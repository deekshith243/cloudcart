import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { getAuthConfig } from '../config/auth.js';
import { AppError } from '../errors/app-error.js';
import type { AuthenticatedUser } from '../types/auth.js';

type AuthTokenClaims = AuthenticatedUser & {
  type: 'access';
};

export class JwtService {
  private readonly config = getAuthConfig();

  sign(user: AuthenticatedUser): string {
    const claims: AuthTokenClaims = { ...user, type: 'access' };
    return jwt.sign(claims, this.config.jwtSecret, {
      expiresIn: this.config.jwtExpiresIn as SignOptions['expiresIn'],
      issuer: this.config.jwtIssuer,
      subject: user.id,
    });
  }

  verify(token: string): AuthenticatedUser {
    try {
      const payload = jwt.verify(token, this.config.jwtSecret, {
        issuer: this.config.jwtIssuer,
      });
      if (typeof payload === 'string' || !this.isAuthClaims(payload)) {
        throw new AppError(401, 'Invalid authentication token');
      }
      return { id: payload.id, email: payload.email, role: payload.role };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(401, 'Invalid or expired authentication token');
    }
  }

  private isAuthClaims(payload: JwtPayload): payload is JwtPayload & AuthTokenClaims {
    return (
      payload.type === 'access' &&
      typeof payload.id === 'string' &&
      typeof payload.email === 'string' &&
      typeof payload.role === 'string' &&
      Object.values(UserRole).includes(payload.role as UserRole)
    );
  }
}
