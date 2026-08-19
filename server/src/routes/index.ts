import { Router } from 'express';
import healthRoutes from './health.routes.js';
import memorybookRoutes from './memorybook.routes.js';
import webhookRoutes from './webhook.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/memorybooks', memorybookRoutes);
router.use('/webhooks', webhookRoutes);

export default router;
