import { generateText, Output } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { StudioContext } from '../studio-context.service.js';

const SlideDeckSchema = z.object({
  deckTitle: z.string().min(1).describe('The overall presentation title, shown on the title slide.'),
  slides: z
    .array(
      z.object({
        title: z.string().min(1).describe('Short slide title/headline.'),
        bullets: z
          .array(z.string().min(1))
          .min(1)
          .max(6)
          .describe('1 to 6 short bullet points for this slide — phrases, not paragraphs.'),
        speakerNotes: z.string().optional().describe('Optional brief talking points for presenting this slide aloud.'),
      })
    )
    .min(3)
    .max(20)
    .describe('3 to 20 content slides (not counting the title slide), in presentation order.'),
});

export type SlideDeckPayload = z.infer<typeof SlideDeckSchema>;

const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });

/**
 * Structured-output generation, same pattern as the other studio-generators.
 * Produces presentation-style content — short titles and terse bullets, not
 * prose (unlike Report) — since it's meant to be read slide-by-slide.
 */
export async function generateSlideDeck(context: StudioContext): Promise<{ title: string; payload: SlideDeckPayload }> {
  const { output } = await generateText({
    model: openai(env.OPENAI_MODEL),
    output: Output.object({ schema: SlideDeckSchema }),
    prompt: `
You are an expert presentation designer. Read the source material below and turn it into a slide deck outline.

RULES:
1. Write a short, specific deck title.
2. Break the material into 3-20 logically ordered slides, each with a short title.
3. Each slide gets 1-6 terse bullet points — phrases, not full paragraphs. Presentation slides are read at a glance, not like a document.
4. Optionally add brief speaker notes for a slide if there's useful context that shouldn't be on the slide itself but is worth saying aloud.
5. Do not invent facts that aren't supported by the source material.

[SOURCE MATERIAL]
${context.formattedText}
    `.trim(),
  });

  return { title: output.deckTitle, payload: output };
}
