import { OrderStatus } from '@prisma/client';
import { AppError } from '../errors/app-error.js';
import type {
  OrderListQuery,
  OrderRecord,
  OrderRepository,
} from '../repositories/order-repository.js';
import type { OrderEventPublisher } from './sqs-service.js';

const transitions: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  PROCESSING: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  SHIPPED: [OrderStatus.DELIVERED],
  DELIVERED: [],
  CANCELLED: [],
};

export class OrderService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly events?: OrderEventPublisher,
  ) {}

  async create(userId: string): Promise<OrderRecord> {
    const order = await this.orders.createFromCart(userId);
    if (this.events) {
      try {
        await this.events.publishOrderCreated({
          eventType: 'ORDER_CREATED',
          orderId: order.id,
          userId: order.userId,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('ORDER_CREATED event publish failed', error);
      }
    }
    return order;
  }

  async listForUser(userId: string, query: OrderListQuery) {
    return this.withPagination(await this.orders.findByUserId(userId, query), query);
  }

  async getForUser(userId: string, orderId: string) {
    const order = await this.orders.findByIdForUser(userId, orderId);
    if (!order) throw new AppError(404, 'Order not found');
    return order;
  }

  async listForAdmin(query: OrderListQuery) {
    return this.withPagination(await this.orders.findMany(query), query);
  }

  async getForAdmin(orderId: string) {
    const order = await this.orders.findById(orderId);
    if (!order) throw new AppError(404, 'Order not found');
    return order;
  }

  async updateStatus(orderId: string, status: OrderStatus) {
    const order = await this.getForAdmin(orderId);
    if (order.status !== status && !transitions[order.status].includes(status)) {
      throw new AppError(409, `Cannot transition order from ${order.status} to ${status}`);
    }
    return this.orders.updateStatus(orderId, status);
  }

  private withPagination(
    result: { items: OrderRecord[]; totalItems: number },
    query: OrderListQuery,
  ) {
    return {
      items: result.items,
      pagination: {
        page: query.page,
        limit: query.limit,
        totalItems: result.totalItems,
        totalPages: Math.ceil(result.totalItems / query.limit),
      },
    };
  }
}
