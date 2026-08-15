import neo4j, { Driver, Session } from 'neo4j-driver';
import { IGraphProvider, GraphEntity, GraphRelation, GraphQueryResult } from './graph.interface.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

export class Neo4jGraphProvider implements IGraphProvider {
  private driver: Driver | null = null;
  private isConnected = false;

  // In-memory graph fallback if Neo4j container is not running during local dev
  private fallbackEntities: Map<string, GraphEntity> = new Map();
  private fallbackRelations: GraphRelation[] = [];

  constructor(
    uri = env.NEO4J_URI,
    user = env.NEO4J_USER,
    password = env.NEO4J_PASSWORD
  ) {
    try {
      this.driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
        maxConnectionPoolSize: 50,
        connectionTimeout: 5000,
      });
      this.initConstraints();
    } catch (err) {
      logger.warn({ err }, 'Failed to initialize Neo4j driver, falling back to embedded graph store');
    }
  }

  private async initConstraints(): Promise<void> {
    try {
      const isHealthy = await this.verifyConnection();
      if (!isHealthy) return;

      const session = this.getSession();
      try {
        await session.run(`
          CREATE CONSTRAINT entity_id_unique IF NOT EXISTS
          FOR (e:Entity) REQUIRE e.id IS UNIQUE
        `);
        logger.info('Neo4j schema constraints initialized successfully');
      } finally {
        await session.close();
      }
    } catch (err) {
      logger.debug({ err }, 'Could not create Neo4j constraints (container may still be starting)');
    }
  }

  private getSession(): Session {
    if (!this.driver) throw new Error('Neo4j driver is not initialized');
    return this.driver.session();
  }

  async verifyConnection(): Promise<boolean> {
    if (!this.driver) return false;
    try {
      const serverInfo = await this.driver.getServerInfo();
      this.isConnected = !!serverInfo;
      return this.isConnected;
    } catch (error) {
      this.isConnected = false;
      return false;
    }
  }

  async runQuery<T = any>(query: string, params: Record<string, any> = {}): Promise<T[]> {
    const isHealthy = await this.verifyConnection();
    if (!isHealthy) {
      logger.debug('Neo4j offline, returning empty query result');
      return [];
    }

    const session = this.getSession();
    try {
      const result = await session.run(query, params);
      return result.records.map((r) => r.toObject() as T);
    } catch (err) {
      logger.error({ err, query }, 'Neo4j Cypher query execution failed');
      return [];
    } finally {
      await session.close();
    }
  }

  async upsertEntity(entity: GraphEntity, userId = 'default_user'): Promise<GraphEntity> {
    const isHealthy = await this.verifyConnection();
    if (!isHealthy) {
      this.fallbackEntities.set(entity.name.toLowerCase(), entity);
      return entity;
    }

    const session = this.getSession();
    try {
      const cypher = `
        MERGE (e:Entity { name: $name, userId: $userId })
        ON CREATE SET 
          e.id = $id,
          e.type = $type,
          e.description = $description,
          e.properties = $properties,
          e.createdAt = datetime()
        ON MATCH SET
          e.type = $type,
          e.description = $description,
          e.updatedAt = datetime()
        RETURN e
      `;
      await session.run(cypher, {
        id: entity.id,
        name: entity.name.trim(),
        userId,
        type: entity.type || 'Concept',
        description: entity.description || '',
        properties: JSON.stringify(entity.properties || {}),
      });
      return entity;
    } catch (err) {
      logger.error({ err, entity }, 'Failed to upsert entity in Neo4j');
      this.fallbackEntities.set(entity.name.toLowerCase(), entity);
      return entity;
    } finally {
      await session.close();
    }
  }

  async upsertRelation(relation: GraphRelation, userId = 'default_user'): Promise<GraphRelation> {
    const isHealthy = await this.verifyConnection();
    if (!isHealthy) {
      this.fallbackRelations.push(relation);
      return relation;
    }

    const session = this.getSession();
    try {
      const cypher = `
        MATCH (s:Entity { name: $sourceEntity, userId: $userId })
        MATCH (t:Entity { name: $targetEntity, userId: $userId })
        MERGE (s)-[r:RELATION { type: $relationType }]->(t)
        ON CREATE SET
          r.description = $description,
          r.validFrom = $validFrom,
          r.validTo = $validTo,
          r.createdAt = datetime()
        ON MATCH SET
          r.description = $description,
          r.validFrom = $validFrom,
          r.validTo = $validTo,
          r.updatedAt = datetime()
        RETURN r
      `;
      await session.run(cypher, {
        sourceEntity: relation.sourceEntity.trim(),
        targetEntity: relation.targetEntity.trim(),
        userId,
        relationType: relation.relationType || 'RELATED_TO',
        description: relation.description || '',
        validFrom: relation.validFrom ? new Date(relation.validFrom).toISOString() : null,
        validTo: relation.validTo ? new Date(relation.validTo).toISOString() : null,
      });
      return relation;
    } catch (err) {
      logger.error({ err, relation }, 'Failed to upsert relation in Neo4j');
      this.fallbackRelations.push(relation);
      return relation;
    } finally {
      await session.close();
    }
  }

  async upsertBatchTriples(
    triples: { sourceName: string; sourceType?: string; relation: string; targetName: string; targetType?: string; context?: string }[],
    notebookId: string,
    userId = 'default_user'
  ): Promise<void> {
    if (!triples || triples.length === 0) return;

    const isHealthy = await this.verifyConnection();
    if (!isHealthy) {
      for (const t of triples) {
        this.fallbackEntities.set(t.sourceName.toLowerCase(), {
          id: t.sourceName,
          name: t.sourceName,
          type: t.sourceType || 'Concept',
          description: t.context,
        });
        this.fallbackEntities.set(t.targetName.toLowerCase(), {
          id: t.targetName,
          name: t.targetName,
          type: t.targetType || 'Concept',
          description: t.context,
        });
        this.fallbackRelations.push({
          sourceEntity: t.sourceName,
          targetEntity: t.targetName,
          relationType: t.relation,
          description: t.context,
        });
      }
      return;
    }

    const session = this.getSession();
    try {
      const cypher = `
        UNWIND $triples AS t
        MERGE (n:Notebook { id: $notebookId })
          ON CREATE SET n.userId = $userId, n.createdAt = datetime()
        MERGE (s:Entity { name: t.sourceName, notebookId: $notebookId })
          ON CREATE SET s.type = coalesce(t.sourceType, 'Concept'), s.createdAt = datetime()
        MERGE (tgt:Entity { name: t.targetName, notebookId: $notebookId })
          ON CREATE SET tgt.type = coalesce(t.targetType, 'Concept'), tgt.createdAt = datetime()
        MERGE (s)-[r:RELATED_TO { relation: t.relation, notebookId: $notebookId }]->(tgt)
          ON CREATE SET r.context = t.context, r.createdAt = datetime()
        MERGE (n)-[:HAS_ENTITY]->(s)
        MERGE (n)-[:HAS_ENTITY]->(tgt)
      `;
      await session.run(cypher, {
        triples,
        notebookId,
        userId,
      });
      logger.info({ count: triples.length, notebookId }, 'Batch ingested knowledge graph triples into Neo4j');
    } catch (err) {
      logger.error({ err, notebookId }, 'Failed to batch upsert triples in Neo4j');
    } finally {
      await session.close();
    }
  }

  async getNeighbors(entityNames: string[], userId = 'default_user', maxHops = 2): Promise<GraphQueryResult> {
    const cleanNames = entityNames.map((n) => n.trim().toLowerCase()).filter(Boolean);
    if (cleanNames.length === 0) return { entities: [], relations: [] };

    const isHealthy = await this.verifyConnection();
    if (!isHealthy) {
      const foundEntities: GraphEntity[] = [];
      const foundRelations: GraphRelation[] = [];
      for (const name of cleanNames) {
        const ent = this.fallbackEntities.get(name);
        if (ent) foundEntities.push(ent);
      }
      for (const rel of this.fallbackRelations) {
        if (
          cleanNames.includes(rel.sourceEntity.toLowerCase()) ||
          cleanNames.includes(rel.targetEntity.toLowerCase())
        ) {
          foundRelations.push(rel);
        }
      }
      return { entities: foundEntities, relations: foundRelations };
    }

    const session = this.getSession();
    try {
      const cypher = `
        MATCH (s:Entity { userId: $userId })
        WHERE toLower(s.name) IN $entityNames
        OPTIONAL MATCH (s)-[r:RELATION*1..${Math.min(maxHops, 2)}]-(t:Entity { userId: $userId })
        RETURN s, r, t
        LIMIT 25
      `;
      const result = await session.run(cypher, {
        userId,
        entityNames: cleanNames,
      });

      const entityMap = new Map<string, GraphEntity>();
      const relationList: GraphRelation[] = [];

      for (const record of result.records) {
        const sNode = record.get('s');
        const tNode = record.get('t');
        const rels = record.get('r');

        if (sNode) {
          const sProps = sNode.properties;
          entityMap.set(sProps.name, {
            id: sProps.id || sProps.name,
            name: sProps.name,
            type: sProps.type || 'Entity',
            description: sProps.description,
          });
        }

        if (tNode) {
          const tProps = tNode.properties;
          entityMap.set(tProps.name, {
            id: tProps.id || tProps.name,
            name: tProps.name,
            type: tProps.type || 'Entity',
            description: tProps.description,
          });
        }

        if (Array.isArray(rels)) {
          for (const rel of rels) {
            relationList.push({
              sourceEntity: sNode?.properties?.name || '',
              targetEntity: tNode?.properties?.name || '',
              relationType: rel.properties?.type || rel.type || 'RELATED_TO',
              description: rel.properties?.description,
              validFrom: rel.properties?.validFrom,
              validTo: rel.properties?.validTo,
            });
          }
        }
      }

      return {
        entities: Array.from(entityMap.values()),
        relations: relationList,
      };
    } catch (err) {
      logger.error({ err, entityNames }, 'Failed to get graph neighbors from Neo4j');
      return { entities: [], relations: [] };
    } finally {
      await session.close();
    }
  }

  async searchEntities(query: string, userId = 'default_user', limit = 10): Promise<GraphEntity[]> {
    const isHealthy = await this.verifyConnection();
    if (!isHealthy) {
      const q = query.toLowerCase();
      return Array.from(this.fallbackEntities.values())
        .filter((e) => e.name.toLowerCase().includes(q) || e.description?.toLowerCase().includes(q))
        .slice(0, limit);
    }

    const session = this.getSession();
    try {
      const cypher = `
        MATCH (e:Entity { userId: $userId })
        WHERE toLower(e.name) CONTAINS toLower($query) 
           OR toLower(e.description) CONTAINS toLower($query)
        RETURN e
        LIMIT $limit
      `;
      const result = await session.run(cypher, {
        userId,
        query: query.trim(),
        limit: neo4j.int(limit),
      });

      return result.records.map((r) => {
        const props = r.get('e').properties;
        return {
          id: props.id || props.name,
          name: props.name,
          type: props.type || 'Entity',
          description: props.description,
        };
      });
    } catch (err) {
      logger.error({ err, query }, 'Failed to search entities in Neo4j');
      return [];
    } finally {
      await session.close();
    }
  }

  async close(): Promise<void> {
    if (this.driver) {
      await this.driver.close();
    }
  }
}
