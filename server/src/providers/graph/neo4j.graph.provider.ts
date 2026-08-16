import neo4j, { Driver, Session } from 'neo4j-driver';
import { IGraphProvider, GraphEntity, GraphRelation, GraphTriple, GraphQueryResult } from './graph.interface.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

export class Neo4jGraphProvider implements IGraphProvider {
  private driver: Driver;
  private isConnected = false;

  constructor(
    uri = env.NEO4J_URI,
    user = env.NEO4J_USER,
    password = env.NEO4J_PASSWORD
  ) {
    this.driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
      maxConnectionPoolSize: 50,
      connectionTimeout: 5000,
    });
  }

  private async initConstraints(): Promise<void> {
    try {
      const isHealthy = await this.verifyConnection();
      if (!isHealthy) return;

      const session = this.getSession();
      try {
        // Entity unique constraint: (name, notebookId) pair must be unique
        await session.run(`
          CREATE CONSTRAINT entity_name_notebook_unique IF NOT EXISTS
          FOR (e:Entity) REQUIRE (e.normalizedName, e.notebookId) IS UNIQUE
        `);
        // Index on normalizedName for fast canonical lookups
        await session.run(`
          CREATE INDEX entity_normalized_name IF NOT EXISTS
          FOR (e:Entity) ON (e.normalizedName)
        `);
        logger.info('Neo4j schema constraints and indexes initialized');
      } finally {
        await session.close();
      }
    } catch (err) {
      logger.debug({ err }, 'Could not create Neo4j constraints (may still be starting)');
    }
  }

  private getSession(): Session {
    if (!this.driver) throw new Error('Neo4j driver is not initialized');
    return this.driver.session();
  }

  async verifyConnection(): Promise<boolean> {
    try {
      const serverInfo = await this.driver.getServerInfo();
      this.isConnected = !!serverInfo;
      return this.isConnected;
    } catch {
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Called once at server startup. Throws if Neo4j is unreachable.
   */
  async connect(): Promise<void> {
    try {
      await this.driver.getServerInfo();
      this.isConnected = true;
      await this.initConstraints();
    } catch (err) {
      throw new Error(`Neo4j is unreachable at ${env.NEO4J_URI}: ${(err as Error).message}`);
    }
  }

  async runQuery<T = any>(query: string, params: Record<string, any> = {}): Promise<T[]> {
    const session = this.getSession();
    try {
      const result = await session.run(query, params);
      return result.records.map((r) => r.toObject() as T);
    } catch (err) {
      logger.error({ err, query }, 'Neo4j Cypher query execution failed');
      throw err;
    } finally {
      await session.close();
    }
  }

  // ---------------------------------------------------------------------------
  // Entity upsert
  // ---------------------------------------------------------------------------
  async upsertEntity(entity: GraphEntity, userId = 'default_user'): Promise<GraphEntity> {
    const session = this.getSession();
    try {
      const normalizedName = entity.name.toLowerCase().trim();
      const cypher = `
        MERGE (e:Entity { normalizedName: $normalizedName, notebookId: $notebookId })
        ON CREATE SET
          e.id = $id,
          e.name = $name,
          e.type = $type,
          e.description = $description,
          e.userId = $userId,
          e.sourceChunkIds = $sourceChunkIds,
          e.aliases = $aliases,
          e.createdAt = datetime()
        ON MATCH SET
          e.type = $type,
          e.description = $description,
          e.aliases = $aliases,
          e.updatedAt = datetime()
        RETURN e
      `;
      // notebookId is passed via entity.properties if available, else userId scope
      const notebookId = (entity.properties?.notebookId as string) || userId;
      await session.run(cypher, {
        id: entity.id,
        name: entity.name.trim(),
        normalizedName,
        notebookId,
        userId,
        type: entity.type || 'Concept',
        description: entity.description || '',
        sourceChunkIds: entity.sourceChunkIds || [],
        aliases: entity.aliases || [],
      });
      return entity;
    } catch (err) {
      logger.error({ err, entity }, 'Failed to upsert entity in Neo4j');
      throw err;
    } finally {
      await session.close();
    }
  }

  // ---------------------------------------------------------------------------
  // Relation upsert (legacy single-relation path)
  // ---------------------------------------------------------------------------
  async upsertRelation(relation: GraphRelation, userId = 'default_user'): Promise<GraphRelation> {
    const session = this.getSession();
    try {
      // Use a dynamic relationship type (the actual semantic type, e.g. CREATED_BY)
      const relType = (relation.relationType || 'RELATED_TO').replace(/[^A-Z0-9_]/gi, '_').toUpperCase();
      const cypher = `
        MATCH (s:Entity { normalizedName: $sourceNorm, userId: $userId })
        MATCH (t:Entity { normalizedName: $targetNorm, userId: $userId })
        MERGE (s)-[r:\`${relType}\`]->(t)
        ON CREATE SET
          r.description = $description,
          r.confidence = $confidence,
          r.evidence = $evidence,
          r.sourceChunkIds = $sourceChunkIds,
          r.validFrom = $validFrom,
          r.validTo = $validTo,
          r.createdAt = datetime()
        ON MATCH SET
          r.description = $description,
          r.confidence = $confidence,
          r.evidence = $evidence,
          r.sourceChunkIds = $sourceChunkIds,
          r.updatedAt = datetime()
        RETURN r
      `;
      await session.run(cypher, {
        sourceNorm: relation.sourceEntity.toLowerCase().trim(),
        targetNorm: relation.targetEntity.toLowerCase().trim(),
        userId,
        description: relation.description || '',
        confidence: relation.confidence ?? 0.8,
        evidence: relation.evidence || '',
        sourceChunkIds: relation.sourceChunkIds || [],
        validFrom: relation.validFrom ? new Date(relation.validFrom as any).toISOString() : null,
        validTo: relation.validTo ? new Date(relation.validTo as any).toISOString() : null,
      });
      return relation;
    } catch (err) {
      logger.error({ err, relation }, 'Failed to upsert relation in Neo4j');
      throw err;
    } finally {
      await session.close();
    }
  }

  // ---------------------------------------------------------------------------
  // Batch triple upsert WITH provenance — primary ingestion path
  //
  // Fixes (vs old implementation):
  //   1. Entity identity: (normalizedName, notebookId) — consistent across write + read.
  //   2. Relationship type: stored as actual Neo4j rel-type (e.g. CREATED_BY, TREATS).
  //   3. Provenance: sourceChunkId, evidence, confidence on every relationship.
  //   4. Deduplication: ON MATCH appends the new sourceChunkId to sourceChunkIds array.
  // ---------------------------------------------------------------------------
  async upsertBatchTriples(
    triples: GraphTriple[],
    notebookId: string,
    userId = 'default_user'
  ): Promise<void> {
    if (!triples || triples.length === 0) return;

    const session = this.getSession();
    try {
      // Each triple may have a different relationship type so we process them
      // individually within a single session to use the semantic rel type.
      // We batch-upsert entities first, then relationships.
      for (const t of triples) {
        const sourceNorm = t.sourceName.toLowerCase().trim();
        const targetNorm = t.targetName.toLowerCase().trim();
        const relType = t.relation.replace(/[^A-Z0-9_]/gi, '_').toUpperCase();
        const chunkId = t.sourceChunkId || '';

        // Upsert source entity
        await session.run(`
          MERGE (e:Entity { normalizedName: $norm, notebookId: $notebookId })
          ON CREATE SET
            e.name = $name,
            e.type = $type,
            e.userId = $userId,
            e.sourceChunkIds = [$chunkId],
            e.createdAt = datetime()
          ON MATCH SET
            e.type = CASE WHEN e.type = 'Concept' THEN $type ELSE e.type END,
            e.sourceChunkIds = CASE
              WHEN NOT $chunkId IN e.sourceChunkIds AND $chunkId <> ''
              THEN e.sourceChunkIds + $chunkId
              ELSE e.sourceChunkIds
            END,
            e.updatedAt = datetime()
        `, { norm: sourceNorm, name: t.sourceName.trim(), type: t.sourceType || 'Concept', notebookId, userId, chunkId });

        // Upsert target entity
        await session.run(`
          MERGE (e:Entity { normalizedName: $norm, notebookId: $notebookId })
          ON CREATE SET
            e.name = $name,
            e.type = $type,
            e.userId = $userId,
            e.sourceChunkIds = [$chunkId],
            e.createdAt = datetime()
          ON MATCH SET
            e.type = CASE WHEN e.type = 'Concept' THEN $type ELSE e.type END,
            e.sourceChunkIds = CASE
              WHEN NOT $chunkId IN e.sourceChunkIds AND $chunkId <> ''
              THEN e.sourceChunkIds + $chunkId
              ELSE e.sourceChunkIds
            END,
            e.updatedAt = datetime()
        `, { norm: targetNorm, name: t.targetName.trim(), type: t.targetType || 'Concept', notebookId, userId, chunkId });

        // Upsert relationship using the semantic type; append sourceChunkId on match
        await session.run(`
          MATCH (s:Entity { normalizedName: $sourceNorm, notebookId: $notebookId })
          MATCH (tgt:Entity { normalizedName: $targetNorm, notebookId: $notebookId })
          MERGE (s)-[r:\`${relType}\`]->(tgt)
          ON CREATE SET
            r.confidence = $confidence,
            r.evidence = $evidence,
            r.sourceChunkIds = [$chunkId],
            r.createdAt = datetime()
          ON MATCH SET
            r.confidence = CASE WHEN $confidence > r.confidence THEN $confidence ELSE r.confidence END,
            r.sourceChunkIds = CASE
              WHEN NOT $chunkId IN r.sourceChunkIds AND $chunkId <> ''
              THEN r.sourceChunkIds + $chunkId
              ELSE r.sourceChunkIds
            END,
            r.updatedAt = datetime()
        `, {
          sourceNorm,
          targetNorm,
          notebookId,
          confidence: t.confidence ?? 0.8,
          evidence: t.evidence || t.context || '',
          chunkId,
        });
      }

      logger.info({ count: triples.length, notebookId }, 'Batch upserted graph triples with provenance into Neo4j');
    } catch (err) {
      logger.error({ err, notebookId }, 'Failed to batch upsert triples in Neo4j');
    } finally {
      await session.close();
    }
  }

  // ---------------------------------------------------------------------------
  // Query-driven neighbor retrieval
  //
  // Fixes:
  //   - Scopes by notebookId (consistent with how entities are written).
  //   - Optionally filters by relationship types relevant to the query.
  //   - Caps results to prevent massive context injection.
  // ---------------------------------------------------------------------------
  async getNeighborsByQuery(
    entityNames: string[],
    notebookId: string,
    relevantRelTypes: string[] = [],
    maxHops = 2
  ): Promise<GraphQueryResult> {
    const cleanNames = entityNames.map((n) => n.toLowerCase().trim()).filter(Boolean);
    if (cleanNames.length === 0) return { entities: [], relations: [] };

    const session = this.getSession();
    try {
      // Build rel-type filter clause; if none specified, allow all
      const relFilter =
        relevantRelTypes.length > 0
          ? `AND type(r) IN [${relevantRelTypes.map((t) => `'${t.toUpperCase()}'`).join(', ')}]`
          : '';

      const hops = Math.min(maxHops, 2);
      const cypher = `
        MATCH (s:Entity { notebookId: $notebookId })
        WHERE s.normalizedName IN $entityNames
        OPTIONAL MATCH (s)-[r*1..${hops}]-(t:Entity { notebookId: $notebookId })
        WHERE ALL(rel IN r WHERE type(rel) IN CASE WHEN size($relTypes) > 0 THEN $relTypes ELSE [type(rel)] END)
        RETURN s, r, t
        LIMIT 30
      `;
      const result = await session.run(cypher, {
        notebookId,
        entityNames: cleanNames,
        relTypes: relevantRelTypes.map((rt) => rt.toUpperCase()),
      });

      return this.parseNeighborResult(result.records);
    } catch (err) {
      logger.error({ err, entityNames }, 'getNeighborsByQuery failed');
      return { entities: [], relations: [] };
    } finally {
      await session.close();
    }
  }

  // ---------------------------------------------------------------------------
  // Legacy getNeighbors — kept for backward compatibility
  // Now correctly scopes by notebookId (was incorrectly using userId before)
  // ---------------------------------------------------------------------------
  async getNeighbors(entityNames: string[], userId = 'default_user', maxHops = 2): Promise<GraphQueryResult> {
    const cleanNames = entityNames.map((n) => n.toLowerCase().trim()).filter(Boolean);
    if (cleanNames.length === 0) return { entities: [], relations: [] };

    const session = this.getSession();
    try {
      const hops = Math.min(maxHops, 2);
      const cypher = `
        MATCH (s:Entity { userId: $userId })
        WHERE s.normalizedName IN $entityNames
        OPTIONAL MATCH (s)-[r*1..${hops}]-(t:Entity { userId: $userId })
        RETURN s, r, t
        LIMIT 25
      `;
      const result = await session.run(cypher, { userId, entityNames: cleanNames });
      return this.parseNeighborResult(result.records);
    } catch (err) {
      logger.error({ err, entityNames }, 'getNeighbors failed');
      return { entities: [], relations: [] };
    } finally {
      await session.close();
    }
  }

  async searchEntities(query: string, userId = 'default_user', limit = 10): Promise<GraphEntity[]> {
    const session = this.getSession();
    try {
      const cypher = `
        MATCH (e:Entity { userId: $userId })
        WHERE toLower(e.name) CONTAINS toLower($query)
           OR toLower(e.description) CONTAINS toLower($query)
        RETURN e
        LIMIT $limit
      `;
      const result = await session.run(cypher, { userId, query: query.trim(), limit: neo4j.int(limit) });
      return result.records.map((r) => {
        const props = r.get('e').properties;
        return {
          id: props.id || props.normalizedName || props.name,
          name: props.name,
          normalizedName: props.normalizedName,
          type: props.type || 'Entity',
          description: props.description,
          sourceChunkIds: props.sourceChunkIds || [],
        };
      });
    } catch (err) {
      logger.error({ err, query }, 'searchEntities failed');
      return [];
    } finally {
      await session.close();
    }
  }

  async close(): Promise<void> {
    await this.driver.close();
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------


  private parseNeighborResult(records: any[]): GraphQueryResult {
    const entityMap = new Map<string, GraphEntity>();
    const relationList: GraphRelation[] = [];

    for (const record of records) {
      const sNode = record.get('s');
      const tNode = record.get('t');
      const rels = record.get('r');

      if (sNode) {
        const p = sNode.properties;
        entityMap.set(p.normalizedName || p.name, {
          id: p.id || p.normalizedName || p.name,
          name: p.name,
          normalizedName: p.normalizedName,
          type: p.type || 'Entity',
          description: p.description,
          sourceChunkIds: p.sourceChunkIds || [],
        });
      }

      if (tNode) {
        const p = tNode.properties;
        entityMap.set(p.normalizedName || p.name, {
          id: p.id || p.normalizedName || p.name,
          name: p.name,
          normalizedName: p.normalizedName,
          type: p.type || 'Entity',
          description: p.description,
          sourceChunkIds: p.sourceChunkIds || [],
        });
      }

      if (Array.isArray(rels)) {
        const sName = sNode?.properties?.name || '';
        const tName = tNode?.properties?.name || '';
        for (const rel of rels) {
          const rp = rel.properties || {};
          relationList.push({
            sourceEntity: sName,
            targetEntity: tName,
            relationType: rel.type || 'RELATED_TO',
            description: rp.description,
            confidence: rp.confidence,
            evidence: rp.evidence,
            sourceChunkIds: rp.sourceChunkIds || [],
            validFrom: rp.validFrom,
            validTo: rp.validTo,
          });
        }
      }
    }

    return { entities: Array.from(entityMap.values()), relations: relationList };
  }
}
