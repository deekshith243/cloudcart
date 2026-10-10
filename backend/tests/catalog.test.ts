import crypto from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { Prisma, UserRole } from '@prisma/client';
import { createApp } from '../src/app.js';
import type {
  CategoryRecord,
  CategoryRepository,
} from '../src/repositories/category-repository.js';
import type {
  ProductInput,
  ProductListQuery,
  ProductListResult,
  ProductRecord,
  ProductRepository,
} from '../src/repositories/product-repository.js';
import type { OrderRepository } from '../src/repositories/order-repository.js';
import { JwtService } from '../src/utils/jwt.js';

const uuid = () => crypto.randomUUID();
const date = new Date('2026-01-01T00:00:00.000Z');

class MemoryCategoryRepository implements CategoryRepository {
  readonly records: CategoryRecord[] = [];

  async findMany() {
    return [...this.records].sort((a, b) => a.name.localeCompare(b.name));
  }
  async findById(id: string) {
    return this.records.find((category) => category.id === id) ?? null;
  }
  async findByName(name: string) {
    return this.records.find((category) => category.name === name) ?? null;
  }
  async create(input: { name: string; description?: string | null }) {
    const record = {
      id: uuid(),
      ...input,
      description: input.description ?? null,
      createdAt: date,
      updatedAt: date,
    };
    this.records.push(record);
    return record;
  }
  async update(id: string, input: { name: string; description?: string | null }) {
    const category = await this.findById(id);
    if (!category) throw new Error('not found');
    Object.assign(category, { ...input, description: input.description ?? null });
    return category;
  }
  async delete(id: string) {
    const index = this.records.findIndex((category) => category.id === id);
    if (index >= 0) this.records.splice(index, 1);
  }
  async count() {
    return this.records.length;
  }
}

class MemoryProductRepository implements ProductRepository {
  readonly records: ProductRecord[] = [];

  constructor(private readonly categories: MemoryCategoryRepository) {}

  async findMany(query: ProductListQuery): Promise<ProductListResult> {
    let records = this.records.filter((product) => {
      if (query.categoryId && product.categoryId !== query.categoryId) return false;
      if (query.minPrice !== undefined && Number(product.price) < query.minPrice) return false;
      if (query.maxPrice !== undefined && Number(product.price) > query.maxPrice) return false;
      if (query.inStock === true && product.stock <= 0) return false;
      if (query.inStock === false && product.stock !== 0) return false;
      if (query.search && !product.name.toLowerCase().includes(query.search.toLowerCase()))
        return false;
      return true;
    });
    records = records.sort((left, right) => {
      const a = left[query.sortBy];
      const b = right[query.sortBy];
      const result = a < b ? -1 : a > b ? 1 : 0;
      return query.sortOrder === 'asc' ? result : -result;
    });
    const start = (query.page - 1) * query.limit;
    return { items: records.slice(start, start + query.limit), totalItems: records.length };
  }

