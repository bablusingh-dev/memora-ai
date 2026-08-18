import { healthCheckFunction } from './health.js';

/**
 * Every Inngest function registered by this app. Imported once by the
 * `serve()` handler in `app.ts`. Later phases append their function exports
 * here rather than introducing a second registration point.
 */
export const inngestFunctions = [healthCheckFunction];
