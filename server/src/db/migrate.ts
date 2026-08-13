import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './index.js';
import { logger } from '../utils/logger.js';

export async function runMigrations() {
  try {
    logger.info('🚀 Running database migrations...');
    await migrate(db, { migrationsFolder: './src/db/migrations' });
    logger.info('✅ Database migrations completed successfully.');
  } catch (error) {
    logger.error({ error }, '❌ Database migration failed');
  } finally {
    await pool.end();
  }
}

runMigrations();
