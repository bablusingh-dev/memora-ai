import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgres://postgres:postgrespassword@localhost:5432/memorybook_db',
  },
  extensionsFilters: ['postgis'],
  tablesFilter: ['users', 'memorybooks', 'source_documents', 'document_chunks', 'notes', 'chat_messages'],
});
