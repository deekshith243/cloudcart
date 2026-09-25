import type { OrderCreatedEvent, OrderEventPublisher } from './sqs-service.js';

export class SafeOrderEventPublisher implements OrderEventPublisher {
  constructor(private readonly publisher: OrderEventPublisher) {}

  async publishOrderCreated(event: OrderCreatedEvent): Promise<void> {
    try {
      await this.publisher.publishOrderCreated(event);
    } catch (error) {
      console.error('ORDER_CREATED event publish failed', error);
    }
  }
}
