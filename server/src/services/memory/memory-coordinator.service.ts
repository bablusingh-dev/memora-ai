import { MemoryFactory } from '../../providers/memory/memory.factory.js';
import { GraphFactory } from '../../providers/graph/graph.factory.js';
import { NotebookRepository } from '../../repositories/notebook.repository.js';
import { ChatRepository } from '../../repositories/chat.repository.js';
import { embeddingService } from '../embedding.service.js';
import {
  CognitiveMemoryBundle,
  SemanticFactMemory,
  EntityGraphMemory,
  KnowledgeBaseMemory,
  EpisodicMemoryItem,
  ProceduralMemoryItem,
  TemporalMemoryItem,
} from './cognitive-memory.types.js';
import { logger } from '../../utils/logger.js';

export class MemoryCoordinatorService {
  private memoryProvider = MemoryFactory.getProvider();
  private graphProvider = GraphFactory.getProvider();
  private notebookRepo = new NotebookRepository();
  private chatRepo = new ChatRepository();

  /**
   * Retrieves context across all memory layers for a given user query.
   *
   * Layer separation:
   *   CONVERSATION — recent chat turns (always from Postgres, not mem0)
   *   USER         — user profile, episodic events, procedural rules (from mem0)
   *   DOCUMENT     — hybrid BM25 + pgvector knowledge chunks (from ParadeDB)
   *   GRAPH        — entity relationships (from Neo4j, query-driven)
   *
   * @param expandedKeywords Query-enhancer keyword variants (see
   *   QueryEnhancerService) fed into the DOCUMENT layer's multi-query BM25
   *   fusion alongside the primary query.
   */
  async retrieveAllMemories(
    notebookId: string,
    userId: string,
    query: string,
    expandedKeywords: string[] = []
  ): Promise<CognitiveMemoryBundle> {
    logger.info({ notebookId, userId, query }, 'Coordinating multi-layer memory retrieval');

    const entityCandidates = this.extractQueryEntities(query);
    const relevantRelTypes = this.inferRelevantRelationships(query);

    const [
      recentChatMessages,
      userProfileMemories,
      semanticMemories,
      episodicMemories,
      proceduralMemories,
      graphResult,
      knowledgeChunks,
    ] = await Promise.all([
      // CONVERSATION layer — last 6 turns from Postgres
      this.chatRepo.findByNotebookId(notebookId, userId).catch((error) => {
        logger.error({ error, notebookId, userId }, 'CONVERSATION layer retrieval failed in memory coordinator');
        return [];
      }),
      // USER layer — profile declarations
      this.memoryProvider.search(query, { userId, category: 'user_profile', limit: 3 }).catch((error) => {
        logger.error({ error, userId, query, category: 'user_profile' }, 'USER layer retrieval failed in memory coordinator');
        return [];
      }),
      // USER layer — semantic facts from past sessions
      this.memoryProvider.search(query, { userId, category: 'semantic', limit: 4 }).catch((error) => {
        logger.error({ error, userId, query, category: 'semantic' }, 'USER layer retrieval failed in memory coordinator');
        return [];
      }),
      // USER layer — episodic session summaries
      this.memoryProvider.search(query, { userId, category: 'episodic', limit: 3 }).catch((error) => {
        logger.error({ error, userId, query, category: 'episodic' }, 'USER layer retrieval failed in memory coordinator');
        return [];
      }),
      // USER layer — procedural formatting rules
      this.memoryProvider.search(query, { userId, category: 'procedural', limit: 2 }).catch((error) => {
        logger.error({ error, userId, query, category: 'procedural' }, 'USER layer retrieval failed in memory coordinator');
        return [];
      }),
      // GRAPH layer — query-driven entity neighbor retrieval
      this.graphProvider
        .getNeighborsByQuery(entityCandidates, notebookId, relevantRelTypes, 2)
        .catch((error) => {
          logger.error({ error, notebookId, entityCandidates }, 'GRAPH layer retrieval failed in memory coordinator');
          return { entities: [], relations: [] };
        }),
      // DOCUMENT layer — hybrid BM25 + pgvector knowledge chunks (searches
      // retrieval_content). Query embedding is generated here, scoped to
      // this branch, so a slow/failed embeddings call only affects the
      // document layer's own latency/fallback rather than blocking the
      // other branches running in parallel alongside it.
      this.retrieveDocumentLayer(notebookId, query, expandedKeywords).catch((error) => {
        logger.error({ error, notebookId, query }, 'DOCUMENT layer retrieval failed in memory coordinator');
        return [];
      }),
    ]);

    // --- Map USER layer ---
    const semanticFacts: SemanticFactMemory[] = semanticMemories.map((m) => ({
      type: 'semantic',
      memoryLayer: 'user',
      id: m.id,
      fact: m.memory,
      confidence: m.score || 0.8,
      category: m.category,
    }));

    const episodic: EpisodicMemoryItem[] = episodicMemories.map((m) => ({
      type: 'episodic',
      memoryLayer: 'user',
      id: m.id,
      summary: m.memory,
      sessionDate: m.createdAt || new Date(),
      notebookId,
      keyTakeaways: [m.memory],
    }));

    const procedural: ProceduralMemoryItem[] = proceduralMemories.map((m) => ({
      type: 'procedural',
      memoryLayer: 'user',
      id: m.id,
      workflowName: 'User Rule',
      triggerPattern: query,
      instructions: [m.memory],
    }));

    // --- Map GRAPH layer ---
    const entityGraph: EntityGraphMemory[] = graphResult.entities.map((e) => ({
      type: 'entity',
      memoryLayer: 'graph',
      name: e.name,
      entityType: e.type,
      description: e.description,
      sourceChunkIds: e.sourceChunkIds,
      connectedEntities: graphResult.relations
        .filter((r) => r.sourceEntity.toLowerCase() === e.name.toLowerCase())
        .map((r) => ({
          target: r.targetEntity,
          relation: r.relationType,
          description: r.description,
          confidence: r.confidence,
          evidence: r.evidence,
          sourceChunkIds: r.sourceChunkIds,
          validFrom: r.validFrom,
          validTo: r.validTo,
        })),
    }));

    const temporalEvents: TemporalMemoryItem[] = graphResult.relations
      .filter((r) => r.validFrom || r.validTo)
      .map((r) => ({
        type: 'temporal',
        memoryLayer: 'graph',
        subject: r.sourceEntity,
        predicate: r.relationType,
        object: r.targetEntity,
        confidence: r.confidence,
        evidence: r.evidence,
        validFrom: r.validFrom,
        validTo: r.validTo,
      }));

    // --- Map DOCUMENT layer ---
    const kbChunks: KnowledgeBaseMemory[] = (knowledgeChunks || []).map((c) => ({
      type: 'knowledge_base',
      memoryLayer: 'document',
      chunkId: c.id,
      sourceId: c.source_id,
      content: c.content,
      retrievalContent: c.retrieval_content,
      heading: c.heading,
      sectionPath: c.section_path,
      chunkIndex: c.chunk_index,
      bm25Score: c.bm25_score,
    }));

    // --- Map CONVERSATION layer ---
    const recentTurns = (recentChatMessages || []).slice(-6);
    const userProfileText = userProfileMemories.map((u) => u.memory).join('\n');

    return {
      shortTerm: {
        type: 'short_term',
        sessionId: notebookId,
        recentTurns: recentTurns.map((m) => ({ role: m.role, content: m.content })),
      },
      conversationHistory: recentTurns.map((m) => ({
        type: 'conversation',
        memoryLayer: 'conversation',
        messageId: m.id,
        role: m.role as any,
        content: m.content,
        timestamp: m.createdAt,
      })),
      userProfile: {
        type: 'user_profile',
        memoryLayer: 'user',
        userId,
        bio: userProfileText || undefined,
        preferences: {},
        rules: userProfileMemories.map((u) => u.memory),
      },
      semanticFacts,
      entityGraph,
      knowledgeChunks: kbChunks,
      episodicMemories: episodic,
      proceduralRules: procedural,
      temporalEvents,
    };
  }

