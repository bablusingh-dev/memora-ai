import { sql } from 'drizzle-orm';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { GraphFactory } from '../../providers/graph/graph.factory.js';
import { logger } from '../../utils/logger.js';

const GraphExtractionSchema = z.object({
  triples: z.array(
    z.object({
      sourceName: z.string().describe('Source entity name (e.g., Hitesh, React, ParadeDB, Python, Docker)'),
      sourceType: z.string().describe('Person, Technology, Organization, Concept, Framework, Project, Topic'),
      relation: z.string().describe('Clear uppercase relationship (e.g., CREATED_BY, USES, TEACHES, DEVELOPS, IS_A, WORKS_ON, INTEGRATES_WITH)'),
      targetName: z.string().describe('Target entity name'),
      targetType: z.string().describe('Category of target entity'),
      context: z.string().describe('Brief sentence explaining this connection'),
    })
  ),
});

export class GraphWorkerService {
  private isProcessing = false;
  private timer: NodeJS.Timeout | null = null;

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
            schema: GraphExtractionSchema,
            prompt: `
Extract key knowledge graph entities and directed relationships (subject -> predicate -> object) from the following text chunk:

"""
${chunk.content}
"""

Guidelines:
- Identify key people, frameworks, tools, companies, concepts, and relationships.
- Keep entity names normalized and concise (e.g. "Hitesh Choudhary", "React", "PostgreSQL").
- Use meaningful predicate relations (e.g. "TEACHES", "FOUNDED", "USES", "INTEGRATES_WITH").
- Return an empty triples array if no meaningful relationships exist.
            `.trim(),
          });

          if (object.triples && object.triples.length > 0) {
            await graphProvider.upsertBatchTriples(
              object.triples,
              chunk.notebook_id,
              chunk.user_id || 'default_user'
            );
            totalTriples += object.triples.length;
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
        // Group consecutive messages by notebook
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
              schema: GraphExtractionSchema,
              prompt: `
Extract all factual knowledge graph entities and relationships discussed in this conversation:

"""
${conversationText}
"""

Guidelines:
- Extract factual statements about subjects, people, tools, tasks, and concepts.
- Example: "Hitesh" -> "WORKS_IN" -> "Software Development", "Hitesh" -> "CREATES" -> "Programming Tutorials".
- Return an empty triples array if no meaningful facts are present.
              `.trim(),
            });

            if (object.triples && object.triples.length > 0) {
              await graphProvider.upsertBatchTriples(object.triples, notebookId, userId);
              totalTriples += object.triples.length;
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
          '[GraphWorker] Successfully indexed background graph batch into Neo4j'
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

    // Run first batch immediately after a small delay
    setTimeout(() => {
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
