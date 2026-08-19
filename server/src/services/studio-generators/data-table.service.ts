import { generateText, Output } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { StudioContext } from '../studio-context.service.js';

const DataTableSchema = z
  .object({
    columns: z
      .array(z.string().min(1))
      .min(2)
      .max(8)
      .describe('Column headers, in display order.'),
    rows: z
      .array(z.array(z.string()))
      .min(1)
      .max(50)
      .describe('Table rows. Each row is an array of cell values, in the same order as and same length as "columns".'),
  })
  .refine((data) => data.rows.every((row) => row.length === data.columns.length), {
    message: 'Every row must have exactly as many cells as there are columns',
    path: ['rows'],
  });

export type DataTablePayload = z.infer<typeof DataTableSchema>;

const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });

/**
 * Structured-output generation, same pattern as flashcards.service.ts /
 * quiz.service.ts. Extracts the source material's most comparable/tabular
 * facts (specs, dates, figures, entities-and-attributes) into a single
 * table — not a literal reproduction of every table already in the source.
 */
export async function generateDataTable(context: StudioContext): Promise<{ title: string; payload: DataTablePayload }> {
  const { output } = await generateText({
    model: openai(env.OPENAI_MODEL),
    output: Output.object({ schema: DataTableSchema }),
    prompt: `
You are an expert data analyst. Read the source material below and extract its most important comparable facts into a single structured table.

RULES:
1. Choose whichever dimension best organizes the material into rows and columns — entities and their attributes, a timeline of dated events, categories and figures, a comparison across items, etc.
2. Use clear, short column headers (2-8 columns).
3. Every row must have exactly one cell per column, in the same order as the columns.
4. Do not invent facts, numbers, or entities that aren't supported by the source material.
5. Produce between 1 and 50 rows depending on how much comparable material is available.

[SOURCE MATERIAL]
${context.formattedText}
    `.trim(),
  });

  return { title: 'Data Table', payload: output };
}
