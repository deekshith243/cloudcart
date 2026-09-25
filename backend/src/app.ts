import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import type { RequestHandler } from 'express';
import { AdminCatalogController } from './controllers/admin-catalog-controller.js';
import { AuthController } from './controllers/auth-controller.js';
import { CategoryController, ProductController } from './controllers/catalog-controllers.js';
import { ImageController } from './controllers/image-controller.js';
import { CartController, OrderController } from './controllers/commerce-controllers.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';
import { PrismaUserRepository } from './repositories/user-repository.js';
import { createAdminRouter } from './routes/admin-routes.js';
import { createCategoryRouter, createProductRouter } from './routes/catalog-routes.js';
import { createCartRouter, createOrderRouter } from './routes/commerce-routes.js';
import { createImageRouter } from './routes/image-routes.js';
import { createAuthRouter } from './routes/auth-routes.js';
import { customerRouter } from './routes/customer-routes.js';
import { AuthService } from './services/auth-service.js';
import { CategoryService } from './services/category-service.js';
import { ProductService } from './services/product-service.js';
import { CartService } from './services/cart-service.js';
import { OrderService } from './services/order-service.js';
import { prisma } from './lib/prisma.js';
import type { UserRepository } from './repositories/user-repository.js';
import {
  PrismaCategoryRepository,
  type CategoryRepository,
} from './repositories/category-repository.js';
import {
  PrismaProductRepository,
  type ProductRepository,
} from './repositories/product-repository.js';
import { JwtService } from './utils/jwt.js';
import { PrismaCartRepository, type CartRepository } from './repositories/cart-repository.js';
import { PrismaOrderRepository, type OrderRepository } from './repositories/order-repository.js';
import { redisCache, type CacheStore } from './services/redis-service.js';
import { S3ImageService } from './services/s3-service.js';
import { SqsOrderEventService } from './services/sqs-service.js';

export const createApp = (
  userRepository: UserRepository = new PrismaUserRepository(prisma),
  options: {
    authRateLimiter?: RequestHandler;
    categoryRepository?: CategoryRepository;
    productRepository?: ProductRepository;
    cartRepository?: CartRepository;
    orderRepository?: OrderRepository;
    cache?: CacheStore;
    imageStorage?: import('./services/s3-service.js').ImageStorage;
  } = {},
) => {
  const app = express();
  const authService = new AuthService(userRepository, new JwtService());
  const authController = new AuthController(authService);
  const categoryRepository = options.categoryRepository ?? new PrismaCategoryRepository(prisma);
  const productRepository = options.productRepository ?? new PrismaProductRepository(prisma);
  const cache = options.cache ?? redisCache;
  const categoryController = new CategoryController(new CategoryService(categoryRepository, cache));
  const imageStorage = options.imageStorage ?? new S3ImageService();
  const productService = new ProductService(
    productRepository,
    categoryRepository,
    cache,
    imageStorage,
  );
  const productController = new ProductController(productService);
  const adminController = new AdminCatalogController(productService);
  const cartRepository = options.cartRepository ?? new PrismaCartRepository(prisma);
  const orderRepository = options.orderRepository ?? new PrismaOrderRepository(prisma);
  const cartController = new CartController(new CartService(cartRepository, productRepository));
  const orderController = new OrderController(
    new OrderService(orderRepository, new SqsOrderEventService()),
  );
  const imageController = new ImageController(productService);

  app.use(helmet());
  const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://localhost:4173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.use(cors({ origin: allowedOrigins }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', async (_request, response) => {
    response.json({
      service: 'cloudcart-api',
      status: 'ok',
      dependencies: { redis: await cache.health() },
    });
  });

  app.use('/api/v1/auth', createAuthRouter(authController, options.authRateLimiter));
  app.use('/api/v1/categories', createCategoryRouter(categoryController));
  app.use('/api/v1/products', createProductRouter(productController));
  app.use('/api/v1/products', createImageRouter(imageController));
  app.use('/api/v1/cart', createCartRouter(cartController));
  app.use('/api/v1/orders', createOrderRouter(orderController));
  app.use('/api/v1/admin', createAdminRouter(adminController, orderController));
  app.use('/api/v1/customer', customerRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

export const app = createApp();
