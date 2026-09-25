import type { ProductQuery } from '../validation/catalog.js';

export const cacheKeys = {
  product: (id: string) => `catalog:product:${id}`,
  productList: (query: ProductQuery) => {
    const normalized = new URLSearchParams({
      page: String(query.page),
      limit: String(query.limit),
      categoryId: query.categoryId ?? '',
      minPrice: query.minPrice === undefined ? '' : String(query.minPrice),
      maxPrice: query.maxPrice === undefined ? '' : String(query.maxPrice),
      inStock: query.inStock === undefined ? '' : String(query.inStock),
      search: query.search ?? '',
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });
    return `catalog:products:list:${normalized.toString()}`;
  },
  productListPrefix: 'catalog:products:list:',
  categories: () => 'catalog:categories',
  category: (id: string) => `catalog:category:${id}`,
  categoryPrefix: 'catalog:category:',
};

export const cacheTtls = {
  product: () => Number(process.env.REDIS_PRODUCT_TTL_SECONDS ?? 300),
  productList: () => Number(process.env.REDIS_PRODUCT_LIST_TTL_SECONDS ?? 60),
  category: () => Number(process.env.REDIS_CATEGORY_TTL_SECONDS ?? 300),
};
