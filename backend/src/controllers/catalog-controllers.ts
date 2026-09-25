import type { Request, Response } from 'express';
import type { CategoryService } from '../services/category-service.js';
import type { ProductService } from '../services/product-service.js';
import {
  createCategorySchema,
  createProductSchema,
  productQuerySchema,
  updateCategorySchema,
  updateProductSchema,
  uuidParamSchema,
} from '../validation/catalog.js';

export class CategoryController {
  constructor(private readonly service: CategoryService) {}

  list = async (_request: Request, response: Response): Promise<void> => {
    response.json({ success: true, data: await this.service.list() });
  };
  get = async (request: Request, response: Response): Promise<void> => {
    const { id } = uuidParamSchema.parse(request.params);
    response.json({ success: true, data: await this.service.get(id) });
  };
  create = async (request: Request, response: Response): Promise<void> => {
    const category = await this.service.create(createCategorySchema.parse(request.body));
    response.status(201).json({ success: true, data: category });
  };
  update = async (request: Request, response: Response): Promise<void> => {
    const { id } = uuidParamSchema.parse(request.params);
    const category = await this.service.update(id, updateCategorySchema.parse(request.body));
    response.json({ success: true, data: category });
  };
  delete = async (request: Request, response: Response): Promise<void> => {
    const { id } = uuidParamSchema.parse(request.params);
    await this.service.delete(id);
    response.status(204).send();
  };
}

export class ProductController {
  constructor(private readonly service: ProductService) {}

  list = async (request: Request, response: Response): Promise<void> => {
    const data = await this.service.list(productQuerySchema.parse(request.query));
    response.json({ success: true, data });
  };
  get = async (request: Request, response: Response): Promise<void> => {
    const { id } = uuidParamSchema.parse(request.params);
    response.json({ success: true, data: await this.service.get(id) });
  };
  create = async (request: Request, response: Response): Promise<void> => {
    const product = await this.service.create(createProductSchema.parse(request.body));
    response.status(201).json({ success: true, data: product });
  };
  update = async (request: Request, response: Response): Promise<void> => {
    const { id } = uuidParamSchema.parse(request.params);
    const product = await this.service.update(id, updateProductSchema.parse(request.body));
    response.json({ success: true, data: product });
  };
  delete = async (request: Request, response: Response): Promise<void> => {
    const { id } = uuidParamSchema.parse(request.params);
    await this.service.delete(id);
    response.status(204).send();
  };
}
