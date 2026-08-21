import { generateText, generateSpeech, Output } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { StudioContext } from '../studio-context.service.js';
import { uploadToCloudinary } from '../../utils/cloudinary.js';

const PodcastScriptSchema = z.object({
  title: z.string().min(1).describe('A short, specific title for this podcast episode.'),
  turns: z
    .array(
      z.object({
        speaker: z.enum(['host_a', 'host_b']).describe('Which host is speaking this turn.'),
        text: z.string().min(1).describe('What this host says, as natural spoken dialogue (not a paragraph to be read).'),
      })
    )
    .min(8)
    .max(30)
    .describe('The full episode script, in speaking order, alternating naturally between the two hosts.'),
});

export type PodcastScript = z.infer<typeof PodcastScriptSchema>;
export type PodcastTurn = PodcastScript['turns'][number];

export interface PodcastPayload {
  audioUrl: string;
  durationSec: number;
  turns: { speaker: 'host_a' | 'host_b'; text: string; startMs: number }[];
}

const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });

// Fixed per-persona voices — no configurability was requested, same reasoning
// as STUDIO_CONTEXT_TOKEN_BUDGET in studio-context.service.ts (plain constant,
// not an env var).
const HOST_VOICES: Record<PodcastTurn['speaker'], string> = {
  host_a: 'alloy',
  host_b: 'onyx',
};

// Rough TTS speaking-rate heuristic (characters/second) used only to derive
// approximate per-turn start offsets for transcript-highlight sync — not a
// real audio-duration measurement. Same "cheap heuristic over precise
// parsing" philosophy as approxTokenCount in utils/tokens.ts.
const PODCAST_CHARS_PER_SECOND = 15;

/**
 * Structured-output script generation — same pattern as the other
 * studio-generators (see slide-deck.service.ts). Produces a two-host
 * conversational script grounded in the source material, optionally centered
 * on a user-supplied focus topic.
 */
export async function generatePodcastScript(
  context: StudioContext,
  options?: { focus?: string }
): Promise<PodcastScript> {
  const focusBlock = options?.focus
    ? `\n\nFOCUS: The hosts should center this discussion on the following, while still staying grounded in the source material: "${options.focus}"`
    : '';

  const { output } = await generateText({
    model: openai(env.OPENAI_MODEL),
    output: Output.object({ schema: PodcastScriptSchema }),
    prompt: `
You are writing the script for a two-host podcast episode discussing the source material below — the same style as a "deep dive" audio discussion between two curious, knowledgeable people, not a monologue.

HOSTS:
- host_a: a curious generalist. Asks questions, reacts, occasionally summarizes for the listener.
- host_b: a knowledgeable explainer. Answers, explains, and cites specifics from the source material.

RULES:
1. Write a short, specific episode title.
2. Open with a brief, natural welcome (host_a greeting the listener and introducing the topic) and close with a short wrap-up.
3. Alternate naturally between the two hosts — real conversation, not alternating monologues. Use short interjections ("Right," "Exactly," "Huh, interesting") where natural, not just long explanations.
4. Each turn is spoken dialogue — write it the way a person would say it aloud, not formal written prose.
5. Aim for roughly 900-1300 words total across all turns — a natural episode reads aloud in about 6-8 minutes.
6. Do not invent facts that aren't supported by the source material.${focusBlock}

[SOURCE MATERIAL]
${context.formattedText}
    `.trim(),
  });

  return output;
}

export interface SynthesizedTurn {
  speaker: PodcastTurn['speaker'];
  text: string;
  /**
   * Base64-encoded MP3 bytes, not a Buffer — this value round-trips through
   * an Inngest `step.run` boundary (JSON-serialized for durability/replay),
   * and base64 stays ~1.33x the original size vs. ~4x for a JSON byte array.
   */
  audioBase64: string;
  approxDurationMs: number;
}

/**
 * Synthesizes one batch of script turns into audio via OpenAI TTS. Called
 * per-batch (not once for the whole script) so the Inngest pipeline can
 * checkpoint progress — see generate-studio-artifact.ts.
 */
export async function synthesizeTurnsBatch(turns: PodcastTurn[]): Promise<SynthesizedTurn[]> {
  const results: SynthesizedTurn[] = [];
  for (const turn of turns) {
    const { audio } = await generateSpeech({
      model: openai.speech(env.OPENAI_TTS_MODEL),
      text: turn.text,
      voice: HOST_VOICES[turn.speaker],
      outputFormat: 'mp3',
    });
    results.push({
      speaker: turn.speaker,
      text: turn.text,
      audioBase64: Buffer.from(audio.uint8Array).toString('base64'),
      approxDurationMs: Math.round((turn.text.length / PODCAST_CHARS_PER_SECOND) * 1000),
    });
  }
  return results;
}

/**
 * Concatenates synthesized turn audio into one MP3 (sequential same-codec
 * MP3 clips concatenate cleanly enough for this without re-encoding — a v1
 * simplification; ffmpeg-based re-encoding is a fast-follow if concatenation
 * artifacts turn out to be audible) and uploads it via the existing
 * Cloudinary helper used for source uploads.
 */
export async function stitchAndUploadPodcast(
  title: string,
  turnAudios: SynthesizedTurn[]
): Promise<{ title: string; payload: PodcastPayload }> {
  const combined = Buffer.concat(turnAudios.map((t) => Buffer.from(t.audioBase64, 'base64')));

  let cursorMs = 0;
  const turns = turnAudios.map((t) => {
    const turn = { speaker: t.speaker, text: t.text, startMs: cursorMs };
    cursorMs += t.approxDurationMs;
    return turn;
  });

  const audioUrl = await uploadToCloudinary(combined, `${title}.mp3`, 'memorybook/podcasts');

  return {
    title,
    payload: {
      audioUrl,
      durationSec: Math.round(cursorMs / 1000),
      turns,
    },
  };
}
