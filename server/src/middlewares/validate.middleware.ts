import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { BadRequestError } from '../utils/api-error.js';

interface RequestValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export const validateRequest = (schemas: RequestValidationSchemas) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schemas.params) {
        // Merge rather than replace: nested routers (mergeParams: true) put
        // parent-router params (e.g. :memorybookId) on req.params alongside
        // this leaf route's own (e.g. :id) — but a leaf's schema only
        // declares its own param(s). Replacing req.params wholesale with the
        // parse result would silently drop every param the schema doesn't
        // mention, turning it into `undefined` for the rest of the request
        // (e.g. a nested DELETE /:id losing :memorybookId, which then reads
        // as a valid-but-nonexistent id instead of a validation error).
        const parsedParams = await schemas.params.parseAsync(req.params);
        req.params = { ...req.params, ...parsedParams };
      }
      if (schemas.query) {
        req.query = await schemas.query.parseAsync(req.query);
      }
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issueMessages = error.issues.map((i) => `${i.path.join('.') || 'field'}: ${i.message}`).join('; ');
        return next(new BadRequestError(`Validation Failed: ${issueMessages}`));
      }
      next(error);
    }
  };
};
