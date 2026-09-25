import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import type { CategoryRepository } from '../src/repositories/category-repository.js';
import type {
  ProductInput,
  ProductListQuery,
  ProductRepository,
  ProductRecord,
} from '../src/repositories/product-repository.js';
import { ProductService } from '../src/services/product-service.js';
import type { ImageStorage } from '../src/services/s3-service.js';
import type { CacheStore } from '../src/services/redis-service.js';
import { OrderService } from '../src/services/order-service.js';
import type { OrderRepository, OrderRecord } from '../src/repositories/order-repository.js';
import { SafeOrderEventPublisher } from '../src/services/order-events.js';
import { imageUploadSchema } from '../src/validation/image.js';

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
  stock: 2,
  imageUrl: 's3://bucket/products/product-1/old.png',
  categoryId: category.id,
  category,
  createdAt: new Date(),
  updatedAt: new Date(),
} as ProductRecord;
class Cache implements CacheStore {
  async connect() {}
  async disconnect() {}
  async get() {
    return null;
  }
  async set() {}
  async del() {}
  async deleteByPrefix() {}
  async health() {
    return 'ok' as const;
  }
}
class Categories implements CategoryRepository {
  async findMany() {
    return [category];
  }
  async findById() {
    return category;
  }
  async findByName() {
    return null;
  }
  async create() {
    return category;
  }
  async update() {
    return category;
  }
  async delete() {}
  async count() {
    return 1;
  }
}
class Products implements ProductRepository {
  async findMany(_query: ProductListQuery) {
    return { items: [product], totalItems: 1 };
  }
  async findById() {
    return product;
  }
  async create(input: ProductInput) {
    return { ...product, ...input };
  }
  async update() {
    return product;
  }
  async updateImage(_id: string, imageUrl: string) {
    product.imageUrl = imageUrl;
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
class Images implements ImageStorage {
  uploaded: string[] = [];
  deleted: string[] = [];
  async uploadObject() {
    const reference = 's3://bucket/products/product-1/new.png';
    this.uploaded.push(reference);
    return reference;
  }
  async deleteObject(reference: string) {
    this.deleted.push(reference);
  }
}
const input = { body: Buffer.from('image'), contentType: 'image/png', extension: 'png' };

describe('AWS-backed application boundaries', () => {
  it('accepts supported image metadata and rejects unsupported files', () => {
    expect(
      imageUploadSchema.parse({ mimeType: 'image/png', size: 100, extension: 'png' }).mimeType,
    ).toBe('image/png');
    expect(() =>
      imageUploadSchema.parse({ mimeType: 'application/pdf', size: 100, extension: 'pdf' }),
    ).toThrow();
    expect(() =>
      imageUploadSchema.parse({ mimeType: 'image/png', size: 6 * 1024 * 1024, extension: 'png' }),
    ).toThrow();
  });
  it('replaces an image and cleans up the old reference', async () => {
    const images = new Images();
    const service = new ProductService(new Products(), new Categories(), new Cache(), images);
    const updated = await service.uploadImage(product.id, input);
    expect(updated.imageUrl).toContain('/new.png');
    expect(images.uploaded).toHaveLength(1);
    expect(images.deleted).toEqual(['s3://bucket/products/product-1/old.png']);
  });
  it('publishes an order event after order creation and does not block on publish failure', async () => {
    const order: OrderRecord = {
      id: 'order-1',
      userId: 'user-1',
      status: 'PENDING',
      totalAmount: 10,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [],
    };
    const repository: OrderRepository = {
      createFromCart: async () => order,
      findByUserId: async () => ({ items: [], totalItems: 0 }),
      findByIdForUser: async () => order,
      findMany: async () => ({ items: [], totalItems: 0 }),
      findById: async () => order,
      updateStatus: async () => order,
    };
    const events: string[] = [];
    const service = new OrderService(repository, {
      publishOrderCreated: async (event) => events.push(event.orderId),
    });
    await service.create(order.userId);
    expect(events).toEqual(['order-1']);
    const safe = new SafeOrderEventPublisher({
      publishOrderCreated: async () => {
        throw new Error('SQS down');
      },
    });
    await expect(
      safe.publishOrderCreated({
        eventType: 'ORDER_CREATED',
        orderId: 'order-1',
        userId: 'user-1',
        timestamp: new Date().toISOString(),
      }),
    ).resolves.toBeUndefined();
  });
});
