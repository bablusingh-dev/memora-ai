import { generateText, Output } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { MemoryFactory } from '../../providers/memory/memory.factory.js';
import { logger } from '../../utils/logger.js';

const MemoryExtractionSchema = z.object({
  profileFacts: z
    .array(z.string())
    .describe(
      'Explicit self-declarations the user made about themselves in THIS message — identity, role, profession, expertise level, goals, constraints, likes/dislikes. Empty array if the user stated nothing about themselves.'
    ),
  proceduralRules: z
    .array(z.string())
    .describe(
      'Explicit formatting or response-style instructions the user gave (e.g. "always answer in bullet points", "keep responses under 100 words", "respond in French"). Empty array if none.'
    ),
  episodicSummary: z
    .string()
    .nullable()
    .describe(
      'A one-sentence summary of what this turn substantively discussed, for recalling "what did we talk about" later. Null for greetings, short exchanges, or anything not worth remembering as a session event.'
    ),
});

export type ExtractedMemories = z.infer<typeof MemoryExtractionSchema>;

/**
 * LLM-graded replacement for the previous regex/keyword-matching extractor.
 * The old approach (`^(i am|i'm|...)`, `.includes('always ')`, etc.) only
 * caught user facts that happened to match a literal phrasing — most
 * conversational self-disclosure ("I mostly work with distributed systems
 * and don't have much frontend experience") was invisible to it. One
 * structured-output call catches the same intent regardless of phrasing.
 *
 * Persistence is a separate method (not bundled into extraction) so the
 * calling Inngest function (extract-memories.ts) can give each concern its
 * own retryable step.
 */
export class MemoryExtractorService {
  private openai: ReturnType<typeof createOpenAI>;
  private memoryProvider = MemoryFactory.getProvider();

  constructor() {
    this.openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
  }

  /**
   * Pure extraction — no I/O to the memory store. Returns empty/null fields
   * rather than throwing when nothing extractable is present; only genuine
   * LLM/API failures throw (letting the caller's Inngest step retry).
   */
  async extractMemories(userMessage: string, assistantReply: string): Promise<ExtractedMemories> {
    // Skip the LLM call entirely for trivial exchanges — matches the old
    // extractor's 60-char substantiveness floor for episodic summaries, and
    // there's essentially never a self-declaration worth extracting from a
    // one-word message either.
    if (userMessage.trim().length < 20) {
      return { profileFacts: [], proceduralRules: [], episodicSummary: null };
    }

    const { output } = await generateText({
      model: this.openai('gpt-4o-mini'),
      output: Output.object({ schema: MemoryExtractionSchema }),
      prompt: `
You are a precise memory extraction engine for a Notebook LLM assistant. Analyze ONLY the user's message below (the assistant reply is provided for context only, not as a source of facts about the user).

CRITICAL RULES:
1. Only extract what the user explicitly stated. Do not infer, assume, or invent facts.
2. profileFacts: durable facts about the USER (not the notebook's subject matter). E.g. "I'm a backend engineer" -> keep; "Tell me about Apache Kafka" -> not a fact about the user, skip.
3. proceduralRules: only extract explicit formatting/style instructions, not implicit preferences.
4. episodicSummary: null unless the exchange covered a substantive topic worth recalling later.
5. Return empty arrays / null rather than guessing when nothing qualifies.

[User Message]:
"${userMessage.trim()}"

[Assistant Reply — context only, do not extract facts from this]:
"${assistantReply.trim().slice(0, 500)}"
`.trim(),
    });

    return output;
  }

  /**
   * Writes extracted facts to their respective mem0 categories. Best-effort
   * per category isn't attempted here — if the underlying memoryProvider.add
   * call throws, the whole thing throws and the caller's Inngest step
   * retries the full extraction, which is safe to repeat (mem0 additions are
   * idempotent-ish in effect; the consolidation pass in extract-memories.ts
   * cleans up any resulting near-duplicates over time).
   */
  async persistMemories(userId: string, notebookId: string, extracted: ExtractedMemories): Promise<void> {
    if (extracted.profileFacts.length > 0) {
      await this.memoryProvider.add(extracted.profileFacts, {
        userId,
        category: 'user_profile',
        metadata: { notebookId, source: 'llm_extraction' },
      });
    }

    if (extracted.proceduralRules.length > 0) {
      await this.memoryProvider.add(extracted.proceduralRules, {
        userId,
        category: 'procedural',
        metadata: { notebookId, source: 'llm_extraction' },
      });
    }

    if (extracted.episodicSummary) {
      await this.memoryProvider.add(extracted.episodicSummary, {
        userId,
        category: 'episodic',
        metadata: { notebookId, timestamp: new Date().toISOString() },
      });
    }

    logger.info(
      {
        userId,
        notebookId,
        profileFactsCount: extracted.profileFacts.length,
        proceduralRulesCount: extracted.proceduralRules.length,
        hasEpisodicSummary: Boolean(extracted.episodicSummary),
      },
      '[MemoryExtractor] Persisted extracted memories'
    );
  }
}

export const memoryExtractor = new MemoryExtractorService();
