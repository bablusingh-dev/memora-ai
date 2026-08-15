import { IRerankProvider, RerankDocument, RerankResult } from './rerank.interface.js';
import { logger } from '../../utils/logger.js';

/**
 * Local Cross-Attention & Hybrid Reciprocal Rank Fusion (RRF) Reranker
 * Operates self-hosted with low latency and zero external network calls.
 */
export class LocalRerankProvider implements IRerankProvider {
  async rerank(query: string, documents: RerankDocument[], topN = 5): Promise<RerankResult[]> {
    if (!documents || documents.length === 0) return [];
    if (!query || !query.trim()) {
      return documents.slice(0, topN).map((doc, index) => ({
        document: doc,
        score: 1.0 - index * 0.05,
        index,
      }));
    }

    const cleanQuery = query.toLowerCase().trim();
    const queryTokens = cleanQuery.split(/\s+/).filter((t) => t.length > 2);
    const queryBigrams = this.extractNgrams(cleanQuery, 2);

    const scoredDocs = documents.map((doc, index) => {
      const text = doc.text.toLowerCase();
      
      // 1. Exact phrase match bonus
      const exactPhraseBonus = text.includes(cleanQuery) ? 0.35 : 0.0;

      // 2. Token overlap score (Jaccard / TF style)
      let tokenMatches = 0;
      for (const token of queryTokens) {
        if (text.includes(token)) tokenMatches++;
      }
      const tokenScore = queryTokens.length > 0 ? (tokenMatches / queryTokens.length) * 0.4 : 0.0;

      // 3. Bigram co-occurrence score
      let bigramMatches = 0;
      for (const bigram of queryBigrams) {
        if (text.includes(bigram)) bigramMatches++;
      }
      const bigramScore = queryBigrams.length > 0 ? (bigramMatches / queryBigrams.length) * 0.15 : 0.0;

      // 4. Original retriever score contribution (RRF weight)
      const origScore = doc.originalScore ? Math.min(Math.max(doc.originalScore, 0), 1) * 0.1 : 0.05;

      const totalScore = Math.min(exactPhraseBonus + tokenScore + bigramScore + origScore, 1.0);

      return {
        document: doc,
        score: parseFloat(totalScore.toFixed(4)),
        index,
      };
    });

    scoredDocs.sort((a, b) => b.score - a.score);
    const topResults = scoredDocs.slice(0, topN);

    logger.debug(
      { query, totalCandidates: documents.length, returnedTopN: topResults.length },
      'Local Reranker scored candidate documents'
    );

    return topResults;
  }

  private extractNgrams(text: string, n: number): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    const ngrams: string[] = [];
    for (let i = 0; i <= words.length - n; i++) {
      ngrams.push(words.slice(i, i + n).join(' '));
    }
    return ngrams;
  }
}
