import { sql } from 'drizzle-orm';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { GraphFactory } from '../../providers/graph/graph.factory.js';
import { logger } from '../../utils/logger.js';

// Generic document & conversation boilerplate meta-words to discard across any subject domain
const DOCUMENT_META_STOPWORDS = new Set([
  'video', 'videos', 'youtube video', 'youtube videos', 'channel', 'youtube channel',
  'user', 'users', 'speaker', 'author', 'developer', 'speaker 1', 'speaker 2',
  'paragraph', 'document', 'text', 'source', 'sources', 'link', 'links', 'page', 'pages',
  'thing', 'things', 'something', 'anything', 'item', 'items', 'stuff',
  'step', 'steps', 'point', 'points', 'part', 'parts', 'section', 'sections',
  'topic', 'topics', 'content', 'information', 'details', 'data', 'overview',
  'question', 'questions', 'answer', 'answers', 'summary', 'example', 'examples',
  'case', 'cases', 'issue', 'issues', 'problem', 'problems', 'solution', 'solutions',
  'minute', 'seconds', 'timestamp', 'chapter', 'slide', 'notes'
]);

const UniversalGraphSchema = z.object({
  triples: z.array(
    z.object({
      sourceName: z.string().describe('Specific named entity or distinct domain concept (e.g., Einstein, Pembrolizumab, GDPR, Maastricht Treaty, Berkshire Hathaway, React)'),
      sourceType: z.string().describe('Category: Person, Organization, Concept, Medicine, Law, Technology, Event, ScientificPrinciple, Location, Theory'),
      relation: z.string().describe('Clear uppercase relationship predicate (e.g., TREATS, CREATED_BY, REGULATES, DISCOVERED, CAUSES, PARTICIPATED_IN, USES, FOUNDED)'),
      targetName: z.string().describe('Specific named target entity or concept'),
      targetType: z.string().describe('Category of target entity'),
      context: z.string().describe('One concise sentence providing verifiable context for this relationship'),
    })
  ),
});

const EXTRACTION_FEW_SHOT_GUIDANCE = `
HIGH-QUALITY EXTRACTION EXAMPLES ACROSS MULTIPLE DOMAINS:

Example 1: Medicine & Healthcare
Input: "Clinical trials showed that Pembrolizumab binds to the PD-1 receptor on human T-cells, preventing interaction with PD-L1 on melanoma tumor cells and reversing immunosuppression."
Triples:
- sourceName: "Pembrolizumab", sourceType: "Medicine", relation: "BINDS_TO", targetName: "PD-1 Receptor", targetType: "BiologicalStructure", context: "Binds to PD-1 receptors on T-cells"
- sourceName: "Pembrolizumab", sourceType: "Medicine", relation: "TREATS", targetName: "Melanoma", targetType: "Disease", context: "Reverses immunosuppression to treat melanoma"
- sourceName: "PD-L1", sourceType: "BiologicalStructure", relation: "PRODUCED_BY", targetName: "Tumor Cells", targetType: "CellType", context: "Expressed by melanoma cells to evade immune destruction"

Example 2: Law & History
Input: "Signed in 1992, the Maastricht Treaty created the European Union and paved the way for the single Euro currency managed by the European Central Bank in Frankfurt."
Triples:
- sourceName: "Maastricht Treaty", sourceType: "Treaty", relation: "ESTABLISHED", targetName: "European Union", targetType: "Organization", context: "Signed in 1992 to establish the European Union"
- sourceName: "European Central Bank", sourceType: "FinancialInstitution", relation: "MANAGES", targetName: "Euro", targetType: "Currency", context: "Central bank based in Frankfurt responsible for monetary policy"
- sourceName: "European Union", sourceType: "Organization", relation: "ADOPTED", targetName: "Euro", targetType: "Currency", context: "Adopted as the official common currency"

Example 3: Finance & Business
Input: "Berkshire Hathaway, an investment conglomerate led by Warren Buffett, holds a 30% equity stake in American Express and fully owns Geico insurance."
Triples:
- sourceName: "Warren Buffett", sourceType: "Person", relation: "LEADS", targetName: "Berkshire Hathaway", targetType: "Company", context: "Chairman and CEO of the conglomerate"
- sourceName: "Berkshire Hathaway", sourceType: "Company", relation: "HOLDS_STAKE_IN", targetName: "American Express", targetType: "Company", context: "Maintains a 30% equity ownership stake"
- sourceName: "Geico", sourceType: "Company", relation: "SUBSIDIARY_OF", targetName: "Berkshire Hathaway", targetType: "Company", context: "Operates as a wholly owned insurance subsidiary"

Example 4: Physics & Science
Input: "James Clerk Maxwell formulated the theory of electromagnetism in 1865, showing that light propagates as transverse electromagnetic waves through oscillating electric and magnetic fields."
Triples:
- sourceName: "James Clerk Maxwell", sourceType: "Person", relation: "FORMULATED", targetName: "Electromagnetism", targetType: "ScientificTheory", context: "Formulated the unified theory in 1865"
- sourceName: "Light", sourceType: "PhysicalPhenomenon", relation: "CONSISTS_OF", targetName: "Electromagnetic Waves", targetType: "PhysicsConcept", context: "Demonstrated to propagate as transverse electromagnetic waves"

Example 5: Technology & Software Architecture
Input: "Uber uses Apache Kafka for real-time telemetry streaming, routing events to Apache Flink for low-latency stateful stream analytics."
Triples:
- sourceName: "Uber", sourceType: "Company", relation: "USES", targetName: "Apache Kafka", targetType: "Technology", context: "Ingests real-time telemetry and ride events"
- sourceName: "Apache Kafka", sourceType: "Technology", relation: "STREAMS_DATA_TO", targetName: "Apache Flink", targetType: "Technology", context: "Streams event batches to Flink for stateful real-time analytics"

NEGATIVE EXAMPLES (WHAT TO DISCARD):
- "This video is about server management" -> REJECT (Generic meta-noun: "video")
- "The speaker mentions three points" -> REJECT (Generic meta-nouns: "speaker", "points")
- "The user asked for more details" -> REJECT (Conversational boilerplate)
`;

