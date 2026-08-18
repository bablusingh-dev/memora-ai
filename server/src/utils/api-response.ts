import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';

export interface ApiResponseOptions<T> {
  res: Response;
  statusCode?: number;
  data?: T;
  message?: string;
  meta?: Record<string, any>;
}

export class ApiResponse {
  public static success<T>({
    res,
    statusCode = StatusCodes.OK,
    data,
    message = 'Success',
    meta,
  }: ApiResponseOptions<T>): Response {
    return res.status(statusCode).json({
      success: true,
      message,
      statusCode,
      data: data ?? null,
      meta,
      timestamp: new Date().toISOString(),
    });
  }

  public static created<T>({
    res,
    data,
    message = 'Created successfully',
    meta,
  }: Omit<ApiResponseOptions<T>, 'statusCode'>): Response {
    return ApiResponse.success({
      res,
      statusCode: StatusCodes.CREATED,
      data,
      message,
      meta,
    });
  }

  /**
   * For requests that kick off async work (Inngest-driven ingestion) rather
   * than completing it synchronously — the response body describes the
   * accepted/queued resource, not its final state.
   */
  public static accepted<T>({
    res,
    data,
    message = 'Accepted for processing',
    meta,
  }: Omit<ApiResponseOptions<T>, 'statusCode'>): Response {
    return ApiResponse.success({
      res,
      statusCode: StatusCodes.ACCEPTED,
      data,
      message,
      meta,
    });
  }

  public static error({
    res,
    statusCode = StatusCodes.INTERNAL_SERVER_ERROR,
    message = 'An error occurred',
    errorCode = 'INTERNAL_SERVER_ERROR',
    details,
    requestId,
  }: {
    res: Response;
    statusCode?: number;
    message?: string;
    errorCode?: string;
    details?: any;
    requestId?: string;
  }): Response {
    return res.status(statusCode).json({
      success: false,
      statusCode,
      error: {
        code: errorCode,
        message,
        details: details ?? null,
      },
      requestId,
      timestamp: new Date().toISOString(),
    });
  }
}
