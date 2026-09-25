import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/app-error.js';
import { JwtService } from '../utils/jwt.js';
import type { AuthenticatedUser } from '../types/auth.js';

const jwtService = new JwtService();

export const authenticate = (request: Request, _response: Response, next: NextFunction): void => {
  const header = request.header('authorization');
  if (!header?.startsWith('Bearer ')) {
    next(new AppError(401, 'Authentication required'));
    return;
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    next(new AppError(401, 'Authentication required'));
    return;
  }

  try {
    request.auth = jwtService.verify(token);
    next();
  } catch (error) {
    next(error);
  }
};

export const requireRole = (...roles: AuthenticatedUser['role'][]) => {
  return (request: Request, _response: Response, next: NextFunction): void => {
    if (!request.auth) {
      next(new AppError(401, 'Authentication required'));
      return;
    }
    if (!roles.includes(request.auth.role)) {
      next(new AppError(403, 'Insufficient permissions'));
      return;
    }
    next();
  };
};
