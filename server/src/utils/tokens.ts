/**
 * Token counting heuristic: 1 token ≈ 4 characters (GPT-family average).
 * Avoids pulling in a tokenizer library — good enough for chunk-sizing
 * (chunking.service.ts) and context-budget trimming (context-builder.service.ts),
 * neither of which need exact token counts, just a consistent approximation.
 */
export function approxTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}
