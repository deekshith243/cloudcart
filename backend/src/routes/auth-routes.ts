import { Router, type RequestHandler } from 'express';
import type { AuthController } from '../controllers/auth-controller.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authenticate } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rate-limit.js';

export const createAuthRouter = (
  controller: AuthController,
  limiter: RequestHandler = authRateLimiter,
): Router => {
  const router = Router();
  router.post('/register', limiter, asyncHandler(controller.register));
  router.post('/login', limiter, asyncHandler(controller.login));
  router.get('/me', authenticate, asyncHandler(controller.me));
  router.post('/logout', asyncHandler(controller.logout));
  return router;
};
