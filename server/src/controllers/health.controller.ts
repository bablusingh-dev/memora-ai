import { Request, Response } from 'express';
import { ApiResponse } from '../utils/api-response.js';
import { asyncHandler } from '../utils/async-handler.js';
import { pool } from '../db/index.js';
import { GraphFactory } from '../providers/graph/graph.factory.js';
import { MemoryFactory } from '../providers/memory/memory.factory.js';

export const getHealth = asyncHandler(async (req: Request, res: Response) => {
  // Run all checks in parallel
  const [dbStatus, neo4jStatus, mem0Status] = await Promise.all([
    pool.query('SELECT 1').then(() => 'connected').catch(() => 'error'),
    GraphFactory.getProvider().verifyConnection().then((ok) => (ok ? 'connected' : 'error')).catch(() => 'error'),
    MemoryFactory.getProvider().ping().then(() => 'connected').catch(() => 'error'),
  ]);

  const allHealthy = dbStatus === 'connected' && neo4jStatus === 'connected' && mem0Status === 'connected';

  return ApiResponse.success({
    res,
    statusCode: allHealthy ? 200 : 503,
    message: allHealthy ? 'Memora AI Server Health Check OK' : 'One or more services are degraded',
    data: {
      status: allHealthy ? 'healthy' : 'degraded',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: {
        paradedb: dbStatus,
        neo4j: neo4jStatus,
        mem0: mem0Status,
      },
    },
  });
});
