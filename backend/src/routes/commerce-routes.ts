import { Router } from 'express';
import type { CartController, OrderController } from '../controllers/commerce-controllers.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authenticate, requireRole } from '../middleware/auth.js';

export const createCartRouter = (controller: CartController): Router => {
  const router = Router();
  router.use(authenticate);
  router.get('/', asyncHandler(controller.get));
  router.post('/items', asyncHandler(controller.add));
  router.put('/items/:itemId', asyncHandler(controller.update));
  router.delete('/items/:itemId', asyncHandler(controller.remove));
  router.delete('/', asyncHandler(controller.clear));
  return router;
};

export const createOrderRouter = (controller: OrderController): Router => {
  const router = Router();
  router.use(authenticate);
  router.post('/', asyncHandler(controller.create));
  router.get('/', asyncHandler(controller.list));
  router.get('/:id', asyncHandler(controller.get));
  return router;
};

export const mountAdminOrderRoutes = (router: Router, controller: OrderController): Router => {
  router.get('/orders', authenticate, requireRole('ADMIN'), asyncHandler(controller.adminList));
  router.get('/orders/:id', authenticate, requireRole('ADMIN'), asyncHandler(controller.adminGet));
  router.patch(
    '/orders/:id/status',
    authenticate,
    requireRole('ADMIN'),
    asyncHandler(controller.adminStatus),
  );
  return router;
};
