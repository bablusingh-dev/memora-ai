export interface GoldenTestCase {
  id: string;
  name: string;
  category:
    | 'short_term_recall'
    | 'user_profile_adherence'
    | 'semantic_fact_retrieval'
    | 'graph_entity_traversal'
    | 'episodic_experience'
    | 'procedural_workflow'
    | 'temporal_ordering'
    | 'hallucination_resistance'
    | 'corrective_reflection';
  query: string;
  mockMemoryContext?: {
    userProfile?: string[];
    semanticFacts?: string[];
    graphEntities?: { name: string; type: string; relation?: string; target?: string }[];
    knowledgeChunks?: string[];
    episodicSummaries?: string[];
    proceduralRules?: string[];
  };
  expectedKeyTerms: string[];
  forbiddenTerms?: string[];
  minGroundednessScore: number;
  minRelevanceScore: number;
}

export interface EvalTestCaseResult {
  id: string;
  name: string;
  category: string;
  query: string;
  relevanceScore: number;
  groundingScore: number;
  completenessScore: number;
  overallScore: number;
  passed: boolean;
  critique: string;
  retriesUsed: number;
  latencyMs: number;
}

export interface EvalSuiteReport {
  timestamp: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  passRatePercentage: number;
  averageRelevance: number;
  averageGrounding: number;
  averageCompleteness: number;
  averageLatencyMs: number;
  results: EvalTestCaseResult[];
}
