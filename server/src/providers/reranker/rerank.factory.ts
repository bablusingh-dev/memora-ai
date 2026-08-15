import { IRerankProvider } from './rerank.interface.js';
import { LocalRerankProvider } from './local.rerank.provider.js';
import { CohereRerankProvider } from './cohere.rerank.provider.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

let rerankInstance: IRerankProvider | null = null;

export class RerankFactory {
  static getProvider(): IRerankProvider {
    if (rerankInstance) return rerankInstance;

    if (env.RERANKER_PROVIDER === 'cohere_api') {
      logger.info('Initializing Cohere API Reranker Provider');
      rerankInstance = new CohereRerankProvider();
    } else {
      logger.info('Initializing Self-Hosted Local Cross-Attention Reranker Provider');
      rerankInstance = new LocalRerankProvider();
    }

    return rerankInstance;
  }

  static setProvider(provider: IRerankProvider): void {
    rerankInstance = provider;
  }
}
