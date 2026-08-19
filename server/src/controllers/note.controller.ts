import { Response } from 'express';
import { NoteService } from '../services/note.service.js';
import { ApiResponse } from '../utils/api-response.js';
import { asyncHandler } from '../utils/async-handler.js';
import { BadRequestError } from '../utils/api-error.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { z } from 'zod';

const noteService = new NoteService();

const createNoteSchema = z.object({
  title: z.string().min(1, 'Note title is required'),
  content: z.string().min(1, 'Note content is required'),
  type: z.enum(['user_note', 'ai_summary', 'study_guide']).optional().default('user_note'),
});

export const getNotes = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const memorybookId = req.params.memorybookId as string;
  const userId = req.userId!;
  const notesList = await noteService.getNotes(memorybookId, userId);

  return ApiResponse.success({
    res,
    data: notesList,
    message: 'Memorybook notes fetched successfully',
  });
});

export const createNote = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const memorybookId = req.params.memorybookId as string;
  const userId = req.userId!;

  const parseResult = createNoteSchema.safeParse(req.body);
  if (!parseResult.success) {
    throw new BadRequestError('Invalid note payload', parseResult.error.format());
  }

  const { title, content, type } = parseResult.data;
  const newNote = await noteService.createNote(memorybookId, userId, title, content, type);

  return ApiResponse.created({
    res,
    data: newNote,
    message: 'Note created successfully',
  });
});

export const deleteNote = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const memorybookId = req.params.memorybookId as string;
  const noteId = req.params.id as string;
  const userId = req.userId!;

  await noteService.deleteNote(memorybookId, noteId, userId);

  return ApiResponse.success({
    res,
    message: 'Note deleted successfully',
  });
});
