import { logger } from './logger.js';

/**
 * Per-query retrieval trace — records every step of the retrieval pipeline
 * so developers can inspect why a source was or wasn't retrieved.
 *
 * Logged at DEBUG level (not visible in production by default).
 * Set LOG_LEVEL=debug in .env to enable.
 */
export interface RetrievalTrace {
  query: string;
  correctedQuery?: string;
  expandedKeywords?: string[];
  entityCandidates?: string[];
  bm25Results: {
    id: string;
    heading?: string;
    sectionPath?: string;
    score: number;
    contentPreview: string;
  }[];
  graphResults: {
    entity: string;
    entityType: string;
    relations: { target: string; relationType: string; confidence?: number; evidence?: string }[];
  }[];
  memoryResults: {
    type: string;
    text: string;
    score?: number;
  }[];
  rerankScores: {
    id: string;
    sourceType: string;
    rerankScore: number;
    contentPreview: string;
  }[];
  finalContext: string;
  durationMs?: number;
}

export class RetrievalTracer {
  private trace: Partial<RetrievalTrace>;
  private startTime: number;

  constructor(query: string) {
    this.trace = { query, bm25Results: [], graphResults: [], memoryResults: [], rerankScores: [] };
    this.startTime = Date.now();
  }

  recordQuery(correctedQuery: string, expandedKeywords: string[], entityCandidates: string[]) {
    this.trace.correctedQuery = correctedQuery;
    this.trace.expandedKeywords = expandedKeywords;
    this.trace.entityCandidates = entityCandidates;
  }

  recordBM25(chunks: any[]) {
    this.trace.bm25Results = chunks.map((c) => ({
      id: c.id,
      heading: c.heading,
      sectionPath: c.section_path,
      score: c.bm25_score,
      contentPreview: (c.content || '').slice(0, 120),
    }));
  }

  recordGraph(entities: any[], relations: any[]) {
    this.trace.graphResults = entities.map((e) => ({
      entity: e.name,
      entityType: e.type,
      relations: relations
        .filter((r) => r.sourceEntity?.toLowerCase() === e.name?.toLowerCase())
        .map((r) => ({
          target: r.targetEntity,
          relationType: r.relationType,
          confidence: r.confidence,
          evidence: r.evidence,
        })),
    }));
  }

  recordMemory(items: { type: string; text: string; score?: number }[]) {
    this.trace.memoryResults = items;
  }

  recordRerank(rankedItems: any[]) {
    this.trace.rerankScores = rankedItems.map((r) => ({
      id: r.document.id,
      sourceType: r.document.sourceType,
      rerankScore: r.score,
      contentPreview: r.document.text.slice(0, 120),
    }));
  }

  recordFinalContext(context: string) {
    this.trace.finalContext = context;
    this.trace.durationMs = Date.now() - this.startTime;
  }

  /** Emit the full trace as a single structured DEBUG log. */
  emit() {
    logger.debug({ retrieval_trace: this.trace }, '[RetrievalTrace] Pipeline trace');
  }

  /** Return the trace object (for testing or explicit logging). */
  getTrace(): Partial<RetrievalTrace> {
    return this.trace;
  }
}