  async findById(id: string) {
    return this.records.find((product) => product.id === id) ?? null;
  }
  async create(input: ProductInput) {
    const category = await this.categories.findById(input.categoryId);
    if (!category) throw new Error('category not found');
    const record = {
      id: uuid(),
      ...input,
      price: new Prisma.Decimal(input.price),
      imageUrl: input.imageUrl ?? null,
      category,
      createdAt: date,
      updatedAt: date,
    } as ProductRecord;
    this.records.push(record);
    return record;
  }
  async update(id: string, input: ProductInput) {
    const product = await this.findById(id);
    const category = await this.categories.findById(input.categoryId);
    if (!product || !category) throw new Error('not found');
    Object.assign(product, {
      ...input,
      price: new Prisma.Decimal(input.price),
      imageUrl: input.imageUrl ?? null,
      category,
    });
    return product;
  }
  async updateImage(id: string, imageUrl: string) {
    const product = await this.findById(id);
    if (!product) throw new Error('not found');
    product.imageUrl = imageUrl;
    return product;
  }
  async delete(id: string) {
    const index = this.records.findIndex((product) => product.id === id);
    if (index >= 0) this.records.splice(index, 1);
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

const productInput = (categoryId: string, name = 'Wireless Headphones'): ProductInput => ({
  name,
  description: 'Bluetooth wireless headphones',
  price: 2999,
  stock: 50,
  imageUrl: 'https://example.com/headphones.jpg',
  categoryId,
});

const makeUserToken = (role: UserRole) =>
  new JwtService().sign({ id: uuid(), email: `${role.toLowerCase()}@example.com`, role });

const setup = async () => {
  const categories = new MemoryCategoryRepository();
  const products = new MemoryProductRepository(categories);
  const category = await categories.create({ name: 'Audio', description: 'Sound products' });
  await products.create(productInput(category.id));
  const app = createApp(undefined, {
    categoryRepository: categories,
    productRepository: products,
    orderRepository: {
      getDashboardStats: async () => ({
        grossVolume: 0,
        ordersToday: 0,
        openFulfillment: 0,
        revenue: [],
      }),
    } as OrderRepository,
    authRateLimiter: (_request, _response, next) => next(),
  });
  return {
    app,
    categories,
    products,
    category,
    admin: makeUserToken(UserRole.ADMIN),
    customer: makeUserToken(UserRole.CUSTOMER),
  };
};

describe('category API', () => {
  it('lists and returns public categories', async () => {
    const { app, category } = await setup();
    expect((await request(app).get('/api/v1/categories')).status).toBe(200);
    const detail = await request(app).get(`/api/v1/categories/${category.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.name).toBe('Audio');
  });

  it('allows admins to create, update, and delete categories', async () => {
    const { app, admin } = await setup();
    const created = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${admin}`)
      .send({ name: 'Travel', description: 'Travel goods' });
    expect(created.status).toBe(201);
    const updated = await request(app)
      .put(`/api/v1/categories/${created.body.data.id}`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ name: 'Travel Gear', description: 'Updated' });
    expect(updated.status).toBe(200);
    expect(
      (
        await request(app)
          .delete(`/api/v1/categories/${created.body.data.id}`)
          .set('Authorization', `Bearer ${admin}`)
      ).status,
    ).toBe(204);
  });

  it('rejects customer and anonymous category mutations', async () => {
    const { app, customer } = await setup();
    expect((await request(app).post('/api/v1/categories').send({ name: 'Travel' })).status).toBe(
      401,
    );
    expect(
      (
        await request(app)
          .post('/api/v1/categories')
          .set('Authorization', `Bearer ${customer}`)
          .send({ name: 'Travel' })
      ).status,
    ).toBe(403);
  });

  it('rejects duplicate and missing categories', async () => {
    const { app, admin, category } = await setup();
    expect(
      (
        await request(app)
          .post('/api/v1/categories')
          .set('Authorization', `Bearer ${admin}`)
          .send({ name: 'Audio' })
      ).status,
    ).toBe(409);
    expect((await request(app).get(`/api/v1/categories/${uuid()}`)).status).toBe(404);
    expect(
      (
        await request(app)
          .put(`/api/v1/categories/${category.id}`)
          .set('Authorization', `Bearer ${admin}`)
          .send({ name: 'x' })
      ).status,
    ).toBe(400);
  });

  it('rejects malformed category ids', async () => {
    const { app } = await setup();
    expect((await request(app).get('/api/v1/categories/not-a-uuid')).status).toBe(400);
  });

  it('requires admin authorization for category deletion', async () => {
    const { app, category, customer } = await setup();
    expect(
      (
        await request(app)
          .delete(`/api/v1/categories/${category.id}`)
          .set('Authorization', `Bearer ${customer}`)
      ).status,
    ).toBe(403);
  });

  it('returns 404 when deleting a missing category', async () => {
    const { app, admin } = await setup();
    expect(
      (
        await request(app)
          .delete(`/api/v1/categories/${uuid()}`)
          .set('Authorization', `Bearer ${admin}`)
      ).status,
    ).toBe(404);
  });
});

describe('health API', () => {
  it('returns a public process health response without optional dependencies', async () => {
    const { app } = await setup();
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ service: 'cloudcart-api', status: 'ok' });
  });
});

