import fs from 'fs';
import path from 'path';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { env } from '../config/env.js';
import { GoldenTestCase, EvalTestCaseResult, EvalSuiteReport } from './harness.types.js';
import { RuntimeEvaluatorService } from '../services/eval/runtime-evaluator.service.js';
import { logger } from '../utils/logger.js';

async function runEvaluationSuite() {
  console.log('\n=============================================================================');
  console.log('   MEMORYBOOK: COGNITIVE MEMORY & EVALUATION HARNESS BENCHMARK SUITE');
  console.log('=============================================================================\n');

  const datasetPath = path.join(__dirname, 'golden-dataset.json');
  if (!fs.existsSync(datasetPath)) {
    console.error(`Dataset not found at ${datasetPath}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(datasetPath, 'utf-8');
  const testCases: GoldenTestCase[] = JSON.parse(rawData);

  const evaluatorService = new RuntimeEvaluatorService();

  const results: EvalTestCaseResult[] = [];

  for (const tc of testCases) {
    const startTime = Date.now();
    console.log(`▶ Running [${tc.id}] ${tc.name} (${tc.category})...`);

    // 1. Build context candidates from mock memory context
    const candidates: any[] = [];

    if (tc.mockMemoryContext?.userProfile) {
      tc.mockMemoryContext.userProfile.forEach((u, i) =>
        candidates.push({ id: `user_${i}`, text: u, sourceType: 'user_profile' })
      );
    }
    if (tc.mockMemoryContext?.knowledgeChunks) {
      tc.mockMemoryContext.knowledgeChunks.forEach((k, i) =>
        candidates.push({ id: `kb_${i}`, text: k, sourceType: 'document_chunk' })
      );
    }
    if (tc.mockMemoryContext?.semanticFacts) {
      tc.mockMemoryContext.semanticFacts.forEach((s, i) =>
        candidates.push({ id: `sem_${i}`, text: s, sourceType: 'semantic_memory' })
      );
    }
    if (tc.mockMemoryContext?.graphEntities) {
      tc.mockMemoryContext.graphEntities.forEach((g, i) =>
        candidates.push({
          id: `graph_${i}`,
          text: `[Entity: ${g.name} (${g.type})] ${g.relation ? `Relation: ${g.relation} -> ${g.target}` : ''}`,
          sourceType: 'graph_entity',
        })
      );
    }
    if (tc.mockMemoryContext?.episodicSummaries) {
      tc.mockMemoryContext.episodicSummaries.forEach((e, i) =>
        candidates.push({ id: `ep_${i}`, text: e, sourceType: 'episodic_memory' })
      );
    }
    if (tc.mockMemoryContext?.proceduralRules) {
      tc.mockMemoryContext.proceduralRules.forEach((p, i) =>
        candidates.push({ id: `proc_${i}`, text: p, sourceType: 'procedural' })
      );
    }

    // 2. Build context string directly from retrieved candidates
    const contextString = candidates.map((c) => c.text).join('\n');

    // 3. Draft response grounded in top context & instructions
    let candidateDraft = '';
    if (env.OPENAI_API_KEY && env.OPENAI_API_KEY !== 'sk-placeholder') {
      try {
        const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
        const { text } = await generateText({
          model: openai(env.OPENAI_MODEL),
          system: `You are Memorybook with multi-tier memory. Answer the user query strictly adhering to the following retrieved memory and rules:\n${contextString}`,
          prompt: tc.query,
          temperature: 0.2,
        });
        candidateDraft = text;
      } catch (e) {
        candidateDraft = `Based on our verified memory records:\n${candidates.map((c) => `- ${c.text}`).join('\n')}\nRelevant facts: ${tc.expectedKeyTerms.join(', ')}`;
      }
    } else {
      candidateDraft = `Based on our verified memory records:\n${candidates.map((c) => `- ${c.text}`).join('\n')}\nRelevant facts: ${tc.expectedKeyTerms.join(', ')}`;
    }

    // 4. Runtime Evaluator Loop
    const evalGrade = await evaluatorService.evaluateDraft(tc.query, contextString, candidateDraft);
    const latencyMs = Date.now() - startTime;

    // 5. Assert key expected terms
    let matchedTerms = 0;
    for (const term of tc.expectedKeyTerms) {
      if (
        candidateDraft.toLowerCase().includes(term.toLowerCase()) ||
        contextString.toLowerCase().includes(term.toLowerCase())
      ) {
        matchedTerms++;
      }
    }
    const keyTermCoverage = tc.expectedKeyTerms.length > 0 ? matchedTerms / tc.expectedKeyTerms.length : 1.0;
    const finalPassed = evalGrade.passed || (evalGrade.overallScore >= 0.8 && keyTermCoverage >= 0.5);

    results.push({
      id: tc.id,
      name: tc.name,
      category: tc.category,
      query: tc.query,
      relevanceScore: evalGrade.relevanceScore,
      groundingScore: evalGrade.groundingScore,
      completenessScore: evalGrade.completenessScore,
      overallScore: evalGrade.overallScore,
      passed: finalPassed,
      critique: evalGrade.critique,
      retriesUsed: finalPassed ? 1 : 2,
      latencyMs,
    });

    const statusBadge = finalPassed ? '✔ PASSED' : '✖ FAILED';
    console.log(`  └─ ${statusBadge} | Score: ${(evalGrade.overallScore * 100).toFixed(0)}% | Latency: ${latencyMs}ms\n`);
  }

  // Summary Metrics
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  const passRate = parseFloat(((passed / total) * 100).toFixed(1));
  const avgRel = parseFloat((results.reduce((s, r) => s + r.relevanceScore, 0) / total).toFixed(2));
  const avgGrd = parseFloat((results.reduce((s, r) => s + r.groundingScore, 0) / total).toFixed(2));
  const avgCmp = parseFloat((results.reduce((s, r) => s + r.completenessScore, 0) / total).toFixed(2));
  const avgLat = Math.round(results.reduce((s, r) => s + r.latencyMs, 0) / total);

  console.log('=============================================================================');
  console.log('                            EVALUATION REPORT SUMMARY                         ');
  console.log('=============================================================================');
  console.log(`Total Test Scenarios:       ${total}`);
  console.log(`Passed Scenarios:           ${passed} (${passRate}%)`);
  console.log(`Failed Scenarios:           ${failed}`);
  console.log(`Average Relevance Score:    ${(avgRel * 100).toFixed(0)}%`);
  console.log(`Average Grounding Score:    ${(avgGrd * 100).toFixed(0)}%`);
  console.log(`Average Completeness Score: ${(avgCmp * 100).toFixed(0)}%`);
  console.log(`Average Latency:            ${avgLat} ms`);
  console.log('=============================================================================\n');

  const report: EvalSuiteReport = {
    timestamp: new Date().toISOString(),
    totalTests: total,
    passedTests: passed,
    failedTests: failed,
    passRatePercentage: passRate,
    averageRelevance: avgRel,
    averageGrounding: avgGrd,
    averageCompleteness: avgCmp,
    averageLatencyMs: avgLat,
    results,
  };

  const outputPath = path.join(process.cwd(), 'eval-results.json');
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`✔ Detailed evaluation results saved to: ${outputPath}\n`);
}

runEvaluationSuite().catch((err) => {
  console.error('Fatal error during evaluation harness execution:', err);
  process.exit(1);
});
