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

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max file size
});

const router = Router({ mergeParams: true });

router.use(requireAuthMiddleware);

router.get('/', getSources);
router.post('/upload', upload.single('file'), uploadSourceFile);
router.post('/website', ingestWebsite);
router.post('/youtube', ingestYoutube);
router.post('/text', ingestTextNote);
router.delete('/:id', deleteSource);

export default router;
