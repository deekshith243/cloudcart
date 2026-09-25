import type { Category, PrismaClient } from '@prisma/client';

export type CategoryRecord = Pick<
  Category,
  'id' | 'name' | 'description' | 'createdAt' | 'updatedAt'
>;

type CategoryInput = { name: string; description?: string | null };

export interface CategoryRepository {
  findMany(): Promise<CategoryRecord[]>;
  findById(id: string): Promise<CategoryRecord | null>;
  findByName(name: string): Promise<CategoryRecord | null>;
  create(input: CategoryInput): Promise<CategoryRecord>;
  update(id: string, input: CategoryInput): Promise<CategoryRecord>;
  delete(id: string): Promise<void>;
  count(): Promise<number>;
}

export class PrismaCategoryRepository implements CategoryRepository {
  constructor(private readonly client: PrismaClient) {}

  findMany(): Promise<CategoryRecord[]> {
    return this.client.category.findMany({ orderBy: { name: 'asc' } });
  }

  findById(id: string): Promise<CategoryRecord | null> {
    return this.client.category.findUnique({ where: { id } });
  }

  findByName(name: string): Promise<CategoryRecord | null> {
    return this.client.category.findUnique({ where: { name } });
  }

  create(input: CategoryInput): Promise<CategoryRecord> {
    return this.client.category.create({ data: input });
  }

  update(id: string, input: CategoryInput): Promise<CategoryRecord> {
    return this.client.category.update({ where: { id }, data: input });
  }

  async delete(id: string): Promise<void> {
    await this.client.category.delete({ where: { id } });
  }

  count(): Promise<number> {
    return this.client.category.count();
  }
}
