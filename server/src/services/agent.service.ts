import { createOpenAI } from '@ai-sdk/openai';
import { streamText, tool, isStepCount } from 'ai';
import { z } from 'zod';
import { env } from '../config/env.js';
import { NotebookRepository } from '../repositories/notebook.repository.js';
import { ChatRepository } from '../repositories/chat.repository.js';
import { MemoryCoordinatorService } from './memory/memory-coordinator.service.js';
import { MemoryExtractorService } from './memory/memory-extractor.service.js';
import { ContextBuilderService } from './context-builder.service.js';
import { GraphFactory } from '../providers/graph/graph.factory.js';
import { MemoryFactory } from '../providers/memory/memory.factory.js';
import { FirecrawlService } from './firecrawl.service.js';
import { RetrievalTracer } from '../utils/retrieval-trace.js';
import { db } from '../db/index.js';
import { notes } from '../db/schema.js';
import { logger } from '../utils/logger.js';
import { queryEnhancer } from './query-enhancer.service.js';
import { embeddingService } from './embedding.service.js';
import { BadRequestError } from '../utils/api-error.js';

export class AgentService {
  private notebookRepo: NotebookRepository;
  private chatRepo: ChatRepository;
  private memoryCoordinator: MemoryCoordinatorService;
  private memoryExtractor: MemoryExtractorService;
  private contextBuilder: ContextBuilderService;
  private firecrawlService: FirecrawlService;
  private graphProvider = GraphFactory.getProvider();
  private memoryProvider = MemoryFactory.getProvider();

  constructor() {
    this.notebookRepo = new NotebookRepository();
    this.chatRepo = new ChatRepository();
    this.memoryCoordinator = new MemoryCoordinatorService();
    this.memoryExtractor = new MemoryExtractorService();
    this.contextBuilder = new ContextBuilderService();
    this.firecrawlService = new FirecrawlService();
  }

  async getChatHistory(notebookId: string, userId: string) {
    const notebook = await this.notebookRepo.findById(notebookId, userId);
    if (!notebook) throw new BadRequestError(`Notebook '${notebookId}' not found or access denied`);
    return await this.chatRepo.findByNotebookId(notebookId, userId);
  }

  async clearChatHistory(notebookId: string, userId: string) {
    const notebook = await this.notebookRepo.findById(notebookId, userId);
    if (!notebook) throw new BadRequestError(`Notebook '${notebookId}' not found or access denied`);
    return await this.chatRepo.clearByNotebookId(notebookId, userId);
  }

  /**
   * Execute Agentic RAG chat with multi-layer memory, tool calling, and streaming.
   */
  async streamAgentChat(
    notebookId: string,
    userId: string,
    messages: any[],
    options: { enableWebSearch?: boolean } = {}
  ) {
    const isWebSearchEnabled = Boolean(options.enableWebSearch);

    const notebook = await this.notebookRepo.findById(notebookId, userId);
    if (!notebook) throw new BadRequestError(`Notebook '${notebookId}' not found or access denied`);

    if (!env.OPENAI_API_KEY || env.OPENAI_API_KEY === 'sk-placeholder') {
      throw new BadRequestError(
        'OpenAI API Key is missing or set to placeholder. Please add OPENAI_API_KEY to server/.env.'
      );
    }

    // Extract latest user query
    let userQuery = '';
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMsg) {
      if (typeof lastUserMsg.content === 'string') {
        userQuery = lastUserMsg.content;
      } else if (Array.isArray(lastUserMsg.parts)) {
        userQuery = lastUserMsg.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('');
      }
    }

    // Persist user message
    try {
      if (userQuery.trim()) {
        await this.chatRepo.createMessage({
          notebookId, userId, role: 'user',
          content: userQuery.trim(),
          parts: lastUserMsg?.parts || [{ type: 'text', text: userQuery.trim() }],
        });
      }
    } catch (err) {
      logger.error({ err, notebookId }, 'Failed to persist user chat message');
    }

    // 1. Query enhancement
    const modelHistory = this.convertToModelMessages(messages);
    const enhanced = await queryEnhancer.enhanceQuery(userQuery, modelHistory);
    const queryForSearch = enhanced.correctedQuery || userQuery;

    // Initialize retrieval tracer
    const tracer = new RetrievalTracer(userQuery);
    tracer.recordQuery(
      enhanced.correctedQuery || userQuery,
      enhanced.expandedKeywords || [],
      [] // entity candidates recorded inside coordinator
    );

    // 2. Multi-layer memory retrieval
    const memoryBundle = await this.memoryCoordinator.retrieveAllMemories(
      notebookId,
      userId,
      queryForSearch,
      enhanced.expandedKeywords || []
    );

