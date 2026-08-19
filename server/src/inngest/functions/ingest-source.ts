import pdfParse from 'pdf-parse';
import { inngest } from '../client.js';
import {
  sourceFileUploaded,
  sourceWebsiteRequested,
  sourceYoutubeRequested,
  sourceTextRequested,
  graphChunkCreated,
} from '../events.js';
import { SourceRepository, UNIQUE_VIOLATION, NewDocumentChunk } from '../../repositories/source.repository.js';
import { ChunkingService } from '../../services/chunking.service.js';
import { FirecrawlService } from '../../services/firecrawl.service.js';
import { YoutubeService } from '../../services/youtube.service.js';
import { embeddingService } from '../../services/embedding.service.js';
import { sha256Hex } from '../../utils/content-hash.js';
import { logger } from '../../utils/logger.js';

const sourceRepo = new SourceRepository();
const firecrawlService = new FirecrawlService();
const youtubeService = new YoutubeService();

type SourceFileType = 'pdf' | 'web' | 'youtube' | 'text';

// ---------------------------------------------------------------------------
// Shared pipeline tail: chunk -> persist (idempotent) -> mark ready -> fan
// out graph extraction. Every trigger function below does its own
// type-specific extraction (and, for website/YouTube, the duplicate check
// that can only run after fetching) before calling this.
// ---------------------------------------------------------------------------
async function chunkPersistAndFanOut(
  step: any,
  params: { sourceId: string; memorybookId: string; userId: string; title: string; rawText: string; fileType: SourceFileType }
): Promise<void> {
  const { sourceId, memorybookId, userId, title, rawText, fileType } = params;

  await step.run('mark-chunking', () => sourceRepo.updateSource(sourceId, { stage: 'chunking' }));

  const dbChunks: NewDocumentChunk[] = await step.run('chunk-content', () =>
    ChunkingService.createChunks(rawText, title, fileType).map((c) => ({
      sourceId,
      memorybookId,
      content: c.originalContent,
      retrievalContent: c.retrievalContent,
      chunkIndex: c.chunkIndex,
      heading: c.heading ?? null,
      parentSection: c.parentSection ?? null,
      sectionPath: c.sectionPath ?? null,
      sourceType: c.sourceType,
      tokenCount: c.tokenCount,
      startPosition: c.startPosition,
      endPosition: c.endPosition,
    }))
  );

  await step.run('mark-embedding', () => sourceRepo.updateSource(sourceId, { stage: 'embedding' }));

  // Soft-fail: an embeddings-API hiccup shouldn't block the whole source
  // from becoming ready — chunks stay fully searchable via BM25 immediately,
  // and the embedding-backfill Inngest cron (embedding-backfill.ts) picks up
  // anything left with a null embedding.
  const embeddings = await step.run('generate-embeddings', async () => {
    try {
      return await embeddingService.embedMany(dbChunks.map((c) => c.retrievalContent || c.content));
    } catch (err) {
      logger.warn(
        { err, sourceId },
        '[IngestSource] Embedding generation failed — chunks will be BM25-only searchable until embedding-backfill retries them'
      );
      return [];
    }
  });

  const chunksWithEmbeddings = dbChunks.map((c, i) => ({
    ...c,
    embedding: embeddings[i] ?? null,
  }));

  const chunkIds: string[] = await step.run('persist-chunks', async () => {
    // Idempotent against a full function-level retry (exhausted step
    // retries -> Inngest starts a fresh run): clear anything a previous
    // attempt already committed before re-inserting, so retries never
    // duplicate chunks. Inngest memoizes *this* step's own result within a
    // single run, so this delete+insert only ever actually executes once
    // per successful run — the safeguard is for the retry-after-failure case.
    await sourceRepo.deleteChunksBySourceId(sourceId);
    return sourceRepo.insertChunksReturningIds(chunksWithEmbeddings);
  });

  await step.run('mark-source-ready', () =>
    sourceRepo.updateSource(sourceId, { status: 'ready', stage: null, title })
  );

  if (chunkIds.length > 0) {
    await step.sendEvent(
      'fan-out-graph-extraction',
      chunkIds.map((chunkId) => graphChunkCreated.create({ chunkId, memorybookId, userId }))
    );
  }
}

/**
 * Only used by website/YouTube ingestion, where content (and therefore its
 * hash) isn't known until after fetching — unlike file/text uploads, which
 * are hashed and dedup-checked synchronously in source.service.ts before the
 * source row even exists. Returns true if this source was marked duplicate
 * and the caller should stop (not an error — a normal terminal outcome).
 */
async function claimContentHashOrMarkDuplicate(
  step: any,
  params: { sourceId: string; memorybookId: string; rawText: string }
): Promise<boolean> {
  const { sourceId, memorybookId, rawText } = params;

  return step.run('check-duplicate', async () => {
    const contentHash = sha256Hex(rawText);
    const existing = await sourceRepo.findByContentHash(memorybookId, contentHash);
    if (existing && existing.id !== sourceId) {
      await sourceRepo.updateSource(sourceId, {
        status: 'duplicate',
        stage: null,
        errorMessage: `Already added to this memorybook as "${existing.title}"`,
      });
      return true;
    }

    try {
      await sourceRepo.updateSource(sourceId, { contentHash });
      return false;
    } catch (err: any) {
      if (err?.code === UNIQUE_VIOLATION) {
        // Race: another ingestion claimed this exact content between our
        // SELECT above and this UPDATE.
        await sourceRepo.updateSource(sourceId, {
          status: 'duplicate',
          stage: null,
          errorMessage: 'This content was already added to this memorybook (concurrent upload).',
        });
        return true;
      }
      throw err;
    }
  });
}

