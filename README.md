# Memorybook 🧠⚡

> A **NotebookLM alternative** built with an enterprise-grade full-stack architecture featuring Hybrid RAG (ParadeDB BM25 + pgvector, RRF-fused), a self-hosted Inngest durable pipeline for ingestion/knowledge-graph extraction/memory extraction, Drizzle ORM, Node.js + Express + TypeScript, and Next.js (App Router, Tailwind CSS, shadcn/ui).

---

## 🌟 Architecture Overview

```
memorybook/
├── AGENTS.md                  # Guidelines for AI agents (Drizzle + ParadeDB rules)
├── docker-compose.yml         # Local ParadeDB (Postgres + pg_search BM25 + pgvector), Neo4j, self-hosted Inngest
├── server/                    # Standalone Express + TypeScript Backend
│   ├── src/
│   │   ├── config/            # Zod environment variable validation
│   │   ├── db/                # Drizzle ORM schemas, database setup, migrations
│   │   ├── utils/             # Pino logger, ApiError, ApiResponse, asyncHandler, retry/RRF/token helpers
│   │   ├── middlewares/       # Global error handler & request correlation ID
│   │   ├── repositories/      # Data access layer (Drizzle & ParadeDB BM25/pgvector SQL)
│   │   ├── services/          # Business logic — chunking, embeddings, RAG, memory, agent orchestration
│   │   ├── controllers/       # HTTP request handlers & Zod validation
│   │   ├── routes/            # Express router modules
│   │   └── inngest/           # Durable background pipelines — client, typed events, functions
│   │       └── functions/     # ingest-source, graph-extract, embedding-backfill, extract-memories
└── client/                    # Standalone Next.js App Router Frontend
    ├── src/
    │   ├── app/               # Next.js App Router pages
    │   ├── components/        # shadcn/ui components & feature UI
    │   ├── lib/                # Typed Axios API client & utility functions
    │   ├── store/              # Zustand state (polls source ingestion status)
    │   └── types/              # Shared API & domain TypeScript types
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: `v20.x` or later (tested on Node `v24.12.0`)
- **Docker**: for ParadeDB, Neo4j, and the self-hosted Inngest server

### 2. Start backing services
```bash
docker compose up -d
```
Brings up **ParadeDB** (Postgres + `pg_search` BM25 + `pgvector`), **Neo4j** (knowledge graph), and a **self-hosted Inngest server** (durable execution for ingestion/graph-extraction/memory pipelines — dashboard at `http://localhost:8288`). The app creates its own dedicated `inngest` database on the ParadeDB instance automatically on boot.

### 3. Configure environment
Copy `server/.env` from your own values (Clerk, OpenAI, Cloudinary, Firecrawl, Mem0 — see `server/src/config/env.ts` for the full list). For Inngest specifically, generate a local signing key and event key once and put the **same values** in both `server/.env` and a root-level `.env` (used by `docker-compose.yml` for the Inngest container):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # -> INNGEST_SIGNING_KEY
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"   # -> INNGEST_EVENT_KEY
```
If you run the server on the host while Inngest stays in Docker (the default local setup), also set `INNGEST_SERVE_ORIGIN=http://host.docker.internal:5000` in `server/.env` — otherwise Inngest can't call back into the app to run a step (it will try `localhost`, which resolves to the container itself, not your host).

### 4. Server Setup & Run
```bash
cd server
npm install
npm run dev
```
- Server API available at: `http://localhost:5000/api/v1/health`
- On boot, the server self-registers its Inngest functions — no manual sync step needed. Watch runs at the Inngest dashboard.

### 5. Client Setup & Run
```bash
cd client
npm install
npm run dev
```
- Web Application available at: `http://localhost:3000`

---

## 🛠️ Key Features & Stack

- **Server**: Express.js, TypeScript, Drizzle ORM, ParadeDB (`pg_search` BM25 + `pgvector`), Pino logger, Zod config validation, custom error hierarchy, standard API response envelope.
- **Client**: Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui component library, Axios client with envelope unwrapping.
- **Hybrid RAG**: BM25 lexical search fused with pgvector semantic search via Reciprocal Rank Fusion — catches both exact keyword matches and paraphrased/semantically-related queries that share no vocabulary with the source text.
- **Durable background pipelines (self-hosted Inngest)**: source ingestion (file/website/YouTube/text — parse, chunk, embed, persist, all async off the request thread, with content-hash dedup and retry/dead-lettering), knowledge-graph extraction (event-driven per chunk, replacing an old polling worker), and LLM-based memory extraction with self-scoped consolidation — all retried automatically and durable across process restarts. Dashboard at `http://localhost:8288`.
- **Multi-layer memory**: conversation history, user profile/semantic/episodic/procedural memory (mem0), a Neo4j knowledge graph, and hybrid document retrieval, coordinated per chat turn with a token budget so context never silently overflows the model's context window.
