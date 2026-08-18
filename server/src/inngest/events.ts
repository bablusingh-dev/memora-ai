import { eventType } from 'inngest';
import { z } from 'zod';

/**
 * Central typed event catalog for every Inngest-driven pipeline in this app.
 *
 * Each entry is an `EventType` — it doubles as (a) a function trigger
 * (`triggers: [sourceFileUploaded]`) and (b) a typed event factory
 * (`sourceFileUploaded.create({...})`) used when calling `inngest.send()`.
 * Keeping every event shape declared here (rather than inline in each
 * function file) means producers and consumers can never silently drift
 * apart on payload shape — a schema change here is a single-file diff that
 * TypeScript will flag everywhere it's used.
 *
 * Naming convention: `<domain>/<subject>.<pastTenseVerb>` for facts that
 * already happened (what triggers our functions), matching the handful of
 * domains already used across the codebase's directory structure
 * (source, graph, chat).
 */

// ---------------------------------------------------------------------------
// Phase 0 — infrastructure verification
// ---------------------------------------------------------------------------

export const systemHealthCheck = eventType('system/health.check', {
  schema: z.object({
    triggeredAt: z.string().datetime(),
  }),
});

// ---------------------------------------------------------------------------
// Phase 1 — source ingestion (file / website / youtube / text)
// ---------------------------------------------------------------------------

/**
 * Common fields every ingestion event carries. The Cloudinary upload (files)
 * and the DB row creation always happen synchronously in the controller
 * before this event is sent — the event only ever carries IDs/URLs/small
 * text, never raw file buffers.
 */
const ingestionBaseFields = {
  sourceId: z.string().uuid(),
  notebookId: z.string().uuid(),
  userId: z.string().min(1),
};

export const sourceFileUploaded = eventType('source/file.uploaded', {
  schema: z.object({
    ...ingestionBaseFields,
    fileUrl: z.string().url(),
    mimeType: z.string(),
    originalName: z.string(),
    /** sha256 of the raw file bytes, already computed synchronously. */
    contentHash: z.string().length(64),
  }),
});

export const sourceWebsiteRequested = eventType('source/website.requested', {
  schema: z.object({
    ...ingestionBaseFields,
    url: z.string().url(),
  }),
});

export const sourceYoutubeRequested = eventType('source/youtube.requested', {
  schema: z.object({
    ...ingestionBaseFields,
    url: z.string().url(),
  }),
});

export const sourceTextRequested = eventType('source/text.requested', {
  schema: z.object({
    ...ingestionBaseFields,
    title: z.string(),
    content: z.string().min(1),
    /** sha256 of `content`, already computed synchronously. */
    contentHash: z.string().length(64),
  }),
});

// ---------------------------------------------------------------------------
// Phase 2 — knowledge graph extraction
// ---------------------------------------------------------------------------

export const graphChunkCreated = eventType('graph/chunk.created', {
  schema: z.object({
    chunkId: z.string().uuid(),
    notebookId: z.string().uuid(),
    userId: z.string().min(1),
  }),
});

// ---------------------------------------------------------------------------
// Phase 4 — durable memory extraction
// ---------------------------------------------------------------------------

export const chatMessageCompleted = eventType('chat/message.completed', {
  schema: z.object({
    userId: z.string().min(1),
    notebookId: z.string().uuid(),
    chatMessageId: z.string().uuid().optional(),
    userMessage: z.string(),
    assistantReply: z.string(),
  }),
});
