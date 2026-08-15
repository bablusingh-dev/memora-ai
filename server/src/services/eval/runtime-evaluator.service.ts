import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

export interface EvaluationGrade {
  relevanceScore: number;
  groundingScore: number;
  completenessScore: number;
  overallScore: number;
  passed: boolean;
  critique: string;
  suggestedReformulation?: string;
}

export class RuntimeEvaluatorService {
  private threshold = env.EVAL_CONFIDENCE_THRESHOLD;

  /**
   * Evaluates a draft response against the user query and retrieved context
   */
  async evaluateDraft(
    query: string,
    context: string,
    draftAnswer: string
  ): Promise<EvaluationGrade> {
    if (!draftAnswer || !draftAnswer.trim()) {
      return {
        relevanceScore: 0,
        groundingScore: 0,
        completenessScore: 0,
        overallScore: 0,
        passed: false,
        critique: 'Draft answer is empty.',
      };
    }

    if (!env.OPENAI_API_KEY || env.OPENAI_API_KEY === 'sk-placeholder') {
      // Local heuristic fallback if OpenAI key is not set
      return this.heuristicEvaluation(query, context, draftAnswer);
    }

    try {
      const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
      const evalPrompt = `
You are an expert AI Response Evaluator and Fact Checker.
Evaluate the following Draft Answer against the User Query and the Retrieved Context.

[User Query]: ${query}
[Retrieved Context]:
${context || 'No specific document context retrieved.'}

[Draft Answer]:
${draftAnswer}

Grade the response on 3 criteria (scale 0.0 to 1.0):
1. relevance: Does it directly and concisely answer what the user asked?
2. grounding: Is every statement strictly supported by the context without hallucinating?
3. completeness: Are key requested aspects addressed?

Respond in pure JSON format:
{
  "relevance": 0.95,
  "grounding": 0.90,
  "completeness": 0.88,
  "passed": true,
  "critique": "Brief 1-sentence critique",
  "suggestedReformulation": "Keywords or specific question to search if more info is needed"
}
`;

      const { text } = await generateText({
        model: openai(env.OPENAI_MODEL),
        prompt: evalPrompt,
        temperature: 0.1,
      });

      const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      const relevance = Math.min(Math.max(parsed.relevance || 0, 0), 1);
      const grounding = Math.min(Math.max(parsed.grounding || 0, 0), 1);
      const completeness = Math.min(Math.max(parsed.completeness || 0, 0), 1);
      const overallScore = parseFloat((relevance * 0.4 + grounding * 0.4 + completeness * 0.2).toFixed(2));
      const passed = overallScore >= this.threshold && parsed.passed !== false;

      logger.info(
        { overallScore, relevance, grounding, completeness, passed },
        'Completed LLM draft self-evaluation'
      );

      return {
        relevanceScore: relevance,
        groundingScore: grounding,
        completenessScore: completeness,
        overallScore,
        passed,
        critique: parsed.critique || (passed ? 'Response satisfies criteria' : 'Needs refinement'),
        suggestedReformulation: parsed.suggestedReformulation,
      };
    } catch (err) {
      logger.warn({ err }, 'LLM-as-a-judge evaluation failed, using heuristic grading');
      return this.heuristicEvaluation(query, context, draftAnswer);
    }
  }

  private heuristicEvaluation(query: string, context: string, draftAnswer: string): EvaluationGrade {
    const queryTokens = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
    const draftTokens = draftAnswer.toLowerCase().split(/\s+/);
    
    let matchCount = 0;
    for (const t of queryTokens) {
      if (draftTokens.includes(t)) matchCount++;
    }

    const relevance = queryTokens.length > 0 ? Math.min((matchCount / queryTokens.length) * 1.2, 1.0) : 0.8;
    const grounding = draftAnswer.length > 30 ? 0.9 : 0.5;
    const completeness = draftAnswer.length > 50 ? 0.85 : 0.6;
    const overallScore = parseFloat((relevance * 0.4 + grounding * 0.4 + completeness * 0.2).toFixed(2));

    return {
      relevanceScore: relevance,
      groundingScore: grounding,
      completenessScore: completeness,
      overallScore,
      passed: overallScore >= 0.7,
      critique: overallScore >= 0.7 ? 'Passes heuristic quality check' : 'Draft answer is too brief or unaligned',
    };
  }
}
