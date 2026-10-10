import { Prisma, type OrderStatus, type PrismaClient, type Product } from '@prisma/client';
import { AppError } from '../errors/app-error.js';

export type OrderItemRecord = {
  id: string;
  productId: string;
  quantity: number;
  priceAtPurchase: number;
  product: Pick<Product, 'id' | 'name' | 'imageUrl'>;
};

export type OrderRecord = {
  id: string;
  userId: string;
  status: OrderStatus;
  totalAmount: number;
  createdAt: Date;
  updatedAt: Date;
  user?: { id: string; name: string; email: string };
  items: OrderItemRecord[];
};

export type OrderListQuery = { page: number; limit: number; status?: OrderStatus };
export type OrderListResult = { items: OrderRecord[]; totalItems: number };

export interface OrderRepository {
  createFromCart(userId: string): Promise<OrderRecord>;
  findByUserId(userId: string, query: OrderListQuery): Promise<OrderListResult>;
  findByIdForUser(userId: string, orderId: string): Promise<OrderRecord | null>;
  findMany(query: OrderListQuery): Promise<OrderListResult>;
  findById(orderId: string): Promise<OrderRecord | null>;
  updateStatus(orderId: string, status: OrderStatus): Promise<OrderRecord>;
}

const itemInclude = {
  items: { include: { product: { select: { id: true, name: true, imageUrl: true } } } },
} as const;

const detailInclude = {
  ...itemInclude,
  user: { select: { id: true, name: true, email: true } },
} as const;

type OrderWithDetails = Prisma.OrderGetPayload<{ include: typeof detailInclude }>;

const mapOrder = (order: OrderWithDetails): OrderRecord => ({
  id: order.id,
  userId: order.userId,
  status: order.status,
  totalAmount: Number(order.totalAmount),
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
  user: order.user,
  items: order.items.map((item) => ({
    id: item.id,
    productId: item.productId,
    quantity: item.quantity,
    priceAtPurchase: Number(item.priceAtPurchase),
    product: item.product,
  })),
});

export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly client: PrismaClient) {}

  async createFromCart(userId: string): Promise<OrderRecord> {
    const order = await this.client.$transaction(async (transaction) => {
      const cart = await transaction.cart.findUnique({
        where: { userId },
        include: { items: { include: { product: true } } },
      });

      if (!cart || cart.items.length === 0) {
        throw new AppError(400, 'Cannot create an order from an empty cart');
      }

      let total = new Prisma.Decimal(0);

      for (const item of cart.items) {
        if (item.quantity > item.product.stock) {
          throw new AppError(409, `Insufficient stock for ${item.product.name}`);
        }

        total = total.add(item.product.price.mul(item.quantity));
      }

      for (const item of cart.items) {
        const updated = await transaction.product.updateMany({
          where: {
            id: item.productId,
            stock: { gte: item.quantity },
          },
          data: {
            stock: { decrement: item.quantity },
          },
        });

        if (updated.count !== 1) {
          throw new AppError(409, `Insufficient stock for ${item.product.name}`);
        }
      }

      const created = await transaction.order.create({
        data: {
          userId,
          totalAmount: total,
          status: 'PENDING',
          items: {
            create: cart.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              priceAtPurchase: item.product.price,
            })),
          },
        },
        include: detailInclude,
      });

      await transaction.cartItem.deleteMany({
        where: { cartId: cart.id },
      });

      return created;
    });

    return mapOrder(order);
  }

  async findByUserId(
    userId: string,
    query: OrderListQuery,
  ): Promise<OrderListResult> {
    const where = { userId, status: query.status };

    const [items, totalItems] = await Promise.all([
      this.client.order.findMany({
        where,
        include: detailInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.client.order.count({ where }),
    ]);

    return { items: items.map(mapOrder), totalItems };
  }

  async findByIdForUser(
    userId: string,
    orderId: string,
  ): Promise<OrderRecord | null> {
    const order = await this.client.order.findFirst({
      where: { id: orderId, userId },
      include: detailInclude,
    });

    return order ? mapOrder(order) : null;
  }

  async findMany(query: OrderListQuery): Promise<OrderListResult> {
    const where = { status: query.status };

    const [items, totalItems] = await Promise.all([
      this.client.order.findMany({
        where,
        include: detailInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.client.order.count({ where }),
    ]);

    return { items: items.map(mapOrder), totalItems };
  }

  async findById(orderId: string): Promise<OrderRecord | null> {
    const order = await this.client.order.findUnique({
      where: { id: orderId },
      include: detailInclude,
    });

    return order ? mapOrder(order) : null;
  }

  async updateStatus(
    orderId: string,
    status: OrderStatus,
  ): Promise<OrderRecord> {
    const order = await this.client.$transaction(async (transaction) => {
      if (status !== 'CANCELLED') {
        return transaction.order.update({
          where: { id: orderId },
          data: { status },
          include: detailInclude,
        });
      }

      const existing = await transaction.order.findUnique({
        where: { id: orderId },
        include: detailInclude,
      });

      if (!existing) {
        throw new AppError(404, 'Order not found');
      }

      // A previously cancelled order must never restore stock twice.
      if (existing.status === 'CANCELLED') {
        return existing;
      }

      // Only PENDING and PROCESSING orders may be cancelled.
      const updated = await transaction.order.updateMany({
        where: {
          id: orderId,
          status: {
            in: ['PENDING', 'PROCESSING'],
          },
        },
        data: { status: 'CANCELLED' },
      });

      if (updated.count !== 1) {
        throw new AppError(409, 'Order can no longer be cancelled');
      }

      for (const item of existing.items) {
        const restored = await transaction.product.updateMany({
          where: { id: item.productId },
          data: {
            stock: { increment: item.quantity },
          },
        });

        if (restored.count !== 1) {
          throw new AppError(409, 'Could not restore product stock');
        }
      }

      return transaction.order.findUniqueOrThrow({
        where: { id: orderId },
        include: detailInclude,
      });
    });

    return mapOrder(order);
  }
}
