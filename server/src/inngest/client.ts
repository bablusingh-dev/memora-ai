import { Inngest } from 'inngest';
import { env } from '../config/env.js';

/**
 * Central Inngest client. All background pipelines (ingestion, knowledge-graph
 * extraction, memory extraction/consolidation) go through this instance rather
 * than ad-hoc setInterval pollers or unawaited promises.
 *
 * Runs against a self-hosted Inngest OSS server (see docker-compose.yml) in both
 * dev and production — INNGEST_DEV toggles signature verification only.
 *
 * This SDK version has no client-level event schema registry (no
 * `EventSchemas`/`schemas` option) — per-event typing instead comes from the
 * `EventType` instances declared in `./events.ts`, used directly as function
 * triggers and as typed factories via `<eventType>.create(data)` when sending.
 */
export const inngest = new Inngest({
  id: env.INNGEST_APP_ID,
  baseUrl: env.INNGEST_BASE_URL,
  isDev: env.INNGEST_DEV,
  eventKey: env.INNGEST_EVENT_KEY,
  signingKey: env.INNGEST_SIGNING_KEY,
});
