import { Router } from 'express';
import { handleAgentChatStream } from '../controllers/chat.controller.js';
import { requireAuthMiddleware } from '../middlewares/auth.middleware.js';

const router = Router({ mergeParams: true });

router.use(requireAuthMiddleware);

router.post('/', handleAgentChatStream);

export default router;
