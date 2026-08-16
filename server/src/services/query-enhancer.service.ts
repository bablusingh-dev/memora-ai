import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const QueryEnhancementSchema = z.object({
  correctedQuery: z
    .string()
    .describe('The user query with all typos, misspellings, and grammatical errors corrected while strictly preserving the user intent.'),
  expandedKeywords: z
    .array(z.string())
    .describe('3 to 5 relevant technical or domain keywords, synonyms, acronyms, and related subtopics for lexical BM25 retrieval.'),
  intentSummary: z
    .string()
    .describe('A brief summary of what specific answer or evidence the user is looking for.'),
});

export type EnhancedQuery = {
  rawQuery: string;
  correctedQuery: string;
  expandedKeywords: string[];
  intentSummary: string;
  searchTerms: string[];
};

export class QueryEnhancerService {
  private openai: ReturnType<typeof createOpenAI>;

  constructor() {
    this.openai = createOpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
  }

  /**
   * Normalize typos, correct spelling, and generate keyword expansions for multi-query BM25 RAG
   */
  async enhanceQuery(
    rawQuery: string,
    recentHistory: { role: string; content: string }[] = []
  ): Promise<EnhancedQuery> {
    const trimmed = rawQuery.trim();
    if (!trimmed) {
      return {
        rawQuery: '',
        correctedQuery: '',
        expandedKeywords: [],
        intentSummary: '',
        searchTerms: [],
      };
    }

    // For very simple single-word greeting or generic short tokens, return fast fallback
    if (trimmed.length < 4 && !trimmed.includes(' ')) {
      return {
        rawQuery: trimmed,
        correctedQuery: trimmed,
        expandedKeywords: [trimmed],
        intentSummary: trimmed,
        searchTerms: [trimmed],
      };
    }

    try {
      const historyContext = recentHistory
        .slice(-4)
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join('\n');

      const { object } = await generateObject({
        model: this.openai('gpt-4o-mini'),
        schema: QueryEnhancementSchema,
        prompt: `
You are an expert Search Query Reformulator and Spell Normalizer for a High-Precision RAG System.

The user input may contain typos, misspellings, bad grammar, ambiguous pronouns (e.g. "what did he say about that?"), or missing domain synonyms.

Analyze the user's latest query in the context of recent messages:

[Recent Conversation Context]:
${historyContext || 'No previous conversation'}

[User Input]:
"${trimmed}"

TASKS:
1. CORRECT SPELLINGS & GRAMMAR: Fix all typos and misspellings (e.g., "mang server crshes" -> "manage server crashes", "alrams" -> "alarms", "ne04j" -> "neo4j", "parade db" -> "paradedb").
2. CONVERSATIONAL ANAPHORA RESOLUTION: If the user says "what did he say about it?", resolve "it" to the specific subject discussed.
3. DOMAIN KEYWORD EXPANSION: Generate 3 to 5 related technical/domain synonyms, subtopics, and exact terms that might appear in the uploaded document chunks (e.g. for "manage server crashes", expand to ["server downtime", "alerting systems", "load testing", "failover redundancy", "system recovery"]).
        `.trim(),
      });

      const uniqueTerms = Array.from(
        new Set([object.correctedQuery, ...object.expandedKeywords, trimmed].filter(Boolean))
      );

      logger.info(
        {
          rawQuery: trimmed,
          correctedQuery: object.correctedQuery,
          expandedKeywords: object.expandedKeywords,
        },
        '[QueryEnhancer] Successfully normalized and expanded query for BM25 RAG'
      );

      return {
        rawQuery: trimmed,
        correctedQuery: object.correctedQuery || trimmed,
        expandedKeywords: object.expandedKeywords || [],
        intentSummary: object.intentSummary || trimmed,
        searchTerms: uniqueTerms,
      };
    } catch (error) {
      logger.warn({ error, rawQuery: trimmed }, '[QueryEnhancer] Fallback to raw query due to enhancement error');
      return {
        rawQuery: trimmed,
        correctedQuery: trimmed,
        expandedKeywords: [trimmed],
        intentSummary: trimmed,
        searchTerms: [trimmed],
      };
    }
  }
}

export const queryEnhancer = new QueryEnhancerService();
