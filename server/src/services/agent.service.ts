import { createOpenAI } from '@ai-sdk/openai';
import { streamText, tool, isStepCount } from 'ai';
import { z } from 'zod';
import { env } from '../config/env.js';
import { NotebookRepository } from '../repositories/notebook.repository.js';
import { ChatRepository } from '../repositories/chat.repository.js';
import { MemoryCoordinatorService } from './memory/memory-coordinator.service.js';
import { MemoryExtractorService } from './memory/memory-extractor.service.js';
import { RerankService } from './rerank.service.js';
import { RuntimeEvaluatorService } from './eval/runtime-evaluator.service.js';
import { GraphFactory } from '../providers/graph/graph.factory.js';
import { MemoryFactory } from '../providers/memory/memory.factory.js';
import { FirecrawlService } from './firecrawl.service.js';
import { db } from '../db/index.js';
import { notes } from '../db/schema.js';
import { logger } from '../utils/logger.js';
import { BadRequestError } from '../utils/api-error.js';

export class AgentService {
  private notebookRepo: NotebookRepository;
  private chatRepo: ChatRepository;
  private memoryCoordinator: MemoryCoordinatorService;
  private memoryExtractor: MemoryExtractorService;
  private rerankService: RerankService;
  private evaluatorService: RuntimeEvaluatorService;
  private firecrawlService: FirecrawlService;
  private graphProvider = GraphFactory.getProvider();
  private memoryProvider = MemoryFactory.getProvider();

  constructor() {
    this.notebookRepo = new NotebookRepository();
    this.chatRepo = new ChatRepository();
    this.memoryCoordinator = new MemoryCoordinatorService();
    this.memoryExtractor = new MemoryExtractorService();
    this.rerankService = new RerankService();
    this.evaluatorService = new RuntimeEvaluatorService();
    this.firecrawlService = new FirecrawlService();
  }

  /**
   * Get historical chat messages for a notebook
   */
  async getChatHistory(notebookId: string, userId: string) {
    const notebook = await this.notebookRepo.findById(notebookId, userId);
    if (!notebook) {
      throw new BadRequestError(`Notebook '${notebookId}' not found or access denied`);
    }
    return await this.chatRepo.findByNotebookId(notebookId, userId);
  }

  /**
   * Clear historical chat messages for a notebook
   */
  async clearChatHistory(notebookId: string, userId: string) {
    const notebook = await this.notebookRepo.findById(notebookId, userId);
    if (!notebook) {
      throw new BadRequestError(`Notebook '${notebookId}' not found or access denied`);
    }
    return await this.chatRepo.clearByNotebookId(notebookId, userId);
  }

  /**
   * Execute Agentic RAG chat with multi-tier memory, reranking, tool calling, and response streaming
   */
  async streamAgentChat(
    notebookId: string,
    userId: string,
    messages: any[],
    options: { enableWebSearch?: boolean } = {}
  ) {
    const isWebSearchEnabled = Boolean(options.enableWebSearch);
    // Verify user owns notebook
    const notebook = await this.notebookRepo.findById(notebookId, userId);
    if (!notebook) {
      throw new BadRequestError(`Notebook '${notebookId}' not found or access denied`);
    }

    if (!env.OPENAI_API_KEY || env.OPENAI_API_KEY === 'sk-placeholder') {
      throw new BadRequestError(
        'OpenAI API Key is missing or set to placeholder. Please add OPENAI_API_KEY to server/.env to enable AI streaming and tool calling.'
      );
    }

    // Extract the latest user query text
    let userQuery = '';
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMsg) {
      if (typeof lastUserMsg.content === 'string') {
        userQuery = lastUserMsg.content;
      } else if (Array.isArray(lastUserMsg.parts)) {
        userQuery = lastUserMsg.parts
          .filter((p: any) => p.type === 'text')
          .map((p: any) => p.text)
          .join('');
      }
    }

    // Persist the latest incoming user message to the database
    try {
      if (userQuery.trim()) {
        await this.chatRepo.createMessage({
          notebookId,
          userId,
          role: 'user',
          content: userQuery.trim(),
          parts: lastUserMsg?.parts || [{ type: 'text', text: userQuery.trim() }],
        });
      }
    } catch (err) {
      logger.error({ err, notebookId }, 'Failed to persist user chat message to database');
    }

