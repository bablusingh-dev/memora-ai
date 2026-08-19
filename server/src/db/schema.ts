import { pgTable, uuid, text, timestamp, integer, jsonb, boolean, customType } from 'drizzle-orm/pg-core';

/**
 * pgvector's `vector(n)` type has no native drizzle-orm/pg-core column type
 * (same reason ParadeDB's `bm25` index type isn't expressed in schema.ts —
 * see AGENTS.md rule #1). node-postgres has no built-in parser for it either,
 * so it round-trips as the literal text pgvector accepts/emits: `[0.1,0.2,...]`.
 */
const vector = (dimensions: number) =>
  customType<{ data: number[]; driverData: string }>({
    dataType() {
      return `vector(${dimensions})`;
    },
    toDriver(value: number[]): string {
      return `[${value.join(',')}]`;
    },
    fromDriver(value: string): number[] {
      return value
        .slice(1, -1)
        .split(',')
        .filter(Boolean)
        .map(Number);
    },
  });

export const users = pgTable('users', {
  id: text('id').primaryKey(), // Clerk User ID e.g. user_2P3...
  email: text('email').notNull(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  imageUrl: text('image_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const memorybooks = pgTable('memorybooks', {
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
  memorybookId: uuid('memorybook_id')
    .references(() => memorybooks.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  fileType: text('file_type').notNull(), // 'pdf' | 'web' | 'youtube' | 'text'
  fileUrl: text('file_url'),
  status: text('status').default('processing').notNull(), // 'processing' | 'ready' | 'error' | 'duplicate'
  // sha256 of the ingested content (file bytes / scraped markdown / transcript
  // text / raw text). Backed by a partial unique index (memorybookId, contentHash)
  // — see db/index.ts — so exact re-ingestion is rejected rather than silently
  // duplicating chunks.
  contentHash: text('content_hash'),
  // Populated only when status = 'error' | 'duplicate'.
  errorMessage: text('error_message'),
  // Coarse pipeline progress for the client's polling UI, e.g. 'queued' |
  // 'extracting' | 'persisting'. Null once status leaves 'processing'.
  stage: text('stage'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const documentChunks = pgTable('document_chunks', {
  id: uuid('id').defaultRandom().primaryKey(),
  sourceId: uuid('source_id')
    .references(() => sourceDocuments.id, { onDelete: 'cascade' })
    .notNull(),
  memorybookId: uuid('memorybook_id')
    .references(() => memorybooks.id, { onDelete: 'cascade' })
    .notNull(),
  content: text('content').notNull(),
  // Context-enriched version of content used for BM25 indexing and retrieval.
  // Includes document title, section path, and the original content so that
  // retrieved chunks are self-contained and understandable without surrounding context.
  retrievalContent: text('retrieval_content'),
  // Structural metadata populated by the structure-aware chunker
  heading: text('heading'),
  parentSection: text('parent_section'),
  sectionPath: text('section_path'),
  sourceType: text('source_type'), // 'markdown' | 'pdf' | 'transcript' | 'text'
  tokenCount: integer('token_count'),
  startPosition: integer('start_position'),
  endPosition: integer('end_position'),
  chunkIndex: integer('chunk_index').notNull(),
  metadata: jsonb('metadata'),
  // Legacy boolean, superseded by graphIndexStatus below but kept for
  // backward compatibility (nothing new reads it — see triple-filter.ts /
  // inngest/functions/graph-extract.ts).
  isGraphIndexed: boolean('is_graph_indexed').default(false).notNull(),
  // 'pending' | 'processing' | 'indexed' | 'failed'. Drives the event-driven
  // Inngest graph extraction pipeline instead of the old setInterval poller.
  graphIndexStatus: text('graph_index_status').default('pending').notNull(),
  graphIndexError: text('graph_index_error'),
  graphIndexAttempts: integer('graph_index_attempts').default(0).notNull(),
  // OpenAI text-embedding-3-small (1536 dims). Nullable — populated by the
  // ingestion pipeline's embedding step and backfilled for older chunks by
  // the embedding-backfill Inngest cron. Null means "not yet embedded", not
  // "embedding failed" — searchHybrid falls back to BM25-only per chunk.
  embedding: vector(1536)('embedding'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const notes = pgTable('notes', {
  id: uuid('id').defaultRandom().primaryKey(),
  memorybookId: uuid('memorybook_id')
    .references(() => memorybooks.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  type: text('type').default('user_note').notNull(), // 'user_note' | 'ai_summary' | 'study_guide'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const studioArtifacts = pgTable('studio_artifacts', {
  id: uuid('id').defaultRandom().primaryKey(),
  memorybookId: uuid('memorybook_id')
    .references(() => memorybooks.id, { onDelete: 'cascade' })
    .notNull(),
  kind: text('kind').notNull(), // 'flashcards' (extend as new Studio output kinds ship)
  title: text('title').notNull(),
  status: text('status').default('generating').notNull(), // 'generating' | 'ready' | 'error'
  errorMessage: text('error_message'),
  // Kind-specific structured content, e.g. { cards: [{front, back}] } for
  // flashcards. Null until status = 'ready'.
  payload: jsonb('payload'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  memorybookId: uuid('memorybook_id')
    .references(() => memorybooks.id, { onDelete: 'cascade' })
    .notNull(),
  userId: text('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  role: text('role').notNull(), // 'user' | 'assistant'
  content: text('content').notNull(),
  parts: jsonb('parts'), // tool invocations, citations, structured parts
  isGraphIndexed: boolean('is_graph_indexed').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

