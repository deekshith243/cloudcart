import type { Request, Response } from 'express';
import type { ProductService } from '../services/product-service.js';

export class AdminCatalogController {
  constructor(private readonly products: ProductService) {}

  dashboard = async (_request: Request, response: Response) => {
    response.json({ success: true, data: await this.products.stats() });
  };
}
