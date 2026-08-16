import { sql } from 'drizzle-orm';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { GraphFactory } from '../../providers/graph/graph.factory.js';
import { logger } from '../../utils/logger.js';

// ---------------------------------------------------------------------------
// Stop-word guard — discard entity names that are document/conversation meta
// ---------------------------------------------------------------------------
const DOCUMENT_META_STOPWORDS = new Set([
  'video', 'videos', 'youtube', 'channel',
  'user', 'users', 'speaker', 'author', 'developer',
  'paragraph', 'document', 'text', 'source', 'sources', 'link', 'links', 'page', 'pages',
  'thing', 'things', 'something', 'anything', 'item', 'items', 'stuff',
  'step', 'steps', 'point', 'points', 'part', 'parts', 'section', 'sections',
  'topic', 'topics', 'content', 'information', 'details', 'data', 'overview',
  'question', 'questions', 'answer', 'answers', 'summary', 'example', 'examples',
  'case', 'cases', 'issue', 'issues', 'problem', 'problems', 'solution', 'solutions',
  'minute', 'seconds', 'timestamp', 'chapter', 'slide', 'notes', 'system', 'process', 'method',
]);

// ---------------------------------------------------------------------------
// LLM extraction schema with mandatory confidence + evidence
// ---------------------------------------------------------------------------
const GraphExtractionSchema = z.object({
  triples: z.array(
    z.object({
      sourceName: z.string().describe('Specific named entity (person, org, product, technology, concept, event, location, law, etc.)'),
      sourceType: z.string().describe('Entity category: Person, Organization, Product, Technology, Concept, Location, Event, Document, Topic, Project, Date, Disease, Law, ScientificPrinciple'),
      relation: z.string().describe('Relationship predicate in UPPER_SNAKE_CASE (e.g. CREATED_BY, TREATS, FOUNDED, REGULATES, USES, DISCOVERED)'),
      targetName: z.string().describe('Specific named target entity'),
      targetType: z.string().describe('Entity category of the target'),
      evidence: z.string().describe('A direct verbatim quote or close paraphrase from the chunk that proves this relationship exists. Must be non-empty.'),
      confidence: z.number().min(0).max(1).describe('Confidence that the source chunk explicitly supports this relationship. 0.9-1.0 = explicit statement. 0.75-0.89 = strong implication. 0.60-0.74 = weak implication. Below 0.60 = do not include.'),
    })
  ),
});

const EXTRACTION_GUIDANCE = `
HIGH-QUALITY EXTRACTION EXAMPLES:

Example 1 (Medicine):
Chunk: "Clinical trials showed that Pembrolizumab binds to the PD-1 receptor on T-cells, preventing PD-L1 interaction and reversing immunosuppression in melanoma patients."
Triples:
- sourceName: "Pembrolizumab", relation: "BINDS_TO", targetName: "PD-1 Receptor", evidence: "Pembrolizumab binds to the PD-1 receptor on T-cells", confidence: 0.98
- sourceName: "Pembrolizumab", relation: "TREATS", targetName: "Melanoma", evidence: "reversing immunosuppression in melanoma patients", confidence: 0.92

Example 2 (Technology):
Chunk: "Uber uses Apache Kafka for real-time telemetry streaming, routing events to Apache Flink for stateful analytics."
Triples:
- sourceName: "Uber", relation: "USES", targetName: "Apache Kafka", evidence: "Uber uses Apache Kafka for real-time telemetry streaming", confidence: 0.97
- sourceName: "Apache Kafka", relation: "STREAMS_DATA_TO", targetName: "Apache Flink", evidence: "routing events to Apache Flink for stateful analytics", confidence: 0.95

REJECTION RULES — Do NOT create a triple if:
- The source chunk does not contain clear evidence (evidence must be a real quote/paraphrase from the chunk)
- confidence < 0.60
- Either entity is a generic meta-word (video, document, speaker, things, steps, system, process)
- The subject and object are the same entity
`;

// Minimum confidence threshold for accepting a relationship into Neo4j
const MIN_CONFIDENCE = 0.60;

export class GraphWorkerService {
  private isProcessing = false;
  private timer: NodeJS.Timeout | null = null;

