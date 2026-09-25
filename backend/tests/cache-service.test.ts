import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import type { CategoryRepository } from '../src/repositories/category-repository.js';
import type {
  ProductInput,
  ProductListQuery,
  ProductRepository,
  ProductRecord,
} from '../src/repositories/product-repository.js';
import { CategoryService } from '../src/services/category-service.js';
import { ProductService } from '../src/services/product-service.js';
import type { CacheStore } from '../src/services/redis-service.js';

const category = {
  id: 'category-1',
  name: 'Audio',
  description: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const product = {
  id: 'product-1',
  name: 'Speaker',
  description: 'Sound',
  price: new Prisma.Decimal(100),
  stock: 4,
  imageUrl: null,
  categoryId: category.id,
  category,
  createdAt: new Date(),
  updatedAt: new Date(),
} as ProductRecord;

class FakeCache implements CacheStore {
  values = new Map<string, string>();
  async connect() {}
  async disconnect() {}
  async get(key: string) {
    return this.values.get(key) ?? null;
  }
  async set(key: string, value: string) {
    this.values.set(key, value);
  }
  async del(key: string) {
    this.values.delete(key);
  }
  async deleteByPrefix(prefix: string) {
    for (const key of this.values.keys()) if (key.startsWith(prefix)) this.values.delete(key);
  }
  async health() {
    return 'ok' as const;
  }
}

class FakeCategories implements CategoryRepository {
  findManyCalls = 0;
  async findMany() {
    this.findManyCalls += 1;
    return [category];
  }
  async findById() {
    return category;
  }
  async findByName() {
    return null;
  }
  async create(input: { name: string; description?: string | null }) {
    return { ...category, ...input };
  }
  async update(id: string, input: { name: string; description?: string | null }) {
    return { ...category, id, ...input };
  }
  async delete() {}
  async count() {
    return 1;
  }
}

class FakeProducts implements ProductRepository {
  findManyCalls = 0;
  updateCalls = 0;
  async findMany(_query: ProductListQuery) {
    this.findManyCalls += 1;
    return { items: [product], totalItems: 1 };
  }
  async findById() {
    return product;
  }
  async create(input: ProductInput) {
    return { ...product, ...input };
  }
  async update() {
    this.updateCalls += 1;
    return product;
  }
  async updateImage() {
    return product;
  }
  async delete() {}
  async count() {
    return 1;
  }
  async countInStock() {
    return 1;
  }
  async countOutOfStock() {
    return 0;
  }
}

const query: ProductListQuery = { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' };
const input: ProductInput = {
  name: product.name,
  description: product.description,
  price: 100,
  stock: 4,
  categoryId: category.id,
};

describe('catalog service caching', () => {
  it('serves repeated product lists from cache', async () => {
    const cache = new FakeCache();
    const products = new FakeProducts();
    const service = new ProductService(products, new FakeCategories(), cache);
    await service.list(query);
    await service.list(query);
    expect(products.findManyCalls).toBe(1);
  });
  it('invalidates product detail and list caches after update', async () => {
    const cache = new FakeCache();
    const products = new FakeProducts();
    const service = new ProductService(products, new FakeCategories(), cache);
    await service.get(product.id);
    await service.list(query);
    expect(cache.values.size).toBe(2);
    await service.update(product.id, input);
    expect(cache.values.size).toBe(0);
  });
  it('falls back to the repository when cache is unavailable', async () => {
    const cache = new FakeCache();
    cache.get = async () => {
      throw new Error('Redis down');
    };
    const products = new FakeProducts();
    const service = new ProductService(products, new FakeCategories(), cache);
    await service.list(query);
    expect(products.findManyCalls).toBe(1);
  });
  it('caches category lists and invalidates them after mutation', async () => {
    const cache = new FakeCache();
    const categories = new FakeCategories();
    const service = new CategoryService(categories, cache);
    await service.list();
    await service.list();
    expect(categories.findManyCalls).toBe(1);
    await service.update(category.id, { name: 'Audio', description: null });
    expect(cache.values.size).toBe(0);
  });
});
