import { Prisma } from '@prisma/client';
import { AppError } from '../errors/app-error.js';
import type { CategoryRepository } from '../repositories/category-repository.js';
import type { CategoryInput } from '../validation/catalog.js';
import { redisCache, type CacheStore } from './redis-service.js';
import { cacheKeys, cacheTtls } from '../utils/cache-keys.js';
import { readCache, writeCache } from '../utils/cache-json.js';

export class CategoryService {
  constructor(
    private readonly categories: CategoryRepository,
    private readonly cache: CacheStore = redisCache,
  ) {}

  async list() {
    const key = cacheKeys.categories();
    const cached = await readCache<Awaited<ReturnType<CategoryRepository['findMany']>>>(
      this.cache,
      key,
    );
    if (cached) return cached;
    const categories = await this.categories.findMany();
    await writeCache(this.cache, key, categories, cacheTtls.category());
    return categories;
  }

  async get(id: string) {
    const key = cacheKeys.category(id);
    const cached = await readCache<Awaited<ReturnType<CategoryRepository['findById']>>>(
      this.cache,
      key,
    );
    if (cached) return cached;
    const category = await this.categories.findById(id);
    if (!category) throw new AppError(404, 'Category not found');
    await writeCache(this.cache, key, category, cacheTtls.category());
    return category;
  }

  async create(input: CategoryInput) {
    const name = input.name.trim();
    if (await this.categories.findByName(name))
      throw new AppError(409, 'Category name already exists');
    try {
      const category = await this.categories.create({
        name,
        description: input.description?.trim() || null,
      });
      await this.invalidateCatalog();
      return category;
    } catch (error) {
      this.handlePrismaError(error);
      throw error;
    }
  }

  async update(id: string, input: CategoryInput) {
    await this.get(id);
    const name = input.name.trim();
    const existing = await this.categories.findByName(name);
    if (existing && existing.id !== id) throw new AppError(409, 'Category name already exists');
    try {
      const category = await this.categories.update(id, {
        name,
        description: input.description?.trim() || null,
      });
      await this.invalidateCatalog(id);
      return category;
    } catch (error) {
      this.handlePrismaError(error);
      throw error;
    }
  }

  async delete(id: string) {
    await this.get(id);
    try {
      await this.categories.delete(id);
      await this.invalidateCatalog(id);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new AppError(409, 'Category cannot be deleted while products reference it');
      }
      throw error;
    }
  }

  private handlePrismaError(error: unknown): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError(409, 'Category name already exists');
    }
  }

  private async invalidateCatalog(categoryId?: string): Promise<void> {
    try {
      await this.cache.del(cacheKeys.categories());
      if (categoryId) await this.cache.del(cacheKeys.category(categoryId));
      await this.cache.deleteByPrefix(cacheKeys.productListPrefix);
    } catch (error) {
      console.warn('Category cache invalidation failed', error);
    }
  }
}