  /**
   * Filter and normalize extracted triples before Neo4j insertion.
   * Applies: stopword check, self-loop reject, minimum confidence, evidence required.
   */
  private filterTriples(
    triples: z.infer<typeof GraphExtractionSchema>['triples'],
    chunkId: string
  ) {
    const valid: ReturnType<typeof this.normalizeTriple>[] = [];

    for (const t of triples) {
      const src = t.sourceName?.trim();
      const tgt = t.targetName?.trim();
      const rel = t.relation?.trim().toUpperCase().replace(/\s+/g, '_');

      if (!src || !tgt || !rel) continue;
      if (src.length < 2 || tgt.length < 2) continue;

      // Reject self-loops
      if (src.toLowerCase() === tgt.toLowerCase()) continue;

      // Reject meta-words
      if (DOCUMENT_META_STOPWORDS.has(src.toLowerCase()) || DOCUMENT_META_STOPWORDS.has(tgt.toLowerCase())) continue;

      // Evidence must be non-empty
      if (!t.evidence?.trim()) continue;

      // Confidence threshold
      if ((t.confidence ?? 0) < MIN_CONFIDENCE) {
        logger.debug({ src, rel, tgt, confidence: t.confidence }, '[GraphWorker] Triple below confidence threshold — rejected');
        continue;
      }

      valid.push(this.normalizeTriple(t, chunkId));
    }

    // Cap at 5 highest-confidence triples per chunk to keep graph precise
    return valid.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0)).slice(0, 5);
  }

  /**
   * Normalize entity names for canonical identity.
   * Removes trailing punctuation, normalizes whitespace, lowercases for comparison.
   */
  private normalizeTriple(
    t: z.infer<typeof GraphExtractionSchema>['triples'][number],
    chunkId: string
  ) {
    const normalize = (name: string) =>
      name.trim().replace(/\s+/g, ' ').replace(/[.,;:!?]$/, '');

    return {
      sourceName: normalize(t.sourceName),
      sourceType: t.sourceType || 'Concept',
      relation: t.relation.toUpperCase().replace(/\s+/g, '_'),
      targetName: normalize(t.targetName),
      targetType: t.targetType || 'Concept',
      context: t.evidence,  // stored as context for backward compat
      evidence: t.evidence,
      confidence: t.confidence,
      sourceChunkId: chunkId,
    };
  }

  /**
   * Process one batch of un-indexed document chunks.
   * NOTE: Chat messages are intentionally NOT processed here — conversation
   * entities must not pollute the document knowledge graph.
   */
  async processBatch(): Promise<{ processedChunks: number; triplesCount: number }> {
    if (this.isProcessing) return { processedChunks: 0, triplesCount: 0 };

    this.isProcessing = true;
    let processedChunks = 0;
    let totalTriples = 0;

    try {
      const graphProvider = GraphFactory.getProvider();

      // Fetch un-indexed document chunks (limit 10 per cycle)
      const chunksResult: any = await db.execute(sql`
        SELECT dc.id, dc.notebook_id, dc.content, dc.retrieval_content, dc.heading, dc.section_path, n.user_id
        FROM document_chunks dc
        JOIN notebooks n ON dc.notebook_id = n.id
        WHERE dc.is_graph_indexed = FALSE
        LIMIT 10
      `);
      const unindexedChunks = chunksResult.rows || [];

      for (const chunk of unindexedChunks) {
        try {
          // Use retrieval_content if available (context-enriched) — gives the LLM
          // better context, but fall back to plain content for old chunks.
          const textForExtraction = chunk.retrieval_content || chunk.content;

          const { object } = await generateObject({
            model: openai('gpt-4o-mini'),
            schema: GraphExtractionSchema,
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
${chunk.section_path ? `Section path: ${chunk.section_path}` : ''}

Text:
"""
${textForExtraction.slice(0, 3000)}
"""

${EXTRACTION_GUIDANCE}
`.trim(),
          });

          const filtered = this.filterTriples(object.triples, chunk.id);

          if (filtered.length > 0) {
            await graphProvider.upsertBatchTriples(
              filtered,
              chunk.notebook_id,
              chunk.user_id || 'default_user'
            );
            totalTriples += filtered.length;
          }

          // Mark chunk as graph-indexed
          await db.execute(sql`
            UPDATE document_chunks SET is_graph_indexed = TRUE WHERE id = ${chunk.id}
          `);
          processedChunks++;
        } catch (err) {
          logger.error({ err, chunkId: chunk.id }, '[GraphWorker] Failed to extract graph from chunk');
          // Still mark it indexed to avoid retry loops on bad chunks
          await db.execute(sql`
            UPDATE document_chunks SET is_graph_indexed = TRUE WHERE id = ${chunk.id}
          `).catch(() => {});
        }
      }

      if (processedChunks > 0) {
        logger.info({ processedChunks, totalTriples }, '[GraphWorker] Batch indexed document chunks into knowledge graph');
      }
    } catch (error) {
      logger.error({ error }, '[GraphWorker] Error during graph worker execution cycle');
    } finally {
      this.isProcessing = false;
    }

    return { processedChunks, triplesCount: totalTriples };
  }

  /**
   * Remove entity nodes created from generic meta-words.
   * Safe to run periodically to clean up older data.
   */
  async cleanupMetaNodes(): Promise<void> {
    try {
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
      logger.info('[GraphWorker] Meta-node cleanup completed');
    } catch (err) {
      logger.error({ err }, '[GraphWorker] Error during meta-node cleanup');
    }
  }

  start(intervalMs = 15000): void {
    if (this.timer) return;
    logger.info({ intervalMs }, '[GraphWorker] Knowledge Graph Worker started');

    setTimeout(async () => {
      await this.cleanupMetaNodes();
      this.processBatch().catch((err) => logger.error({ err }, '[GraphWorker] Initial batch error'));
    }, 3000);

    this.timer = setInterval(() => {
      this.processBatch().catch((err) => logger.error({ err }, '[GraphWorker] Periodic batch error'));
    }, intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('[GraphWorker] Knowledge Graph Worker stopped');
    }
  }
}

export const graphWorker = new GraphWorkerService();
