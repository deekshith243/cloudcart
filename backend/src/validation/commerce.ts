import { OrderStatus } from '@prisma/client';
import { z } from 'zod';

export const cartItemSchema = z.object({
  productId: z.uuid(),
  quantity: z.coerce.number().int().positive(),
});
export const cartQuantitySchema = z.object({ quantity: z.coerce.number().int().positive() });
export const itemIdParamSchema = z.object({ itemId: z.uuid() });
export const orderIdParamSchema = z.object({ id: z.uuid() });
export const orderQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
export const adminOrderQuerySchema = orderQuerySchema.extend({
  status: z.enum(OrderStatus).optional(),
});
export const orderStatusSchema = z.object({ status: z.enum(OrderStatus) });
export type CartItemInput = z.infer<typeof cartItemSchema>;
export type CartQuantityInput = z.infer<typeof cartQuantitySchema>;
export type OrderQuery = z.infer<typeof orderQuerySchema>;
