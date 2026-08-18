#Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---


# AI Agent System Instructions & Engineering Guidelines: memora-ai

Welcome to **memora-ai** (Notebook LLM Alternative). This repository is engineered with a production-grade full-stack architecture separated into standalone `server/` (Node.js, Express, TypeScript, Drizzle ORM, ParadeDB BM25, Clerk Express Auth, Svix Webhooks) and `client/` (Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Clerk Auth) directories.

When working on this codebase, **ALL AI AGENTS MUST ADHERE TO THE FOLLOWING GUIDELINES AND CONVENTIONS**.

---

## 1. Drizzle ORM & ParadeDB (BM25 Vectorless RAG) Guidelines

> [!IMPORTANT]
> **CRITICAL RULE**: Drizzle ORM is used for table schemas and type-safe CRUD operations, while **ParadeDB (`pg_search`)** is used for BM25 algorithmic full-text search.

### Rules for Database Operations:
1. **Drizzle Schema Cleanliness**: Keep `server/src/db/schema.ts` focused on standard PostgreSQL table definitions (`users`, `notebooks`, `source_documents`, `document_chunks`, `notes`, `chat_messages`), column types, foreign keys, and indexes. Do NOT attempt to express ParadeDB-specific custom index types (`USING bm25`, `USING hnsw`) directly in Drizzle schema definitions if Drizzle generator fails to parse them — those live in the raw-SQL self-heal block in `server/src/db/index.ts` instead (see rule 2). The one exception is the pgvector `embedding` column itself, which Drizzle *can* express via `customType` (see the `vector()` helper at the top of `schema.ts`) — only the index type needs raw SQL.
2. **Database Connection Verification**: `server/src/db/index.ts` exposes `connectDB()` and pool connection listeners that log database connection events using Pino logger. It also runs a `DO $$ ... $$` block on every boot that self-heals schema drift (new columns, indexes) — this repo has no automatic migration runner wired into boot (drizzle-kit migrations exist under `server/src/db/migrations/` for history/versioning, generated via `npm run db:generate`, but must be applied manually with `npm run db:migrate`; they are not run automatically). When adding a column/index that the app depends on at runtime, add it to both: the `DO $$` block (so it's live immediately) and generate a matching migration (so history stays in sync).
3. **Encapsulate BM25 Search in Repositories**: All ParadeDB BM25 search queries must be executed within `server/src/repositories/` using Drizzle's `sql` template literal tag.
   - **Example BM25 Query**:
     ```ts
     import { sql } from 'drizzle-orm';
     import { db } from '../db';
     
     export async function searchChunksBM25(query: string, limit = 10) {
       return await db.execute(sql`
         SELECT id, notebook_id, content, score() AS score
         FROM document_chunks
         WHERE content @@@ ${query}
         ORDER BY score DESC
         LIMIT ${limit}
       `);
     }
     ```
4. **No Raw SQL Leaks**: Never construct or execute raw SQL strings inside Controllers, Services, or API routes. All database queries must go through the Repository Layer (`src/repositories/`).

---

## 2. Server Architecture Guidelines (`server/`)

### Layered Architecture Scoping, Clerk Authentication & Webhooks
The backend enforces a strict **Controller -> Service -> Repository** directional flow:
- **Clerk Express Authentication**:
  - `clerkMiddleware()` is registered in `server/src/app.ts`.
  - Protected route modules apply `requireAuthMiddleware` from `server/src/middlewares/auth.middleware.ts`.
  - Controllers extract `req.userId` (from Clerk) and pass `userId` down to Services and Repositories to enforce strict multi-tenant data isolation.
- **Clerk User Sync Webhook (`POST /api/v1/webhooks/clerk`)**:
  - Svix webhook signature verification handles `user.created`, `user.updated`, and `user.deleted` events.
  - Automatically syncs user profile changes to the local `users` table via `UserRepository.upsertUser()`.
- **Controllers (`src/controllers/`)**: Responsible ONLY for parsing HTTP requests, extracting `userId`, validating request bodies/queries (using Zod), calling Services, and returning standard API JSON responses via `ApiResponse`. Ingestion controllers return `202 Accepted` with the resource still `processing` — they hand off to Inngest rather than doing the work inline (see below).
- **Services (`src/services/`)**: Responsible for business logic, chunking algorithms, calling LLMs, coordinating RAG search, handling webhooks, and managing data processing flows. Service methods called from HTTP request handlers must stay fast (sync validation + a DB write + an Inngest event send) — anything slower or retry-worthy (parsing, LLM calls, external API calls) belongs in an Inngest function instead, see below.
- **Repositories (`src/repositories/`)**: Responsible ONLY for data access, database queries (Drizzle ORM & ParadeDB SQL scoped by `userId`), and data persistence.

### Background Jobs (`server/src/inngest/`)
All work that (a) doesn't need to finish before the HTTP response, (b) should survive a process restart, or (c) needs automatic retries, goes through an **Inngest function** — never a raw `setInterval`/`setTimeout` poller and never an unawaited fire-and-forget promise. Both of those were the actual pre-Inngest patterns in this codebase and both silently lost work on process restart; don't reintroduce them.
- **Client**: `server/src/inngest/client.ts` — the single `Inngest` instance, configured for the self-hosted server in `docker-compose.yml`.
- **Events**: `server/src/inngest/events.ts` — every event is a typed `EventType` (via `eventType(name, { schema })` with a zod schema), doubling as a function trigger and a typed factory (`someEvent.create({...})`) for `inngest.send()`. Add new event shapes here, not inline in a function file.
- **Functions**: `server/src/inngest/functions/*.ts`, registered in `server/src/inngest/functions/index.ts` (the only registration point — `serve()` in `app.ts` imports from there). Each function should: use `step.run(id, fn)` for each retryable unit of work, set `retries` explicitly, use `idempotency` keyed on the triggering entity's ID where redelivery could otherwise double-process something, and provide `onFailure` to mark the originating row (`error`/`failed`) when a durable entity (a source, a chunk) is involved — never leave a row silently stuck on `processing`/`pending` forever.
- **Cron functions** (backfills, cleanup) are the safety net, not the primary path — e.g. `embedding-backfill`/`graph-backfill` catch anything whose event-driven fan-out was lost; they shouldn't be the only way work gets done.
- Structured-object LLM calls in this codebase use `generateText({ output: Output.object({ schema }) })` from `ai`, not `generateObject` — the latter is deprecated in the installed SDK version. Verify current deprecation status against `node_modules/ai/dist/index.d.ts` before assuming an API is still current; SDKs move fast.

### Error Handling & Standard API Envelope
1. **Throw Custom Errors**: In Services or Repositories, throw instances of `ApiError` (`BadRequestError`, `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`, `TooManyRequestsError`, `InternalServerError`).
2. **Centralized Error Middleware**: Do NOT wrap every controller line in try/catch blocks manually unless necessary for specific cleanup. Wrap route handlers with `asyncHandler` and let `server/src/middlewares/error.middleware.ts` catch and format errors.
3. **Standard Response Format**:
   All API endpoints MUST respond with the unified structure:
   ```json
   {
     "success": true,
     "data": { ... },
     "message": "Operation successful",
     "statusCode": 200,
     "meta": { ... },
     "timestamp": "2026-08-12T21:19:00.000Z"
   }
   ```
4. **Structured Pino Logging**: Use `logger` from `@/utils/logger` instead of `console.log`. Log contextual parameters as JSON objects:
   ```ts
   logger.info({ userId, notebookId, sourceCount }, 'Processed notebook source upload');
   logger.error({ error, requestId }, 'Failed to parse document chunk');
   ```

---

## 3. Client Architecture Guidelines (`client/`)

1. **Standalone Next.js App**: `client/` is independently deployable. Keep API calls routed through `client/src/lib/api-client.ts`.
2. **Clerk Authentication Integration**:
   - `ClerkProvider` wraps `src/app/layout.tsx`.
   - `clerkMiddleware()` protects routes in `src/middleware.ts`.
   - `setAuthToken(token)` automatically syncs Clerk session JWTs to Axios request headers (`Authorization: Bearer <token>`).
3. **Axios API Client**: `apiClient` automatically unwraps the backend's standard JSON envelope and returns typed data.
4. **Tailwind & shadcn/ui**: Use predefined design tokens and shadcn component wrappers in `src/components/ui/`.

---

## 4. Quick Verification Commands

```bash
# Test Server Build & Type Checking
cd server && npm run build

# Test Client Build & Type Checking
cd client && npm run build

# Run server unit tests (chunking, graph-triple-filter)
cd server && npx tsx --test src/services/__tests__/*.test.ts
```

For anything touching ingestion, graph extraction, memory extraction, or hybrid retrieval, also verify against the live stack (`docker compose up -d`, `npm run dev`, watch the Inngest dashboard at `http://localhost:8288`) — these are async pipelines where a clean build doesn't guarantee the runtime behavior (retries, dead-lettering, event wiring) is correct.
