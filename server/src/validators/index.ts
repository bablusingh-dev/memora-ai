import { z } from 'zod';

// Reusable Param Validators
export const uuidParamSchema = z.object({
  id: z.string().uuid('ID must be a valid UUID format'),
});

export const memorybookIdParamSchema = z.object({
  memorybookId: z.string().uuid('Memorybook ID must be a valid UUID format'),
});

export const sourceIdParamSchema = z.object({
  memorybookId: z.string().uuid('Memorybook ID must be a valid UUID format'),
  sourceId: z.string().uuid('Source ID must be a valid UUID format'),
});

export const noteIdParamSchema = z.object({
  memorybookId: z.string().uuid('Memorybook ID must be a valid UUID format'),
  noteId: z.string().uuid('Note ID must be a valid UUID format'),
});

// Memorybook Validators
export const createMemorybookSchema = z.object({
  title: z.string().trim().min(1, 'Memorybook title is required').max(200, 'Title cannot exceed 200 characters'),
  description: z.string().trim().max(1000, 'Description cannot exceed 1000 characters').optional(),
});

export const updateMemorybookSchema = z.object({
  title: z.string().trim().min(1, 'Memorybook title cannot be empty').max(200).optional(),
  description: z.string().trim().max(1000).optional(),
});

// Chat Validators
export const chatSchema = z.object({
  messages: z.array(z.any()).optional(),
  prompt: z.string().optional(),
  text: z.string().optional(),
});

// Source Document Validators
export const websiteSourceSchema = z.object({
  url: z.string().trim().url('Website URL must be a valid http or https URL'),
});

export const youtubeSourceSchema = z.object({
  url: z.string().trim().url('YouTube URL must be a valid video link'),
});

export const textSourceSchema = z.object({
  title: z.string().trim().min(1, 'Source title is required'),
  content: z.string().trim().min(1, 'Text content is required'),
});

// Notes Validators
export const createNoteSchema = z.object({
  title: z.string().trim().min(1, 'Note title is required'),
  content: z.string().trim().min(1, 'Note content is required'),
  type: z.string().trim().optional(),
});
