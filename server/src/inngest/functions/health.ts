import { inngest } from '../client.js';
import { systemHealthCheck } from '../events.js';
import { logger } from '../../utils/logger.js';

/**
 * Trivial function used only to verify the Inngest wiring end-to-end during
 * Phase 0 rollout: the self-hosted Inngest server can reach this app's
 * `/api/v1/inngest` endpoint, discovers this function, and can execute a run.
 * Trigger it manually from the Inngest dashboard (http://localhost:8288) —
 * nothing in the app sends this event automatically.
 */
export const healthCheckFunction = inngest.createFunction(
  { id: 'system-health-check', triggers: [{ event: systemHealthCheck.event }] },
  async ({ event, step }) => {
    await step.run('log-health-check', () => {
      logger.info({ triggeredAt: event.data.triggeredAt }, '[Inngest] Health check function executed successfully');
      return { ok: true, receivedAt: new Date().toISOString() };
    });
  }
);
