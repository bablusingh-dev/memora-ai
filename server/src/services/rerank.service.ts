import { RerankFactory } from '../providers/reranker/rerank.factory.js';
import { RerankDocument, RerankResult } from '../providers/reranker/rerank.interface.js';
import { CognitiveMemoryBundle } from './memory/cognitive-memory.types.js';
import { logger } from '../utils/logger.js';

export interface RankedMemoryContext {
  /** Structured, section-labelled context for the LLM system prompt. */
  formattedContext: string;
  rankedItems: RerankResult[];
  userProfileContext: string;
  proceduralContext: string;
}

export class RerankService {
  private rerankProvider = RerankFactory.getProvider();

  /**
   * Reranks all candidate documents from across memory layers, then builds a
   * structured context string with clearly labelled sections:
   *
   *   [DOCUMENT SOURCES]
   *   [GRAPH FACTS]
   *   [CONVERSATION MEMORY]
   *
   * This prevents the LLM from confusing source content with user memory or
   * graph inferences.
   */
  async rerankBundle(query: string, bundle: CognitiveMemoryBundle, topN = 8): Promise<RankedMemoryContext> {
    const candidateDocs: RerankDocument[] = [];

    // --- DOCUMENT layer candidates ---
    for (const chunk of bundle.knowledgeChunks) {
      // Prefer retrieval_content (context-enriched) for reranking to surface section context.
      // Display-side always uses original content.
      const textForRanking = chunk.retrievalContent || chunk.content;
      candidateDocs.push({
        id: `doc_${chunk.chunkId}`,
        text: textForRanking,
        sourceType: 'document_chunk',
        originalScore: chunk.bm25Score,
        metadata: {
          chunkId: chunk.chunkId,
          sourceId: chunk.sourceId,
          chunkIndex: chunk.chunkIndex,
          heading: chunk.heading,
          sectionPath: chunk.sectionPath,
          originalContent: chunk.content,
        },
      });
    }

    // --- GRAPH layer candidates ---
    for (const entity of bundle.entityGraph) {
      const relLines = entity.connectedEntities
        .map((r) => {
          const conf = r.confidence != null ? ` [conf: ${r.confidence.toFixed(2)}]` : '';
          const ev = r.evidence ? ` — "${r.evidence}"` : '';
          return `• ${entity.name} ${r.relation} ${r.target}${conf}${ev}`;
        })
        .join('\n');

      const text = [
        `Entity: ${entity.name} (${entity.entityType})`,
        entity.description ? entity.description : '',
        relLines || '',
      ]
        .filter(Boolean)
        .join('\n');

      candidateDocs.push({
        id: `graph_${entity.name}`,
        text,
        sourceType: 'graph_entity',
        originalScore: 0.85,
        metadata: { entityName: entity.name, sourceChunkIds: entity.sourceChunkIds },
      });
    }

    // --- USER / Semantic layer candidates ---
    for (const fact of bundle.semanticFacts) {
      candidateDocs.push({
        id: `sem_${fact.id}`,
        text: fact.fact,
        sourceType: 'semantic_memory',
        originalScore: fact.confidence,
      });
    }

    // --- EPISODIC candidates ---
    for (const ep of bundle.episodicMemories) {
      candidateDocs.push({
        id: `ep_${ep.id}`,
        text: ep.summary,
        sourceType: 'episodic_memory',
        originalScore: 0.65,
      });
    }

    // Execute reranking across all candidates
    const rankedItems = await this.rerankProvider.rerank(query, candidateDocs, topN);

    // -------------------------------------------------------------------------
    // Build structured context with clearly labelled sections
    // -------------------------------------------------------------------------
    const docItems = rankedItems.filter((r) => r.document.sourceType === 'document_chunk');
    const graphItems = rankedItems.filter((r) => r.document.sourceType === 'graph_entity');
    const memoryItems = rankedItems.filter(
      (r) => r.document.sourceType === 'semantic_memory' || r.document.sourceType === 'episodic_memory'
    );

    const sections: string[] = [];

    if (docItems.length > 0) {
      const docLines = docItems.map((r, i) => {
        const meta = r.document.metadata || {};
        const heading = meta.heading ? ` [${meta.heading}]` : '';
        const section = meta.sectionPath ? ` (${meta.sectionPath})` : '';
        const score = r.score.toFixed(3);
        // Display original (uncontextualized) content to avoid showing the "Document: X / Section: Y" prefix
        const displayText = (meta.originalContent as string) || r.document.text;
        return `[Source ${i + 1}${heading}${section} | Rerank: ${score}]\n${displayText}`;
      });
      sections.push(`[DOCUMENT SOURCES]\n${docLines.join('\n\n')}`);
    }

    if (graphItems.length > 0) {
      const graphLines = graphItems.map((r) => r.document.text).join('\n\n');
      sections.push(`[GRAPH FACTS]\n${graphLines}`);
    }

    if (memoryItems.length > 0) {
      const memLines = memoryItems.map((r) => r.document.text).join('\n');
      sections.push(`[PAST SESSION MEMORY]\n${memLines}`);
    }

    const formattedContext = sections.join('\n\n---\n\n') || 'No relevant context retrieved.';

    // Separate out user profile and procedural context (injected differently in system prompt)
    const userProfileContext = bundle.userProfile?.bio
      ? `[USER PROFILE]\n${bundle.userProfile.bio}`
      : '';

    const proceduralContext =
      bundle.proceduralRules.length > 0
        ? `[USER FORMATTING RULES]\n${bundle.proceduralRules.map((p) => p.instructions.join('\n')).join('\n')}`
        : '';

    logger.info(
      {
        totalCandidates: candidateDocs.length,
        rankedCount: rankedItems.length,
        docCount: docItems.length,
        graphCount: graphItems.length,
        memoryCount: memoryItems.length,
      },
      'Reranked hybrid memory context'
    );

    return { formattedContext, rankedItems, userProfileContext, proceduralContext };
  }
}
