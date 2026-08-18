import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { clerkMiddleware } from '@clerk/express';
import { serve as serveInngest } from 'inngest/express';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { requestIdMiddleware } from './middlewares/request-id.middleware.js';
import { errorMiddleware } from './middlewares/error.middleware.js';
import apiRouter from './routes/index.js';
import { NotFoundError } from './utils/api-error.js';
import { inngest } from './inngest/client.js';
import { inngestFunctions } from './inngest/functions/index.js';

export const app = express();

const isClerkConfigured =
  env.CLERK_SECRET_KEY &&
  env.CLERK_SECRET_KEY.startsWith('sk_') &&
  !env.CLERK_SECRET_KEY.includes('placeholder');

// Security Headers (allow cross-origin reads from client)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS configuration
app.use(
  cors({
    origin: [env.CORS_ORIGIN, 'http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with', 'Accept'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
);

// Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request Correlation ID Middleware
app.use(requestIdMiddleware);

// Clerk Authentication Middleware (only registered when valid secret key exists)
if (isClerkConfigured) {
  app.use(
    clerkMiddleware({
      publishableKey: env.CLERK_PUBLISHABLE_KEY,
      secretKey: env.CLERK_SECRET_KEY,
    })
  );
}

// Pino HTTP Request Logging
app.use(
  pinoHttp({
    logger,
    customAttributeKeys: {
      req: 'request',
      res: 'response',
      err: 'error',
    },
    serializers: {
      req: (req) => ({
        id: req.id,
        method: req.method,
        url: req.url,
      }),
      res: (res) => ({
        statusCode: res.statusCode,
      }),
    },
  })
);

// Inngest function registration endpoint — the self-hosted Inngest server
// calls this to discover/invoke functions. Authenticated via
// INNGEST_SIGNING_KEY request signatures, not Clerk, so it deliberately sits
// outside requireAuthMiddleware.
app.use(
  '/api/v1/inngest',
  serveInngest({
    client: inngest,
    functions: inngestFunctions,
    // See INNGEST_SERVE_ORIGIN's doc comment in config/env.ts — required
    // whenever Inngest can't reach this app via the Host header of whatever
    // request triggers a sync (e.g. Inngest-in-Docker, app-on-host locally).
    serveOrigin: env.INNGEST_SERVE_ORIGIN,
  })
);

// Mount API v1 Routes
app.use('/api/v1', apiRouter);

// Catch-all 404 Route Handler
app.use('*', (req, res, next) => {
  next(new NotFoundError(`Route '${req.originalUrl}' not found`));
});

// Centralized Error Handling Middleware
app.use(errorMiddleware);
