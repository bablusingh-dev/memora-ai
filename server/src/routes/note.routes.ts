import { Router } from 'express';
import { getNotes, createNote, deleteNote } from '../controllers/note.controller.js';
import { requireAuthMiddleware } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import { notebookIdParamSchema, createNoteSchema, uuidParamSchema } from '../validators/index.js';

const router = Router({ mergeParams: true });

router.use(requireAuthMiddleware);

router.get('/', validateRequest({ params: notebookIdParamSchema }), getNotes);
router.post('/', validateRequest({ params: notebookIdParamSchema, body: createNoteSchema }), createNote);
router.delete('/:id', validateRequest({ params: uuidParamSchema }), deleteNote);

export default router;
