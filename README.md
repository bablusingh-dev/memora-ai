# memora-ai 🧠⚡

> **Notebook LLM Alternative** built with an enterprise-grade full-stack architecture featuring Vectorless RAG (ParadeDB BM25), Drizzle ORM, Node.js + Express + TypeScript, and Next.js (App Router, Tailwind CSS, shadcn/ui).

---

## 🌟 Architecture Overview

```
memora-ai/
├── AGENTS.md                  # Guidelines for AI agents (Drizzle + ParadeDB rules)
├── docker-compose.yml         # Local ParadeDB (PostgreSQL + pg_search BM25) container
├── server/                    # Standalone Express + TypeScript Backend
│   ├── src/
│   │   ├── config/            # Zod environment variable validation
│   │   ├── db/                # Drizzle ORM schemas & database setup
│   │   ├── utils/             # Pino logger, ApiError, ApiResponse, asyncHandler
│   │   ├── middlewares/       # Global error handler & request correlation ID
│   │   ├── repositories/      # Data access layer (Drizzle & ParadeDB BM25 SQL)
│   │   ├── services/          # Business logic & RAG integration
│   │   ├── controllers/       # HTTP request handlers & Zod validation
│   │   └── routes/            # Express router modules
└── client/                    # Standalone Next.js App Router Frontend
    ├── src/
    │   ├── app/               # Next.js App Router pages
    │   ├── components/        # shadcn/ui components & feature UI
    │   ├── lib/               # Typed Axios API client & utility functions
    │   └── types/             # Shared API & domain TypeScript types
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: `v20.x` or later (tested on Node `v24.12.0`)
- **Docker**: For running ParadeDB locally

### 2. Start ParadeDB Database
```bash
docker compose up -d
```

### 3. Server Setup & Run
```bash
cd server
npm install
npm run dev
```
- Server API available at: `http://localhost:5000/api/v1/health`

### 4. Client Setup & Run
```bash
cd client
npm install
npm run dev
```
- Web Application available at: `http://localhost:3000`

---

## 🛠️ Key Features & Stack

- **Server**: Express.js, TypeScript, Drizzle ORM, ParadeDB BM25 (`pg_search`), Pino logger, Zod config validation, custom error hierarchy, standard API response envelope.
- **Client**: Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui component library, Axios client with envelope unwrapping.
- **Vectorless RAG**: Algorithmically ranked text retrieval using ParadeDB BM25 search over Postgres.
- **Background Jobs Ready**: Architecture prepared for Inngest serverless job handlers.
