import { createOpenAI } from '@ai-sdk/openai';
import { streamText, tool, isStepCount } from 'ai';
import { z } from 'zod';
import { env } from '../config/env.js';
import { MemorybookRepository } from '../repositories/memorybook.repository.js';
import { ChatRepository } from '../repositories/chat.repository.js';
import { MemoryCoordinatorService } from './memory/memory-coordinator.service.js';
import { ContextBuilderService } from './context-builder.service.js';
import { GraphFactory } from '../providers/graph/graph.factory.js';
import { FirecrawlService } from './firecrawl.service.js';
import { RetrievalTracer } from '../utils/retrieval-trace.js';
import { retryWithBackoff } from '../utils/retry.js';
import { db } from '../db/index.js';
import { notes } from '../db/schema.js';
import { logger } from '../utils/logger.js';
import { queryEnhancer } from './query-enhancer.service.js';
import { embeddingService } from './embedding.service.js';
import { inngest } from '../inngest/client.js';
import { chatMessageCompleted } from '../inngest/events.js';
import { BadRequestError, TooManyRequestsError } from '../utils/api-error.js';

export class AgentService {
  private memorybookRepo: MemorybookRepository;
  private chatRepo: ChatRepository;
  private memoryCoordinator: MemoryCoordinatorService;
  private contextBuilder: ContextBuilderService;
  private firecrawlService: FirecrawlService;
  private graphProvider = GraphFactory.getProvider();

  // In-memory, single-instance bulkhead against one user opening more
  // concurrent chat streams than env.MAX_CONCURRENT_STREAMS_PER_USER — each
  // stream already fans out to ~2 LLM calls (query enhancement + main
  // completion, more with tool calls) plus BM25/vector/graph/mem0 retrieval,
  // so unbounded parallel streams from one user is a real cost/load risk.
  // Static (not per-instance) since AgentService may be constructed more
  // than once but the limit is process-wide. Would need a shared store
  // (Redis, etc.) to hold across multiple server instances — acceptable
  // limitation for this app's current non-HA deployment model.
  private static activeStreamCounts = new Map<string, number>();

  constructor() {
    this.memorybookRepo = new MemorybookRepository();
    this.chatRepo = new ChatRepository();
    this.memoryCoordinator = new MemoryCoordinatorService();
    this.contextBuilder = new ContextBuilderService();
    this.firecrawlService = new FirecrawlService();
  }

  private static acquireStreamSlot(userId: string): boolean {
    const current = AgentService.activeStreamCounts.get(userId) || 0;
    if (current >= env.MAX_CONCURRENT_STREAMS_PER_USER) return false;
    AgentService.activeStreamCounts.set(userId, current + 1);
    return true;
  }

  private static releaseStreamSlot(userId: string): void {
    const current = AgentService.activeStreamCounts.get(userId) || 0;
    if (current <= 1) {
      AgentService.activeStreamCounts.delete(userId);
    } else {
      AgentService.activeStreamCounts.set(userId, current - 1);
    }
  }

  async getChatHistory(memorybookId: string, userId: string) {
    const memorybook = await this.memorybookRepo.findById(memorybookId, userId);
    if (!memorybook) throw new BadRequestError(`Memorybook '${memorybookId}' not found or access denied`);
    return await this.chatRepo.findByMemorybookId(memorybookId, userId);
  }

  async clearChatHistory(memorybookId: string, userId: string) {
    const memorybook = await this.memorybookRepo.findById(memorybookId, userId);
    if (!memorybook) throw new BadRequestError(`Memorybook '${memorybookId}' not found or access denied`);
    return await this.chatRepo.clearByMemorybookId(memorybookId, userId);
  }

  /**
   * Execute Agentic RAG chat with multi-layer memory, tool calling, and streaming.
   */
  async streamAgentChat(
    memorybookId: string,
    userId: string,
    messages: any[],
    options: { enableWebSearch?: boolean } = {}
  ) {
    if (!AgentService.acquireStreamSlot(userId)) {
      throw new TooManyRequestsError(
        `You already have ${env.MAX_CONCURRENT_STREAMS_PER_USER} chat response(s) in progress. Please wait for one to finish before starting another.`
      );
    }

    try {
      return await this.doStreamAgentChat(memorybookId, userId, messages, options);
    } catch (err) {
      // Only reached if setup fails before streamText is called — once
      // streaming starts, the slot is released from onFinish/onError below
      // instead, since this function returns before the stream completes.
      AgentService.releaseStreamSlot(userId);
      throw err;
    }
  }

