export interface GraphEntity {
  id: string;
  name: string;
  /** Canonical lowercased identifier used for deduplication (e.g. "openai"). */
  normalizedName?: string;
  type: string;
  description?: string;
  properties?: Record<string, any>;
  /** Chunk IDs from which this entity was extracted. */
  sourceChunkIds?: string[];
  aliases?: string[];
  createdAt?: string | Date;
}

export interface GraphRelation {
  id?: string;
  sourceEntity: string;
  targetEntity: string;
  relationType: string;
  description?: string;
  /** Confidence score 0–1 for this relationship (reject below 0.60). */
  confidence?: number;
  /** Direct evidence quote from the source chunk supporting this relationship. */
  evidence?: string;
  /** All chunk IDs that support this relationship (for provenance + deduplication). */
  sourceChunkIds?: string[];
  properties?: Record<string, any>;
  validFrom?: string | Date;
  validTo?: string | Date;
}

export interface GraphTriple {
  sourceName: string;
  sourceType?: string;
  relation: string;
  targetName: string;
  targetType?: string;
  context?: string;
  /** Confidence score 0–1 (LLM-generated). Required for insertion. */
  confidence?: number;
  /** Direct evidence quote from the source chunk. Required for insertion. */
  evidence?: string;
  /** Chunk ID this triple was extracted from. */
  sourceChunkId?: string;
}

export interface GraphQueryResult {
  entities: GraphEntity[];
  relations: GraphRelation[];
}

export interface IGraphProvider {
  /** Verify graph database connectivity. */
  verifyConnection(): Promise<boolean>;

  /** Called at server startup — throws if Neo4j is unreachable. */
  connect(): Promise<void>;

  /** Run a raw parameterized Cypher query. */
  runQuery<T = any>(query: string, params?: Record<string, any>): Promise<T[]>;

  /** Upsert an entity node into the knowledge graph. */
  upsertEntity(entity: GraphEntity, userId?: string): Promise<GraphEntity>;

  /** Upsert a directed relationship between two entity nodes. */
  upsertRelation(relation: GraphRelation, userId?: string): Promise<GraphRelation>;

  /**
   * Batch upsert triples with full provenance (confidence, evidence, sourceChunkId).
   * Replaces the old upsertBatchTriples signature.
   */
  upsertBatchTriples(
    triples: GraphTriple[],
    memorybookId: string,
    userId?: string
  ): Promise<void>;

  /**
   * Query entity neighbors filtered to relationship types relevant to the user query.
   * More precise than getNeighbors — avoids returning the entire entity neighborhood.
   */
  getNeighborsByQuery(
    entityNames: string[],
    memorybookId: string,
    relevantRelTypes?: string[],
    maxHops?: number
  ): Promise<GraphQueryResult>;

  /** Legacy neighbor lookup — retained for backwards compatibility. */
  getNeighbors(entityNames: string[], userId?: string, maxHops?: number): Promise<GraphQueryResult>;

  /** Search entities by keyword or fuzzy string. */
  searchEntities(query: string, userId?: string, limit?: number): Promise<GraphEntity[]>;

  /** Close driver connections. */
  close(): Promise<void>;
}