    // Record trace data
    tracer.recordBM25(memoryBundle.knowledgeChunks.map((c) => ({
      id: c.chunkId, heading: c.heading, section_path: c.sectionPath,
      bm25_score: c.bm25Score, content: c.content,
    })));
    tracer.recordGraph(
      memoryBundle.entityGraph.map((e) => ({ name: e.name, type: e.entityType })),
      memoryBundle.entityGraph.flatMap((e) => e.connectedEntities.map((r) => ({
        sourceEntity: e.name, targetEntity: r.target, relationType: r.relation,
        confidence: r.confidence, evidence: r.evidence,
      })))
    );
    tracer.recordMemory([
      ...memoryBundle.semanticFacts.map((f) => ({ type: 'semantic', text: f.fact, score: f.confidence })),
      ...memoryBundle.episodicMemories.map((ep) => ({ type: 'episodic', text: ep.summary })),
    ]);

    // 3. Build structured context from multi-tier memory
    const formattedContext = this.contextBuilder.buildContext(memoryBundle);

    tracer.recordFinalContext(formattedContext.formattedContext);
    tracer.emit(); // debug-level log

    const openaiClient = createOpenAI({ apiKey: env.OPENAI_API_KEY });

    logger.info(
      {
        notebookId, userId, userQuery,
        correctedQuery: enhanced.correctedQuery,
        expandedKeywords: enhanced.expandedKeywords,
        retrievedChunkCount: memoryBundle.knowledgeChunks.length,
      },
      'Initiating Agentic RAG chat stream'
    );

    // -------------------------------------------------------------------------
    // System prompt with clearly separated context sections
    // -------------------------------------------------------------------------
    const systemPrompt = `You are Memora AI, an intelligent, grounded Notebook LLM assistant.
Your goal is to answer the user's questions accurately using facts from their notebook source documents and memory.

${formattedContext.userProfileContext ? `\n${formattedContext.userProfileContext}\n` : ''}
${formattedContext.proceduralContext ? `\n${formattedContext.proceduralContext}\n` : ''}

[RETRIEVED CONTEXT]
${formattedContext.formattedContext || 'No relevant context retrieved yet — call searchKnowledgeBase or queryKnowledgeGraph to retrieve sources.'}

INSTRUCTIONS:
1. ALWAYS call 'searchKnowledgeBase' first when the user asks about their notebook content, files, or topics. This is your primary retrieval tool.
2. Call 'queryKnowledgeGraph' when the question involves relationships, connections, "who created X", "what is related to Y", or dependency chains.
3. Ground every statement in retrieved sources. Do NOT hallucinate or invent facts.
4. When citing sources, reference the document section and chunk number, e.g. [Source: Authentication > JWT, Chunk #3].
5. If you cite a graph fact, mention the confidence level if below 0.90.
6. If information is truly unavailable, say so explicitly.
7. Only call 'searchWeb' / 'browseWebPage' when the user explicitly asks about external/live information not in their notebook.
8. To save a note, call 'createNotebookNote'.`;

    // -------------------------------------------------------------------------
    // Tools
    // -------------------------------------------------------------------------
    const searchKnowledgeBase = (tool as any)({
      description: 'Search notebook document chunks using hybrid retrieval — BM25 lexical search fused with pgvector semantic search via Reciprocal Rank Fusion. Call this first for any question about notebook content; also call it again with a different/refined query if the context above turns out insufficient or the conversation shifts topic.',
      parameters: z.object({
        query: z.string().optional().describe('Search query keywords or question.'),
        topK: z.number().optional().default(5).describe('Number of top relevant chunks to retrieve'),
      }),
      execute: async ({ query, topK }: { query?: string; topK?: number }) => {
        const cleanQuery = query?.trim() || queryForSearch;
        logger.info({ notebookId, cleanQuery, topK }, 'Agent: searchKnowledgeBase tool call');
        const queryTerms = Array.from(new Set([cleanQuery, ...(enhanced.expandedKeywords || [])].filter(Boolean)));
        const queryEmbedding = await embeddingService.embedQuerySafe(cleanQuery);
        const chunks = await this.notebookRepo.searchHybrid(notebookId, queryTerms, queryEmbedding, topK || 5);
        return {
          query: cleanQuery,
          correctedQuery: enhanced.correctedQuery,
          expandedKeywords: enhanced.expandedKeywords,
          retrievedCount: chunks.length,
          results: chunks.map((c) => ({
            id: c.id,
            sourceId: c.source_id,
            content: c.content,
            heading: c.heading,
            sectionPath: c.section_path,
            chunkIndex: c.chunk_index,
            relevanceScore: c.bm25_score,
          })),
        };
      },
    });

