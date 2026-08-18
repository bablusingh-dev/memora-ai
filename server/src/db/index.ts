import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from '../config/env.js';
import * as schema from './schema.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
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
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notebooks') AND
           EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
          CREATE TABLE IF NOT EXISTS chat_messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            notebook_id UUID NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            parts JSONB,
            is_graph_indexed BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_chat_messages_notebook_id ON chat_messages(notebook_id);
          ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS is_graph_indexed BOOLEAN NOT NULL DEFAULT FALSE;
          CREATE INDEX IF NOT EXISTS idx_chat_messages_graph_indexed ON chat_messages(is_graph_indexed);
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'document_chunks') THEN
          ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS is_graph_indexed BOOLEAN NOT NULL DEFAULT FALSE;
          CREATE INDEX IF NOT EXISTS idx_document_chunks_graph_indexed ON document_chunks(is_graph_indexed);

          -- BM25 index must cover retrieval_content (the column actually queried by
          -- searchBM25 — see notebook.repository.ts) as well as content, the legacy
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
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'source_documents') THEN
          ALTER TABLE source_documents ADD COLUMN IF NOT EXISTS content_hash TEXT;
          ALTER TABLE source_documents ADD COLUMN IF NOT EXISTS error_message TEXT;
          ALTER TABLE source_documents ADD COLUMN IF NOT EXISTS stage TEXT;

          -- Dedup backstop: two concurrent ingestions of identical content in
          -- the same notebook race past the application-level pre-check, but
          -- can't both win here. NULL content_hash (legacy rows, or rows not
          -- yet far enough through the async pipeline to know their hash) is
          -- deliberately excluded so it never blocks unrelated inserts.
          CREATE UNIQUE INDEX IF NOT EXISTS idx_source_documents_notebook_hash
            ON source_documents(notebook_id, content_hash)
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