export class GraphWorkerService {
  private isProcessing = false;
  private timer: NodeJS.Timeout | null = null;

  /**
   * Filter and sanitize raw triples to remove generic document boilerplate
   */
  private filterHighValueTriples(triples: any[]): any[] {
    if (!Array.isArray(triples)) return [];

    const valid: any[] = [];
    for (const t of triples) {
      const src = t.sourceName?.trim();
      const tgt = t.targetName?.trim();
      const rel = t.relation?.trim().toUpperCase();

      if (!src || !tgt || !rel) continue;
      if (src.length < 2 || tgt.length < 2) continue;
      if (src.toLowerCase() === tgt.toLowerCase()) continue;

      // Discard document/conversation meta-words
      if (DOCUMENT_META_STOPWORDS.has(src.toLowerCase()) || DOCUMENT_META_STOPWORDS.has(tgt.toLowerCase())) {
        continue;
      }

      valid.push({
        sourceName: src,
        sourceType: t.sourceType || 'Concept',
        relation: rel,
        targetName: tgt,
        targetType: t.targetType || 'Concept',
        context: t.context || '',
      });
    }

    // Limit to top 5 highest-salience triples per text block
    return valid.slice(0, 5);
  }

  /**
   * Clean up document meta-words from Neo4j
   */
  async cleanupMetaNodes(): Promise<void> {
    try {
      const graphProvider = GraphFactory.getProvider();
      const stopwords = Array.from(DOCUMENT_META_STOPWORDS);
      await graphProvider.runQuery(
        `
        MATCH (e:Entity)
        WHERE toLower(e.name) IN $stopwords OR size(e.name) < 2
        DETACH DELETE e
        `,
        { stopwords }
      );
      logger.info('[GraphWorker] Successfully cleaned document meta-nodes from Neo4j');
    } catch (err) {
      logger.error({ err }, '[GraphWorker] Error during meta-node cleanup');
    }
  }

