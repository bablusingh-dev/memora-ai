import { generateText, Output } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { inngest } from '../client.js';
import { chatMessageCompleted } from '../events.js';
import { env } from '../../config/env.js';
import { memoryExtractor } from '../../services/memory/memory-extractor.service.js';
import { MemoryFactory } from '../../providers/memory/memory.factory.js';
import { logger } from '../../utils/logger.js';

const memoryProvider = MemoryFactory.getProvider();
const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });

const ConsolidationSchema = z.object({
  supersededMemoryIds: z
    .array(z.string())
    .describe(
      'IDs of memories that are near-duplicates of, or have been superseded/contradicted by, a more recent memory elsewhere in the list. Keep whichever version is most recent/complete; list the others here for deletion. Never list the only source of a given fact.'
    ),
});

// Only worth checking for duplicates once there's enough accumulated memory
// for redundancy to actually be likely, and re-checking on every single
// turn past that point would be wasteful LLM spend for little benefit.
const CONSOLIDATION_MIN_MEMORIES = 10;
const CONSOLIDATION_CHECK_INTERVAL = 10;
const CONSOLIDATION_FETCH_LIMIT = 100;

/**
 * Replaces the previous fire-and-forget `this.memoryExtractor
 * .extractAndPersistMemories(...).catch(...)` call inside agent.service.ts's
 * onFinish — that promise was never awaited by anything, had no retry, and
 * was silently lost if the process restarted mid-extraction or mem0 was
 * briefly down. This is durable: Inngest retries on failure and the run
 * survives a process restart.
 */
export const extractMemoriesFunction = inngest.createFunction(
  {
    id: 'extract-memories',
    triggers: [{ event: chatMessageCompleted.event }],
    retries: 3,
    // Collapses a redelivered event for the same chat message into one run
    // (only meaningful when chatMessageId was available at send time).
    idempotency: 'event.data.chatMessageId',
  },
  async ({ event, step }) => {
    const { userId, notebookId, userMessage, assistantReply } = event.data;

    const extracted = await step.run('extract-memories', () => memoryExtractor.extractMemories(userMessage, assistantReply));

    const hasAnything = extracted.profileFacts.length > 0 || extracted.proceduralRules.length > 0 || Boolean(extracted.episodicSummary);
    if (!hasAnything) {
      return { extracted: false };
    }

    await step.run('persist-memories', () => memoryExtractor.persistMemories(userId, notebookId, extracted));

    await step.run('maybe-consolidate', () => maybeConsolidateMemories(userId));

    return { extracted: true };
  }
);

/**
 * Self-scoped consolidation — deliberately NOT a cron over "all active
 * users" (which would need a new table to track who's been active). Instead
 * it piggybacks on the user who just talked, checking their own memory count
 * with no persistent counter: every 10th memory (10, 20, 30...) triggers one
 * LLM pass that identifies near-duplicate/superseded memories and deletes
 * them. Self-limiting by construction — bounded by CONSOLIDATION_FETCH_LIMIT
 * regardless of how large a user's memory store grows.
 */
export async function maybeConsolidateMemories(userId: string): Promise<{ ran: boolean; deleted?: number }> {
  const all = await memoryProvider.getAll({ userId, limit: CONSOLIDATION_FETCH_LIMIT });
  if (all.length < CONSOLIDATION_MIN_MEMORIES || all.length % CONSOLIDATION_CHECK_INTERVAL !== 0) {
    return { ran: false };
  }

  const listText = all.map((m, i) => `${i}. [id:${m.id}] ${m.memory}`).join('\n');

  const { output } = await generateText({
    model: openai('gpt-4o-mini'),
    output: Output.object({ schema: ConsolidationSchema }),
    prompt: `
Below is a numbered list of memories stored for one user. Identify any that are near-duplicates of, or have been superseded/contradicted by, a different memory later in the list (e.g. "prefers Python" followed later by "now primarily uses Rust").

${listText}

Return the IDs of memories that should be deleted because a later memory already captures the same (or updated) information. Never list the only source of a given fact — only list genuine redundancy/supersession.
`.trim(),
  });

  let deleted = 0;
  for (const id of output.supersededMemoryIds) {
    const ok = await memoryProvider.delete(id).catch((err) => {
      logger.warn({ err, id, userId }, '[ExtractMemories] Failed to delete superseded memory during consolidation');
      return false;
    });
    if (ok) deleted++;
  }

  logger.info({ userId, totalChecked: all.length, deleted }, '[ExtractMemories] Consolidation pass completed');
  return { ran: true, deleted };
}
