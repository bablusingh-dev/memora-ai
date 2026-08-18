import { generateText, Output } from 'ai';
import { openai } from '@ai-sdk/openai';
import { inngest } from '../client.js';
import { graphChunkCreated } from '../events.js';
import { GraphFactory } from '../../providers/graph/graph.factory.js';
import { DocumentChunkRepository } from '../../repositories/document-chunk.repository.js';
import {
  GraphExtractionSchema,
  EXTRACTION_GUIDANCE,
  DOCUMENT_META_STOPWORDS,
  MIN_CONFIDENCE,
  filterTriples,
} from '../../services/graph/triple-filter.js';
import { logger } from '../../utils/logger.js';

const chunkRepo = new DocumentChunkRepository();

/**
 * Per-chunk knowledge-graph extraction. Replaces the old
 * GraphWorkerService.processBatch() setInterval poller (10 chunks / 10s,
 * single process, "mark indexed to avoid retry loops" on failure) with:
 *
 *   - Event-driven: fires the moment a chunk is persisted (graph/chunk.created,
 *     sent from the ingestion pipeline), not on a fixed timer.
 *   - concurrency.limit bounds parallel LLM calls + Neo4j writes across
 *     however many chunks fan out at once, regardless of how many server
 *     instances are running — no more single-process-only `isProcessing` flag.
 *   - Real retries (Inngest's own, per step) instead of immediately giving up.
 *   - Real dead-lettering: after retries are exhausted, the chunk is marked
 *     graph_index_status = 'failed' with an error message and attempt count —
 *     visible and queryable, not silently marked "indexed".
 */
export const graphExtractChunkFunction = inngest.createFunction(
  {
    id: 'graph-extract-chunk',
    triggers: [{ event: graphChunkCreated.event }],
    concurrency: { limit: 5 },
    retries: 3,
    idempotency: 'event.data.chunkId',
    onFailure: async ({ event, error }: { event: any; error: Error }) => {
      const chunkId: string | undefined = event?.data?.event?.data?.chunkId;
      if (!chunkId) {
        logger.error({ error: error?.message }, '[GraphExtract] onFailure fired without a resolvable chunkId');
        return;
      }
      try {
        await chunkRepo.markGraphIndexFailed(chunkId, error?.message || 'Graph extraction failed after multiple retries');
        logger.error({ chunkId, error: error?.message }, '[GraphExtract] Marked chunk failed after exhausting retries');
      } catch (err) {
        logger.error({ err, chunkId }, '[GraphExtract] Failed to mark chunk failed in onFailure handler');
      }
    },
  },
  async ({ event, step }) => {
    const { chunkId, notebookId, userId } = event.data;

    const chunk = await step.run('fetch-chunk', () => chunkRepo.findForGraphExtraction(chunkId));
    if (!chunk) {
      // Chunk was deleted (source removed/re-ingested) between fan-out and
      // processing — nothing to do, and not a failure.
      logger.debug({ chunkId }, '[GraphExtract] Chunk no longer exists, skipping');
      return;
    }

    await step.run('mark-processing', () => chunkRepo.markGraphIndexing(chunkId));

    const triples = await step.run('extract-and-filter-triples', async () => {
      const textForExtraction = chunk.retrievalContent || chunk.content;

      // generateObject is deprecated in this SDK version — structured output
      // now goes through generateText's `output` option instead.
      const { output } = await generateText({
        model: openai('gpt-4o-mini'),
        output: Output.object({ schema: GraphExtractionSchema }),
        prompt: `
You are a precise Knowledge Graph Extraction Engine for a NotebookLLM system.

Your task: extract only explicitly supported subject-predicate-object triples from the text below.

CRITICAL RULES:
1. ONLY create a triple when the source text EXPLICITLY states the relationship.
2. The evidence field MUST be a direct quote or close paraphrase from the chunk.
3. Set confidence accurately: 0.9-1.0 if explicit, 0.75-0.89 if strongly implied, below 0.60 = do not include.
4. Do NOT invent relationships. If unsure, do not include.
5. Do NOT extract generic words as entities (video, document, speaker, steps, things, system, process).
6. Return empty triples array if no meaningful domain facts exist.

${chunk.heading ? `Section heading: ${chunk.heading}` : ''}
${chunk.sectionPath ? `Section path: ${chunk.sectionPath}` : ''}

Text:
"""
${textForExtraction.slice(0, 3000)}
"""

${EXTRACTION_GUIDANCE}
`.trim(),
      });

      return filterTriples(output.triples, chunkId);
    });

    if (triples.length > 0) {
      await step.run('upsert-triples', async () => {
        const graphProvider = GraphFactory.getProvider();
        await graphProvider.upsertBatchTriples(triples, notebookId, userId || 'default_user');
      });
    }

    await step.run('mark-indexed', () => chunkRepo.markGraphIndexed(chunkId));
  }
);

/**
 * Safety-net + backlog on-ramp: fans out `graph/chunk.created` for any chunk
 * still `pending` — chunks whose fan-out event from the ingestion pipeline
 * was somehow lost, and (on first deploy of this pipeline) the pre-existing
 * backlog of chunks the old poller hadn't gotten to yet.
 */
export const graphBackfillFunction = inngest.createFunction(
  { id: 'graph-backfill', triggers: [{ cron: '*/5 * * * *' }] },
  async ({ step }) => {
    const pending = await step.run('find-pending-chunks', () => chunkRepo.findPendingGraphIndexChunks(200));
    if (pending.length === 0) return { fannedOut: 0 };

    await step.sendEvent(
      'fan-out-pending-chunks',
      pending.map((c) => graphChunkCreated.create({ chunkId: c.id, notebookId: c.notebookId, userId: c.userId }))
    );

    logger.info({ count: pending.length }, '[GraphBackfill] Fanned out pending chunks for graph extraction');
    return { fannedOut: pending.length };
  }
);

/**
 * Same cleanup Cypher as the old GraphWorkerService.cleanupMetaNodes(), now
 * on a daily schedule instead of running once at boot.
 */
export const graphCleanupMetaNodesFunction = inngest.createFunction(
  { id: 'graph-cleanup-meta-nodes', triggers: [{ cron: '0 3 * * *' }] },
  async ({ step }) => {
    await step.run('cleanup-meta-nodes', async () => {
      const graphProvider = GraphFactory.getProvider();
      const stopwords = Array.from(DOCUMENT_META_STOPWORDS);
      await graphProvider.runQuery(
        `
        MATCH (e:Entity)
        WHERE toLower(e.normalizedName) IN $stopwords
           OR size(e.name) < 2
           OR (e.confidence IS NOT NULL AND e.confidence < ${MIN_CONFIDENCE})
        DETACH DELETE e
        `,
        { stopwords }
      );
      logger.info('[GraphCleanup] Meta-node cleanup completed');
    });
  }
);
