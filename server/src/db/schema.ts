import { pgTable, uuid, text, timestamp, integer, jsonb } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(), // Clerk User ID e.g. user_2P3...
  email: text('email').notNull(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  imageUrl: text('image_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const notebooks = pgTable('notebooks', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const sourceDocuments = pgTable('source_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  notebookId: uuid('notebook_id')
    .references(() => notebooks.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  fileType: text('file_type').notNull(), // 'pdf' | 'web' | 'text'
  fileUrl: text('file_url'),
  status: text('status').default('processing').notNull(), // 'processing' | 'ready' | 'error'
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const documentChunks = pgTable('document_chunks', {
  id: uuid('id').defaultRandom().primaryKey(),
  sourceId: uuid('source_id')
    .references(() => sourceDocuments.id, { onDelete: 'cascade' })
    .notNull(),
  notebookId: uuid('notebook_id')
    .references(() => notebooks.id, { onDelete: 'cascade' })
    .notNull(),
  content: text('content').notNull(),
  chunkIndex: integer('chunk_index').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const notes = pgTable('notes', {
  id: uuid('id').defaultRandom().primaryKey(),
  notebookId: uuid('notebook_id')
    .references(() => notebooks.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  type: text('type').default('user_note').notNull(), // 'user_note' | 'ai_summary' | 'study_guide'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
