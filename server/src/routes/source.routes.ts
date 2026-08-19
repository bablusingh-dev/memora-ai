import { Router } from 'express';
import multer from 'multer';
import {
  getSources,
  uploadSourceFile,
  ingestWebsite,
  ingestYoutube,
  ingestTextNote,
  deleteSource,
} from '../controllers/source.controller.js';
import { requireAuthMiddleware } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import {
  memorybookIdParamSchema,
  websiteSourceSchema,
  youtubeSourceSchema,
  textSourceSchema,
  sourceIdParamSchema,
} from '../validators/index.js';

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max file size
});

const router = Router({ mergeParams: true });

router.use(requireAuthMiddleware);

router.get('/', validateRequest({ params: memorybookIdParamSchema }), getSources);
router.post('/upload', validateRequest({ params: memorybookIdParamSchema }), upload.single('file'), uploadSourceFile);
router.post('/website', validateRequest({ params: memorybookIdParamSchema, body: websiteSourceSchema }), ingestWebsite);
router.post('/youtube', validateRequest({ params: memorybookIdParamSchema, body: youtubeSourceSchema }), ingestYoutube);
router.post('/text', validateRequest({ params: memorybookIdParamSchema, body: textSourceSchema }), ingestTextNote);
router.delete('/:id', validateRequest({ params: sourceIdParamSchema }), deleteSource);

export default router;
