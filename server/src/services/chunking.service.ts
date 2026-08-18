import { logger } from '../utils/logger.js';
import { approxTokenCount as approxTokens } from '../utils/tokens.js';

export interface TextChunk {
  /** Raw extracted content from the source document — never modified. */
  originalContent: string;
  /**
   * Context-enriched version of the content stored in the DB and used for BM25 retrieval.
   * Includes document title, section breadcrumb, and the original content so that a
   * retrieved chunk is self-contained ("Document: X / Section: Y / content…").
   */
  retrievalContent: string;
  chunkIndex: number;
  heading?: string;
  parentSection?: string;
  sectionPath?: string;
  /** Detected document type that drove the chunking strategy. */
  sourceType: 'markdown' | 'transcript' | 'text';
  /** Approximate token count (word-count / 0.75). */
  tokenCount: number;
  /** Byte/character offset into the cleaned source text where this chunk starts. */
  startPosition: number;
  /** Byte/character offset into the cleaned source text where this chunk ends. */
  endPosition: number;
}


// ---------------------------------------------------------------------------
// Document type detection
// ---------------------------------------------------------------------------
function detectSourceType(text: string): 'markdown' | 'transcript' | 'text' {
  // Has markdown headings?
  if (/^#{1,4}\s+.+/m.test(text)) return 'markdown';
  // Has transcript speaker-turn pattern (e.g. "Speaker 1:", "JOHN:", "[00:12]")
  if (/^(?:[A-Z][A-Za-z\s]{1,30}:|Speaker\s*\d+:|(\[\d{2}:\d{2}\]))/m.test(text)) return 'transcript';
  return 'text';
}

// ---------------------------------------------------------------------------
// Block types for the markdown parser
// ---------------------------------------------------------------------------
interface Block {
  type: 'heading' | 'code' | 'table' | 'list' | 'paragraph' | 'blank';
  level?: number;   // for headings: 1-6
  content: string;  // raw text of the block
}

/**
 * Very lightweight markdown block splitter.
 * Does NOT use a full AST — only what we need for structural chunking.
 */
function parseMarkdownBlocks(text: string): Block[] {
  const lines = text.split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Blank line
    if (!line.trim()) {
      i++;
      continue;
    }

    // Fenced code block (``` or ~~~)
    const fenceMatch = line.match(/^(`{3,}|~{3,})/);
    if (fenceMatch) {
      const fence = fenceMatch[1];
      const codeLines = [line];
      i++;
      while (i < lines.length) {
        codeLines.push(lines[i]);
        if (lines[i].startsWith(fence)) { i++; break; }
        i++;
      }
      blocks.push({ type: 'code', content: codeLines.join('\n') });
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      blocks.push({ type: 'heading', level: headingMatch[1].length, content: line });
      i++;
      continue;
    }

    // Table row (pipe-delimited)
    if (line.startsWith('|')) {
      const tableLines = [line];
      i++;
      while (i < lines.length && lines[i].startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: 'table', content: tableLines.join('\n') });
      continue;
    }

    // List item (-, *, +, or numbered)
    if (/^(\s*[-*+]|\s*\d+\.)/.test(line)) {
      const listLines = [line];
      i++;
      while (i < lines.length && /^(\s*[-*+]|\s*\d+\.)/.test(lines[i])) {
        listLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: 'list', content: listLines.join('\n') });
      continue;
    }

    // Paragraph — accumulate until blank line or next structural element
    const paraLines = [line];
    i++;
    while (i < lines.length) {
      const next = lines[i];
      if (!next.trim()) break;
      if (/^#{1,6}\s/.test(next)) break;
      if (next.match(/^(`{3,}|~{3,})/)) break;
      if (next.startsWith('|')) break;
      paraLines.push(next);
      i++;
    }
    blocks.push({ type: 'paragraph', content: paraLines.join('\n') });
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// Split oversized text at sentence boundaries
// ---------------------------------------------------------------------------
function splitAtSentenceBoundary(text: string, maxTokens: number): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const parts: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (approxTokens(candidate) > maxTokens && current) {
      parts.push(current.trim());
      current = sentence;
    } else {
      current = candidate;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

// ---------------------------------------------------------------------------
// Build the retrieval content string (context-enriched for BM25)
// ---------------------------------------------------------------------------
function buildRetrievalContent(
  originalContent: string,
  documentTitle: string,
  sectionPath?: string
): string {
  const lines: string[] = [`Document: ${documentTitle}`];
  if (sectionPath) lines.push(`Section: ${sectionPath}`);
  lines.push('', originalContent);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Transcript chunking: split at speaker turns
// ---------------------------------------------------------------------------
function chunkTranscript(
  text: string,
  documentTitle: string,
  targetMin = 200,
  targetMax = 700,
  hardMax = 900
): Omit<TextChunk, 'chunkIndex'>[] {
  // Speaker pattern: "Speaker Name:", "JOHN:", "[00:01:23]"
  const turnPattern = /^(?:[A-Z][A-Za-z\s]{1,30}:|Speaker\s*\d+:|(\[\d{2}:\d{2}(?::\d{2})?\]))/m;
  const rawTurns = text.split(/\n(?=[A-Z][A-Za-z\s]{1,30}:|Speaker\s*\d+:)/);

  const chunks: Omit<TextChunk, 'chunkIndex'>[] = [];
  let accumulated = '';
  let startPos = 0;
  let currentPos = 0;

  const flush = (content: string, start: number, end: number) => {
    const original = content.trim();
    if (!original) return;
    chunks.push({
      originalContent: original,
      retrievalContent: buildRetrievalContent(original, documentTitle, 'Transcript'),
      heading: 'Transcript',
      parentSection: undefined,
      sectionPath: 'Transcript',
      sourceType: 'transcript',
      tokenCount: approxTokens(original),
      startPosition: start,
      endPosition: end,
    });
  };

  for (const turn of rawTurns) {
    const tokens = approxTokens((accumulated + '\n' + turn).trim());

    if (tokens > hardMax && accumulated) {
      flush(accumulated, startPos, currentPos);
      startPos = currentPos;
      accumulated = turn;
    } else if (tokens >= targetMin && tokens > targetMax) {
      // Flush at natural turn boundary
      flush((accumulated + '\n' + turn).trim(), startPos, currentPos + turn.length);
      startPos = currentPos + turn.length;
      accumulated = '';
    } else {
      accumulated = accumulated ? `${accumulated}\n${turn}` : turn;
    }
    currentPos += turn.length + 1;
  }
  if (accumulated.trim()) flush(accumulated, startPos, currentPos);

  return chunks;
}

// ---------------------------------------------------------------------------
// Plain-text chunking: paragraph → sentence fallback
// ---------------------------------------------------------------------------
function chunkPlainText(
  text: string,
  documentTitle: string,
  targetMin = 200,
  targetMax = 700,
  hardMax = 900
): Omit<TextChunk, 'chunkIndex'>[] {
  const paragraphs = text.split(/\n{2,}/);
  const chunks: Omit<TextChunk, 'chunkIndex'>[] = [];
  let accumulated = '';
  let startPos = 0;
  let currentPos = 0;

  const flush = (content: string, start: number, end: number) => {
    const original = content.trim();
    if (!original) return;
    // If still too large, split at sentence boundary
    if (approxTokens(original) > hardMax) {
      const parts = splitAtSentenceBoundary(original, targetMax);
      let partStart = start;
      for (const part of parts) {
        chunks.push({
          originalContent: part,
          retrievalContent: buildRetrievalContent(part, documentTitle),
          heading: undefined,
          parentSection: undefined,
          sectionPath: undefined,
          sourceType: 'text',
          tokenCount: approxTokens(part),
          startPosition: partStart,
          endPosition: partStart + part.length,
        });
        partStart += part.length + 1;
      }
    } else {
      chunks.push({
        originalContent: original,
        retrievalContent: buildRetrievalContent(original, documentTitle),
        heading: undefined,
        parentSection: undefined,
        sectionPath: undefined,
        sourceType: 'text',
        tokenCount: approxTokens(original),
        startPosition: start,
        endPosition: end,
      });
    }
  };

  for (const para of paragraphs) {
    const paraLen = para.length;
    const candidate = accumulated ? `${accumulated}\n\n${para}` : para;
    const tokens = approxTokens(candidate);

    if (tokens > targetMax && accumulated) {
      flush(accumulated, startPos, currentPos);
      startPos = currentPos + 2; // skip the \n\n
      accumulated = para;
    } else {
      accumulated = candidate;
    }
    currentPos += paraLen + 2;
  }
  if (accumulated.trim()) flush(accumulated, startPos, currentPos);

  return chunks;
}

// ---------------------------------------------------------------------------
// Markdown-aware chunking: respects headings, code, tables, lists
// ---------------------------------------------------------------------------
function chunkMarkdown(
  text: string,
  documentTitle: string,
  targetMin = 200,
  targetMax = 700,
  hardMax = 900
): Omit<TextChunk, 'chunkIndex'>[] {
  const blocks = parseMarkdownBlocks(text);
  const chunks: Omit<TextChunk, 'chunkIndex'>[] = [];

  // Section stack tracks heading hierarchy for breadcrumb building
  const headingStack: { level: number; text: string }[] = [];

  /** Extract plain heading text from "## My Heading" */
  const headingText = (raw: string) => raw.replace(/^#+\s*/, '').trim();

  /** Build breadcrumb from current heading stack */
  const getSectionPath = () => headingStack.map((h) => h.text).join(' > ') || undefined;

  /** Get current heading (leaf) */
  const getCurrentHeading = () =>
    headingStack.length > 0 ? headingStack[headingStack.length - 1].text : undefined;

  let accumulated = '';
  let accumulatedHeading: string | undefined;
  let accumulatedPath: string | undefined;
  let accumulatedParent: string | undefined;
  let startPos = 0;
  let currentPos = 0;

  const flush = (
    content: string,
    heading: string | undefined,
    sectionPath: string | undefined,
    parentSection: string | undefined,
    start: number,
    end: number
  ) => {
    const original = content.trim();
    if (!original) return;

    const pushChunk = (c: string, s: number, e: number) => {
      chunks.push({
        originalContent: c,
        retrievalContent: buildRetrievalContent(c, documentTitle, sectionPath),
        heading,
        parentSection,
        sectionPath,
        sourceType: 'markdown',
        tokenCount: approxTokens(c),
        startPosition: s,
        endPosition: e,
      });
    };

    if (approxTokens(original) > hardMax) {
      const parts = splitAtSentenceBoundary(original, targetMax);
      let partStart = start;
      for (const part of parts) {
        pushChunk(part, partStart, partStart + part.length);
        partStart += part.length + 1;
      }
    } else {
      pushChunk(original, start, end);
    }
  };

  const flushAccumulated = () => {
    if (accumulated.trim()) {
      flush(
        accumulated,
        accumulatedHeading,
        accumulatedPath,
        accumulatedParent,
        startPos,
        currentPos
      );
    }
    accumulated = '';
  };

  for (const block of blocks) {
    const blockLen = block.content.length + 1; // +1 for newline

    if (block.type === 'heading') {
      const level = block.level!;
      const hText = headingText(block.content);

      // Pop stack entries that are at the same or deeper level
      while (headingStack.length > 0 && headingStack[headingStack.length - 1].level >= level) {
        headingStack.pop();
      }

      // If we have enough accumulated content, flush before starting new section
      if (approxTokens(accumulated) >= targetMin) {
        flushAccumulated();
        startPos = currentPos;
      }

      headingStack.push({ level, text: hText });
      accumulatedHeading = getCurrentHeading();
      accumulatedParent =
        headingStack.length > 1 ? headingStack[headingStack.length - 2].text : undefined;
      accumulatedPath = getSectionPath();

      // Include the heading text in the chunk so it doesn't float alone
      accumulated = accumulated ? `${accumulated}\n\n${block.content}` : block.content;

    } else if (block.type === 'code' || block.type === 'table') {
      // Atomic blocks — never split. Flush accumulation first if adding would exceed hard max.
      const combinedTokens = approxTokens(accumulated + '\n\n' + block.content);
      if (combinedTokens > hardMax && accumulated.trim()) {
        flushAccumulated();
        startPos = currentPos;
      }
      accumulated = accumulated ? `${accumulated}\n\n${block.content}` : block.content;

    } else if (block.type === 'list') {
      // Lists are kept together where possible; split only if truly massive
      const combinedTokens = approxTokens(accumulated + '\n\n' + block.content);
      if (combinedTokens > hardMax && accumulated.trim()) {
        flushAccumulated();
        startPos = currentPos;
      }
      accumulated = accumulated ? `${accumulated}\n\n${block.content}` : block.content;

    } else {
      // Regular paragraph
      const candidate = accumulated ? `${accumulated}\n\n${block.content}` : block.content;
      const tokens = approxTokens(candidate);

      if (tokens > targetMax && accumulated.trim()) {
        flushAccumulated();
        startPos = currentPos;
        accumulated = block.content;
      } else {
        accumulated = candidate;
      }
    }

    currentPos += blockLen;
  }

  flushAccumulated();
  return chunks;
}

// ---------------------------------------------------------------------------
// Overlap helper: prepend a short tail from the previous chunk
// ---------------------------------------------------------------------------
function applyOverlap(
  chunks: Omit<TextChunk, 'chunkIndex'>[],
  overlapRatio = 0.12
): Omit<TextChunk, 'chunkIndex'>[] {
  if (chunks.length <= 1) return chunks;

  return chunks.map((chunk, i) => {
    if (i === 0) return chunk;
    const prev = chunks[i - 1];
    const prevTokens = prev.tokenCount;
    const overlapTokens = Math.floor(prevTokens * overlapRatio);
    if (overlapTokens < 10) return chunk;

    // Grab last ~overlapRatio fraction of previous chunk content
    const prevChars = Math.floor(prev.originalContent.length * overlapRatio);
    const overlapText = prev.originalContent.slice(-prevChars).trim();
    if (!overlapText) return chunk;

    const newOriginal = `${overlapText}\n\n${chunk.originalContent}`;
    return {
      ...chunk,
      originalContent: newOriginal,
      retrievalContent: buildRetrievalContent(
        newOriginal,
        // extracting title from retrievalContent prefix is brittle; just rebuild
        chunk.retrievalContent.split('\n')[0].replace('Document: ', ''),
        chunk.sectionPath
      ),
      tokenCount: approxTokens(newOriginal),
    };
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export class ChunkingService {
  /**
   * Structure-aware chunker for NotebookLLM ingestion.
   *
   * Automatically detects whether the source is Markdown, a speaker-turn
   * transcript, or plain text, then applies the appropriate splitting strategy.
   *
   * Priority for chunk boundaries:
   *   1. Markdown heading/section boundary
   *   2. Paragraph break
   *   3. List / table / code block boundary
   *   4. Sentence boundary
   *   5. Token boundary
   *
   * @param text        Cleaned source text (normalised line endings)
   * @param title       Source document title (used in retrievalContent)
   * @param fileType    Source file type hint ('pdf' | 'web' | 'youtube' | 'text')
   * @param targetMin   Minimum target token size before merging (default 200)
   * @param targetMax   Soft maximum target token size (default 700)
   * @param hardMax     Absolute maximum before forced split (default 900)
   */
  public static createChunks(
    text: string,
    title = 'Untitled Document',
    fileType: 'pdf' | 'web' | 'youtube' | 'text' = 'text',
    targetMin = 200,
    targetMax = 700,
    hardMax = 900
  ): TextChunk[] {
    const cleanedText = text.replace(/\r\n/g, '\n').trim();
    if (!cleanedText) return [];

    const detectedType = detectSourceType(cleanedText);

    let rawChunks: Omit<TextChunk, 'chunkIndex'>[];

    if (detectedType === 'markdown' || fileType === 'web') {
      rawChunks = chunkMarkdown(cleanedText, title, targetMin, targetMax, hardMax);
    } else if (detectedType === 'transcript' || fileType === 'youtube') {
      rawChunks = chunkTranscript(cleanedText, title, targetMin, targetMax, hardMax);
    } else {
      rawChunks = chunkPlainText(cleanedText, title, targetMin, targetMax, hardMax);
    }

    // Apply overlap between adjacent chunks (~12%)
    const withOverlap = applyOverlap(rawChunks, 0.12);

    const chunks: TextChunk[] = withOverlap.map((c, i) => ({ ...c, chunkIndex: i }));

    logger.info(
      {
        totalChunks: chunks.length,
        textLength: cleanedText.length,
        detectedType,
        avgTokens:
          chunks.length > 0
            ? Math.round(chunks.reduce((sum, c) => sum + c.tokenCount, 0) / chunks.length)
            : 0,
      },
      'Structure-aware text chunking completed'
    );

    return chunks;
  }
}
