import { generateText, Output } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { StudioContext } from '../studio-context.service.js';

const ReportSchema = z.object({
  title: z.string().min(1).describe('A concise, specific report title (not just "Report").'),
  summary: z.string().min(1).describe('A 2-4 sentence executive summary of the report.'),
  sections: z
    .array(
      z.object({
        heading: z.string().min(1),
        content: z.string().min(1).describe('Markdown-formatted body content for this section — paragraphs, lists, or tables as appropriate.'),
      })
    )
    .min(2)
    .max(10)
    .describe('2 to 10 sections covering the source material in a logical order.'),
});

export type ReportPayload = z.infer<typeof ReportSchema>;

const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });

/**
 * Structured-output generation, same pattern as the other studio-generators.
 * Unlike Flashcards/Quiz/Data Table (short structured facts), a Report is a
 * long-form synthesis — the LLM is asked to actually write prose per
 * section, not just extract discrete facts.
 */
export async function generateReport(context: StudioContext): Promise<{ title: string; payload: ReportPayload }> {
  const { output } = await generateText({
    model: openai(env.OPENAI_MODEL),
    output: Output.object({ schema: ReportSchema }),
    prompt: `
You are an expert analyst writing a structured report for someone who wants a thorough but readable synthesis of the source material below.

RULES:
1. Write a specific, descriptive title for the report (not generic like "Report" or "Summary").
2. Write a 2-4 sentence executive summary capturing the most important takeaways.
3. Organize the body into 2-10 logically ordered sections, each with a clear heading.
4. Write each section's content in Markdown — use paragraphs, bullet lists, or tables where they aid clarity.
5. Do not invent facts that aren't supported by the source material.
6. Be thorough but readable — prefer clear prose over exhaustively restating every detail.

[SOURCE MATERIAL]
${context.formattedText}
    `.trim(),
  });

  return { title: output.title, payload: output };
}
