# AI Agent System Instructions & Engineering Guidelines: memora-ai

Welcome to **memora-ai** (Notebook LLM Alternative). This repository is engineered with a production-grade full-stack architecture separated into standalone `server/` (Node.js, Express, TypeScript, Drizzle ORM, ParadeDB BM25) and `client/` (Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui) directories.

When working on this codebase, **ALL AI AGENTS MUST ADHERE TO THE FOLLOWING GUIDELINES AND CONVENTIONS**.

---

## 1. Drizzle ORM & ParadeDB (BM25 Vectorless RAG) Guidelines

> [!IMPORTANT]
> **CRITICAL RULE**: Drizzle ORM is used for table schemas and type-safe CRUD operations, while **ParadeDB (`pg_search`)** is used for BM25 algorithmic full-text search.

### Rules for Database Operations:
1. **Drizzle Schema Cleanliness**: Keep `server/src/db/schema.ts` focused on standard PostgreSQL table definitions, column types, foreign keys, and indexes. Do NOT attempt to express ParadeDB-specific custom index types (`USING bm25`) directly in Drizzle schema definitions if Drizzle generator fails to parse them.
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
3. **No Raw SQL Leaks**: Never construct or execute raw SQL strings inside Controllers, Services, or API routes. All database queries must go through the Repository Layer (`src/repositories/`).

---

## 2. Server Architecture Guidelines (`server/`)

### Layered Architecture Scoping
The backend enforces a strict **Controller -> Service -> Repository** directional flow:
- **Controllers (`src/controllers/`)**: Responsible ONLY for parsing HTTP requests, validating request bodies/queries (using Zod), calling Services, and returning standard API JSON responses via `ApiResponse`.
- **Services (`src/services/`)**: Responsible for business logic, chunking algorithms, calling LLMs, coordinating RAG search, and managing data processing flows.
- **Repositories (`src/repositories/`)**: Responsible ONLY for data access, database queries (Drizzle ORM & ParadeDB SQL), and data persistence.

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
     "timestamp": "2026-08-10T22:40:00.000Z"
   }
   ```
4. **Structured Pino Logging**: Use `logger` from `@/utils/logger` instead of `console.log`. Log contextual parameters as JSON objects:
   ```ts
   logger.info({ notebookId, sourceCount }, 'Processed notebook source upload');
   logger.error({ error, requestId }, 'Failed to parse document chunk');
   ```

---

## 3. Background Processing & Inngest

1. **Inngest Serverless Functions**: Async heavy operations (document ingestion, BM25 indexing, audio overview generation) will be triggered as Inngest functions in `server/src/jobs/`.
2. Do NOT install or introduce heavy queue backends like BullMQ/Redis unless requested.

---

## 4. Client Architecture Guidelines (`client/`)

1. **Standalone Next.js App**: `client/` is independently deployable. Keep API calls routed through `client/src/lib/api-client.ts`.
2. **Axios API Client**: `apiClient` automatically unwraps the backend's standard JSON envelope and returns typed data.
3. **Tailwind & shadcn/ui**: Use predefined design tokens and shadcn component wrappers in `src/components/ui/`.
4. **Dark Mode & Modern Aesthetics**: Maintain high visual quality, dark mode aesthetics, glassmorphism card highlights, and smooth micro-animations.

---

## 5. Quick Verification Commands

```bash
# Test Server Build & Type Checking
cd server && npm run build

# Test Client Build & Type Checking
cd client && npm run build
```
