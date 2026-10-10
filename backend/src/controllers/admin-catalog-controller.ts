import type { Request, Response } from 'express';
import type { OrderRepository } from '../repositories/order-repository.js';
import type { ProductService } from '../services/product-service.js';

export class AdminCatalogController {
  constructor(
    private readonly products: ProductService,
    private readonly orders: OrderRepository,
  ) {}

  dashboard = async (_request: Request, response: Response) => {
    const [productStats, orderStats] = await Promise.all([
      this.products.stats(),
      this.orders.getDashboardStats(),
    ]);
    response.json({ success: true, data: { ...productStats, ...orderStats } });
  };
}
