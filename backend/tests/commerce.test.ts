import crypto from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { Prisma, UserRole, type OrderStatus } from '@prisma/client';
import { createApp } from '../src/app.js';
import type { CartRecord, CartRepository } from '../src/repositories/cart-repository.js';
import type { CategoryRepository } from '../src/repositories/category-repository.js';
import type {
  ProductInput,
  ProductListQuery,
  ProductRepository,
  ProductRecord,
} from '../src/repositories/product-repository.js';
import type {
  OrderListQuery,
  OrderListResult,
  OrderRecord,
  OrderRepository,
} from '../src/repositories/order-repository.js';
import type { UserRepository } from '../src/repositories/user-repository.js';
import { JwtService } from '../src/utils/jwt.js';
import { AppError } from '../src/errors/app-error.js';

const id = () => crypto.randomUUID();
const now = new Date('2026-01-01T00:00:00.000Z');

class EmptyUsers implements UserRepository {
  findByEmail = async () => null;
  findById = async () => null;
  create = async () => {
    throw new Error('not used');
  };
}

class CatalogProducts implements ProductRepository {
  records: ProductRecord[] = [];
  async findMany(query: ProductListQuery) {
    return {
      items: this.records.slice((query.page - 1) * query.limit, query.page * query.limit),
      totalItems: this.records.length,
    };
  }
  async findById(productId: string) {
    return this.records.find((product) => product.id === productId) ?? null;
  }
  async create(input: ProductInput) {
    const category = { id: input.categoryId, name: 'Test', description: null };
    const product = {
      id: id(),
      ...input,
      price: new Prisma.Decimal(input.price),
      imageUrl: input.imageUrl ?? null,
      category,
      createdAt: now,
      updatedAt: now,
    } as ProductRecord;
    this.records.push(product);
    return product;
  }
  async update(productId: string, input: ProductInput) {
    const product = await this.findById(productId);
    if (!product) throw new Error('not found');
    Object.assign(product, { ...input, price: new Prisma.Decimal(input.price) });
    return product;
  }
  async updateImage(productId: string, imageUrl: string) {
    const product = await this.findById(productId);
    if (!product) throw new Error('not found');
    product.imageUrl = imageUrl;
    return product;
  }
  async delete(productId: string) {
    this.records = this.records.filter((product) => product.id !== productId);
  }
  async count() {
    return this.records.length;
  }
  async countInStock() {
    return this.records.filter((product) => product.stock > 0).length;
  }
  async countOutOfStock() {
    return this.records.filter((product) => product.stock === 0).length;
  }
}

class CatalogCategories implements CategoryRepository {
  async findMany() {
    return [];
  }
  async findById(categoryId: string) {
    return { id: categoryId, name: 'Test', description: null, createdAt: now, updatedAt: now };
  }
  async findByName() {
    return null;
  }
  async create(input: { name: string; description?: string | null }) {
    return {
      id: id(),
      ...input,
      description: input.description ?? null,
      createdAt: now,
      updatedAt: now,
    };
  }
  async update(categoryId: string, input: { name: string; description?: string | null }) {
    return {
      id: categoryId,
      ...input,
      description: input.description ?? null,
      createdAt: now,
      updatedAt: now,
    };
  }
  async delete() {}
  async count() {
    return 1;
  }
}

class MemoryCartRepository implements CartRepository {
  carts = new Map<string, CartRecord>();
  constructor(private readonly products: CatalogProducts) {}
  private refresh(cart: CartRecord) {
    cart.items = cart.items.map((item) => ({
      ...item,
      product: this.products.records.find((product) => product.id === item.productId)!,
    }));
    return cart;
  }
  async findByUserId(userId: string) {
    return this.carts.get(userId) ?? null;
  }
  async getOrCreate(userId: string) {
    let cart = this.carts.get(userId);
    if (!cart) {
      cart = { id: id(), userId, items: [], createdAt: now, updatedAt: now };
      this.carts.set(userId, cart);
    }
    return this.refresh(cart);
  }
  async addItem(userId: string, productId: string, quantity: number) {
    const cart = await this.getOrCreate(userId);
    const item = cart.items.find((candidate) => candidate.productId === productId);
    if (item) item.quantity += quantity;
    else
      cart.items.push({
        id: id(),
        cartId: cart.id,
        productId,
        quantity,
        product: this.products.records.find((product) => product.id === productId)!,
      });
    return this.refresh(cart);
  }
  async updateItem(userId: string, itemId: string, quantity: number) {
    const cart = await this.getOrCreate(userId);
    const item = cart.items.find((candidate) => candidate.id === itemId);
    if (item) item.quantity = quantity;
    return this.refresh(cart);
  }
  async removeItem(userId: string, itemId: string) {
    const cart = await this.getOrCreate(userId);
    cart.items = cart.items.filter((item) => item.id !== itemId);
  }
  async clear(userId: string) {
    const cart = await this.getOrCreate(userId);
    cart.items = [];
  }
}

