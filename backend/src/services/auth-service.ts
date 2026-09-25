import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { AppError } from '../errors/app-error.js';
import type { UserRepository, UserRecord } from '../repositories/user-repository.js';
import type { SafeUser } from '../types/auth.js';
import { JwtService } from '../utils/jwt.js';
import { type LoginInput, type RegisterInput } from '../validation/auth.js';

const BCRYPT_ROUNDS = 12;

export type AuthResult = {
  user: SafeUser;
  token: string;
};

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly jwt: JwtService,
  ) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.users.findByEmail(email);
    if (existing) throw new AppError(409, 'Email already registered');

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    let user: UserRecord;
    try {
      user = await this.users.create({
        name: input.name.trim(),
        email,
        passwordHash,
        role: 'CUSTOMER',
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError(409, 'Email already registered');
      }
      throw error;
    }

    return { user: this.toSafeUser(user), token: this.jwt.sign(user) };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const email = input.email.trim().toLowerCase();
    const user = await this.users.findByEmail(email);
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new AppError(401, 'Invalid email or password');
    }
    return { user: this.toSafeUser(user), token: this.jwt.sign(user) };
  }

  async currentUser(id: string): Promise<SafeUser> {
    const user = await this.users.findById(id);
    if (!user) throw new AppError(401, 'Authentication required');
    return this.toSafeUser(user);
  }

  private toSafeUser(user: UserRecord): SafeUser {
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }
}
