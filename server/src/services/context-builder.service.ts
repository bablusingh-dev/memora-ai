import { CognitiveMemoryBundle, KnowledgeBaseMemory, EntityGraphMemory } from './memory/cognitive-memory.types.js';
import { approxTokenCount } from '../utils/tokens.js';
import { env } from '../config/env.js';
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
   *
   * Enforces env.MAX_CONTEXT_TOKENS: previously the assembled context could
   * grow unboundedly with enough retrieved chunks/graph facts on a large
   * notebook, risking silently overflowing the model's context window. Both
   * knowledgeChunks and entityGraph already arrive sorted by relevance
   * (highest first), so trimming from the tail drops the least-relevant
   * items first — document chunks are trimmed before graph facts, since
   * they're the more likely (and larger) budget contributor; USER
   * PROFILE/PROCEDURAL/PAST SESSION MEMORY are left untouched (already
   * small, capped at query time by the memory coordinator's per-category
   * limits).
   */
  buildContext(bundle: CognitiveMemoryBundle): FormattedMemoryContext {
    let knowledgeChunks = bundle.knowledgeChunks || [];
    let entityGraph = bundle.entityGraph || [];

    const buildSections = (): string[] => {
      const sections: string[] = [];

      if (knowledgeChunks.length > 0) {
        sections.push(`[DOCUMENT SOURCES]\n${this.formatDocumentSources(knowledgeChunks)}`);
      }

      if (entityGraph.length > 0) {
        const graphLines = this.formatGraphFacts(entityGraph);
        if (graphLines) sections.push(`[GRAPH FACTS]\n${graphLines}`);
      }

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

      return sections;
    };

    let sections = buildSections();
    let formattedContext = sections.join('\n\n---\n\n') || 'No relevant context retrieved.';
    let totalTokens = approxTokenCount(formattedContext);
    let trimmed = false;

    // Trim the lowest-relevance document chunks first (they're the largest
    // and most variable contributor), then graph facts if still over budget.
    while (totalTokens > env.MAX_CONTEXT_TOKENS && knowledgeChunks.length > 1) {
      knowledgeChunks = knowledgeChunks.slice(0, -1);
      trimmed = true;
      sections = buildSections();
      formattedContext = sections.join('\n\n---\n\n') || 'No relevant context retrieved.';
      totalTokens = approxTokenCount(formattedContext);
    }
    while (totalTokens > env.MAX_CONTEXT_TOKENS && entityGraph.length > 0) {
      entityGraph = entityGraph.slice(0, -1);
      trimmed = true;
      sections = buildSections();
      formattedContext = sections.join('\n\n---\n\n') || 'No relevant context retrieved.';
      totalTokens = approxTokenCount(formattedContext);
    }

    if (totalTokens > env.MAX_CONTEXT_TOKENS) {
      logger.warn(
        { totalTokens, maxContextTokens: env.MAX_CONTEXT_TOKENS },
        'Context still exceeds token budget after trimming document sources and graph facts — remaining sections (user profile/procedural/past session memory) are left intact rather than cut further'
      );
    } else if (trimmed) {
      logger.info(
        { totalTokens, maxContextTokens: env.MAX_CONTEXT_TOKENS, keptChunks: knowledgeChunks.length, keptEntities: entityGraph.length },
        'Trimmed retrieved context to fit token budget'
      );
    }

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
        docCount: knowledgeChunks.length,
        graphCount: entityGraph.length,
        totalTokens,
      },
      'Formatted cognitive memory context for LLM'
    );

    return { formattedContext, userProfileContext, proceduralContext };
  }

  private formatDocumentSources(knowledgeChunks: KnowledgeBaseMemory[]): string {
    return knowledgeChunks
      .map((chunk, i) => {
        const heading = chunk.heading ? ` [${chunk.heading}]` : '';
        const section = chunk.sectionPath ? ` (${chunk.sectionPath})` : '';
        const score = chunk.bm25Score != null ? ` | Relevance: ${chunk.bm25Score.toFixed(3)}` : '';
        return `[Source ${i + 1}${heading}${section}${score}]\n${chunk.content}`;
      })
      .join('\n\n');
  }

  private formatGraphFacts(entityGraph: EntityGraphMemory[]): string {
    return entityGraph
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
  }
}
