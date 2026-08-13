import { Router } from 'express';
import {
  getNotebooks,
  getNotebookById,
  createNotebook,
  updateNotebook,
  deleteNotebook,
  searchNotebookRAG,
} from '../controllers/notebook.controller.js';
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

export default router;
