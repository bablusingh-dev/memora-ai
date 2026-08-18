import { SourceRepository, SourceDocument, UNIQUE_VIOLATION } from '../repositories/source.repository.js';
import { NotebookRepository } from '../repositories/notebook.repository.js';
import { uploadToCloudinary } from '../utils/cloudinary.js';
import { sha256Hex } from '../utils/content-hash.js';
import { NotFoundError, ConflictError } from '../utils/api-error.js';
import { logger } from '../utils/logger.js';
import { inngest } from '../inngest/client.js';
import {
  sourceFileUploaded,
  sourceWebsiteRequested,
  sourceYoutubeRequested,
  sourceTextRequested,
} from '../inngest/events.js';

/**
 * Source ingestion is now a two-phase process:
 *
 *   1. THIS SERVICE (synchronous, inside the HTTP request): validate
 *      ownership, do the minimum work needed to either (a) reject an exact
 *      duplicate immediately or (b) create a `processing` source row and
 *      hand off to Inngest. Never parses/chunks/embeds here — that's what
 *      made ingestion block the request thread and risk gateway timeouts.
 *   2. THE INGEST-SOURCE INNGEST FUNCTIONS (server/src/inngest/functions/
 *      ingest-source.ts) — durable, retried, observable pipeline that does
 *      the actual extraction/chunking/persisting/graph fan-out.
 *
 * Clients poll `GET /sources` and watch `status` (processing -> ready |
 * error | duplicate) rather than getting a synchronous "ready" response.
 */
export class SourceService {
  private sourceRepo: SourceRepository;
  private notebookRepo: NotebookRepository;

  constructor() {
    this.sourceRepo = new SourceRepository();
    this.notebookRepo = new NotebookRepository();
  }

  async getSources(notebookId: string, userId: string) {
    const notebook = await this.notebookRepo.findById(notebookId, userId);
    if (!notebook) {
      throw new NotFoundError(`Notebook '${notebookId}' not found`);
    }
    return await this.sourceRepo.findByNotebookId(notebookId);
  }

  /**
   * Ingest PDF/Document File -> Cloudinary upload (sync) -> Inngest pipeline
   * (parse/chunk/persist/graph fan-out, async).
   */
  async ingestFile(notebookId: string, userId: string, file: Express.Multer.File): Promise<SourceDocument> {
    const notebook = await this.notebookRepo.findById(notebookId, userId);
    if (!notebook) {
      throw new NotFoundError(`Notebook '${notebookId}' not found`);
    }

    // Hash the raw bytes before doing anything else — an exact re-upload is
    // rejected here with zero wasted Cloudinary upload or parsing work.
    const contentHash = sha256Hex(file.buffer);
    const existing = await this.sourceRepo.findByContentHash(notebookId, contentHash);
    if (existing) {
      throw new ConflictError(`This file has already been added to this notebook as "${existing.title}".`);
    }

    logger.info({ fileName: file.originalname, size: file.size, notebookId }, 'Uploading file to Cloudinary for ingestion');
    const fileUrl = await uploadToCloudinary(file.buffer, file.originalname);

    const source = await this.createSourceOrConflict({
      notebookId,
      title: file.originalname,
      fileType: 'pdf',
      fileUrl,
      status: 'processing',
      stage: 'queued',
      contentHash,
      metadata: { originalName: file.originalname, mimeType: file.mimetype, size: file.size },
    });

    await inngest.send(
      sourceFileUploaded.create({
        sourceId: source.id,
        notebookId,
        userId,
        fileUrl,
        mimeType: file.mimetype,
        originalName: file.originalname,
        contentHash,
      })
    );

    return source;
  }

