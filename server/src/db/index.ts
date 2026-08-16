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

export async function connectDB() {
  try {
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
          CREATE INDEX IF NOT EXISTS idx_document_chunks_bm25 ON document_chunks USING bm25 (id, content) WITH (key_field='id');
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

