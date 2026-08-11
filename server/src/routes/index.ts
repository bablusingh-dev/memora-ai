import { Router } from 'express';
import healthRoutes from './health.routes.js';
import notebookRoutes from './notebook.routes.js';
import webhookRoutes from './webhook.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/notebooks', notebookRoutes);
router.use('/webhooks', webhookRoutes);

export default router;
