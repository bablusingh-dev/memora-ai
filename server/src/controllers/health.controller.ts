import { Request, Response } from 'express';
import { ApiResponse } from '../utils/api-response.js';
import { asyncHandler } from '../utils/async-handler.js';
import { pool } from '../db/index.js';

export const getHealth = asyncHandler(async (req: Request, res: Response) => {
  let dbStatus = 'disconnected';
  try {
    await pool.query('SELECT 1');
    dbStatus = 'connected';
  } catch (e) {
    dbStatus = 'error';
  }

  return ApiResponse.success({
    res,
    message: 'Memora AI Server Health Check OK',
    data: {
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        vectorlessSearch: 'ParadeDB (BM25)',
      },
    },
  });
});
