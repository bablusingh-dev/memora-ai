import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ApiError } from '../utils/api-error.js';
import { ApiResponse } from '../utils/api-response.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';
import { StatusCodes } from 'http-status-codes';

export const errorMiddleware: ErrorRequestHandler = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) => {
  const requestId = req.id ? String(req.id) : undefined;
  let statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected server error occurred';
  let details: any = undefined;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    errorCode = err.errorCode;
    message = err.message;
    details = err.details;
  } else {
    logger.error(
      {
        err,
        requestId,
        url: req.originalUrl,
        method: req.method,
      },
      'Unhandled Application Error'
    );
  }

  if (env.NODE_ENV === 'development' && !(err instanceof ApiError)) {
    details = {
      stack: err.stack,
      rawError: err.message,
    };
  }

  ApiResponse.error({
    res,
    statusCode,
    errorCode,
    message,
    details,
    requestId,
  });
};
