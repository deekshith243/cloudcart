import type { RequestHandler } from 'express';
import { AppError } from '../errors/app-error.js';

export const notFoundHandler: RequestHandler = (_request, _response, next) => {
  next(new AppError(404, 'Route not found'));
};