class MemoryOrderRepository implements OrderRepository {
  records: OrderRecord[] = [];
  constructor(
    private readonly carts: MemoryCartRepository,
    private readonly products: CatalogProducts,
  ) {}
  async createFromCart(userId: string) {
    const cart = await this.carts.getOrCreate(userId);
    if (!cart.items.length) throw new AppError(400, 'Cannot create an order from an empty cart');
    let total = new Prisma.Decimal(0);
    const items = cart.items.map((item) => {
      if (item.quantity > item.product.stock)
        throw new AppError(409, `Insufficient stock for ${item.product.name}`);
      const price = new Prisma.Decimal(item.product.price);
      total = total.add(price.mul(item.quantity));
      item.product.stock -= item.quantity;
      return {
        id: id(),
        productId: item.productId,
        quantity: item.quantity,
        priceAtPurchase: price.toNumber(),
        product: { id: item.product.id, name: item.product.name, imageUrl: item.product.imageUrl },
      };
    });
    const order: OrderRecord = {
      id: id(),
      userId,
      status: 'PENDING',
      totalAmount: total.toNumber(),
      createdAt: now,
      updatedAt: now,
      items,
    };
    this.records.push(order);
    await this.carts.clear(userId);
    return order;
  }
  async findByUserId(userId: string, query: OrderListQuery): Promise<OrderListResult> {
    const items = this.records.filter(
      (order) => order.userId === userId && (!query.status || order.status === query.status),
    );
    return {
      items: items.slice((query.page - 1) * query.limit, query.page * query.limit),
      totalItems: items.length,
    };
  }
  async findByIdForUser(userId: string, orderId: string) {
    return this.records.find((order) => order.userId === userId && order.id === orderId) ?? null;
  }
  async findMany(query: OrderListQuery): Promise<OrderListResult> {
    const items = this.records.filter((order) => !query.status || order.status === query.status);
    return {
      items: items.slice((query.page - 1) * query.limit, query.page * query.limit),
      totalItems: items.length,
    };
  }
  async findById(orderId: string) {
    return this.records.find((order) => order.id === orderId) ?? null;
  }
  async updateStatus(orderId: string, status: OrderStatus) {
    const order = await this.findById(orderId);
    if (!order) throw new Error('not found');
    order.status = status;
    return order;
  }
  async getDashboardStats(now = new Date()) {
    const todayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);
    const revenueStart = new Date(todayStart);
    revenueStart.setUTCDate(revenueStart.getUTCDate() - 29);
    const revenueByDate = new Map<string, number>();

    for (
      let date = new Date(revenueStart);
      date < tomorrowStart;
      date.setUTCDate(date.getUTCDate() + 1)
    ) {
      revenueByDate.set(date.toISOString().slice(0, 10), 0);
    }

    for (const order of this.records) {
      if (order.status === 'CANCELLED') continue;
      const date = order.createdAt.toISOString().slice(0, 10);
      if (revenueByDate.has(date)) {
        revenueByDate.set(date, (revenueByDate.get(date) ?? 0) + order.totalAmount);
      }
    }

    return {
      grossVolume: this.records
        .filter((order) => order.status !== 'CANCELLED')
        .reduce((total, order) => total + order.totalAmount, 0),
      ordersToday: this.records.filter(
        (order) => order.createdAt >= todayStart && order.createdAt < tomorrowStart,
      ).length,
      openFulfillment: this.records.filter((order) =>
        ['PENDING', 'PROCESSING', 'SHIPPED'].includes(order.status),
      ).length,
      revenue: [...revenueByDate].map(([date, revenue]) => ({ date, revenue })),
    };
  }
}

