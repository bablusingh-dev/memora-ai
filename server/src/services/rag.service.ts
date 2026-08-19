import { MemorybookRepository } from '../repositories/memorybook.repository.js';
import { logger } from '../utils/logger.js';

export class RagService {
  private memorybookRepo: MemorybookRepository;

  constructor() {
    this.memorybookRepo = new MemorybookRepository();
  }

  /**
   * Vectorless RAG Retrieval powered by ParadeDB BM25 search
   */
  async retrieveContext(memorybookId: string, query: string, topK = 5) {
    logger.info({ memorybookId, query, topK }, 'Executing ParadeDB BM25 vectorless RAG search');
    
    const chunks = await this.memorybookRepo.searchBM25(memorybookId, query, topK);

    return {
      query,
      retrievedChunksCount: chunks.length,
      chunks: chunks.map((c) => ({
        id: c.id,
        content: c.content,
        score: c.bm25_score,
      })),
    };
  }
}
