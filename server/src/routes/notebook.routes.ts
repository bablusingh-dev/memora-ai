import { Router } from 'express';
import {
  getNotebooks,
  getNotebookById,
  createNotebook,
  deleteNotebook,
  searchNotebookRAG,
} from '../controllers/notebook.controller.js';

const router = Router();

router.get('/', getNotebooks);
router.post('/', createNotebook);
router.get('/:id', getNotebookById);
router.delete('/:id', deleteNotebook);
router.get('/:id/search', searchNotebookRAG);

export default router;
