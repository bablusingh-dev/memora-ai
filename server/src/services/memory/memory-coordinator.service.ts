import { MemoryFactory } from '../../providers/memory/memory.factory.js';
import { GraphFactory } from '../../providers/graph/graph.factory.js';
import { NotebookRepository } from '../../repositories/notebook.repository.js';
import { ChatRepository } from '../../repositories/chat.repository.js';
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
   * Retrieves context across all 9 memory layers for a given user query
   */
  async retrieveAllMemories(
    notebookId: string,
    userId: string,
    query: string
  ): Promise<CognitiveMemoryBundle> {
    logger.info({ notebookId, userId, query }, 'Coordinating multi-tier cognitive memory retrieval');

    // 1. Extract potential entity names from the query for Neo4j traversal
    const entityCandidates = this.extractQueryEntities(query);

    // Parallel multi-memory retrieval
    const [
      recentChatMessages,
      userProfileMemories,
      semanticMemories,
      episodicMemories,
      proceduralMemories,
      graphResult,
      knowledgeChunks,
    ] = await Promise.all([
      // Short-Term & Conversation Memory
      this.chatRepo.findByNotebookId(notebookId, userId).catch(() => []),
      // User Profile Memory
      this.memoryProvider.search(query, { userId, category: 'user_profile', limit: 3 }).catch(() => []),
      // Semantic Memory
      this.memoryProvider.search(query, { userId, category: 'semantic', limit: 5 }).catch(() => []),
      // Episodic Memory
      this.memoryProvider.search(query, { userId, category: 'episodic', limit: 3 }).catch(() => []),
      // Procedural Memory
      this.memoryProvider.search(query, { userId, category: 'procedural', limit: 2 }).catch(() => []),
      // Entity & Temporal Graph (Neo4j)
      this.graphProvider.getNeighbors(entityCandidates, userId, 2).catch(() => ({ entities: [], relations: [] })),
      // Knowledge Base Chunks (ParadeDB BM25)
      this.notebookRepo.searchBM25(notebookId, query, 5).catch(() => []),
    ]);

    // Map Semantic Facts
    const semanticFacts: SemanticFactMemory[] = semanticMemories.map((m) => ({
      type: 'semantic',
      id: m.id,
      fact: m.memory,
      confidence: m.score || 0.8,
      category: m.category,
    }));

    // Map Episodic
    const episodic: EpisodicMemoryItem[] = episodicMemories.map((m) => ({
      type: 'episodic',
      id: m.id,
      summary: m.memory,
      sessionDate: m.createdAt || new Date(),
      notebookId,
      keyTakeaways: [m.memory],
    }));

    // Map Procedural
    const procedural: ProceduralMemoryItem[] = proceduralMemories.map((m) => ({
      type: 'procedural',
      id: m.id,
      workflowName: 'User Rule',
      triggerPattern: query,
      instructions: [m.memory],
    }));

    // Map Entity Graph & Temporal Relations
    const entityGraph: EntityGraphMemory[] = graphResult.entities.map((e) => ({
      type: 'entity',
      name: e.name,
      entityType: e.type,
      description: e.description,
      connectedEntities: graphResult.relations
        .filter((r) => r.sourceEntity.toLowerCase() === e.name.toLowerCase())
        .map((r) => ({
          target: r.targetEntity,
          relation: r.relationType,
          description: r.description,
          validFrom: r.validFrom,
          validTo: r.validTo,
        })),
    }));

    const temporalEvents: TemporalMemoryItem[] = graphResult.relations
      .filter((r) => r.validFrom || r.validTo)
      .map((r) => ({
        type: 'temporal',
        subject: r.sourceEntity,
        predicate: r.relationType,
        object: r.targetEntity,
        validFrom: r.validFrom,
        validTo: r.validTo,
      }));

    // Map Knowledge Base chunks
    const kbChunks: KnowledgeBaseMemory[] = (knowledgeChunks || []).map((c) => ({
      type: 'knowledge_base',
      chunkId: c.id,
      sourceId: c.source_id,
      content: c.content,
      chunkIndex: c.chunk_index,
      bm25Score: c.bm25_score,
    }));

    const userProfileText = userProfileMemories.map((u) => u.memory).join('\n');

    return {
      shortTerm: {
        type: 'short_term',
        sessionId: notebookId,
        recentTurns: (recentChatMessages || []).slice(-4).map((m) => ({ role: m.role, content: m.content })),
      },
      conversationHistory: (recentChatMessages || []).map((m) => ({
        type: 'conversation',
        messageId: m.id,
        role: m.role as any,
        content: m.content,
        timestamp: m.createdAt,
      })),
      userProfile: {
        type: 'user_profile',
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

  private extractQueryEntities(query: string): string[] {
    const capitalizedWords = query.match(/\b[A-Z][a-zA-Z0-9_-]{2,}\b/g) || [];
    const keywords = query
      .split(/\s+/)
      .filter((w) => w.length > 3 && !['what', 'when', 'where', 'which', 'about', 'explain'].includes(w.toLowerCase()));

    return Array.from(new Set([...capitalizedWords, ...keywords])).slice(0, 6);
  }
}