  private async doStreamAgentChat(
    memorybookId: string,
    userId: string,
    messages: any[],
    options: { enableWebSearch?: boolean }
  ) {
    const isWebSearchEnabled = Boolean(options.enableWebSearch);

    const memorybook = await this.memorybookRepo.findById(memorybookId, userId);
    if (!memorybook) throw new BadRequestError(`Memorybook '${memorybookId}' not found or access denied`);

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

    // Persist user message. Retried a few times — this needs to succeed
    // synchronously (the UI already shows the user's message optimistically,
    // so silently losing it on a transient DB blip would desync history),
    // unlike memory extraction below which is fine to hand off to Inngest.
    if (userQuery.trim()) {
      try {
        await retryWithBackoff(() =>
          this.chatRepo.createMessage({
            memorybookId, userId, role: 'user',
            content: userQuery.trim(),
            parts: lastUserMsg?.parts || [{ type: 'text', text: userQuery.trim() }],
          })
        );
      } catch (err) {
        logger.error({ err, memorybookId }, 'Failed to persist user chat message after retries');
      }
    }

    // 1 & 2. Query enhancement and the CONVERSATION/USER memory layers run
    // concurrently — neither depends on the other. Enhancement is an LLM
    // call (typo correction + keyword expansion) that only the
    // DOCUMENT/GRAPH layers actually need; conversation history and mem0
    // search tolerate the raw query fine. Previously these ran fully
    // sequentially, adding the enhancement call's latency to every turn even
    // though most of retrieval didn't depend on its output.
    const modelHistory = this.convertToModelMessages(messages);
    const [enhanced, independentMemories] = await Promise.all([
      queryEnhancer.enhanceQuery(userQuery, modelHistory),
      this.memoryCoordinator.retrieveQueryIndependentMemories(memorybookId, userId, userQuery),
    ]);
    const queryForSearch = enhanced.correctedQuery || userQuery;

    // Initialize retrieval tracer
    const tracer = new RetrievalTracer(userQuery);
    tracer.recordQuery(
      enhanced.correctedQuery || userQuery,
      enhanced.expandedKeywords || [],
      [] // entity candidates recorded inside coordinator
    );

    // 3. DOCUMENT/GRAPH layers — need the corrected+expanded query, so these
    // wait for query enhancement to finish (see retrieveQueryDependentMemories's
    // doc comment for why this split is safe/correct).
    const dependentMemories = await this.memoryCoordinator.retrieveQueryDependentMemories(
      memorybookId,
      queryForSearch,
      enhanced.expandedKeywords || []
    );
    const memoryBundle = this.memoryCoordinator.buildBundle(memorybookId, userId, queryForSearch, independentMemories, dependentMemories);

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

    // 4. Build structured context from multi-tier memory (token-budgeted —
    // see ContextBuilderService)
    const formattedContext = this.contextBuilder.buildContext(memoryBundle);

    tracer.recordFinalContext(formattedContext.formattedContext);
    tracer.emit(); // debug-level log

    const openaiClient = createOpenAI({ apiKey: env.OPENAI_API_KEY });

    logger.info(
      {
        memorybookId, userId, userQuery,
        correctedQuery: enhanced.correctedQuery,
        expandedKeywords: enhanced.expandedKeywords,
        retrievedChunkCount: memoryBundle.knowledgeChunks.length,
      },
      'Initiating Agentic RAG chat stream'
    );

    // -------------------------------------------------------------------------
    // System prompt with clearly separated context sections
    // -------------------------------------------------------------------------
    const systemPrompt = `You are Memorybook, an intelligent, grounded research assistant.
Your goal is to answer the user's questions accurately using facts from their memorybook source documents and memory.

${formattedContext.userProfileContext ? `\n${formattedContext.userProfileContext}\n` : ''}
${formattedContext.proceduralContext ? `\n${formattedContext.proceduralContext}\n` : ''}

[RETRIEVED CONTEXT]
${formattedContext.formattedContext || 'No relevant context retrieved yet — call searchKnowledgeBase or queryKnowledgeGraph to retrieve sources.'}

INSTRUCTIONS:
1. The [RETRIEVED CONTEXT] above was already searched for this query — use it directly as your primary source. Only call 'searchKnowledgeBase' if that context is insufficient to answer, the conversation has shifted to a different topic than what's shown above, or you need a more specific/refined search.
2. Call 'queryKnowledgeGraph' when the question involves relationships, connections, "who created X", "what is related to Y", or dependency chains not already covered by [GRAPH FACTS] above.
3. Ground every statement in retrieved sources. Do NOT hallucinate or invent facts.
4. When citing sources, reference the document section and chunk number, e.g. [Source: Authentication > JWT, Chunk #3].
5. If you cite a graph fact, mention the confidence level if below 0.90.
6. If information is truly unavailable, say so explicitly.
7. Only call 'searchWeb' / 'browseWebPage' when the user explicitly asks about external/live information not in their memorybook.
8. To save a note, call 'createMemorybookNote'.`;

    // -------------------------------------------------------------------------
    // Tools
    // -------------------------------------------------------------------------
    const searchKnowledgeBase = (tool as any)({
      description: 'Search memorybook document chunks using hybrid retrieval — BM25 lexical search fused with pgvector semantic search via Reciprocal Rank Fusion. The system prompt already contains an initial search for the user\'s query; call this only to refine/broaden that search or when the conversation has moved to a new topic.',
      parameters: z.object({
        query: z.string().optional().describe('Search query keywords or question.'),
        topK: z.number().optional().default(5).describe('Number of top relevant chunks to retrieve'),
      }),
      execute: async ({ query, topK }: { query?: string; topK?: number }) => {
        const cleanQuery = query?.trim() || queryForSearch;
        logger.info({ memorybookId, cleanQuery, topK }, 'Agent: searchKnowledgeBase tool call');
        const queryTerms = Array.from(new Set([cleanQuery, ...(enhanced.expandedKeywords || [])].filter(Boolean)));
        const queryEmbedding = await embeddingService.embedQuerySafe(cleanQuery);
        const chunks = await this.memorybookRepo.searchHybrid(memorybookId, queryTerms, queryEmbedding, topK || 5);
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
          memorybookId,
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
      description: 'Search the live internet for external facts, recent events, or documentation not in the memorybook.',
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

    const createMemorybookNote = (tool as any)({
      description: 'Save a study note, summary, or insight into the memorybook.',
      parameters: z.object({
        title: z.string().describe('Note title'),
        content: z.string().describe('Note markdown content'),
        type: z.enum(['user_note', 'ai_summary', 'study_guide']).optional().default('ai_summary'),
      }),
      execute: async ({ title, content, type }: { title: string; content: string; type: string }) => {
        logger.info({ memorybookId, title }, 'Agent: createMemorybookNote tool call');
        const [newNote] = await db.insert(notes).values({ memorybookId, title, content, type: (type as any) || 'ai_summary' }).returning();
        return { success: true, noteId: newNote.id, title: newNote.title };
      },
    });

    const modelMessages = this.convertToModelMessages(messages);

    const activeTools: Record<string, any> = { searchKnowledgeBase, queryKnowledgeGraph, createMemorybookNote };
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
      onError: (event: any) => {
        logger.error({ error: event?.error, memorybookId, userId }, 'Chat stream errored');
        AgentService.releaseStreamSlot(userId);
      },
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
            const savedMessage = await retryWithBackoff(() =>
              this.chatRepo.createMessage({ memorybookId, userId, role: 'assistant', content: assistantText, parts })
            );
            logger.info({ memorybookId, userId }, 'Persisted assistant response');

            // Durable memory extraction (NOT document graph — that's handled
            // by graph-extract-chunk on document ingestion, never on chat
            // turns). Replaces the old unawaited
            // `this.memoryExtractor.extractAndPersistMemories(...).catch(...)`
            // call — that promise had no retry and was silently lost if the
            // process restarted mid-extraction or mem0 was briefly down.
            // Sending the event is itself best-effort: a failure here just
            // means this turn's memories are never extracted (same
            // reliability ceiling as before), rather than blocking a
            // response the user is already looking at.
            try {
              await inngest.send(
                chatMessageCompleted.create({
                  userId,
                  memorybookId,
                  chatMessageId: savedMessage.id,
                  userMessage: userQuery,
                  assistantReply: assistantText,
                })
              );
            } catch (sendErr) {
              logger.error({ sendErr, memorybookId, userId }, 'Failed to enqueue memory extraction event');
            }
          }
        } catch (saveErr) {
          logger.error({ saveErr, memorybookId }, 'Failed to persist assistant response after retries');
        } finally {
          AgentService.releaseStreamSlot(userId);
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
          const nonTextParts = msg.parts.filter((p: any) => p.type !== 'text');
          if (nonTextParts.length > 0) {
            logger.warn(
              { role, droppedPartTypes: nonTextParts.map((p: any) => p.type) },
              'convertToModelMessages: dropping non-text message part(s) — multimodal content is not yet forwarded to the model'
            );
          }
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
