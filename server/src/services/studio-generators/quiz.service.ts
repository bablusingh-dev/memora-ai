import { generateText, Output } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { StudioContext } from '../studio-context.service.js';

const QuizSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string().min(1).describe('The quiz question.'),
        options: z
          .array(z.string().min(1))
          .length(4)
          .describe('Exactly 4 answer options, in the order they should be displayed.'),
        correctIndex: z
          .number()
          .int()
          .min(0)
          .max(3)
          .describe('Index (0-3) into "options" of the correct answer.'),
        explanation: z.string().min(1).describe('A brief explanation of why the correct answer is right.'),
      })
    )
    .min(5)
    .max(15)
    .describe('5 to 15 multiple-choice questions covering the most important concepts in the source material.'),
});

export type QuizPayload = z.infer<typeof QuizSchema>;

const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });

/**
 * Structured-output generation, same pattern as flashcards.service.ts /
 * query-enhancer.service.ts.
 */
export async function generateQuiz(context: StudioContext): Promise<{ title: string; payload: QuizPayload }> {
  const { output } = await generateText({
    model: openai(env.OPENAI_MODEL),
    output: Output.object({ schema: QuizSchema }),
    prompt: `
You are an expert quiz author. Read the source material below and produce a multiple-choice quiz for someone testing their understanding of it.

RULES:
1. Cover the most important concepts, definitions, and facts — not trivia.
2. Each question must have exactly 4 answer options, with exactly one correct answer.
3. Distractors (wrong options) should be plausible, not obviously wrong.
4. Do not invent facts that aren't supported by the source material.
5. Include a brief explanation for each correct answer.
6. Produce between 5 and 15 questions depending on how much material is available.

[SOURCE MATERIAL]
${context.formattedText}
    `.trim(),
  });

  return { title: 'Quiz', payload: output };
}
