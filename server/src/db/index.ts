import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from '../config/env.js';
import * as schema from './schema.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  // Keep a few connections warm so a chat turn's parallel retrieval queries
  // (doc search, graph search, mem0, chat history, ...) don't have to pay a
  // fresh TCP+auth handshake per connection every time the pool goes idle
  // between requests. Default idleTimeoutMillis (10s) was shorter than the
  // typical gap between chat turns, so every message reopened ~6 connections.
  min: 2,
  idleTimeoutMillis: 60_000,
});

pool.on('connect', () => {
  logger.info('[DB] PostgreSQL / ParadeDB database pool connected successfully');
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected PostgreSQL pool error');
});

/**
 * Ensure a dedicated `inngest` database exists on the same Postgres server,
 * used by the self-hosted Inngest server for its own durable run/step state
 * (see docker-compose.yml's `inngest` service `--postgres-uri`).
 *
 * Deliberately NOT done via a `docker-entrypoint-initdb.d` init script:
 * those only run once, on a brand-new empty data volume — anyone upgrading
 * an existing deployment (pre-existing `paradedb_data` volume) would never
 * get the new database created. `CREATE DATABASE` also cannot run inside a
 * transaction/DO block, so it can't simply join the `DO $$ ... $$` block
 * below. Instead this runs a plain statement on every boot and treats
 * "already exists" (Postgres error code 42P04) as success — safe to repeat,
 * self-heals both fresh and pre-existing deployments.
 */
async function ensureInngestDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('CREATE DATABASE inngest');
    logger.info('[DB] Created dedicated "inngest" database for the self-hosted Inngest server');
  } catch (error: any) {
    if (error?.code === '42P04') {
      // duplicate_database — already exists, nothing to do.
      return;
    }
    // Non-fatal: the Inngest server will simply fail to start until this is
    // resolved manually. Ingestion/graph/memory pipelines degrade (see the
    // soft Inngest reachability check in server.ts) but the API stays up.
    logger.error({ error }, '[DB] Failed to ensure "inngest" database exists — self-hosted Inngest server may not start');
  } finally {
    client.release();
  }
}

export async function connectDB() {
  try {
    await ensureInngestDatabase();

    const client = await pool.connect();
    logger.info({ databaseUrl: env.DATABASE_URL.replace(/:[^:@]+@/, ':****@') }, 'Database connection verified');

    // Ensure chat_messages table and ParadeDB BM25 index exist safely
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'memorybooks') AND
           EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
          CREATE TABLE IF NOT EXISTS chat_messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            memorybook_id UUID NOT NULL REFERENCES memorybooks(id) ON DELETE CASCADE,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            parts JSONB,
            is_graph_indexed BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_chat_messages_memorybook_id ON chat_messages(memorybook_id);
          ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS is_graph_indexed BOOLEAN NOT NULL DEFAULT FALSE;
          CREATE INDEX IF NOT EXISTS idx_chat_messages_graph_indexed ON chat_messages(is_graph_indexed);

          -- Composite index for the bounded "last N turns" query the memory
          -- coordinator uses (ORDER BY created_at DESC LIMIT N per memorybook)
          -- instead of fetching a memorybook's entire chat history every turn.
          CREATE INDEX IF NOT EXISTS idx_chat_messages_memorybook_created ON chat_messages(memorybook_id, created_at);
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'document_chunks') THEN
          ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS is_graph_indexed BOOLEAN NOT NULL DEFAULT FALSE;
          CREATE INDEX IF NOT EXISTS idx_document_chunks_graph_indexed ON document_chunks(is_graph_indexed);

          -- BM25 index must cover retrieval_content (the column actually queried by
          -- searchBM25 — see memorybook.repository.ts) as well as content, the legacy
          -- fallback column for chunks ingested before retrieval_content existed.
          -- If an older index only covers content, drop and rebuild it here so
          -- every deploy self-heals instead of silently falling back to ILIKE.
          IF EXISTS (
            SELECT 1 FROM pg_indexes
            WHERE tablename = 'document_chunks' AND indexname = 'idx_document_chunks_bm25'
          ) AND NOT EXISTS (
            SELECT 1 FROM pg_indexes
            WHERE tablename = 'document_chunks' AND indexname = 'idx_document_chunks_bm25'
              AND indexdef LIKE '%retrieval_content%'
          ) THEN
            DROP INDEX idx_document_chunks_bm25;
          END IF;

          CREATE INDEX IF NOT EXISTS idx_document_chunks_bm25
            ON document_chunks USING bm25 (id, retrieval_content, content)
            WITH (key_field='id');

          -- Event-driven graph extraction pipeline (Inngest) supersedes the
          -- old is_graph_indexed-boolean + setInterval poller. The boolean
          -- column is kept (nothing new reads it) so this is purely additive.
          ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS graph_index_status TEXT NOT NULL DEFAULT 'pending';
          ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS graph_index_error TEXT;
          ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS graph_index_attempts INTEGER NOT NULL DEFAULT 0;
          CREATE INDEX IF NOT EXISTS idx_document_chunks_graph_index_status ON document_chunks(graph_index_status);

          -- One-time data migration: chunks already indexed by the old
          -- boolean-driven poller shouldn't be reprocessed by the new
          -- backfill cron just because graph_index_status defaults to
          -- 'pending' on this newly-added column.
          UPDATE document_chunks
            SET graph_index_status = 'indexed'
            WHERE is_graph_indexed = TRUE AND graph_index_status = 'pending';

          -- Hybrid retrieval: pgvector embedding column + HNSW cosine index.
          -- Bundled in the paradedb/paradedb image; guarded in a nested block
          -- so an environment without it degrades to BM25-only (searchHybrid
          -- catches the resulting query errors) instead of failing boot.
          BEGIN
            CREATE EXTENSION IF NOT EXISTS vector;
            ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS embedding vector(1536);
            CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding
              ON document_chunks USING hnsw (embedding vector_cosine_ops);
          EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'pgvector unavailable — hybrid retrieval will degrade to BM25-only: %', SQLERRM;
          END;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'memorybooks') THEN
          CREATE TABLE IF NOT EXISTS studio_artifacts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            memorybook_id UUID NOT NULL REFERENCES memorybooks(id) ON DELETE CASCADE,
            kind TEXT NOT NULL,
            title TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'generating',
            error_message TEXT,
            payload JSONB,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_studio_artifacts_memorybook_id ON studio_artifacts(memorybook_id);
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'source_documents') THEN
          ALTER TABLE source_documents ADD COLUMN IF NOT EXISTS content_hash TEXT;
          ALTER TABLE source_documents ADD COLUMN IF NOT EXISTS error_message TEXT;
          ALTER TABLE source_documents ADD COLUMN IF NOT EXISTS stage TEXT;

          -- Dedup backstop: two concurrent ingestions of identical content in
          -- the same memorybook race past the application-level pre-check, but
          -- can't both win here. NULL content_hash (legacy rows, or rows not
          -- yet far enough through the async pipeline to know their hash) is
          -- deliberately excluded so it never blocks unrelated inserts.
          CREATE UNIQUE INDEX IF NOT EXISTS idx_source_documents_memorybook_hash
            ON source_documents(memorybook_id, content_hash)
            WHERE content_hash IS NOT NULL;
        END IF;
      END $$;
    `);

    client.release();
  } catch (error) {
    logger.error({ error }, 'Failed to connect to PostgreSQL / ParadeDB database');
    throw error;
  }
}

export const db = drizzle(pool, { schema });

