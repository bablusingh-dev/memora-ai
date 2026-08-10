import { NotebookRepository } from '../repositories/notebook.repository.js';
import { logger } from '../utils/logger.js';

export class RagService {
  private notebookRepo: NotebookRepository;

  constructor() {
    this.notebookRepo = new NotebookRepository();
  }

  /**
   * Vectorless RAG Retrieval powered by ParadeDB BM25 search
   */
  async retrieveContext(notebookId: string, query: string, topK = 5) {
    logger.info({ notebookId, query, topK }, 'Executing ParadeDB BM25 vectorless RAG search');
    
    const chunks = await this.notebookRepo.searchBM25(notebookId, query, topK);

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
