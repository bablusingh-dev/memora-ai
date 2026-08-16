import { SourceRepository } from '../repositories/source.repository.js';
import { NotebookRepository } from '../repositories/notebook.repository.js';
import { ChunkingService } from './chunking.service.js';
import { FirecrawlService } from './firecrawl.service.js';
import { YoutubeService } from './youtube.service.js';
import { uploadToCloudinary } from '../utils/cloudinary.js';
import { NotFoundError } from '../utils/api-error.js';
import { logger } from '../utils/logger.js';
import pdfParse from 'pdf-parse';

export class SourceService {
  private sourceRepo: SourceRepository;
  private notebookRepo: NotebookRepository;
  private firecrawlService: FirecrawlService;
  private youtubeService: YoutubeService;

  constructor() {
    this.sourceRepo = new SourceRepository();
    this.notebookRepo = new NotebookRepository();
    this.firecrawlService = new FirecrawlService();
    this.youtubeService = new YoutubeService();
  }

  async getSources(notebookId: string, userId: string) {
    const notebook = await this.notebookRepo.findById(notebookId, userId);
    if (!notebook) {
      throw new NotFoundError(`Notebook '${notebookId}' not found`);
    }
    return await this.sourceRepo.findByNotebookId(notebookId);
  }

  /**
   * Ingest PDF/Document File -> Upload to Cloudinary -> Parse Text -> Chunk -> ParadeDB BM25 insert
   */
  async ingestFile(notebookId: string, userId: string, file: Express.Multer.File) {
    const notebook = await this.notebookRepo.findById(notebookId, userId);
    if (!notebook) {
      throw new NotFoundError(`Notebook '${notebookId}' not found`);
    }

    logger.info({ fileName: file.originalname, size: file.size, notebookId }, 'Processing file ingestion');

    // Upload asset to Cloudinary
    const fileUrl = await uploadToCloudinary(file.buffer, file.originalname);

    // Extract text from PDF buffer
    let rawText = '';
    try {
      if (file.mimetype === 'application/pdf') {
        const parseFn = (pdfParse as any).default || pdfParse;
        const pdfData = await parseFn(file.buffer);
        rawText = pdfData.text;
      } else {
        rawText = file.buffer.toString('utf-8');
      }
    } catch (err: any) {
      logger.error({ err: err.message }, 'Failed to parse file text, using fallback text');
      rawText = file.buffer.toString('utf-8');
    }

    const source = await this.sourceRepo.createSource({
      notebookId,
      title: file.originalname,
      fileType: 'pdf',
      fileUrl,
      status: 'processing',
      metadata: { originalName: file.originalname, mimeType: file.mimetype, size: file.size },
    });

    await this.processChunksAndMarkReady(source.id, notebookId, rawText, file.originalname, 'pdf');

    return {
      ...source,
      status: 'ready',
    };
  }

  /**
   * Ingest Website URL via Firecrawl -> Chunk -> ParadeDB BM25 insert
   */
  async ingestWebsite(notebookId: string, userId: string, url: string) {
    const notebook = await this.notebookRepo.findById(notebookId, userId);
    if (!notebook) {
      throw new NotFoundError(`Notebook '${notebookId}' not found`);
    }

    const { title, markdown } = await this.firecrawlService.scrapeUrl(url);

    const source = await this.sourceRepo.createSource({
      notebookId,
      title,
      fileType: 'web',
      fileUrl: url,
      status: 'processing',
      metadata: { originalUrl: url },
    });

    await this.processChunksAndMarkReady(source.id, notebookId, markdown, title, 'web');

    return {
      ...source,
      status: 'ready',
    };
  }

  /**
   * Ingest YouTube Video URL -> Extract Transcript -> Chunk -> ParadeDB BM25 insert
   */
  async ingestYoutube(notebookId: string, userId: string, url: string) {
    const notebook = await this.notebookRepo.findById(notebookId, userId);
    if (!notebook) {
      throw new NotFoundError(`Notebook '${notebookId}' not found`);
    }

    const { title, text } = await this.youtubeService.getTranscript(url);

    const source = await this.sourceRepo.createSource({
      notebookId,
      title,
      fileType: 'youtube',
      fileUrl: url,
      status: 'processing',
      metadata: { originalUrl: url },
    });

    await this.processChunksAndMarkReady(source.id, notebookId, text, title, 'youtube');

    return {
      ...source,
      status: 'ready',
    };
  }

  /**
   * Ingest Plain Text Note -> Chunk -> ParadeDB BM25 insert
   */
  async ingestText(notebookId: string, userId: string, title: string, text: string) {
    const notebook = await this.notebookRepo.findById(notebookId, userId);
    if (!notebook) {
      throw new NotFoundError(`Notebook '${notebookId}' not found`);
    }

    const source = await this.sourceRepo.createSource({
      notebookId,
      title: title || 'Pasted Text Note',
      fileType: 'text',
      status: 'processing',
      metadata: { characterCount: text.length },
    });

    await this.processChunksAndMarkReady(source.id, notebookId, text, title || 'Pasted Text Note', 'text');

    return {
      ...source,
      status: 'ready',
    };
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

  private async processChunksAndMarkReady(
    sourceId: string,
    notebookId: string,
    rawText: string,
    title: string,
    fileType: 'pdf' | 'web' | 'youtube' | 'text' = 'text'
  ) {
    const chunks = ChunkingService.createChunks(rawText, title, fileType);
    const dbChunks = chunks.map((c) => ({
      sourceId,
      notebookId,
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
    }));

    await this.sourceRepo.insertChunks(dbChunks);
    await this.sourceRepo.updateSourceStatus(sourceId, 'ready');
  }
}
