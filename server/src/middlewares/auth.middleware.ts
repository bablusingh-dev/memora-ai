import { Request, Response, NextFunction } from 'express';
import { getAuth } from '@clerk/express';
import { UnauthorizedError } from '../utils/api-error.js';
import { env } from '../config/env.js';

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

const isClerkConfigured =
  env.CLERK_SECRET_KEY &&
  env.CLERK_SECRET_KEY.startsWith('sk_') &&
  !env.CLERK_SECRET_KEY.includes('placeholder');

export const requireAuthMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!isClerkConfigured) {
    // Dev fallback mode when real Clerk secret keys are not plugged in yet
    req.userId = 'user_dev_guest';
    return next();
  }

  const auth = getAuth(req);

  if (!auth.userId) {
    throw new UnauthorizedError('Authentication required. Missing or invalid Bearer token.');
  }

  req.userId = auth.userId;
  next();
};
