import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';

export const customerRouter = Router();
customerRouter.get(
  '/profile',
  authenticate,
  requireRole('CUSTOMER', 'ADMIN'),
  (request, response) => {
    response.json({ success: true, data: { userId: request.auth?.id, role: request.auth?.role } });
  },
);
