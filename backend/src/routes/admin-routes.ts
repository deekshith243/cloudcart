import { Router } from 'express';
import type { AdminCatalogController } from '../controllers/admin-catalog-controller.js';
import type { OrderController } from '../controllers/commerce-controllers.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authenticate, requireRole } from '../middleware/auth.js';

export const createAdminRouter = (
  controller: AdminCatalogController,
  orders: OrderController,
): Router => {
  const router = Router();
  router.get('/dashboard', authenticate, requireRole('ADMIN'), asyncHandler(controller.dashboard));
  router.get('/orders', authenticate, requireRole('ADMIN'), asyncHandler(orders.adminList));
  router.get('/orders/:id', authenticate, requireRole('ADMIN'), asyncHandler(orders.adminGet));
  router.patch(
    '/orders/:id/status',
    authenticate,
    requireRole('ADMIN'),
    asyncHandler(orders.adminStatus),
  );
  return router;
};
