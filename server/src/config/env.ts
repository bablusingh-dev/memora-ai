import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform((val) => parseInt(val, 10)).default('5000'),
  DATABASE_URL: z.string().default('postgres://postgres:postgrespassword@localhost:5432/memora_db'),
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

  // Memory Provider Configuration
  MEMORY_PROVIDER: z.enum(['self_hosted', 'mem0_cloud']).default('mem0_cloud'),
  MEM0_HOST: z.string().default('http://localhost:8888'),
  MEM0_API_KEY: z.string().optional(),

  // Graph Database (Neo4j) Configuration
  GRAPH_PROVIDER: z.enum(['self_hosted', 'neo4j_aura']).default('self_hosted'),
  NEO4J_URI: z.string().default('bolt://localhost:7687'),
  NEO4J_USER: z.string().default('neo4j'),
  NEO4J_PASSWORD: z.string().default('memora_graph_password'),

  // Evaluation & Reflection Loop Configuration
  EVAL_MAX_RETRIES: z.coerce.number().default(3),
  EVAL_CONFIDENCE_THRESHOLD: z.coerce.number().default(0.85),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:', parsedEnv.error.format());
  throw new Error('Invalid environment variables');
}

export const env = parsedEnv.data;
