import type { Request, Response } from 'express';
import type { ProductService } from '../services/product-service.js';
import { imageUploadSchema } from '../validation/image.js';
import { uuidParamSchema } from '../validation/catalog.js';

export class ImageController {
  constructor(private readonly products: ProductService) {}

  upload = async (request: Request, response: Response): Promise<void> => {
    const file = request.file;
    const { id } = uuidParamSchema.parse(request.params);
    if (!file) {
      response.status(400).json({ success: false, error: 'Image file is required' });
      return;
    }
    const extension = file.originalname.split('.').pop()?.toLowerCase() ?? '';
    imageUploadSchema.parse({ mimeType: file.mimetype, size: file.size, extension });
    const product = await this.products.uploadImage(id, {
      body: file.buffer,
      contentType: file.mimetype,
      extension,
    });
    response.json({ success: true, data: product });
  };
}
