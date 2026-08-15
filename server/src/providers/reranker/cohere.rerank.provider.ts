import { IRerankProvider, RerankDocument, RerankResult } from './rerank.interface.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

/**
 * Cohere Rerank API v3.5 Provider
 * Zero-code switchable when RERANKER_PROVIDER=cohere_api
 */
export class CohereRerankProvider implements IRerankProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey = env.COHERE_API_KEY || '', model = 'rerank-v3.5') {
    this.apiKey = apiKey;
    this.model = model;
    if (!this.apiKey) {
      logger.warn('COHERE_API_KEY is not configured while using cohere_api provider');
    }
  }

  async rerank(query: string, documents: RerankDocument[], topN = 5): Promise<RerankResult[]> {
    if (!documents || documents.length === 0) return [];
    if (!this.apiKey) {
      logger.warn('Cohere API key missing, falling back to original document ordering');
      return documents.slice(0, topN).map((doc, index) => ({
        document: doc,
        score: 1.0 - index * 0.05,
        index,
      }));
    }

    try {
      const res = await fetch('https://api.cohere.com/v2/rerank', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          query,
          documents: documents.map((d) => d.text),
          top_n: topN,
        }),
      });

      if (!res.ok) {
        throw new Error(`Cohere API error: ${res.statusText}`);
      }

      const data: any = await res.json();
      const results: RerankResult[] = (data?.results || []).map((r: any) => ({
        document: documents[r.index],
        score: r.relevance_score,
        index: r.index,
      }));

      return results;
    } catch (err) {
      logger.error({ err }, 'Cohere Rerank API call failed, falling back to topN slice');
      return documents.slice(0, topN).map((doc, index) => ({
        document: doc,
        score: 0.5,
        index,
      }));
    }
  }
}