    // 1. Multi-tier Cognitive Memory Retrieval (Short-term, Semantic, User, Graph, Temporal, KB)
    const memoryBundle = await this.memoryCoordinator.retrieveAllMemories(notebookId, userId, userQuery);

    // 2. Hybrid Reranking
    const rankedContext = await this.rerankService.rerankBundle(userQuery, memoryBundle, 6);

    const openai = createOpenAI({
      apiKey: env.OPENAI_API_KEY,
    });

    logger.info(
      { notebookId, userId, retrievedRankedCount: rankedContext.rankedItems.length },
      'Initiating Multi-Memory Agentic RAG chat stream'
    );

    const systemPrompt = `
You are Memora AI, an intelligent, grounded Notebook LLM assistant with multi-tier cognitive memory.
Your goal is to answer the user's questions accurately using facts from their notebook source documents and memory layers.

${rankedContext.userProfileContext ? `\n${rankedContext.userProfileContext}\n` : ''}
${rankedContext.proceduralContext ? `\n${rankedContext.proceduralContext}\n` : ''}

[Retrieved & Reranked Cognitive Memory & Document Context]:
${rankedContext.formattedContext || 'No previous documents retrieved yet.'}

CRITICAL INSTRUCTIONS:
1. Ground your answers strictly in the retrieved facts and memory context above.
2. If more specific notebook knowledge is needed, call 'searchParadeDB' (for BM25 document chunks) or 'queryKnowledgeGraph' (for entity relationships).
3. If the user asks about recent events, external research, or topics not found in their notebook, call 'searchWeb' to search the live internet, or 'browseWebPage' to inspect a specific URL.
4. When citing web sources, include markdown links with the URL, e.g. [Web: Title](url).
5. If information is completely unavailable across notebook memory and web search, explicitly inform the user.
6. Include inline citation brackets like [Source: Document Title] or [Chunk #N] when referencing facts.
7. If the user asks to save an insight or note, call the 'createNotebookNote' tool.
`;

    const searchParadeDB = (tool as any)({
      description: 'Search document text chunks indexed in ParadeDB using BM25 vectorless search',
      parameters: z.object({
        query: z.string().optional().describe('Search query keywords or questions.'),
        topK: z.number().optional().default(5).describe('Number of top relevant chunks to retrieve'),
      }),
      execute: async ({ query, topK }: { query?: string; topK?: number }) => {
        logger.info({ notebookId, query, topK }, 'Agent executing searchParadeDB tool call');
        const cleanQuery = query?.trim() || '';
        const chunks = await this.notebookRepo.searchBM25(notebookId, cleanQuery, topK || 5);
        return {
          query: cleanQuery,
          retrievedCount: chunks.length,
          results: chunks.map((c) => ({
            id: c.id,
            sourceId: c.source_id,
            content: c.content,
            chunkIndex: c.chunk_index,
            bm25Score: c.bm25_score,
          })),
        };
      },
    });

    const queryKnowledgeGraph = (tool as any)({
      description: 'Traverse the Neo4j Knowledge Graph for related entities, concepts, and relationships',
      parameters: z.object({
        entityNames: z.array(z.string()).optional().default([]).describe('List of entity names to query neighbors for'),
        maxHops: z.number().optional().default(2).describe('Graph traversal depth'),
      }),
      execute: async ({ entityNames, maxHops }: { entityNames?: string[]; maxHops?: number }) => {
        let targets = (entityNames || []).filter(Boolean);
        if (targets.length === 0 && lastUserMsg.content) {
          targets = [lastUserMsg.content.slice(0, 50)];
        }
        logger.info({ targets, maxHops }, 'Agent executing queryKnowledgeGraph tool call');
        const graphResult = await this.graphProvider.getNeighbors(targets, userId, maxHops || 2);
        return {
          entitiesFound: graphResult.entities.length,
          entities: graphResult.entities,
          relations: graphResult.relations,
        };
      },
    });

