export interface GraphEntity {
  id: string;
  name: string;
  type: string;
  description?: string;
  properties?: Record<string, any>;
  createdAt?: string | Date;
}

export interface GraphRelation {
  id?: string;
  sourceEntity: string;
  targetEntity: string;
  relationType: string;
  description?: string;
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
}

export interface GraphQueryResult {
  entities: GraphEntity[];
  relations: GraphRelation[];
}

export interface IGraphProvider {
  /**
   * Verify graph database connectivity
   */
  verifyConnection(): Promise<boolean>;

  /**
   * Run a raw parameterized Cypher query
   */
  runQuery<T = any>(query: string, params?: Record<string, any>): Promise<T[]>;

  /**
   * Upsert an entity node into the knowledge graph
   */
  upsertEntity(entity: GraphEntity, userId?: string): Promise<GraphEntity>;

  /**
   * Upsert a directed relationship between two entity nodes
   */
  upsertRelation(relation: GraphRelation, userId?: string): Promise<GraphRelation>;

  /**
   * Batch upsert triples for a notebook
   */
  upsertBatchTriples(triples: GraphTriple[], notebookId: string, userId?: string): Promise<void>;

  /**
   * Query 1-hop and 2-hop neighbors for given entity names
   */
  getNeighbors(entityNames: string[], userId?: string, maxHops?: number): Promise<GraphQueryResult>;

  /**
   * Search entities by keyword or fuzzy string
   */
  searchEntities(query: string, userId?: string, limit?: number): Promise<GraphEntity[]>;

  /**
   * Close driver connections
   */
  close(): Promise<void>;
}
