/**
 * Cognitive memory types for the Memora AI multi-tier memory system.
 *
 * Conceptual layers (clear boundaries — do NOT mix):
 *   1. CONVERSATION — recent turns in this session
 *   2. USER         — user profile, preferences, procedural rules
 *   3. DOCUMENT     — BM25 knowledge chunks from ingested sources
 *   4. GRAPH        — entity/relationship knowledge from Neo4j
 */

export type MemoryLayer = 'conversation' | 'user' | 'document' | 'graph';

export type MemoryType =
  | 'short_term'
  | 'conversation'
  | 'user_profile'
  | 'semantic'
  | 'entity'
  | 'knowledge_base'
  | 'episodic'
  | 'procedural'
  | 'temporal';

export interface ShortTermWorkingMemory {
  type: 'short_term';
  sessionId: string;
  activeScratchpad?: string;
  recentTurns: { role: string; content: string }[];
}

export interface ConversationMemoryItem {
  type: 'conversation';
  memoryLayer: 'conversation';
  messageId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface UserProfileMemory {
  type: 'user_profile';
  memoryLayer: 'user';
  userId: string;
  bio?: string;
  preferences: Record<string, string>;
  domainExpertise?: string[];
  rules: string[];
}

export interface SemanticFactMemory {
  type: 'semantic';
  memoryLayer: 'user';
  id: string;
  fact: string;
  confidence: number;
  sourceContext?: string;
  category?: string;
}

export interface EntityGraphMemory {
  type: 'entity';
  memoryLayer: 'graph';
  name: string;
  entityType: string;
  description?: string;
  /** Chunk IDs from which this entity was extracted — for provenance. */
  sourceChunkIds?: string[];
  connectedEntities: {
    target: string;
    relation: string;
    description?: string;
    confidence?: number;
    evidence?: string;
    sourceChunkIds?: string[];
    validFrom?: string | Date;
    validTo?: string | Date;
  }[];
}

export interface KnowledgeBaseMemory {
  type: 'knowledge_base';
  memoryLayer: 'document';
  chunkId: string;
  sourceId: string;
  content: string;
  retrievalContent?: string;
  heading?: string;
  sectionPath?: string;
  chunkIndex: number;
  bm25Score?: number;
}

export interface EpisodicMemoryItem {
  type: 'episodic';
  memoryLayer: 'user';
  id: string;
  summary: string;
  sessionDate: Date | string;
  notebookId: string;
  keyTakeaways: string[];
}

export interface ProceduralMemoryItem {
  type: 'procedural';
  memoryLayer: 'user';
  id: string;
  workflowName: string;
  triggerPattern: string;
  instructions: string[];
}

export interface TemporalMemoryItem {
  type: 'temporal';
  memoryLayer: 'graph';
  subject: string;
  predicate: string;
  object: string;
  confidence?: number;
  evidence?: string;
  occurredAt?: Date | string;
  validFrom?: Date | string;
  validTo?: Date | string;
}

export interface CognitiveMemoryBundle {
  shortTerm?: ShortTermWorkingMemory;
  conversationHistory?: ConversationMemoryItem[];
  userProfile?: UserProfileMemory;
  semanticFacts: SemanticFactMemory[];
  entityGraph: EntityGraphMemory[];
  knowledgeChunks: KnowledgeBaseMemory[];
  episodicMemories: EpisodicMemoryItem[];
  proceduralRules: ProceduralMemoryItem[];
  temporalEvents: TemporalMemoryItem[];
}