  /**
   * Ingest Website URL -> Inngest pipeline (Firecrawl scrape, dedup, chunk,
   * persist, graph fan-out, all async).
   */
  async ingestWebsite(notebookId: string, userId: string, url: string): Promise<SourceDocument> {
    const notebook = await this.notebookRepo.findById(notebookId, userId);
    if (!notebook) {
      throw new NotFoundError(`Notebook '${notebookId}' not found`);
    }

    // Content (and its hash) isn't known until the page is fetched, so this
    // is only a cheap same-URL pre-check (catches double-clicks); the
    // authoritative content-hash dedup happens inside the Inngest function
    // once the page has actually been scraped.
    const activeByUrl = await this.sourceRepo.findActiveByUrl(notebookId, url);
    if (activeByUrl) {
      throw new ConflictError(
        activeByUrl.status === 'ready'
          ? `This URL has already been added to this notebook as "${activeByUrl.title}".`
          : 'This URL is already being processed for this notebook.'
      );
    }

    const source = await this.sourceRepo.createSource({
      notebookId,
      title: url,
      fileType: 'web',
      fileUrl: url,
      status: 'processing',
      stage: 'queued',
      metadata: { originalUrl: url },
    });

    await inngest.send(sourceWebsiteRequested.create({ sourceId: source.id, notebookId, userId, url }));

    return source;
  }

  /**
   * Ingest YouTube Video URL -> Inngest pipeline (transcript fetch, dedup,
   * chunk, persist, graph fan-out, all async).
   */
  async ingestYoutube(notebookId: string, userId: string, url: string): Promise<SourceDocument> {
    const notebook = await this.notebookRepo.findById(notebookId, userId);
    if (!notebook) {
      throw new NotFoundError(`Notebook '${notebookId}' not found`);
    }

    const activeByUrl = await this.sourceRepo.findActiveByUrl(notebookId, url);
    if (activeByUrl) {
      throw new ConflictError(
        activeByUrl.status === 'ready'
          ? `This video has already been added to this notebook as "${activeByUrl.title}".`
          : 'This video is already being processed for this notebook.'
      );
    }

    const source = await this.sourceRepo.createSource({
      notebookId,
      title: url,
      fileType: 'youtube',
      fileUrl: url,
      status: 'processing',
      stage: 'queued',
      metadata: { originalUrl: url },
    });

    await inngest.send(sourceYoutubeRequested.create({ sourceId: source.id, notebookId, userId, url }));

    return source;
  }

  /**
   * Ingest Plain Text Note -> Inngest pipeline (chunk, persist, graph
   * fan-out, async). Content is already known synchronously, so — like
   * files — it's hashed and dedup-checked up front.
   */
  async ingestText(notebookId: string, userId: string, title: string, text: string): Promise<SourceDocument> {
    const notebook = await this.notebookRepo.findById(notebookId, userId);
    if (!notebook) {
      throw new NotFoundError(`Notebook '${notebookId}' not found`);
    }

    const resolvedTitle = title || 'Pasted Text Note';
    const contentHash = sha256Hex(text);
    const existing = await this.sourceRepo.findByContentHash(notebookId, contentHash);
    if (existing) {
      throw new ConflictError(`This text has already been added to this notebook as "${existing.title}".`);
    }

    const source = await this.createSourceOrConflict({
      notebookId,
      title: resolvedTitle,
      fileType: 'text',
      status: 'processing',
      stage: 'queued',
      contentHash,
      metadata: { characterCount: text.length },
    });

    await inngest.send(
      sourceTextRequested.create({ sourceId: source.id, notebookId, userId, title: resolvedTitle, content: text, contentHash })
    );

    return source;
  }

  async deleteSource(notebookId: string, sourceId: string, userId: string) {
    const notebook = await this.notebookRepo.findById(notebookId, userId);
    if (!notebook) {
      throw new NotFoundError(`Notebook '${notebookId}' not found`);
    }
    const deleted = await this.sourceRepo.deleteSource(sourceId, notebookId);
    if (!deleted) {
      throw new NotFoundError(`Source document '${sourceId}' not found`);
    }
    return true;
  }

  /**
   * Insert a source row, converting a unique-constraint violation on
   * (notebookId, contentHash) into a friendly ConflictError. This is the
   * race-condition backstop for the synchronous dedup check above: two
   * identical uploads submitted at the same instant both pass the
   * SELECT-based pre-check (which found nothing, or we'd have thrown
   * already), but only one INSERT can win — we don't know the winner's
   * title without a second query, so this gives a generic-but-accurate
   * message rather than one more round-trip on an already-rare race.
   */
  private async createSourceOrConflict(data: Parameters<SourceRepository['createSource']>[0]): Promise<SourceDocument> {
    try {
      return await this.sourceRepo.createSource(data);
    } catch (err: any) {
      if (err?.code === UNIQUE_VIOLATION) {
        throw new ConflictError('This content is already being added to this notebook.');
      }
      throw err;
    }
  }
}