    const searchWeb = (tool as any)({
      description: 'Search the live internet for external facts, recent events, documentation, or information missing from the notebook',
      parameters: z.object({
        query: z.string().describe('Search query keywords for the internet'),
        limit: z.number().optional().default(5).describe('Number of web search results to retrieve'),
      }),
      execute: async ({ query, limit }: { query: string; limit?: number }) => {
        logger.info({ query, limit }, 'Agent executing searchWeb tool call');
        const results = await this.firecrawlService.searchWeb(query, limit || 5);
        return {
          query,
          resultsCount: results.length,
          results,
        };
      },
    });

    const browseWebPage = (tool as any)({
      description: 'Visit and extract full markdown content from any live webpage or URL',
      parameters: z.object({
        url: z.string().url().describe('The webpage URL to visit and scrape'),
      }),
      execute: async ({ url }: { url: string }) => {
        logger.info({ url }, 'Agent executing browseWebPage tool call');
        const page = await this.firecrawlService.scrapeUrl(url);
        return {
          url,
          title: page.title,
          content: page.markdown.slice(0, 4000),
        };
      },
    });

    const createNotebookNote = (tool as any)({
      description: 'Save a study note, summary, or insight into the notebook',
      parameters: z.object({
        title: z.string().describe('Note title'),
        content: z.string().describe('Note markdown content'),
        type: z.enum(['user_note', 'ai_summary', 'study_guide']).optional().default('ai_summary'),
      }),
      execute: async ({ title, content, type }: { title: string; content: string; type: string }) => {
        logger.info({ notebookId, title }, 'Agent executing createNotebookNote tool call');
        const [newNote] = await db
          .insert(notes)
          .values({
            notebookId,
            title,
            content,
            type: (type as any) || 'ai_summary',
          })
          .returning();
        return { success: true, noteId: newNote.id, title: newNote.title };
      },
    });

    const modelMessages = this.convertToModelMessages(messages);

    const activeTools: Record<string, any> = {
      searchParadeDB,
      queryKnowledgeGraph,
      createNotebookNote,
    };

    if (isWebSearchEnabled) {
      activeTools.searchWeb = searchWeb;
      activeTools.browseWebPage = browseWebPage;
      logger.info({ notebookId }, 'Live Web Search enabled for this turn');
    }

    const result = streamText({
      model: openai(env.OPENAI_MODEL),
      system: systemPrompt,
      messages: modelMessages,
      stopWhen: isStepCount(5),
      tools: activeTools,
      onFinish: async (event: any) => {
        try {
          const assistantText = event.text || '';
          const parts: any[] = [];

          if (event.toolCalls && Array.isArray(event.toolCalls)) {
            for (const tc of event.toolCalls) {
              const tr = event.toolResults?.find((r: any) => r.toolCallId === tc.toolCallId);
              parts.push({
                type: `tool-${tc.toolName}`,
                toolName: tc.toolName,
                toolCallId: tc.toolCallId,
                state: 'result',
                input: tc.args,
                output: tr?.result,
              });
            }
          }

          if (assistantText) {
            parts.push({ type: 'text', text: assistantText });
          }

          if (assistantText || parts.length > 0) {
            await this.chatRepo.createMessage({
              notebookId,
              userId,
              role: 'assistant',
              content: assistantText,
              parts,
            });
            logger.info({ notebookId, userId }, 'Persisted assistant chat response to database');

            // Asynchronously extract and persist memories across all layers in the background
            this.memoryExtractor
              .extractAndPersistMemories(userId, notebookId, userQuery, assistantText)
              .catch((e) => logger.error({ e }, 'Background memory extraction failed'));
          }
        } catch (saveErr) {
          logger.error({ saveErr, notebookId }, 'Failed to persist assistant chat response');
        }
      },
    } as any);

    return result;
  }

  private convertToModelMessages(uiMessages: any[]): any[] {
    return uiMessages
      .map((msg) => {
        const role = msg.role as string;
        let content: string;
        if (typeof msg.content === 'string') {
          content = msg.content;
        } else if (Array.isArray(msg.parts)) {
          content = msg.parts
            .filter((p: any) => p.type === 'text')
            .map((p: any) => p.text as string)
            .join('');
        } else {
          content = '';
        }

        if (!content.trim()) return null;
        return { role, content };
      })
      .filter(Boolean);
  }
}
