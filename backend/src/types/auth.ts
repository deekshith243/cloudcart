import type { UserRole } from '@prisma/client';

export type SafeUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export type AuthenticatedUser = {
  id: string;
  email: string;
  role: UserRole;
};

declare global {
  namespace Express {
    interface Request {
      auth?: AuthenticatedUser;
    }
  }
}

export {};
