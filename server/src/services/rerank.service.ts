import { RerankFactory } from '../providers/reranker/rerank.factory.js';
import { RerankDocument, RerankResult } from '../providers/reranker/rerank.interface.js';
import { CognitiveMemoryBundle } from './memory/cognitive-memory.types.js';
import { logger } from '../utils/logger.js';

export interface RankedMemoryContext {
  formattedContext: string;
  rankedItems: RerankResult[];
  userProfileContext: string;
  proceduralContext: string;
}

export class RerankService {
  private rerankProvider = RerankFactory.getProvider();

  /**
   * Unifies and reranks knowledge chunks, graph triples, and semantic/episodic facts
   */
  async rerankBundle(query: string, bundle: CognitiveMemoryBundle, topN = 8): Promise<RankedMemoryContext> {
    const candidateDocs: RerankDocument[] = [];

    // 1. Add Knowledge Base document chunks
    for (const chunk of bundle.knowledgeChunks) {
      candidateDocs.push({
        id: `kb_${chunk.chunkId}`,
        text: chunk.content,
        sourceType: 'document_chunk',
        originalScore: chunk.bm25Score,
        metadata: { chunkIndex: chunk.chunkIndex, sourceId: chunk.sourceId },
      });
    }

    // 2. Add Semantic Facts
    for (const fact of bundle.semanticFacts) {
      candidateDocs.push({
        id: `sem_${fact.id}`,
        text: `[Fact] ${fact.fact}`,
        sourceType: 'semantic_memory',
        originalScore: fact.confidence,
      });
    }

    // 3. Add Entity Graph Nodes & Relations
    for (const entity of bundle.entityGraph) {
      const rels = entity.connectedEntities
        .map((r) => `${r.relation} -> ${r.target}${r.description ? ` (${r.description})` : ''}`)
        .join(', ');
      const text = `[Entity: ${entity.name} (${entity.entityType})] ${entity.description || ''}${rels ? ` | Relations: ${rels}` : ''}`;
      candidateDocs.push({
        id: `graph_${entity.name}`,
        text,
        sourceType: 'graph_entity',
        originalScore: 0.85,
      });
    }

    // 4. Add Episodic Memories
    for (const ep of bundle.episodicMemories) {
      candidateDocs.push({
        id: `ep_${ep.id}`,
        text: `[Past Session] ${ep.summary}`,
        sourceType: 'episodic_memory',
        originalScore: 0.75,
      });
    }

    // Execute reranking
    const rankedItems = await this.rerankProvider.rerank(query, candidateDocs, topN);

    // Format top ranked context string for system prompt injection
    const formattedContext = rankedItems
      .map((r, i) => `[Context #${i + 1} (${r.document.sourceType}) | Score: ${r.score}]\n${r.document.text}`)
      .join('\n\n');

    // Format User Profile & Procedural instructions
    const userProfileContext = bundle.userProfile?.bio ? `[User Profile & Persona]\n${bundle.userProfile.bio}` : '';
    const proceduralContext =
      bundle.proceduralRules.length > 0
        ? `[User Rules & Procedural Directives]\n${bundle.proceduralRules.map((p) => p.instructions.join('\n')).join('\n')}`
        : '';

    logger.info(
      { totalCandidates: candidateDocs.length, rankedCount: rankedItems.length },
      'Reranked hybrid cognitive memory context'
    );

    return {
      formattedContext,
      rankedItems,
      userProfileContext,
      proceduralContext,
    };
  }
}
