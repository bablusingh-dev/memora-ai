import { Router } from 'express';
import {
  getMemorybooks,
  getMemorybookById,
  createMemorybook,
  updateMemorybook,
  deleteMemorybook,
  searchMemorybookRAG,
} from '../controllers/memorybook.controller.js';
import sourceRoutes from './source.routes.js';
import chatRoutes from './chat.routes.js';
import noteRoutes from './note.routes.js';
import { requireAuthMiddleware } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import { uuidParamSchema, createMemorybookSchema, updateMemorybookSchema } from '../validators/index.js';

const router = Router();

// Apply Clerk requireAuthMiddleware to all memorybook endpoints
router.use(requireAuthMiddleware);

router.get('/', getMemorybooks);
router.post('/', validateRequest({ body: createMemorybookSchema }), createMemorybook);
router.get('/:id', validateRequest({ params: uuidParamSchema }), getMemorybookById);
router.patch('/:id', validateRequest({ params: uuidParamSchema, body: updateMemorybookSchema }), updateMemorybook);
router.delete('/:id', validateRequest({ params: uuidParamSchema }), deleteMemorybook);
router.get('/:id/search', validateRequest({ params: uuidParamSchema }), searchMemorybookRAG);

// Nested Source Document Routes (/api/v1/memorybooks/:memorybookId/sources)
router.use('/:memorybookId/sources', sourceRoutes);

// Nested Agentic RAG Chat Routes (/api/v1/memorybooks/:memorybookId/chat & /messages)
router.use('/:memorybookId/chat', chatRoutes);
router.use('/:memorybookId/messages', chatRoutes);

// Nested Notes Routes (/api/v1/memorybooks/:memorybookId/notes)
router.use('/:memorybookId/notes', noteRoutes);

export default router;
