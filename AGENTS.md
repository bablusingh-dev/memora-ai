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
1. **Drizzle Schema Cleanliness**: Keep `server/src/db/schema.ts` focused on standard PostgreSQL table definitions (`users`, `notebooks`, `source_documents`, `document_chunks`, `notes`), column types, foreign keys, and indexes. Do NOT attempt to express ParadeDB-specific custom index types (`USING bm25`) directly in Drizzle schema definitions if Drizzle generator fails to parse them.
2. **Database Connection Verification**: `server/src/db/index.ts` exposes `connectDB()` and pool connection listeners that log database connection events using Pino logger.
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
- **Controllers (`src/controllers/`)**: Responsible ONLY for parsing HTTP requests, extracting `userId`, validating request bodies/queries (using Zod), calling Services, and returning standard API JSON responses via `ApiResponse`.
- **Services (`src/services/`)**: Responsible for business logic, chunking algorithms, calling LLMs, coordinating RAG search, handling webhooks, and managing data processing flows.
- **Repositories (`src/repositories/`)**: Responsible ONLY for data access, database queries (Drizzle ORM & ParadeDB SQL scoped by `userId`), and data persistence.

### Error Handling & Standard API Envelope
1. **Throw Custom Errors**: In Services or Repositories, throw instances of `ApiError` (`BadRequestError`, `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`, `InternalServerError`).
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
```
