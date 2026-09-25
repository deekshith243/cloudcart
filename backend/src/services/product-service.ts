import { Prisma } from '@prisma/client';
import { AppError } from '../errors/app-error.js';
import type { CategoryRepository } from '../repositories/category-repository.js';
import type { ProductRepository } from '../repositories/product-repository.js';
import type { ProductInput, ProductQuery } from '../validation/catalog.js';
import { redisCache, type CacheStore } from './redis-service.js';
import { cacheKeys, cacheTtls } from '../utils/cache-keys.js';
import { readCache, writeCache } from '../utils/cache-json.js';
import type { ImageStorage, ImageUpload } from './s3-service.js';

export class ProductService {
  constructor(
    private readonly products: ProductRepository,
    private readonly categories: CategoryRepository,
    private readonly cache: CacheStore = redisCache,
    private readonly imageStorage?: ImageStorage,
  ) {}

  async list(query: ProductQuery) {
    const key = cacheKeys.productList(query);
    const cached = await readCache<Awaited<ReturnType<ProductService['listFromDatabase']>>>(
      this.cache,
      key,
    );
    if (cached) return cached;
    const result = await this.listFromDatabase(query);
    await writeCache(this.cache, key, result, cacheTtls.productList());
    return result;
  }

  private async listFromDatabase(query: ProductQuery) {
    const result = await this.products.findMany(query);
    return {
      items: result.items,
      pagination: {
        page: query.page,
        limit: query.limit,
        totalItems: result.totalItems,
        totalPages: Math.ceil(result.totalItems / query.limit),
      },
    };
  }

  async get(id: string) {
    const key = cacheKeys.product(id);
    const cached = await readCache<Awaited<ReturnType<ProductService['getFromDatabase']>>>(
      this.cache,
      key,
    );
    if (cached) return cached;
    const product = await this.getFromDatabase(id);
    await writeCache(this.cache, key, product, cacheTtls.product());
    return product;
  }

  private async getFromDatabase(id: string) {
    const product = await this.products.findById(id);
    if (!product) throw new AppError(404, 'Product not found');
    return product;
  }

  async create(input: ProductInput) {
    await this.ensureCategory(input.categoryId);
    try {
      const product = await this.products.create(this.normalize(input));
      await this.invalidateCatalog();
      return product;
    } catch (error) {
      this.handlePrismaError(error);
      throw error;
    }
  }

  async update(id: string, input: ProductInput) {
    await this.get(id);
    await this.ensureCategory(input.categoryId);
    try {
      const product = await this.products.update(id, this.normalize(input));
      await this.invalidateCatalog(id);
      return product;
    } catch (error) {
      this.handlePrismaError(error);
      throw error;
    }
  }

  async delete(id: string) {
    const product = await this.get(id);
    try {
      await this.products.delete(id);
      await this.invalidateCatalog(id);
      if (product.imageUrl && this.imageStorage) {
        await this.imageStorage.deleteObject(product.imageUrl).catch((error) => {
          console.warn('Product image cleanup failed', error);
        });
      }
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new AppError(
          409,
          'Product cannot be deleted because it is referenced by order history',
        );
      }
      throw error;
    }
  }

  async uploadImage(id: string, input: Omit<ImageUpload, 'productId'>) {
    if (!this.imageStorage) throw new AppError(503, 'Image storage is not configured');
    const product = await this.get(id);
    const oldImageReference = product.imageUrl;
    const reference = await this.imageStorage.uploadObject({ ...input, productId: id });
    try {
      const updated = await this.products.updateImage(id, reference);
      await this.invalidateCatalog(id);
      if (oldImageReference) {
        await this.imageStorage.deleteObject(oldImageReference).catch((error) => {
          console.warn('Previous product image cleanup failed', error);
        });
      }
      return updated;
    } catch (error) {
      await this.imageStorage.deleteObject(reference).catch(() => undefined);
      throw error;
    }
  }

  async stats() {
    const [totalProducts, totalCategories, productsInStock, productsOutOfStock] = await Promise.all(
      [
        this.products.count(),
        this.categories.count(),
        this.products.countInStock(),
        this.products.countOutOfStock(),
      ],
    );
    return { totalProducts, totalCategories, productsInStock, productsOutOfStock };
  }

  private async ensureCategory(categoryId: string): Promise<void> {
    if (!(await this.categories.findById(categoryId)))
      throw new AppError(400, 'Category not found');
  }

  private normalize(input: ProductInput): ProductInput {
    return {
      ...input,
      name: input.name.trim(),
      description: input.description.trim(),
      imageUrl: input.imageUrl || null,
    };
  }

  private handlePrismaError(error: unknown): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError(409, 'Product name already exists in this category');
    }
  }

  private async invalidateCatalog(productId?: string): Promise<void> {
    try {
      if (productId) await this.cache.del(cacheKeys.product(productId));
      await this.cache.deleteByPrefix(cacheKeys.productListPrefix);
    } catch (error) {
      console.warn('Product cache invalidation failed', error);
    }
  }
}