    const queryKnowledgeGraph = (tool as any)({
      description: 'Query the Neo4j Knowledge Graph for entity relationships and connections. Use for: "who created X?", "what does Y relate to?", "show connections between A and B".',
      parameters: z.object({
        entityNames: z.array(z.string()).optional().default([]).describe('Named entities from the question to look up'),
        relationshipTypes: z.array(z.string()).optional().default([]).describe('Specific relationship types to filter by (e.g. CREATED_BY, TREATS, USES). Leave empty for all.'),
        maxHops: z.number().optional().default(2).describe('Graph traversal depth (1 or 2)'),
      }),
      execute: async ({
        entityNames,
        relationshipTypes,
        maxHops,
      }: {
        entityNames?: string[];
        relationshipTypes?: string[];
        maxHops?: number;
      }) => {
        let targets = (entityNames || []).filter(Boolean);
        if (targets.length === 0 && userQuery) {
          targets = userQuery.match(/\b[A-Z][a-zA-Z0-9_-]{2,}\b/g)?.slice(0, 5) || [];
        }
        logger.info({ targets, relationshipTypes, maxHops }, 'Agent: queryKnowledgeGraph tool call');
        const graphResult = await this.graphProvider.getNeighborsByQuery(
          targets,
          notebookId,
          (relationshipTypes || []).map((r) => r.toUpperCase()),
          maxHops || 2
        );
        return {
          entitiesFound: graphResult.entities.length,
          entities: graphResult.entities.map((e) => ({
            name: e.name,
            type: e.type,
            sourceChunkIds: e.sourceChunkIds,
          })),
          relations: graphResult.relations.map((r) => ({
            from: r.sourceEntity,
            relation: r.relationType,
            to: r.targetEntity,
            confidence: r.confidence,
            evidence: r.evidence,
            sourceChunkIds: r.sourceChunkIds,
          })),
        };
      },
    });

    const searchWeb = (tool as any)({
      description: 'Search the live internet for external facts, recent events, or documentation not in the notebook.',
      parameters: z.object({
        query: z.string().describe('Search query for the internet'),
        limit: z.number().optional().default(5),
      }),
      execute: async ({ query, limit }: { query: string; limit?: number }) => {
        logger.info({ query, limit }, 'Agent: searchWeb tool call');
        const results = await this.firecrawlService.searchWeb(query, limit || 5);
        return { query, resultsCount: results.length, results };
      },
    });

    const browseWebPage = (tool as any)({
      description: 'Visit and extract full markdown content from any live webpage URL.',
      parameters: z.object({ url: z.string().url().describe('The webpage URL to scrape') }),
      execute: async ({ url }: { url: string }) => {
        logger.info({ url }, 'Agent: browseWebPage tool call');
        const page = await this.firecrawlService.scrapeUrl(url);
        return { url, title: page.title, content: page.markdown.slice(0, 4000) };
      },
    });

    const createNotebookNote = (tool as any)({
      description: 'Save a study note, summary, or insight into the notebook.',
      parameters: z.object({
        title: z.string().describe('Note title'),
        content: z.string().describe('Note markdown content'),
        type: z.enum(['user_note', 'ai_summary', 'study_guide']).optional().default('ai_summary'),
      }),
      execute: async ({ title, content, type }: { title: string; content: string; type: string }) => {
        logger.info({ notebookId, title }, 'Agent: createNotebookNote tool call');
        const [newNote] = await db.insert(notes).values({ notebookId, title, content, type: (type as any) || 'ai_summary' }).returning();
        return { success: true, noteId: newNote.id, title: newNote.title };
      },
    });

    const modelMessages = this.convertToModelMessages(messages);

    const activeTools: Record<string, any> = { searchKnowledgeBase, queryKnowledgeGraph, createNotebookNote };
    if (isWebSearchEnabled) {
      activeTools.searchWeb = searchWeb;
      activeTools.browseWebPage = browseWebPage;
    }

    const result = streamText({
      model: openaiClient(env.OPENAI_MODEL),
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

          if (assistantText) parts.push({ type: 'text', text: assistantText });

          if (assistantText || parts.length > 0) {
            await this.chatRepo.createMessage({ notebookId, userId, role: 'assistant', content: assistantText, parts });
            logger.info({ notebookId, userId }, 'Persisted assistant response');

            // Background: extract and persist user-scoped memories (NOT document graph)
            this.memoryExtractor
              .extractAndPersistMemories(userId, notebookId, userQuery, assistantText)
              .catch((e) => logger.error({ e }, 'Background memory extraction failed'));
          }
        } catch (saveErr) {
          logger.error({ saveErr, notebookId }, 'Failed to persist assistant response');
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
          content = msg.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text as string).join('');
        } else {
          content = '';
        }
        if (!content.trim()) return null;
        return { role, content };
      })
      .filter(Boolean);
  }
}
