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
    client.release();
  } catch (error) {
    logger.error({ error }, 'Failed to connect to PostgreSQL / ParadeDB database');
  }
}

export const db = drizzle(pool, { schema });

