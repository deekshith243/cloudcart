import type { Request, Response } from 'express';
import { AppError } from '../errors/app-error.js';
import type { AuthService } from '../services/auth-service.js';
import { loginSchema, registerSchema } from '../validation/auth.js';

export class AuthController {
  constructor(private readonly auth: AuthService) {}

  register = async (request: Request, response: Response): Promise<void> => {
    const input = registerSchema.parse(request.body);
    const result = await this.auth.register(input);
    response.status(201).json({ success: true, data: result });
  };

  login = async (request: Request, response: Response): Promise<void> => {
    const input = loginSchema.parse(request.body);
    const result = await this.auth.login(input);
    response.json({ success: true, data: result });
  };

  me = async (request: Request, response: Response): Promise<void> => {
    if (!request.auth) throw new AppError(401, 'Authentication required');
    const user = await this.auth.currentUser(request.auth.id);
    response.json({ success: true, data: user });
  };

  logout = async (_request: Request, response: Response): Promise<void> => {
    response.json({
      success: true,
      data: null,
      message: 'Logged out locally. Existing access tokens remain valid until they expire.',
    });
  };
}
