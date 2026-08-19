import { Router } from 'express';
import { getArtifacts, generateArtifact, getArtifactById, deleteArtifact } from '../controllers/studio.controller.js';
import { requireAuthMiddleware } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import { memorybookIdParamSchema, studioKindParamSchema, studioIdParamSchema } from '../validators/index.js';

const router = Router({ mergeParams: true });

router.use(requireAuthMiddleware);

router.get('/', validateRequest({ params: memorybookIdParamSchema }), getArtifacts);
router.post('/:kind', validateRequest({ params: studioKindParamSchema }), generateArtifact);
router.get('/:id', validateRequest({ params: studioIdParamSchema }), getArtifactById);
router.delete('/:id', validateRequest({ params: studioIdParamSchema }), deleteArtifact);

export default router;
