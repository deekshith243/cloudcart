import { Router } from 'express';
import multer from 'multer';
import type { ImageController } from '../controllers/image-controller.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export const createImageRouter = (controller: ImageController): Router => {
  const router = Router();
  router.post(
    '/:id/image',
    authenticate,
    requireRole('ADMIN'),
    upload.single('image'),
    asyncHandler(controller.upload),
  );
  return router;
};
