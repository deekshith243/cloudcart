import type { ErrorRequestHandler } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { AppError } from '../errors/app-error.js';

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof multer.MulterError) {
    response.status(400).json({
      success: false,
      error:
        error.code === 'LIMIT_FILE_SIZE' ? 'Image exceeds the 5 MB limit' : 'Invalid image upload',
    });
    return;
  }
  if (error instanceof ZodError) {
    response.status(400).json({
      success: false,
      error: 'Validation error',
      details: error.issues.map((issue) => ({ path: issue.path, message: issue.message })),
    });
    return;
  }

  if (error instanceof AppError) {
    response
      .status(error.statusCode)
      .json({ success: false, error: error.message, code: error.code });
    return;
  }

  console.error(error);
  response.status(500).json({ success: false, error: 'Internal server error' });
};