  /**
   * DOCUMENT layer: embed the query (soft-fail — null on error, degrading to
   * BM25-only), then run hybrid BM25 + pgvector retrieval. Bundled as one
   * async unit so it's a single parallel branch in retrieveAllMemories'
   * Promise.all rather than adding a second top-level embedding call that
   * other branches would have to wait on.
   */
  private async retrieveDocumentLayer(notebookId: string, query: string, expandedKeywords: string[]) {
    const queryEmbedding = await embeddingService.embedQuerySafe(query);
    const queries = Array.from(new Set([query, ...expandedKeywords].filter(Boolean)));
    return this.notebookRepo.searchHybrid(notebookId, queries, queryEmbedding, 5);
  }

  /**
   * Extract entity candidates from the query for graph lookup.
   * Prioritizes capitalized tokens (named entities) then significant keywords.
   */
  private extractQueryEntities(query: string): string[] {
    const capitalizedWords = query.match(/\b[A-Z][a-zA-Z0-9_-]{2,}\b/g) || [];
    const keywords = query
      .split(/\s+/)
      .filter(
        (w) =>
          w.length > 3 &&
          !['what', 'when', 'where', 'which', 'about', 'explain', 'tell', 'show', 'give'].includes(
            w.toLowerCase()
          )
      );
    return Array.from(new Set([...capitalizedWords, ...keywords])).slice(0, 6);
  }

  /**
   * Infer relevant Neo4j relationship types from the query phrasing.
   * Returning an empty array means "retrieve all relationship types" (no filter).
   */
  private inferRelevantRelationships(query: string): string[] {
    const lower = query.toLowerCase();
    if (lower.includes('creat') || lower.includes('found') || lower.includes('built') || lower.includes('develop')) {
      return ['CREATED_BY', 'CREATED', 'FOUNDED', 'BUILT_BY', 'DEVELOPED_BY', 'DEVELOPED'];
    }
    if (lower.includes('treat') || lower.includes('cure') || lower.includes('drug') || lower.includes('medicine')) {
      return ['TREATS', 'USED_FOR', 'PRESCRIBED_FOR', 'CURES'];
    }
    if (lower.includes('owned') || lower.includes('acqui') || lower.includes('subsidiary') || lower.includes('parent')) {
      return ['OWNS', 'ACQUIRED', 'SUBSIDIARY_OF', 'PARENT_OF', 'HOLDS_STAKE_IN'];
    }
    if (lower.includes('use') || lower.includes('integrat') || lower.includes('depend')) {
      return ['USES', 'INTEGRATES_WITH', 'DEPENDS_ON', 'STREAMS_DATA_TO'];
    }
    if (lower.includes('work') || lower.includes('employ') || lower.includes('lead') || lower.includes('manage')) {
      return ['WORKS_AT', 'EMPLOYED_BY', 'LEADS', 'MANAGES', 'CEO_OF'];
    }
    if (lower.includes('regulat') || lower.includes('govern') || lower.includes('law') || lower.includes('legal')) {
      return ['REGULATES', 'GOVERNED_BY', 'ENACTED_BY', 'APPLIES_TO'];
    }
    // No strong signal — let the graph provider return all relationship types
    return [];
  }
}
