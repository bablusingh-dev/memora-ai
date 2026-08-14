import { Router } from 'express';
import { handleAgentChatStream } from '../controllers/chat.controller.js';
import { requireAuthMiddleware } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import { notebookIdParamSchema, chatSchema } from '../validators/index.js';

const router = Router({ mergeParams: true });

router.use(requireAuthMiddleware);

router.post('/', validateRequest({ params: notebookIdParamSchema, body: chatSchema }), handleAgentChatStream);

export default router;