/**
 * Shared onFailure handler: after Inngest exhausts all retries, mark the
 * source `error` with the failure reason instead of leaving it stuck on
 * `processing` forever. `event.data.event` is the original triggering event
 * (Inngest's FailureEventPayload shape) — every ingestion event carries
 * `sourceId`, so this generalizes across all four trigger types.
 */
async function handleIngestionFailure({ event, error }: { event: any; error: Error }): Promise<void> {
  const sourceId: string | undefined = event?.data?.event?.data?.sourceId;
  if (!sourceId) {
    logger.error({ error: error?.message }, '[IngestSource] onFailure fired without a resolvable sourceId');
    return;
  }
  try {
    await sourceRepo.updateSource(sourceId, {
      status: 'error',
      stage: null,
      errorMessage: (error?.message || 'Ingestion failed after multiple retries').slice(0, 500),
    });
    logger.error({ sourceId, error: error?.message }, '[IngestSource] Marked source as error after exhausting retries');
  } catch (err) {
    logger.error({ err, sourceId }, '[IngestSource] Failed to mark source as error in onFailure handler');
  }
}

// ---------------------------------------------------------------------------
// Trigger functions
// ---------------------------------------------------------------------------

export const ingestFileFunction = inngest.createFunction(
  {
    id: 'ingest-source-file',
    triggers: [{ event: sourceFileUploaded.event }],
    retries: 3,
    // Collapses a redelivered/duplicate event for the same source into one run.
    idempotency: 'event.data.sourceId',
    onFailure: handleIngestionFailure,
  },
  async ({ event, step }) => {
    const { sourceId, memorybookId, userId, fileUrl, mimeType, originalName } = event.data;

    await step.run('mark-extracting', () => sourceRepo.updateSource(sourceId, { stage: 'extracting' }));

    const rawText = await step.run('fetch-and-parse-file', async () => {
      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error(`Failed to download uploaded file from storage: HTTP ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());

      if (mimeType === 'application/pdf') {
        try {
          const parseFn = (pdfParse as any).default || pdfParse;
          const pdfData = await parseFn(buffer);
          return pdfData.text as string;
        } catch (err) {
          logger.warn({ err, sourceId }, '[IngestSource] PDF parse failed, falling back to raw text decode');
          return buffer.toString('utf-8');
        }
      }
      return buffer.toString('utf-8');
    });

    await chunkPersistAndFanOut(step, {
      sourceId,
      memorybookId,
      userId,
      title: originalName,
      rawText,
      fileType: 'pdf', // Matches the pre-existing (pre-Inngest) behavior: fileType is always 'pdf' for uploads regardless of actual mimetype.
    });
  }
);

export const ingestWebsiteFunction = inngest.createFunction(
  {
    id: 'ingest-source-website',
    triggers: [{ event: sourceWebsiteRequested.event }],
    retries: 3,
    idempotency: 'event.data.sourceId',
    onFailure: handleIngestionFailure,
  },
  async ({ event, step }) => {
    const { sourceId, memorybookId, userId, url } = event.data;

    await step.run('mark-extracting', () => sourceRepo.updateSource(sourceId, { stage: 'extracting' }));

    const { title, markdown } = await step.run('scrape-website', () => firecrawlService.scrapeUrl(url));

    const isDuplicate = await claimContentHashOrMarkDuplicate(step, { sourceId, memorybookId, rawText: markdown });
    if (isDuplicate) return;

    await chunkPersistAndFanOut(step, { sourceId, memorybookId, userId, title, rawText: markdown, fileType: 'web' });
  }
);

export const ingestYoutubeFunction = inngest.createFunction(
  {
    id: 'ingest-source-youtube',
    triggers: [{ event: sourceYoutubeRequested.event }],
    retries: 3,
    idempotency: 'event.data.sourceId',
    onFailure: handleIngestionFailure,
  },
  async ({ event, step }) => {
    const { sourceId, memorybookId, userId, url } = event.data;

    await step.run('mark-extracting', () => sourceRepo.updateSource(sourceId, { stage: 'extracting' }));

    const { title, text } = await step.run('fetch-youtube-transcript', () => youtubeService.getTranscript(url));

    const isDuplicate = await claimContentHashOrMarkDuplicate(step, { sourceId, memorybookId, rawText: text });
    if (isDuplicate) return;

    await chunkPersistAndFanOut(step, { sourceId, memorybookId, userId, title, rawText: text, fileType: 'youtube' });
  }
);

export const ingestTextFunction = inngest.createFunction(
  {
    id: 'ingest-source-text',
    triggers: [{ event: sourceTextRequested.event }],
    retries: 3,
    idempotency: 'event.data.sourceId',
    onFailure: handleIngestionFailure,
  },
  async ({ event, step }) => {
    const { sourceId, memorybookId, userId, title, content } = event.data;
    // contentHash was already computed and dedup-checked synchronously in
    // source.service.ts before this event was even sent — no
    // check-duplicate step needed here (unlike website/YouTube).
    await chunkPersistAndFanOut(step, { sourceId, memorybookId, userId, title, rawText: content, fileType: 'text' });
  }
);
