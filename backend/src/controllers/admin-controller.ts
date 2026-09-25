import type { Request, Response } from 'express';

export const adminDashboard = (request: Request, response: Response): void => {
  response.json({
    success: true,
    data: { message: 'Admin dashboard access granted', userId: request.auth?.id },
  });
};
