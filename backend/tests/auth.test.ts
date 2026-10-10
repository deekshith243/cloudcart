import bcrypt from 'bcrypt';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { UserRole, type User } from '@prisma/client';
import { createApp } from '../src/app.js';
import type { CategoryRepository } from '../src/repositories/category-repository.js';
import type { OrderRepository } from '../src/repositories/order-repository.js';
import type { ProductRepository } from '../src/repositories/product-repository.js';
import type { UserRepository, UserRecord } from '../src/repositories/user-repository.js';
import { JwtService } from '../src/utils/jwt.js';

class MemoryUserRepository implements UserRepository {
  private readonly users: UserRecord[] = [];

  async findByEmail(email: string): Promise<UserRecord | null> {
    return this.users.find((user) => user.email === email) ?? null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.users.find((user) => user.id === id) ?? null;
  }

  async create(input: Parameters<UserRepository['create']>[0]): Promise<UserRecord> {
    const user: UserRecord = {
      id: crypto.randomUUID(),
      ...input,
    } as User;
    this.users.push(user);
    return user;
  }

  async addUser(email: string, role: UserRole): Promise<UserRecord> {
    const user: UserRecord = {
      id: crypto.randomUUID(),
      name: role === UserRole.ADMIN ? 'Admin User' : 'Customer User',
      email,
      passwordHash: await bcrypt.hash('Password123!', 4),
      role,
    };
    this.users.push(user);
    return user;
  }
}

const setup = async () => {
  const repository = new MemoryUserRepository();
  const categoryRepository = {
    findMany: async () => [],
    findById: async () => null,
    findByName: async () => null,
    create: async () => {
      throw new Error('not used');
    },
    update: async () => {
      throw new Error('not used');
    },
    delete: async () => undefined,
    count: async () => 0,
  } as CategoryRepository;
  const productRepository = {
    findMany: async () => ({ items: [], totalItems: 0 }),
    findById: async () => null,
    create: async () => {
      throw new Error('not used');
    },
    update: async () => {
      throw new Error('not used');
    },
    delete: async () => undefined,
    count: async () => 0,
    countInStock: async () => 0,
    countOutOfStock: async () => 0,
  } as ProductRepository;
  const app = createApp(repository, {
    authRateLimiter: (_request, _response, next) => next(),
    categoryRepository,
    productRepository,
    orderRepository: {
      getDashboardStats: async () => ({
        grossVolume: 0,
        ordersToday: 0,
        openFulfillment: 0,
        revenue: [],
      }),
    } as OrderRepository,
  });
  return { app, repository };
};

describe('authentication and authorization', () => {
  it('registers a customer and never returns passwordHash', async () => {
    const { app } = await setup();
    const response = await request(app).post('/api/v1/auth/register').send({
      name: 'John Doe',
      email: ' JOHN@example.com ',
      password: 'Password123!',
    });

    expect(response.status).toBe(201);
    expect(response.body.data.user).toMatchObject({ email: 'john@example.com', role: 'CUSTOMER' });
    expect(response.body.data.user.passwordHash).toBeUndefined();
    expect(response.body.data.token).toEqual(expect.any(String));
  });

  it('rejects duplicate email, invalid email, and weak password', async () => {
    const { app } = await setup();
    await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'John Doe', email: 'john@example.com', password: 'Password123!' });
    const duplicate = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Other User', email: 'JOHN@example.com', password: 'Password123!' });
    const invalidEmail = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Other User', email: 'invalid', password: 'Password123!' });
    const weakPassword = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Other User', email: 'other@example.com', password: 'password' });

    expect(duplicate.status).toBe(409);
    expect(invalidEmail.status).toBe(400);
    expect(weakPassword.status).toBe(400);
  });

  it('logs in successfully and rejects incorrect or unknown credentials', async () => {
    const { app } = await setup();
    await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'John Doe', email: 'john@example.com', password: 'Password123!' });
    const success = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'JOHN@example.com', password: 'Password123!' });
    const incorrect = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'john@example.com', password: 'Wrong123!' });
    const unknown = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'unknown@example.com', password: 'Password123!' });

    expect(success.status).toBe(200);
    expect(success.body.data.user.passwordHash).toBeUndefined();
    expect(incorrect.status).toBe(401);
    expect(unknown.status).toBe(401);
  });

  it('rejects missing, invalid, and expired JWTs', async () => {
    const { app } = await setup();
    const missing = await request(app).get('/api/v1/auth/me');
    const invalid = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalid');
    const expired = new (await import('jsonwebtoken')).default.sign(
      {
        id: crypto.randomUUID(),
        email: 'expired@example.com',
        role: UserRole.CUSTOMER,
        type: 'access',
      },
      process.env.JWT_SECRET!,
      { issuer: process.env.JWT_ISSUER, expiresIn: '-1s' },
    );
    const expiredResponse = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${expired}`);

    expect(missing.status).toBe(401);
    expect(invalid.status).toBe(401);
    expect(expiredResponse.status).toBe(401);
  });

  it('returns the current safe user', async () => {
    const { app } = await setup();
    const registration = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'John Doe', email: 'john@example.com', password: 'Password123!' });
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${registration.body.data.token}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      name: 'John Doe',
      email: 'john@example.com',
      role: 'CUSTOMER',
    });
    expect(response.body.data.passwordHash).toBeUndefined();
  });

  it('allows admins and rejects customers on the admin endpoint', async () => {
    const { app, repository } = await setup();
    const customer = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Customer', email: 'customer@example.com', password: 'Password123!' });
    const adminRecord = await repository.addUser('admin@example.com', UserRole.ADMIN);
    const adminToken = new JwtService().sign(adminRecord);
    const customerResponse = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${customer.body.data.token}`);
    const adminResponse = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);
    const anonymousResponse = await request(app).get('/api/v1/admin/dashboard');

    expect(customerResponse.status).toBe(403);
    expect(adminResponse.status).toBe(200);
    expect(anonymousResponse.status).toBe(401);
  });

  it('logs out with an explicit stateless JWT limitation', async () => {
    const { app } = await setup();
    const response = await request(app).post('/api/v1/auth/logout');

    expect(response.status).toBe(200);
    expect(response.body.message).toContain('remain valid until they expire');
  });
});