describe('product API', () => {
  it('lists and returns public product details', async () => {
    const { app, products } = await setup();
    const list = await request(app).get('/api/v1/products');
    expect(list.status).toBe(200);
    expect(list.body.data.items).toHaveLength(1);
    const product = products.records[0];
    const detail = await request(app).get(`/api/v1/products/${product.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.category.name).toBe('Audio');
  });

  it('allows admins to create and update products', async () => {
    const { app, category, admin } = await setup();
    const created = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${admin}`)
      .send(productInput(category.id, 'Desk Speaker'));
    expect(created.status).toBe(201);
    const updated = await request(app)
      .put(`/api/v1/products/${created.body.data.id}`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ ...productInput(category.id, 'Desk Speaker'), stock: 0 });
    expect(updated.status).toBe(200);
    expect(Number(updated.body.data.stock)).toBe(0);
  });

  it('rejects customer and anonymous product mutations', async () => {
    const { app, category, customer, admin } = await setup();
    expect(
      (
        await request(app)
          .post('/api/v1/products')
          .send(productInput(category.id, 'Anonymous Product'))
      ).status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .post('/api/v1/products')
          .set('Authorization', `Bearer ${customer}`)
          .send(productInput(category.id, 'Customer Product'))
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .delete(`/api/v1/products/${uuid()}`)
          .set('Authorization', `Bearer ${admin}`)
      ).status,
    ).toBe(404);
  });

  it('validates product data and category references', async () => {
    const { app, admin, category } = await setup();
    expect(
      (
        await request(app)
          .post('/api/v1/products')
          .set('Authorization', `Bearer ${admin}`)
          .send({ ...productInput(category.id), price: -1 })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post('/api/v1/products')
          .set('Authorization', `Bearer ${admin}`)
          .send({ ...productInput(uuid()), name: 'Missing Category' })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post('/api/v1/products')
          .set('Authorization', `Bearer ${admin}`)
          .send({ ...productInput(category.id), imageUrl: 'not-url' })
      ).status,
    ).toBe(400);
  });

  it('deletes products for admins and returns 404 for missing products', async () => {
    const { app, products, admin } = await setup();
    const productId = products.records[0].id;
    expect(
      (
        await request(app)
          .delete(`/api/v1/products/${productId}`)
          .set('Authorization', `Bearer ${admin}`)
      ).status,
    ).toBe(204);
    expect((await request(app).get(`/api/v1/products/${productId}`)).status).toBe(404);
  });

  it('supports pagination, filtering, sorting, and search', async () => {
    const { app, category, products } = await setup();
    await products.create({ ...productInput(category.id, 'Desk Lamp'), price: 100, stock: 0 });
    await products.create({
      ...productInput(category.id, 'Travel Speaker'),
      price: 500,
      stock: 10,
    });
    const page = await request(app).get('/api/v1/products?page=1&limit=2');
    const filtered = await request(app).get(
      `/api/v1/products?categoryId=${category.id}&inStock=true&minPrice=400&maxPrice=600`,
    );
    const sorted = await request(app).get('/api/v1/products?sortBy=price&sortOrder=asc');
    const searched = await request(app).get('/api/v1/products?search=speaker');
    expect(page.body.data.pagination).toMatchObject({
      page: 1,
      limit: 2,
      totalItems: 3,
      totalPages: 2,
    });
    expect(filtered.body.data.items).toHaveLength(1);
    expect(Number(sorted.body.data.items[0].price)).toBe(100);
    expect(searched.body.data.items).toHaveLength(1);
  });

  it('rejects invalid product query parameters', async () => {
    const { app } = await setup();
    expect((await request(app).get('/api/v1/products?page=0&sortBy=secretField')).status).toBe(400);
  });

  it('requires admin authorization for product deletion', async () => {
    const { app, products, customer } = await setup();
    expect(
      (
        await request(app)
          .delete(`/api/v1/products/${products.records[0].id}`)
          .set('Authorization', `Bearer ${customer}`)
      ).status,
    ).toBe(403);
  });

  it('returns 404 when updating a missing product', async () => {
    const { app, category, admin } = await setup();
    expect(
      (
        await request(app)
          .put(`/api/v1/products/${uuid()}`)
          .set('Authorization', `Bearer ${admin}`)
          .send(productInput(category.id))
      ).status,
    ).toBe(404);
  });
});

describe('admin dashboard API', () => {
  it('returns product and category statistics for admins only', async () => {
    const { app, admin, customer } = await setup();
    const response = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${admin}`);
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      totalProducts: 1,
      totalCategories: 1,
      productsInStock: 1,
      productsOutOfStock: 0,
    });
    expect(
      (await request(app).get('/api/v1/admin/dashboard').set('Authorization', `Bearer ${customer}`))
        .status,
    ).toBe(403);
  });

  it('requires authentication for dashboard statistics', async () => {
    const { app } = await setup();
    expect((await request(app).get('/api/v1/admin/dashboard')).status).toBe(401);
  });
});
