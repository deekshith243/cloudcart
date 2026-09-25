import type { PrismaClient, User, UserRole } from '@prisma/client';

export type UserRecord = Pick<User, 'id' | 'name' | 'email' | 'passwordHash' | 'role'>;

type CreateUserInput = {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
};

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  create(input: CreateUserInput): Promise<UserRecord>;
}

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly client: PrismaClient) {}

  findByEmail(email: string): Promise<UserRecord | null> {
    return this.client.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<UserRecord | null> {
    return this.client.user.findUnique({ where: { id } });
  }

  create(input: CreateUserInput): Promise<UserRecord> {
    return this.client.user.create({ data: input });
  }
}
