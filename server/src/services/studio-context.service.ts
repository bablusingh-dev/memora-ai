import { SourceRepository } from '../repositories/source.repository.js';
import { approxTokenCount } from '../utils/tokens.js';

/**
 * Token budget for the source text handed to a Studio artifact generator
 * (Flashcards, and future output kinds). Deliberately a plain constant, not
 * an env var — no configurability was requested and MAX_CONTEXT_TOKENS
 * (env.ts) is a different, unrelated budget for chat context assembly.
 */
const STUDIO_CONTEXT_TOKEN_BUDGET = 6000;

export interface StudioContext {
  /** All accumulated chunk text, ready to drop into a generation prompt. */
  formattedText: string;
  chunkCount: number;
}

const sourceRepo = new SourceRepository();

/**
 * Builds a coherent, token-budgeted read of "everything in this memorybook"
 * for Studio artifact generation (e.g. Flashcards) — distinct from
 * context-builder.service.ts, which formats query-ranked chunks + graph
 * facts + memory for the *chat* agent. This is deliberately simpler: no
 * graph/memory layers, just chunk text in document order, trimmed to a
 * fixed budget.
 */
export async function buildStudioContext(memorybookId: string): Promise<StudioContext> {
  const chunks = await sourceRepo.findChunksByMemorybookId(memorybookId);

  let budget = STUDIO_CONTEXT_TOKEN_BUDGET;
  const parts: string[] = [];
  let chunkCount = 0;

  for (const chunk of chunks) {
    const text = chunk.retrievalContent || chunk.content;
    if (!text) continue;
    const tokens = approxTokenCount(text);
    if (tokens > budget) break;
    parts.push(text);
    budget -= tokens;
    chunkCount += 1;
  }

  return { formattedText: parts.join('\n\n---\n\n'), chunkCount };
}
