import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform((val) => parseInt(val, 10)).default('5000'),
  DATABASE_URL: z.string().default('postgres://postgres:postgrespassword@localhost:5432/memorybook_db'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  CLERK_PUBLISHABLE_KEY: z.string().optional().default('pk_test_placeholder'),
  CLERK_SECRET_KEY: z.string().optional().default('sk_test_placeholder'),
  CLERK_WEBHOOK_SECRET: z.string().optional().default('whsec_placeholder'),
  CLOUDINARY_CLOUD_NAME: z.string().optional().default('placeholder'),
  CLOUDINARY_API_KEY: z.string().optional().default('placeholder'),
  CLOUDINARY_API_SECRET: z.string().optional().default('placeholder'),
  FIRECRAWL_API_KEY: z.string().optional().default('fc-placeholder'),
  OPENAI_API_KEY: z.string().optional().default('sk-placeholder'),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  // Text-to-speech model for the Podcast Studio artifact (two-host audio
  // discussion). Separate from OPENAI_MODEL since TTS and chat/completion
  // models are unrelated model families.
  OPENAI_TTS_MODEL: z.string().default('gpt-4o-mini-tts'),

  // Memory Provider Configuration
  MEMORY_PROVIDER: z.enum(['self_hosted', 'mem0_cloud']).default('mem0_cloud'),
  MEM0_HOST: z.string().default('http://localhost:8888'),
  MEM0_API_KEY: z.string().optional(),

  // Graph Database (Neo4j) Configuration
  GRAPH_PROVIDER: z.enum(['self_hosted', 'neo4j_aura']).default('self_hosted'),
  NEO4J_URI: z.string().default('bolt://localhost:7687'),
  NEO4J_USER: z.string().default('neo4j'),
  NEO4J_PASSWORD: z.string().default('memorybook_graph_password'),

  // Evaluation & Reflection Loop Configuration
  EVAL_MAX_RETRIES: z.coerce.number().default(3),
  EVAL_CONFIDENCE_THRESHOLD: z.coerce.number().default(0.85),

  // Inngest (self-hosted OSS) — durable async pipeline execution for
  // ingestion, knowledge-graph extraction, and memory extraction.
  INNGEST_APP_ID: z.string().default('memorybook'),
  INNGEST_BASE_URL: z.string().default('http://localhost:8288'),
  // `isDev: true` targets Inngest's lightweight throwaway "Dev Server"
  // (`inngest-cli dev`) and auto-discovers it, bypassing signature
  // verification. We run the self-hosted, Postgres-backed `inngest start`
  // server instead (see docker-compose.yml) — that server requires real
  // signing/event keys unconditionally, so this stays false in every
  // environment, local dev included.
  INNGEST_DEV: z.coerce.boolean().default(false),
  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),
  // Explicit override for the URL Inngest should use to call *back* into this
  // app (function registration + step invocation). Left unset, the SDK infers
  // it from the Host header of whatever request triggers a sync — which is
  // wrong whenever the caller and the app are on different network
  // namespaces, e.g. this app running on the host while a self-hosted Inngest
  // server runs in Docker: the container can't reach the host via
  // "localhost", it needs "host.docker.internal". Set
  // INNGEST_SERVE_ORIGIN=http://host.docker.internal:<PORT> for that local
  // dev topology; leave unset for any deployment where Inngest can already
  // reach the app directly (both containerized on one network, or a real
  // public/internal URL).
  INNGEST_SERVE_ORIGIN: z.string().optional(),

  // Chat context assembly — approximate token budget (char/4 heuristic,
  // consistent with ChunkingService) enforced when building the LLM system
  // prompt context from retrieved chunks/graph facts/memory.
  MAX_CONTEXT_TOKENS: z.coerce.number().default(6000),

  // Per-user concurrent chat-stream bulkhead (in-memory, single-instance).
  MAX_CONCURRENT_STREAMS_PER_USER: z.coerce.number().default(3),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:', parsedEnv.error.format());
  throw new Error('Invalid environment variables');
}

export const env = parsedEnv.data;
