import { Router } from 'express';
import { getNotes, createNote, deleteNote } from '../controllers/note.controller.js';
import { requireAuthMiddleware } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import { memorybookIdParamSchema, createNoteSchema, noteIdParamSchema } from '../validators/index.js';

const router = Router({ mergeParams: true });

router.use(requireAuthMiddleware);

router.get('/', validateRequest({ params: memorybookIdParamSchema }), getNotes);
router.post('/', validateRequest({ params: memorybookIdParamSchema, body: createNoteSchema }), createNote);
router.delete('/:id', validateRequest({ params: noteIdParamSchema }), deleteNote);

export default router;
