import { generateText, Output } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { StudioContext } from '../studio-context.service.js';

const FlashcardsSchema = z.object({
  cards: z
    .array(
      z.object({
        front: z.string().min(1).describe('The question or term side of the flashcard.'),
        back: z.string().min(1).describe('The answer or definition side of the flashcard.'),
      })
    )
    .min(5)
    .max(20)
    .describe('5 to 20 flashcards covering the most important concepts in the source material.'),
});

export type FlashcardsPayload = z.infer<typeof FlashcardsSchema>;

const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });

/**
 * Structured-output generation, same pattern as query-enhancer.service.ts:
 * generateText's `output: Output.object({ schema })` rather than the
 * deprecated `generateObject`.
 */
export async function generateFlashcards(context: StudioContext): Promise<{ title: string; payload: FlashcardsPayload }> {
  const { output } = await generateText({
    model: openai(env.OPENAI_MODEL),
    output: Output.object({ schema: FlashcardsSchema }),
    prompt: `
You are an expert study-guide author. Read the source material below and produce a set of high-quality flashcards for someone studying it.

RULES:
1. Cover the most important concepts, definitions, and facts — not trivia.
2. Each "front" should be a concise question or term; each "back" should be a clear, self-contained answer.
3. Do not invent facts that aren't supported by the source material.
4. Produce between 5 and 20 cards depending on how much material is available.

[SOURCE MATERIAL]
${context.formattedText}
    `.trim(),
  });

  return { title: 'Flashcards', payload: output };
}
