import { Request, Response, NextFunction } from 'express';
import { getAuth } from '@clerk/express';
import { UnauthorizedError } from '../utils/api-error.js';

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

export const requireAuthMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const auth = getAuth(req);

  if (!auth.userId) {
    throw new UnauthorizedError('Authentication required. Missing or invalid Bearer token.');
  }

  req.userId = auth.userId;
  next();
};
