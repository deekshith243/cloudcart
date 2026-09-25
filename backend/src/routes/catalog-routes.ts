import { Router } from 'express';
import type { CategoryController, ProductController } from '../controllers/catalog-controllers.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authenticate, requireRole } from '../middleware/auth.js';

export const createCategoryRouter = (controller: CategoryController): Router => {
  const router = Router();
  router.get('/', asyncHandler(controller.list));
  router.get('/:id', asyncHandler(controller.get));
  router.post('/', authenticate, requireRole('ADMIN'), asyncHandler(controller.create));
  router.put('/:id', authenticate, requireRole('ADMIN'), asyncHandler(controller.update));
  router.delete('/:id', authenticate, requireRole('ADMIN'), asyncHandler(controller.delete));
  return router;
};

export const createProductRouter = (controller: ProductController): Router => {
  const router = Router();
  router.get('/', asyncHandler(controller.list));
  router.get('/:id', asyncHandler(controller.get));
  router.post('/', authenticate, requireRole('ADMIN'), asyncHandler(controller.create));
  router.put('/:id', authenticate, requireRole('ADMIN'), asyncHandler(controller.update));
  router.delete('/:id', authenticate, requireRole('ADMIN'), asyncHandler(controller.delete));
  return router;
};
