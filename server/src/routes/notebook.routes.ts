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
import { requireAuthMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

// Apply Clerk requireAuthMiddleware to all notebook endpoints
router.use(requireAuthMiddleware);

router.get('/', getNotebooks);
router.post('/', createNotebook);
router.get('/:id', getNotebookById);
router.patch('/:id', updateNotebook);
router.delete('/:id', deleteNotebook);
router.get('/:id/search', searchNotebookRAG);

// Nested Source Document Routes (/api/v1/notebooks/:notebookId/sources)
router.use('/:notebookId/sources', sourceRoutes);

// Nested Agentic RAG Chat Routes (/api/v1/notebooks/:notebookId/chat)
router.use('/:notebookId/chat', chatRoutes);

export default router;
