import { logger } from '../utils/logger.js';

export interface TextChunk {
  content: string;
  chunkIndex: number;
}

export class ChunkingService {
  /**
   * Split raw text into overlapping window chunks for ParadeDB BM25 indexing
   * @param text Raw source text
   * @param chunkSize Target character size per chunk (default 600)
   * @param overlap Character overlap between adjacent chunks (default 100)
   */
  public static createChunks(text: string, chunkSize = 600, overlap = 100): TextChunk[] {
    const cleanedText = text.replace(/\r\n/g, '\n').trim();
    if (!cleanedText) return [];

    const chunks: TextChunk[] = [];
    let start = 0;
    let index = 0;

    while (start < cleanedText.length) {
      let end = start + chunkSize;

      // Try to break at paragraph or sentence boundaries if within end range
      if (end < cleanedText.length) {
        const boundary = cleanedText.indexOf('\n\n', end - 100);
        if (boundary !== -1 && boundary < end + 100) {
          end = boundary;
        } else {
          const sentenceEnd = cleanedText.indexOf('. ', end - 50);
          if (sentenceEnd !== -1 && sentenceEnd < end + 50) {
            end = sentenceEnd + 1;
          }
        }
      }

      const chunkContent = cleanedText.slice(start, end).trim();
      if (chunkContent.length > 0) {
        chunks.push({
          content: chunkContent,
          chunkIndex: index++,
        });
      }

      start = end - overlap;
      if (start >= cleanedText.length || end >= cleanedText.length) break;
    }

    logger.info({ totalChunks: chunks.length, textLength: cleanedText.length }, 'Text chunking completed');
    return chunks;
  }
}
