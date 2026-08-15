export interface RerankDocument {
  id: string;
  text: string;
  sourceType?: 'document_chunk' | 'graph_entity' | 'graph_relation' | 'semantic_memory' | 'episodic_memory' | 'user_profile' | 'procedural';
  metadata?: Record<string, any>;
  originalScore?: number;
}

export interface RerankResult {
  document: RerankDocument;
  score: number;
  index: number;
}

export interface IRerankProvider {
  /**
   * Rerank a set of retrieved documents against a query
   */
  rerank(query: string, documents: RerankDocument[], topN?: number): Promise<RerankResult[]>;
}
