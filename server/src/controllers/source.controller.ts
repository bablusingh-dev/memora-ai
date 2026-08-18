import { Response } from 'express';
import { SourceService } from '../services/source.service.js';
import { ApiResponse } from '../utils/api-response.js';
import { asyncHandler } from '../utils/async-handler.js';
import { BadRequestError } from '../utils/api-error.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { z } from 'zod';

const sourceService = new SourceService();

const urlSchema = z.object({
  url: z.string().url('Invalid URL format'),
});

const textSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Text content is required'),
});

export const getSources = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const notebookId = req.params.notebookId as string;
  const userId = req.userId!;
  const sources = await sourceService.getSources(notebookId, userId);

  return ApiResponse.success({
    res,
    data: sources,
    message: 'Notebook source documents fetched successfully',
  });
});

export const uploadSourceFile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const notebookId = req.params.notebookId as string;
  const userId = req.userId!;

  if (!req.file) {
    throw new BadRequestError('No file uploaded');
  }

  const source = await sourceService.ingestFile(notebookId, userId, req.file);

  return ApiResponse.accepted({
    res,
    data: source,
    message: 'File accepted — processing in the background. Poll GET /sources for status.',
  });
});

export const ingestWebsite = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const notebookId = req.params.notebookId as string;
  const userId = req.userId!;

  const parseResult = urlSchema.safeParse(req.body);
  if (!parseResult.success) {
    throw new BadRequestError('Invalid website payload', parseResult.error.format());
  }

  const source = await sourceService.ingestWebsite(notebookId, userId, parseResult.data.url);

  return ApiResponse.accepted({
    res,
    data: source,
    message: 'Website accepted — processing in the background. Poll GET /sources for status.',
  });
});

export const ingestYoutube = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const notebookId = req.params.notebookId as string;
  const userId = req.userId!;

  const parseResult = urlSchema.safeParse(req.body);
  if (!parseResult.success) {
    throw new BadRequestError('Invalid YouTube payload', parseResult.error.format());
  }

  const source = await sourceService.ingestYoutube(notebookId, userId, parseResult.data.url);

  return ApiResponse.accepted({
    res,
    data: source,
    message: 'YouTube video accepted — processing in the background. Poll GET /sources for status.',
  });
});

export const ingestTextNote = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const notebookId = req.params.notebookId as string;
  const userId = req.userId!;

  const parseResult = textSchema.safeParse(req.body);
  if (!parseResult.success) {
    throw new BadRequestError('Invalid text note payload', parseResult.error.format());
  }

  const { title, content } = parseResult.data;
  const source = await sourceService.ingestText(notebookId, userId, title, content);

  return ApiResponse.accepted({
    res,
    data: source,
    message: 'Text note accepted — processing in the background. Poll GET /sources for status.',
  });
});

export const deleteSource = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const notebookId = req.params.notebookId as string;
  const sourceId = req.params.id as string;
  const userId = req.userId!;

  await sourceService.deleteSource(notebookId, sourceId, userId);

  return ApiResponse.success({
    res,
    message: 'Source document deleted successfully',
  });
});
