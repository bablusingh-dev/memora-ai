import { Router } from 'express';
import {
  getNotebooks,
  getNotebookById,
  createNotebook,
  updateNotebook,
  deleteNotebook,
  searchNotebookRAG,
} from '../controllers/notebook.controller.js';
import sourceRoutes from './source.routes.js';
import chatRoutes from './chat.routes.js';
import noteRoutes from './note.routes.js';
import { requireAuthMiddleware } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import { uuidParamSchema, createNotebookSchema, updateNotebookSchema } from '../validators/index.js';

const router = Router();

// Apply Clerk requireAuthMiddleware to all notebook endpoints
router.use(requireAuthMiddleware);

router.get('/', getNotebooks);
router.post('/', validateRequest({ body: createNotebookSchema }), createNotebook);
router.get('/:id', validateRequest({ params: uuidParamSchema }), getNotebookById);
router.patch('/:id', validateRequest({ params: uuidParamSchema, body: updateNotebookSchema }), updateNotebook);
router.delete('/:id', validateRequest({ params: uuidParamSchema }), deleteNotebook);
router.get('/:id/search', validateRequest({ params: uuidParamSchema }), searchNotebookRAG);

// Nested Source Document Routes (/api/v1/notebooks/:notebookId/sources)
router.use('/:notebookId/sources', sourceRoutes);

// Nested Agentic RAG Chat Routes (/api/v1/notebooks/:notebookId/chat)
router.use('/:notebookId/chat', chatRoutes);

// Nested Notes Routes (/api/v1/notebooks/:notebookId/notes)
router.use('/:notebookId/notes', noteRoutes);

export default router;