const setup = async () => {
  const products = new CatalogProducts();
  const categories = new CatalogCategories();
  const product = await products.create({
    name: 'Headphones',
    description: 'Clear sound',
    price: 100,
    stock: 5,
    categoryId: id(),
  });
  const carts = new MemoryCartRepository(products);
  const orders = new MemoryOrderRepository(carts, products);
  const app = createApp(new EmptyUsers(), {
    categoryRepository: categories,
    productRepository: products,
    cartRepository: carts,
    orderRepository: orders,
    authRateLimiter: (_request, _response, next) => next(),
  });
  const token = (userId: string, role: UserRole) =>
    new JwtService().sign({ id: userId, email: `${userId}@example.com`, role });
  return {
    app,
    products,
    carts,
    orders,
    product,
    customerId: id(),
    otherId: id(),
    customer: token('customer', UserRole.CUSTOMER),
    other: token('other', UserRole.CUSTOMER),
    admin: token('admin', UserRole.ADMIN),
  };
};

const add = (
  app: ReturnType<typeof createApp>,
  token: string,
  productId: string,
  quantity: number,
) =>
  request(app)
    .post('/api/v1/cart/items')
    .set('Authorization', `Bearer ${token}`)
    .send({ productId, quantity });

describe('cart API', () => {
  it('retrieves an authenticated empty cart', async () => {
    const { app, customer } = await setup();
    const response = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${customer}`);
    expect(response.status).toBe(200);
    expect(response.body.data.totalItems).toBe(0);
  });
  it('rejects anonymous cart access', async () => {
    const { app } = await setup();
    expect((await request(app).get('/api/v1/cart')).status).toBe(401);
  });
  it('adds an item and calculates subtotal', async () => {
    const { app, customer, product } = await setup();
    const response = await add(app, customer, product.id, 2);
    expect(response.status).toBe(201);
    expect(response.body.data.totalAmount).toBe(200);
  });
  it('increases an existing cart item', async () => {
    const { app, customer, product } = await setup();
    await add(app, customer, product.id, 1);
    const response = await add(app, customer, product.id, 2);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].quantity).toBe(3);
  });
  it('rejects missing products and quantities above stock', async () => {
    const { app, customer, product } = await setup();
    expect((await add(app, customer, id(), 1)).status).toBe(404);
    expect((await add(app, customer, product.id, 6)).status).toBe(409);
  });
  it('updates a cart item quantity', async () => {
    const { app, customer, product } = await setup();
    await add(app, customer, product.id, 1);
    const cart = await request(app).get('/api/v1/cart').set('Authorization', `Bearer ${customer}`);
    const response = await request(app)
      .put(`/api/v1/cart/items/${cart.body.data.items[0].id}`)
      .set('Authorization', `Bearer ${customer}`)
      .send({ quantity: 3 });
    expect(response.body.data.items[0].quantity).toBe(3);
  });
  it('prevents modifying another users cart item', async () => {
    const { app, customer, other, product } = await setup();
    await add(app, customer, product.id, 1);
    const cart = await request(app).get('/api/v1/cart').set('Authorization', `Bearer ${customer}`);
    expect(
      (
        await request(app)
          .put(`/api/v1/cart/items/${cart.body.data.items[0].id}`)
          .set('Authorization', `Bearer ${other}`)
          .send({ quantity: 2 })
      ).status,
    ).toBe(404);
  });
  it('removes and clears cart items', async () => {
    const { app, customer, product } = await setup();
    await add(app, customer, product.id, 1);
    const cart = await request(app).get('/api/v1/cart').set('Authorization', `Bearer ${customer}`);
    expect(
      (
        await request(app)
          .delete(`/api/v1/cart/items/${cart.body.data.items[0].id}`)
          .set('Authorization', `Bearer ${customer}`)
      ).status,
    ).toBe(204);
    await add(app, customer, product.id, 1);
    expect(
      (await request(app).delete('/api/v1/cart').set('Authorization', `Bearer ${customer}`)).status,
    ).toBe(200);
  });
});

describe('order API', () => {
  it('rejects checkout with an empty cart', async () => {
    const { app, customer } = await setup();
    expect(
      (
        await request(app)
          .post('/api/v1/orders')
          .set('Authorization', `Bearer ${customer}`)
          .send({})
      ).status,
    ).toBe(400);
  });
  it('creates an order, snapshots price, reduces stock, and clears cart', async () => {
    const { app, customer, product } = await setup();
    await add(app, customer, product.id, 2);
    const response = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${customer}`)
      .send({});
    expect(response.status).toBe(201);
    expect(response.body.data.items[0].priceAtPurchase).toBe(100);
    expect(response.body.data.totalAmount).toBe(200);
    expect(product.stock).toBe(3);
    expect(
      (await request(app).get('/api/v1/cart').set('Authorization', `Bearer ${customer}`)).body.data
        .totalItems,
    ).toBe(0);
  });
  it('prevents insufficient stock checkout without clearing the cart', async () => {
    const { app, customer, product } = await setup();
    await add(app, customer, product.id, 5);
    product.stock = 2;
    const response = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${customer}`)
      .send({});
    expect(response.status).toBe(409);
    expect(
      (await request(app).get('/api/v1/cart').set('Authorization', `Bearer ${customer}`)).body.data
        .totalItems,
    ).toBe(5);
  });
  it('lists and returns only the customers own orders', async () => {
    const { app, customer, other, product } = await setup();
    await add(app, customer, product.id, 1);
    const created = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${customer}`)
      .send({});
    const list = await request(app)
      .get('/api/v1/orders')
      .set('Authorization', `Bearer ${customer}`);
    expect(list.body.data.items).toHaveLength(1);
    expect(
      (
        await request(app)
          .get(`/api/v1/orders/${created.body.data.id}`)
          .set('Authorization', `Bearer ${other}`)
      ).status,
    ).toBe(404);
  });
  it('supports customer order pagination', async () => {
    const { app, customer, product } = await setup();
    for (let index = 0; index < 2; index += 1) {
      await add(app, customer, product.id, 1);
      await request(app).post('/api/v1/orders').set('Authorization', `Bearer ${customer}`).send({});
      product.stock += 1;
    }
    const response = await request(app)
      .get('/api/v1/orders?page=1&limit=1')
      .set('Authorization', `Bearer ${customer}`);
    expect(response.body.data.pagination.totalPages).toBe(2);
  });
  it('supports admin order list, details, and status updates', async () => {
    const { app, customer, admin, product } = await setup();
    await add(app, customer, product.id, 1);
    const created = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${customer}`)
      .send({});
    expect(
      (await request(app).get('/api/v1/admin/orders').set('Authorization', `Bearer ${admin}`))
        .status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .get(`/api/v1/admin/orders/${created.body.data.id}`)
          .set('Authorization', `Bearer ${admin}`)
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .patch(`/api/v1/admin/orders/${created.body.data.id}/status`)
          .set('Authorization', `Bearer ${admin}`)
          .send({ status: 'PROCESSING' })
      ).status,
    ).toBe(200);
  });
  it('rejects customer admin access and invalid status transitions', async () => {
    const { app, customer, admin, product } = await setup();
    await add(app, customer, product.id, 1);
    const created = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${customer}`)
      .send({});
    expect(
      (await request(app).get('/api/v1/admin/orders').set('Authorization', `Bearer ${customer}`))
        .status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .patch(`/api/v1/admin/orders/${created.body.data.id}/status`)
          .set('Authorization', `Bearer ${admin}`)
          .send({ status: 'DELIVERED' })
      ).status,
    ).toBe(409);
    expect(
      (
        await request(app)
          .patch(`/api/v1/admin/orders/${created.body.data.id}/status`)
          .set('Authorization', `Bearer ${admin}`)
          .send({ status: 'NOT_A_STATUS' })
      ).status,
    ).toBe(400);
  });
  it('supports admin order pagination', async () => {
    const { app, admin } = await setup();
    const response = await request(app)
      .get('/api/v1/admin/orders?page=1&limit=10')
      .set('Authorization', `Bearer ${admin}`);
    expect(response.body.data.pagination).toMatchObject({ page: 1, limit: 10 });
  });
});
