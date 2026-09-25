import { describe, expect, it } from 'vitest';
import type { Message } from '@aws-sdk/client-sqs';
import {
  OrderEventConsumer,
  type NotificationClient,
  type QueueClient,
} from '../src/sqs-consumer.js';
import type { OrderCreatedEvent } from '../src/aws.js';

class FakeQueue implements QueueClient {
  messages: Message[] = [];
  deleted: string[] = [];
  async receive() {
    return this.messages;
  }
  async delete(receiptHandle: string) {
    this.deleted.push(receiptHandle);
  }
}
class FakeNotifications implements NotificationClient {
  events: OrderCreatedEvent[] = [];
  fail = false;
  async publish(event: OrderCreatedEvent) {
    if (this.fail) throw new Error('SNS down');
    this.events.push(event);
  }
}
const message = (body: string): Message => ({ Body: body, ReceiptHandle: 'receipt-1' });
const event = {
  eventType: 'ORDER_CREATED',
  orderId: 'order-1',
  userId: 'user-1',
  timestamp: new Date().toISOString(),
} as const;

describe('order event consumer', () => {
  it('publishes valid events and deletes only after success', async () => {
    const queue = new FakeQueue();
    const notifications = new FakeNotifications();
    const consumer = new OrderEventConsumer(queue, notifications);
    expect(await consumer.processMessage(message(JSON.stringify(event)))).toBe(true);
    expect(notifications.events).toHaveLength(1);
    expect(queue.deleted).toEqual(['receipt-1']);
  });
  it('leaves failed SNS messages available for retry', async () => {
    const queue = new FakeQueue();
    const notifications = new FakeNotifications();
    notifications.fail = true;
    const consumer = new OrderEventConsumer(queue, notifications);
    expect(await consumer.processMessage(message(JSON.stringify(event)))).toBe(false);
    expect(queue.deleted).toHaveLength(0);
  });
  it('handles duplicate order events idempotently', async () => {
    const queue = new FakeQueue();
    const notifications = new FakeNotifications();
    const consumer = new OrderEventConsumer(queue, notifications);
    await consumer.processMessage(message(JSON.stringify(event)));
    await consumer.processMessage({
      ...message(JSON.stringify(event)),
      ReceiptHandle: 'receipt-2',
    });
    expect(notifications.events).toHaveLength(1);
    expect(queue.deleted).toEqual(['receipt-1', 'receipt-2']);
  });
  it('does not delete invalid events', async () => {
    const queue = new FakeQueue();
    const consumer = new OrderEventConsumer(queue, new FakeNotifications());
    expect(await consumer.processMessage(message('{bad'))).toBe(false);
    expect(queue.deleted).toHaveLength(0);
  });
});
