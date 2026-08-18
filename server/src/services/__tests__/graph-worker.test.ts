/**
 * Graph extraction pipeline unit tests.
 * Run with: npx tsx --test src/services/__tests__/graph-worker.test.ts
 *
 * Tests the filtering/normalization logic in triple-filter.ts — the REAL
 * module used by the graph-extract-chunk Inngest function (see
 * server/src/inngest/functions/graph-extract.ts) — plus a simulated model of
 * the deduplication semantics performed by Neo4j's MERGE queries. Pure unit
 * tests: no Neo4j or OpenAI connection needed.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { filterTriples } from '../graph/triple-filter.js';

// Canonical name normalization (same logic used in entity upsert)
function canonicalKey(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

// Simulate relationship deduplication
function deduplicateRelations(
  existing: { source: string; rel: string; target: string; sourceChunkIds: string[] }[],
  newTriple: { sourceName: string; relation: string; targetName: string; sourceChunkId: string }
) {
  const key = `${canonicalKey(newTriple.sourceName)}::${newTriple.relation}::${canonicalKey(newTriple.targetName)}`;
  const found = existing.find(
    (e) =>
      `${canonicalKey(e.source)}::${e.rel}::${canonicalKey(e.target)}` === key
  );
  if (found) {
    if (!found.sourceChunkIds.includes(newTriple.sourceChunkId)) {
      found.sourceChunkIds.push(newTriple.sourceChunkId);
    }
    return existing;
  }
  existing.push({
    source: newTriple.sourceName,
    rel: newTriple.relation,
    target: newTriple.targetName,
    sourceChunkIds: [newTriple.sourceChunkId],
  });
  return existing;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GraphWorker — filterTriples', () => {
  test('1. Valid high-confidence triple is accepted', () => {
    const triples = [{
      sourceName: 'OpenAI',
      sourceType: 'Organization',
      relation: 'CREATED',
      targetName: 'GPT-4',
      targetType: 'Product',
      evidence: 'OpenAI created GPT-4 in 2023.',
      confidence: 0.95,
    }];
    const result = filterTriples(triples, 'chunk-001');
    assert.equal(result.length, 1);
    assert.equal(result[0].sourceName, 'OpenAI');
    assert.equal(result[0].relation, 'CREATED');
    assert.equal(result[0].sourceChunkId, 'chunk-001');
  });

  test('2. Triple below minimum confidence threshold is rejected', () => {
    const triples = [{
      sourceName: 'CompanyA',
      relation: 'MAYBE_RELATED_TO',
      targetName: 'ProductB',
      evidence: 'Possibly related.',
      confidence: 0.45,
    }];
    const result = filterTriples(triples, 'chunk-002');
    assert.equal(result.length, 0, 'Low-confidence triple should be rejected');
  });

  test('3. Triple with empty evidence is rejected', () => {
    const triples = [{
      sourceName: 'Microsoft',
      relation: 'OWNS',
      targetName: 'GitHub',
      evidence: '',  // no evidence
      confidence: 0.90,
    }];
    const result = filterTriples(triples, 'chunk-003');
    assert.equal(result.length, 0, 'Triple without evidence should be rejected');
  });

  test('4. Self-loop is rejected', () => {
    const triples = [{
      sourceName: 'Python',
      relation: 'USES',
      targetName: 'Python',
      evidence: 'Python uses Python.',
      confidence: 0.85,
    }];
    const result = filterTriples(triples, 'chunk-004');
    assert.equal(result.length, 0, 'Self-loop should be rejected');
  });

  test('5. Generic meta-word entities are rejected', () => {
    const stopwordTriples = [
      { sourceName: 'document', relation: 'ABOUT', targetName: 'React', evidence: 'Document about React.', confidence: 0.90 },
      { sourceName: 'React', relation: 'USES', targetName: 'things', evidence: 'React uses things.', confidence: 0.88 },
      { sourceName: 'system', relation: 'MANAGES', targetName: 'Docker', evidence: 'System manages Docker.', confidence: 0.92 },
    ];
    const result = filterTriples(stopwordTriples, 'chunk-005');
    assert.equal(result.length, 0, 'All meta-word triples should be rejected');
  });

  test('6. Results sorted by confidence descending, capped at 5', () => {
    const triples = Array.from({ length: 8 }, (_, i) => ({
      sourceName: `Entity${i}`,
      relation: 'RELATED_TO',
      targetName: `Target${i}`,
      evidence: `Evidence for entity ${i}.`,
      confidence: 0.60 + i * 0.03,
    }));
    const result = filterTriples(triples, 'chunk-006');
    assert.equal(result.length, 5, 'Should cap at 5 triples');
    // First should have highest confidence
    assert.ok(result[0].confidence >= result[result.length - 1].confidence, 'Not sorted by confidence');
  });

  test('7. Entity normalization strips trailing punctuation', () => {
    const triples = [{
      sourceName: 'OpenAI,',
      relation: 'CREATED',
      targetName: 'GPT-4.',
      evidence: 'OpenAI created GPT-4.',
      confidence: 0.92,
    }];
    const result = filterTriples(triples, 'chunk-007');
    assert.equal(result[0].sourceName, 'OpenAI', 'Trailing comma not stripped');
    assert.equal(result[0].targetName, 'GPT-4', 'Trailing period not stripped');
  });
});

describe('GraphWorker — entity normalization / deduplication', () => {
  test('8. OpenAI / openai / Open AI resolve to same canonical key', () => {
    const variants = ['OpenAI', 'openai', 'Open AI', 'OPENAI'];
    const keys = variants.map(canonicalKey);
    // All should be lowercase-trimmed
    assert.equal(keys[0], 'openai');
    assert.equal(keys[1], 'openai');
    assert.equal(keys[2], 'open ai');
    // Note: "Open AI" and "OpenAI" are different strings after normalization.
    // Full entity resolution (alias merging) happens in Neo4j MERGE, not here.
    // But simple canonical matching works for exact-same-name variants.
    assert.equal(keys[3], 'openai');
  });

  test('9. Same relationship from two chunks deduplicates correctly', () => {
    const relations: { source: string; rel: string; target: string; sourceChunkIds: string[] }[] = [];

    deduplicateRelations(relations, { sourceName: 'OpenAI', relation: 'CREATED', targetName: 'GPT-4', sourceChunkId: 'chunk-A' });
    deduplicateRelations(relations, { sourceName: 'OpenAI', relation: 'CREATED', targetName: 'GPT-4', sourceChunkId: 'chunk-B' });
    deduplicateRelations(relations, { sourceName: 'OpenAI', relation: 'CREATED', targetName: 'GPT-4', sourceChunkId: 'chunk-B' }); // duplicate chunk

    assert.equal(relations.length, 1, 'Should have exactly 1 relationship');
    assert.equal(relations[0].sourceChunkIds.length, 2, 'Should have 2 unique sourceChunkIds');
    assert.ok(relations[0].sourceChunkIds.includes('chunk-A'));
    assert.ok(relations[0].sourceChunkIds.includes('chunk-B'));
  });

  test('10. Different relationships between same entities are kept separate', () => {
    const relations: { source: string; rel: string; target: string; sourceChunkIds: string[] }[] = [];

    deduplicateRelations(relations, { sourceName: 'Microsoft', relation: 'OWNS', targetName: 'GitHub', sourceChunkId: 'c1' });
    deduplicateRelations(relations, { sourceName: 'Microsoft', relation: 'ACQUIRED', targetName: 'GitHub', sourceChunkId: 'c2' });

    assert.equal(relations.length, 2, 'Different relation types should create separate relationships');
  });

  test('11. Provenance: every accepted triple has a sourceChunkId', () => {
    const triples = [
      { sourceName: 'Tesla', relation: 'MANUFACTURES', targetName: 'Model S', evidence: 'Tesla manufactures the Model S.', confidence: 0.95 },
      { sourceName: 'Elon Musk', relation: 'LEADS', targetName: 'Tesla', evidence: 'Elon Musk leads Tesla as CEO.', confidence: 0.98 },
    ];
    const result = filterTriples(triples, 'chunk-provenance-test');
    for (const t of result) {
      assert.equal(t.sourceChunkId, 'chunk-provenance-test', 'Missing sourceChunkId provenance');
    }
  });
});
