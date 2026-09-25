import type { Category, PrismaClient, Product } from '@prisma/client';

export type ProductRecord = Pick<
  Product,
  | 'id'
  | 'name'
  | 'description'
  | 'price'
  | 'stock'
  | 'imageUrl'
  | 'categoryId'
  | 'createdAt'
  | 'updatedAt'
> & { category: Pick<Category, 'id' | 'name' | 'description'> };

export type ProductInput = {
  name: string;
  description: string;
  price: number;
  stock: number;
  imageUrl?: string | null;
  categoryId: string;
};

export type ProductListQuery = {
  page: number;
  limit: number;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  search?: string;
  sortBy: 'name' | 'price' | 'stock' | 'createdAt';
  sortOrder: 'asc' | 'desc';
};

export type ProductListResult = {
  items: ProductRecord[];
  totalItems: number;
};

export interface ProductRepository {
  findMany(query: ProductListQuery): Promise<ProductListResult>;
  findById(id: string): Promise<ProductRecord | null>;
  create(input: ProductInput): Promise<ProductRecord>;
  update(id: string, input: ProductInput): Promise<ProductRecord>;
  updateImage(id: string, imageUrl: string): Promise<ProductRecord>;
  delete(id: string): Promise<void>;
  count(): Promise<number>;
  countInStock(): Promise<number>;
  countOutOfStock(): Promise<number>;
}

export class PrismaProductRepository implements ProductRepository {
  constructor(private readonly client: PrismaClient) {}

  async findMany(query: ProductListQuery): Promise<ProductListResult> {
    const where = {
      categoryId: query.categoryId,
      price:
        query.minPrice !== undefined || query.maxPrice !== undefined
          ? { gte: query.minPrice, lte: query.maxPrice }
          : undefined,
      stock: query.inStock === undefined ? undefined : query.inStock ? { gt: 0 } : { equals: 0 },
      name: query.search ? { contains: query.search, mode: 'insensitive' as const } : undefined,
    };
    const [items, totalItems] = await Promise.all([
      this.client.product.findMany({
        where,
        include: { category: { select: { id: true, name: true, description: true } } },
        orderBy: { [query.sortBy]: query.sortOrder },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.client.product.count({ where }),
    ]);
    return { items, totalItems };
  }

  findById(id: string): Promise<ProductRecord | null> {
    return this.client.product.findUnique({
      where: { id },
      include: { category: { select: { id: true, name: true, description: true } } },
    });
  }

  create(input: ProductInput): Promise<ProductRecord> {
    return this.client.product.create({
      data: input,
      include: { category: { select: { id: true, name: true, description: true } } },
    });
  }

  update(id: string, input: ProductInput): Promise<ProductRecord> {
    return this.client.product.update({
      where: { id },
      data: input,
      include: { category: { select: { id: true, name: true, description: true } } },
    });
  }

  updateImage(id: string, imageUrl: string): Promise<ProductRecord> {
    return this.client.product.update({
      where: { id },
      data: { imageUrl },
      include: { category: { select: { id: true, name: true, description: true } } },
    });
  }

  async delete(id: string): Promise<void> {
    await this.client.product.delete({ where: { id } });
  }

  count(): Promise<number> {
    return this.client.product.count();
  }

  countInStock(): Promise<number> {
    return this.client.product.count({ where: { stock: { gt: 0 } } });
  }

  countOutOfStock(): Promise<number> {
    return this.client.product.count({ where: { stock: { equals: 0 } } });
  }
}
