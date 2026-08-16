import { CognitiveMemoryBundle } from './memory/cognitive-memory.types.js';
import { logger } from '../utils/logger.js';

export interface FormattedMemoryContext {
  /** Structured, section-labelled context for the LLM system prompt. */
  formattedContext: string;
  userProfileContext: string;
  proceduralContext: string;
}

export class ContextBuilderService {
  /**
   * Formats candidate documents from across memory layers into a
   * structured context string with clearly labelled sections:
   *
   *   [DOCUMENT SOURCES]
   *   [GRAPH FACTS]
   *   [PAST SESSION MEMORY]
   *
   * This prevents the LLM from confusing source content with user memory or
   * graph inferences.
   */
  buildContext(bundle: CognitiveMemoryBundle): FormattedMemoryContext {
    const sections: string[] = [];

    // --- DOCUMENT SOURCES ---
    if (bundle.knowledgeChunks && bundle.knowledgeChunks.length > 0) {
      const docLines = bundle.knowledgeChunks.map((chunk, i) => {
        const heading = chunk.heading ? ` [${chunk.heading}]` : '';
        const section = chunk.sectionPath ? ` (${chunk.sectionPath})` : '';
        const score = chunk.bm25Score != null ? ` | BM25: ${chunk.bm25Score.toFixed(3)}` : '';
        return `[Source ${i + 1}${heading}${section}${score}]\n${chunk.content}`;
      });
      sections.push(`[DOCUMENT SOURCES]\n${docLines.join('\n\n')}`);
    }

    // --- GRAPH FACTS ---
    if (bundle.entityGraph && bundle.entityGraph.length > 0) {
      const graphLines = bundle.entityGraph
        .map((entity) => {
          const relLines = entity.connectedEntities
            .map((r) => {
              const conf = r.confidence != null ? ` [conf: ${r.confidence.toFixed(2)}]` : '';
              const ev = r.evidence ? ` — "${r.evidence}"` : '';
              return `• ${entity.name} ${r.relation} ${r.target}${conf}${ev}`;
            })
            .join('\n');

          return [
            `Entity: ${entity.name} (${entity.entityType})`,
            entity.description ? entity.description : '',
            relLines || '',
          ]
            .filter(Boolean)
            .join('\n');
        })
        .join('\n\n');

      if (graphLines) {
        sections.push(`[GRAPH FACTS]\n${graphLines}`);
      }
    }

    // --- PAST SESSION MEMORY ---
    const memoryLines: string[] = [];
    if (bundle.semanticFacts && bundle.semanticFacts.length > 0) {
      bundle.semanticFacts.forEach((fact) => memoryLines.push(fact.fact));
    }
    if (bundle.episodicMemories && bundle.episodicMemories.length > 0) {
      bundle.episodicMemories.forEach((ep) => memoryLines.push(ep.summary));
    }
    if (memoryLines.length > 0) {
      sections.push(`[PAST SESSION MEMORY]\n${memoryLines.join('\n')}`);
    }

    const formattedContext = sections.join('\n\n---\n\n') || 'No relevant context retrieved.';

    // Separate out user profile and procedural context
    const userProfileContext = bundle.userProfile?.bio
      ? `[USER PROFILE]\n${bundle.userProfile.bio}`
      : '';

    const proceduralContext =
      bundle.proceduralRules && bundle.proceduralRules.length > 0
        ? `[USER FORMATTING RULES]\n${bundle.proceduralRules.map((p) => p.instructions.join('\n')).join('\n')}`
        : '';

    logger.info(
      {
        docCount: bundle.knowledgeChunks.length,
        graphCount: bundle.entityGraph.length,
        memoryCount: memoryLines.length,
      },
      'Formatted cognitive memory context for LLM'
    );

    return { formattedContext, userProfileContext, proceduralContext };
  }
}
