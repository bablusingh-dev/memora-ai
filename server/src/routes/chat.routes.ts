import { Router } from 'express';
import {
  handleAgentChatStream,
  handleGetChatHistory,
  handleClearChatHistory,
} from '../controllers/chat.controller.js';
import { requireAuthMiddleware } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import { memorybookIdParamSchema, chatSchema } from '../validators/index.js';

const router = Router({ mergeParams: true });

router.use(requireAuthMiddleware);

// POST /api/v1/memorybooks/:memorybookId/chat (stream agent chat)
router.post('/', validateRequest({ params: memorybookIdParamSchema, body: chatSchema }), handleAgentChatStream);

// GET /api/v1/memorybooks/:memorybookId/chat (fetch chat history)
router.get('/', validateRequest({ params: memorybookIdParamSchema }), handleGetChatHistory);

// DELETE /api/v1/memorybooks/:memorybookId/chat (clear chat history)
router.delete('/', validateRequest({ params: memorybookIdParamSchema }), handleClearChatHistory);

export default router;
