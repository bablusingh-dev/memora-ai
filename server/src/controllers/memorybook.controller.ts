import { Response } from 'express';
import { MemorybookService } from '../services/memorybook.service.js';
import { RagService } from '../services/rag.service.js';
import { ApiResponse } from '../utils/api-response.js';
import { asyncHandler } from '../utils/async-handler.js';
import { z } from 'zod';
import { BadRequestError } from '../utils/api-error.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';

const memorybookService = new MemorybookService();
const ragService = new RagService();

const createMemorybookSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
});

const updateMemorybookSchema = z.object({
  title: z.string().min(1, 'Title is required').optional(),
  description: z.string().optional(),
});

const searchSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  topK: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 5)),
});

export const getMemorybooks = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const memorybooks = await memorybookService.getAllMemorybooks(userId);
  return ApiResponse.success({
    res,
    data: memorybooks,
    message: 'Memorybooks fetched successfully',
  });
});

export const getMemorybookById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;
  const userId = req.userId!;
  const memorybook = await memorybookService.getMemorybookById(id, userId);
  return ApiResponse.success({
    res,
    data: memorybook,
    message: 'Memorybook details fetched successfully',
  });
});

export const createMemorybook = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const parseResult = createMemorybookSchema.safeParse(req.body);
  if (!parseResult.success) {
    throw new BadRequestError('Invalid memorybook payload', parseResult.error.format());
  }

  const newMemorybook = await memorybookService.createMemorybook({
    ...parseResult.data,
    userId,
  });

  return ApiResponse.created({
    res,
    data: newMemorybook,
    message: 'Memorybook created successfully',
  });
});

export const updateMemorybook = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;
  const userId = req.userId!;
  const parseResult = updateMemorybookSchema.safeParse(req.body);
  if (!parseResult.success) {
    throw new BadRequestError('Invalid update payload', parseResult.error.format());
  }

  const updated = await memorybookService.updateMemorybook(id, userId, parseResult.data);

  return ApiResponse.success({
    res,
    data: updated,
    message: 'Memorybook updated successfully',
  });
});

export const deleteMemorybook = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;
  const userId = req.userId!;
  await memorybookService.deleteMemorybook(id, userId);
  return ApiResponse.success({
    res,
    message: `Memorybook '${id}' deleted successfully`,
  });
});

export const searchMemorybookRAG = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;
  const userId = req.userId!;
  
  // Verify user owns memorybook first
  await memorybookService.getMemorybookById(id, userId);

  const parseResult = searchSchema.safeParse(req.query);
  if (!parseResult.success) {
    throw new BadRequestError('Invalid search query parameters', parseResult.error.format());
  }

  const { query, topK } = parseResult.data;
  const ragResult = await ragService.retrieveContext(id, query, topK);

  return ApiResponse.success({
    res,
    data: ragResult,
    message: 'Vectorless ParadeDB BM25 search completed successfully',
  });
});
