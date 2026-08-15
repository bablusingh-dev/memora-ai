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
  messageId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface UserProfileMemory {
  type: 'user_profile';
  userId: string;
  bio?: string;
  preferences: Record<string, string>;
  domainExpertise?: string[];
  rules: string[];
}

export interface SemanticFactMemory {
  type: 'semantic';
  id: string;
  fact: string;
  confidence: number;
  sourceContext?: string;
  category?: string;
}

export interface EntityGraphMemory {
  type: 'entity';
  name: string;
  entityType: string;
  description?: string;
  connectedEntities: {
    target: string;
    relation: string;
    description?: string;
    validFrom?: string | Date;
    validTo?: string | Date;
  }[];
}

export interface KnowledgeBaseMemory {
  type: 'knowledge_base';
  chunkId: string;
  sourceId: string;
  content: string;
  chunkIndex: number;
  bm25Score?: number;
}

export interface EpisodicMemoryItem {
  type: 'episodic';
  id: string;
  summary: string;
  sessionDate: Date | string;
  notebookId: string;
  keyTakeaways: string[];
}

export interface ProceduralMemoryItem {
  type: 'procedural';
  id: string;
  workflowName: string;
  triggerPattern: string;
  instructions: string[];
}

export interface TemporalMemoryItem {
  type: 'temporal';
  subject: string;
  predicate: string;
  object: string;
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
