import type { Request, Response } from 'express';
import type { CartService } from '../services/cart-service.js';
import type { OrderService } from '../services/order-service.js';
import {
  adminOrderQuerySchema,
  cartItemSchema,
  cartQuantitySchema,
  itemIdParamSchema,
  orderIdParamSchema,
  orderQuerySchema,
  orderStatusSchema,
} from '../validation/commerce.js';
import { AppError } from '../errors/app-error.js';

const userId = (request: Request): string => {
  if (!request.auth) throw new AppError(401, 'Authentication required');
  return request.auth.id;
};

export class CartController {
  constructor(private readonly cart: CartService) {}
  get = async (request: Request, response: Response): Promise<void> => {
    response.json({ success: true, data: await this.cart.get(userId(request)) });
  };
  add = async (request: Request, response: Response): Promise<void> => {
    response.status(201).json({
      success: true,
      data: await this.cart.add(userId(request), cartItemSchema.parse(request.body)),
    });
  };
  update = async (request: Request, response: Response): Promise<void> => {
    const { itemId } = itemIdParamSchema.parse(request.params);
    response.json({
      success: true,
      data: await this.cart.update(userId(request), itemId, cartQuantitySchema.parse(request.body)),
    });
  };
  remove = async (request: Request, response: Response): Promise<void> => {
    const { itemId } = itemIdParamSchema.parse(request.params);
    await this.cart.remove(userId(request), itemId);
    response.status(204).send();
  };
  clear = async (request: Request, response: Response): Promise<void> => {
    await this.cart.clear(userId(request));
    response.json({ success: true, data: null });
  };
}

export class OrderController {
  constructor(private readonly orders: OrderService) {}
  create = async (request: Request, response: Response): Promise<void> => {
    response.status(201).json({ success: true, data: await this.orders.create(userId(request)) });
  };
  list = async (request: Request, response: Response): Promise<void> => {
    const query = orderQuerySchema.parse(request.query);
    response.json({ success: true, data: await this.orders.listForUser(userId(request), query) });
  };
  get = async (request: Request, response: Response): Promise<void> => {
    const { id } = orderIdParamSchema.parse(request.params);
    response.json({ success: true, data: await this.orders.getForUser(userId(request), id) });
  };
  adminList = async (request: Request, response: Response): Promise<void> => {
    const query = adminOrderQuerySchema.parse(request.query);
    response.json({ success: true, data: await this.orders.listForAdmin(query) });
  };
  adminGet = async (request: Request, response: Response): Promise<void> => {
    const { id } = orderIdParamSchema.parse(request.params);
    response.json({ success: true, data: await this.orders.getForAdmin(id) });
  };
  adminStatus = async (request: Request, response: Response): Promise<void> => {
    const { id } = orderIdParamSchema.parse(request.params);
    const { status } = orderStatusSchema.parse(request.body);
    response.json({ success: true, data: await this.orders.updateStatus(id, status) });
  };
}
