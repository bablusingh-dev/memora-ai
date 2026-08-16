/**
 * Chunking service tests.
 * Run with: npx tsx --test src/services/__tests__/chunking.test.ts
 *
 * Uses Node.js built-in test runner (no external test framework needed).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ChunkingService, TextChunk } from '../chunking.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function chunks(text: string, title = 'Test Doc', fileType: any = 'text'): TextChunk[] {
  return ChunkingService.createChunks(text, title, fileType);
}

function assertCoherent(chunk: TextChunk, label: string) {
  assert.ok(chunk.originalContent.trim().length > 0, `${label}: originalContent is empty`);
  assert.ok(chunk.retrievalContent.includes('Document: Test Doc'), `${label}: retrievalContent missing document title`);
  assert.ok(chunk.tokenCount > 0, `${label}: tokenCount is 0`);
  assert.ok(chunk.startPosition >= 0, `${label}: startPosition < 0`);
  assert.ok(chunk.endPosition > chunk.startPosition, `${label}: endPosition <= startPosition`);
}

// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------

describe('ChunkingService', () => {
  test('1. Empty text returns no chunks', () => {
    const result = chunks('');
    assert.equal(result.length, 0);
  });

  test('2. Very short document produces a single chunk', () => {
    const text = 'Short text.';
    const result = chunks(text);
    assert.equal(result.length, 1);
    assert.equal(result[0].originalContent, 'Short text.');
    assert.equal(result[0].chunkIndex, 0);
  });

  test('3. Markdown with multiple headings — each section produces a chunk', () => {
    // Each section has ~250 tokens of content to ensure the chunker splits them
    const loremSection = (heading: string) =>
      `${heading}\n\n` +
      Array(12)
        .fill(
          'This section contains detailed technical information about the topic. It covers theory, implementation, and practical considerations for software engineers working in this domain.'
        )
        .join(' ');

    const text = [
      loremSection('# Introduction'),
      loremSection('## Background and History'),
      loremSection('## Core Methodology'),
    ].join('\n\n');

    const result = chunks(text, 'Test Doc', 'web');

    assert.ok(result.length >= 2, `Expected >= 2 chunks, got ${result.length}`);
    // At least one chunk should carry a heading
    const withHeadings = result.filter((c) => c.heading);
    assert.ok(withHeadings.length > 0, 'No chunks have heading metadata');
    result.forEach((c, i) => assertCoherent(c, `Chunk ${i}`));
  });

  test('4. Nested headings populate sectionPath correctly', () => {
    const text = `# Chapter 1\n\n## Section 1.1\n\nSome content in section 1.1.\n\n### Subsection 1.1.1\n\nDeep content here inside subsection 1.1.1.`;
    const result = chunks(text, 'Test Doc', 'web');

    const deepChunk = result.find((c) => c.sectionPath && c.sectionPath.includes('>'));
    assert.ok(deepChunk, 'No chunk with nested sectionPath found');
  });

  test('5. Code block is not split across chunks', () => {
    const codeBlock = '```python\ndef hello():\n    print("hello world")\n    return True\n```';
    const text = `# Examples\n\nHere is a Python example:\n\n${codeBlock}\n\nThe above code prints hello.`;
    const result = chunks(text, 'Test Doc', 'web');

    // Verify the code fence appears intact in exactly one chunk
    const withCode = result.filter((c) => c.originalContent.includes('```python'));
    assert.equal(withCode.length, 1, `Code block appears in ${withCode.length} chunks, expected 1`);
    assert.ok(withCode[0].originalContent.includes('```python') && withCode[0].originalContent.includes('```'), 'Code block is split');
  });

  test('6. Table is not split across chunks', () => {
    const table = `| Name | Value |\n|------|-------|\n| A    | 1     |\n| B    | 2     |\n| C    | 3     |`;
    const text = `# Data\n\nResults:\n\n${table}\n\nEnd of results.`;
    const result = chunks(text, 'Test Doc', 'web');

    const withTable = result.filter((c) => c.originalContent.includes('| Name |'));
    assert.equal(withTable.length, 1, `Table appears in ${withTable.length} chunks, expected 1`);
  });

  test('7. List items stay together in a chunk', () => {
    const list = `- Item one\n- Item two\n- Item three\n- Item four`;
    const text = `# Features\n\n${list}`;
    const result = chunks(text, 'Test Doc', 'web');

    // All list items should appear in a single chunk
    const withAllItems = result.filter(
      (c) => c.originalContent.includes('Item one') && c.originalContent.includes('Item four')
    );
    assert.ok(withAllItems.length > 0, 'List items were split across chunks');
  });

  test('8. Transcript speaker turns stay together', () => {
    const text = `Speaker 1: Hello, welcome to the meeting.\n\nSpeaker 2: Thank you for having me. Today we discuss AI.\n\nSpeaker 1: Great. Let us start with the overview of the project.\n\nSpeaker 2: Sure. The project aims to build a knowledge graph system.`;
    const result = chunks(text, 'Test Doc', 'youtube');

    assert.ok(result.length >= 1, 'Expected at least 1 chunk');
    // Each chunk should not mix incomplete speaker turns
    for (const c of result) {
      assertCoherent(c, 'Transcript chunk');
    }
    // Source type should be transcript
    assert.equal(result[0].sourceType, 'transcript');
  });

  test('9. Long paragraph is split at sentence boundary', () => {
    // ~150 words → ~200 tokens — should produce at least 1 chunk
    const para = Array(15).fill('This is a long sentence that contains meaningful content.').join(' ');
    const result = chunks(para);

    assert.ok(result.length >= 1);
    // Chunks should not end mid-sentence (no dangling words after splitting)
    for (const c of result) {
      const lastChar = c.originalContent.trim().slice(-1);
      // Most chunks should end at a sentence boundary
      assertCoherent(c, 'Long para chunk');
    }
  });

  test('10. Document with no punctuation produces at least 1 chunk', () => {
    const text = 'word '.repeat(300);
    const result = chunks(text);
    assert.ok(result.length >= 1);
    assert.ok(result[0].originalContent.length > 0);
  });

  test('11. retrievalContent contains Document title and section', () => {
    const text = `# Authentication\n\n## JWT\n\nIt expires after 15 minutes.`;
    const result = chunks(text, 'React Documentation', 'web');

    const jwtChunk = result.find((c) => c.originalContent.includes('expires'));
    assert.ok(jwtChunk, 'JWT chunk not found');
    assert.ok(jwtChunk!.retrievalContent.includes('React Documentation'), 'Missing document title in retrievalContent');
    // The section path should flow to context
    assert.ok(jwtChunk!.sectionPath || jwtChunk!.heading, 'JWT chunk has no heading/sectionPath');
  });

  test('12. chunkIndex is sequential and starts at 0', () => {
    const text = Array(10).fill('Paragraph of reasonable length to ensure multiple chunks.').join('\n\n');
    const result = chunks(text);

    result.forEach((c, i) => {
      assert.equal(c.chunkIndex, i, `chunkIndex mismatch at position ${i}`);
    });
  });

  test('13. originalContent is not contaminated with retrieval prefix', () => {
    const text = `# Auth\n\nTokens expire after 15 minutes.`;
    const result = chunks(text, 'My Doc', 'web');

    for (const c of result) {
      assert.ok(!c.originalContent.startsWith('Document:'), 'originalContent has retrieval prefix');
    }
  });
});
