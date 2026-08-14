import { Router } from 'express';
import {
  handleAgentChatStream,
  handleGetChatHistory,
  handleClearChatHistory,
} from '../controllers/chat.controller.js';
import { requireAuthMiddleware } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import { notebookIdParamSchema, chatSchema } from '../validators/index.js';

const router = Router({ mergeParams: true });

router.use(requireAuthMiddleware);

// POST /api/v1/notebooks/:notebookId/chat (stream agent chat)
router.post('/', validateRequest({ params: notebookIdParamSchema, body: chatSchema }), handleAgentChatStream);

// GET /api/v1/notebooks/:notebookId/chat (fetch chat history)
router.get('/', validateRequest({ params: notebookIdParamSchema }), handleGetChatHistory);

// DELETE /api/v1/notebooks/:notebookId/chat (clear chat history)
router.delete('/', validateRequest({ params: notebookIdParamSchema }), handleClearChatHistory);

export default router;