  /**
   * Process a single batch of un-indexed document chunks and chat messages
   */
  async processBatch(): Promise<{ processedChunks: number; processedChats: number; triplesCount: number }> {
    if (this.isProcessing) {
      return { processedChunks: 0, processedChats: 0, triplesCount: 0 };
    }

    this.isProcessing = true;
    let processedChunks = 0;
    let processedChats = 0;
    let totalTriples = 0;

    try {
      const graphProvider = GraphFactory.getProvider();

      // 1. Fetch un-indexed document chunks (limit 10 per cycle)
      const chunksResult: any = await db.execute(sql`
        SELECT dc.id, dc.notebook_id, dc.content, n.user_id
        FROM document_chunks dc
        JOIN notebooks n ON dc.notebook_id = n.id
        WHERE dc.is_graph_indexed = FALSE
        LIMIT 10
      `);

      const unindexedChunks = chunksResult.rows || [];

      for (const chunk of unindexedChunks) {
        try {
          const { object } = await generateObject({
            model: openai('gpt-4o-mini'),
            schema: UniversalGraphSchema,
            prompt: `
You are a Universal Knowledge Graph Extraction Engine for notebooks across all academic, professional, and general domains (Medicine, Law, History, Business, Finance, Science, Literature, Technology, Philosophy, etc.).

Analyze the text chunk below and extract the essential subject-predicate-object knowledge graph triples:

"""
${chunk.content}
"""

${EXTRACTION_FEW_SHOT_GUIDANCE}

CORE GUIDELINES:
1. Extract concrete, domain-meaningful entities and proper nouns (e.g., people, organizations, medical drugs, legal statutes, scientific laws, geographical locations, business metrics, or core domain principles).
2. DO NOT extract words describing the document itself (e.g. "paragraph", "video", "speaker", "document", "source", "step", "summary", "link", "things").
3. Use precise, expressive relationship verbs (e.g., "DISCOVERED_BY", "TREATS", "LEADS_TO", "MEMBER_OF", "REGULATED_BY", "USES", "CONTRADICTS", "FOUNDED").
4. Extract up to 4-5 high-value triples. If the text has no meaningful domain facts, return an empty triples array [].
            `.trim(),
          });

          const filtered = this.filterHighValueTriples(object.triples);

          if (filtered.length > 0) {
            await graphProvider.upsertBatchTriples(
              filtered,
              chunk.notebook_id,
              chunk.user_id || 'default_user'
            );
            totalTriples += filtered.length;
          }

          // Mark chunk as indexed
          await db.execute(sql`
            UPDATE document_chunks
            SET is_graph_indexed = TRUE
            WHERE id = ${chunk.id}
          `);
          processedChunks++;
        } catch (err) {
          logger.error({ err, chunkId: chunk.id }, 'Failed to extract graph from document chunk');
        }
      }

      // 2. Fetch un-indexed chat messages (limit 15 per cycle)
      const chatsResult: any = await db.execute(sql`
        SELECT cm.id, cm.notebook_id, cm.user_id, cm.role, cm.content
        FROM chat_messages cm
        WHERE cm.is_graph_indexed = FALSE
        ORDER BY cm.created_at ASC
        LIMIT 15
      `);

      const unindexedChats = chatsResult.rows || [];

      if (unindexedChats.length > 0) {
        const groupedByNotebook: Record<string, typeof unindexedChats> = {};
        for (const chat of unindexedChats) {
          if (!groupedByNotebook[chat.notebook_id]) {
            groupedByNotebook[chat.notebook_id] = [];
          }
          groupedByNotebook[chat.notebook_id].push(chat);
        }

        for (const [notebookId, msgs] of Object.entries(groupedByNotebook)) {
          const conversationText = msgs
            .map((m: any) => `${m.role.toUpperCase()}: ${m.content}`)
            .join('\n\n');
          const userId = msgs[0]?.user_id || 'default_user';

          try {
            const { object } = await generateObject({
              model: openai('gpt-4o-mini'),
              schema: UniversalGraphSchema,
              prompt: `
You are a Universal Knowledge Graph Extraction Engine.
Extract meaningful, factual knowledge graph entities and relationships discussed in this conversation:

"""
${conversationText}
"""

${EXTRACTION_FEW_SHOT_GUIDANCE}

CORE GUIDELINES:
1. Extract distinct subject matter facts, people, theories, locations, or core domain concepts.
2. DO NOT extract conversational filler or document meta-words (e.g. "user", "assistant", "question", "answer", "details").
3. Return an empty triples array if no meaningful facts were discussed.
              `.trim(),
            });

            const filtered = this.filterHighValueTriples(object.triples);

            if (filtered.length > 0) {
              await graphProvider.upsertBatchTriples(filtered, notebookId, userId);
              totalTriples += filtered.length;
            }

            // Mark these chat messages as indexed
            const messageIds = msgs.map((m: any) => m.id);
            for (const mid of messageIds) {
              await db.execute(sql`
                UPDATE chat_messages
                SET is_graph_indexed = TRUE
                WHERE id = ${mid}
              `);
            }
            processedChats += msgs.length;
          } catch (err) {
            logger.error({ err, notebookId }, 'Failed to extract graph from chat conversation');
          }
        }
      }

      if (processedChunks > 0 || processedChats > 0) {
        logger.info(
          { processedChunks, processedChats, totalTriples },
          '[GraphWorker] Successfully indexed domain-agnostic graph batch into Neo4j'
        );
      }
    } catch (error) {
      logger.error({ error }, '[GraphWorker] Error during graph worker execution cycle');
    } finally {
      this.isProcessing = false;
    }

    return { processedChunks, processedChats, triplesCount: totalTriples };
  }

  /**
   * Start recurring background polling
   */
  start(intervalMs = 15000): void {
    if (this.timer) return;

    logger.info({ intervalMs }, '[GraphWorker] Background Neo4j Knowledge Graph Worker started');

    // Run initial cleanup of document meta-words + first batch
    setTimeout(async () => {
      await this.cleanupMetaNodes();
      this.processBatch().catch((err) =>
        logger.error({ err }, '[GraphWorker] Initial batch error')
      );
    }, 3000);

    // Recurring interval
    this.timer = setInterval(() => {
      this.processBatch().catch((err) =>
        logger.error({ err }, '[GraphWorker] Periodic batch error')
      );
    }, intervalMs);
  }

  /**
   * Stop recurring background polling
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('[GraphWorker] Background Neo4j Knowledge Graph Worker stopped');
    }
  }
}

export const graphWorker = new GraphWorkerService();
