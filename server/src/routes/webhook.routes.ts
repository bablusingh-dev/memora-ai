import { Router } from 'express';
import { handleClerkWebhook } from '../controllers/webhook.controller.js';

const router = Router();

// Clerk Webhook Route
router.post('/clerk', handleClerkWebhook);

export default router;
