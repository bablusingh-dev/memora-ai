import { Request, Response, NextFunction } from 'express';
import { getAuth } from '@clerk/express';
import { UnauthorizedError } from '../utils/api-error.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

const isClerkConfigured =
  env.CLERK_SECRET_KEY &&
  env.CLERK_SECRET_KEY.startsWith('sk_') &&
  !env.CLERK_SECRET_KEY.includes('placeholder');

export const requireAuthMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!isClerkConfigured) {
    throw new UnauthorizedError('Clerk authentication is not properly configured on server');
  }

  const auth = getAuth(req);

  if (!auth.userId) {
    logger.warn(
      {
        hasAuthHeader: !!req.headers.authorization,
        authHeaderPrefix: req.headers.authorization ? req.headers.authorization.substring(0, 15) : 'none',
        url: req.originalUrl,
        method: req.method,
      },
      'requireAuthMiddleware rejected request - missing userId from Clerk'
    );
    throw new UnauthorizedError('Authentication required. Please sign in to access your notebooks.');
  }

  req.userId = auth.userId;
  next();
};
