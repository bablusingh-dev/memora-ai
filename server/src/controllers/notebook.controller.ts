import { Request, Response } from 'express';
import { NotebookService } from '../services/notebook.service.js';
import { RagService } from '../services/rag.service.js';
import { ApiResponse } from '../utils/api-response.js';
import { asyncHandler } from '../utils/async-handler.js';
import { z } from 'zod';
import { BadRequestError } from '../utils/api-error.js';

const notebookService = new NotebookService();
const ragService = new RagService();

const createNotebookSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
});

const searchSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  topK: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 5)),
});

export const getNotebooks = asyncHandler(async (req: Request, res: Response) => {
  const notebooks = await notebookService.getAllNotebooks();
  return ApiResponse.success({
    res,
    data: notebooks,
    message: 'Notebooks fetched successfully',
  });
});

export const getNotebookById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const notebook = await notebookService.getNotebookById(id);
  return ApiResponse.success({
    res,
    data: notebook,
    message: 'Notebook details fetched successfully',
  });
});

export const createNotebook = asyncHandler(async (req: Request, res: Response) => {
  const parseResult = createNotebookSchema.safeParse(req.body);
  if (!parseResult.success) {
    throw new BadRequestError('Invalid notebook payload', parseResult.error.format());
  }

  const newNotebook = await notebookService.createNotebook(parseResult.data);
  return ApiResponse.created({
    res,
    data: newNotebook,
    message: 'Notebook created successfully',
  });
});

export const deleteNotebook = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  await notebookService.deleteNotebook(id);
  return ApiResponse.success({
    res,
    message: `Notebook '${id}' deleted successfully`,
  });
});

export const searchNotebookRAG = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
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
