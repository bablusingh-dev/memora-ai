import crypto from 'crypto';

/**
 * SHA-256 hex digest of a source document's ingested content, used to detect
 * exact-duplicate ingestion (re-uploading the same file, re-pasting the same
 * text, re-scraping content identical to something already in the memorybook).
 * Backed by a partial unique index — see idx_source_documents_memorybook_hash
 * in db/index.ts.
 */
export function sha256Hex(input: Buffer | string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}
