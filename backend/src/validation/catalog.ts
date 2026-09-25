import { z } from 'zod';

export const uuidParamSchema = z.object({ id: z.uuid() });

const categoryFields = {
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).nullable().optional(),
};

export const createCategorySchema = z.object(categoryFields);
export const updateCategorySchema = createCategorySchema;

const productFields = {
  name: z.string().trim().min(2).max(150),
  description: z.string().trim().min(2).max(2000),
  price: z.coerce.number().finite().positive(),
  stock: z.coerce.number().int().nonnegative(),
  imageUrl: z.string().url().max(2048).nullable().optional(),
  categoryId: z.uuid(),
};

export const createProductSchema = z.object(productFields);
export const updateProductSchema = createProductSchema;

export const productQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    categoryId: z.uuid().optional(),
    minPrice: z.coerce.number().finite().nonnegative().optional(),
    maxPrice: z.coerce.number().finite().nonnegative().optional(),
    inStock: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
    search: z.string().trim().max(150).optional(),
    sortBy: z.enum(['name', 'price', 'stock', 'createdAt']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .superRefine((query, context) => {
    if (
      query.minPrice !== undefined &&
      query.maxPrice !== undefined &&
      query.minPrice > query.maxPrice
    ) {
      context.addIssue({
        code: 'custom',
        path: ['maxPrice'],
        message: 'maxPrice must be greater than or equal to minPrice',
      });
    }
  });

export type CategoryInput = z.infer<typeof createCategorySchema>;
export type ProductInput = z.infer<typeof createProductSchema>;
export type ProductQuery = z.infer<typeof productQuerySchema>;
