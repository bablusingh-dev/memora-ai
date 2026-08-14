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
  logger.info('🐘 PostgreSQL / ParadeDB database pool connected successfully');
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected PostgreSQL pool error');
});

export async function connectDB() {
  try {
    const client = await pool.connect();
    logger.info({ databaseUrl: env.DATABASE_URL.replace(/:[^:@]+@/, ':****@') }, 'Database connection verified');

    // Ensure chat_messages table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        notebook_id UUID NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        parts JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_chat_messages_notebook_id ON chat_messages(notebook_id);
    `);

    client.release();
  } catch (error) {
    logger.error({ error }, 'Failed to connect to PostgreSQL / ParadeDB database');
  }
}

export const db = drizzle(pool, { schema });

