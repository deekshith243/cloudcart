import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SQSClient,
  type Message,
} from '@aws-sdk/client-sqs';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { parseOrderCreatedEvent, workerAwsConfig, type OrderCreatedEvent } from './aws.js';

export interface QueueClient {
  receive(): Promise<Message[]>;
  delete(receiptHandle: string): Promise<void>;
}
export interface NotificationClient {
  publish(event: OrderCreatedEvent): Promise<void>;
}

export class AwsQueueClient implements QueueClient {
  private readonly client = new SQSClient({ region: workerAwsConfig.region });
  async receive(): Promise<Message[]> {
    if (!workerAwsConfig.queueUrl) return [];
    const response = await this.client.send(
      new ReceiveMessageCommand({
        QueueUrl: workerAwsConfig.queueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 10,
        VisibilityTimeout: 30,
      }),
    );
    return response.Messages ?? [];
  }
  async delete(receiptHandle: string): Promise<void> {
    if (workerAwsConfig.queueUrl)
      await this.client.send(
        new DeleteMessageCommand({
          QueueUrl: workerAwsConfig.queueUrl,
          ReceiptHandle: receiptHandle,
        }),
      );
  }
}

export class AwsNotificationClient implements NotificationClient {
  private readonly client = new SNSClient({ region: workerAwsConfig.region });
  async publish(event: OrderCreatedEvent): Promise<void> {
    if (!workerAwsConfig.topicArn) return;
    await this.client.send(
      new PublishCommand({
        TopicArn: workerAwsConfig.topicArn,
        Message: JSON.stringify(event),
        MessageAttributes: { eventType: { DataType: 'String', StringValue: event.eventType } },
      }),
    );
  }
}

export class OrderEventConsumer {
  private readonly processed = new Set<string>();
  constructor(
    private readonly queue: QueueClient,
    private readonly notifications: NotificationClient,
  ) {}

  async processMessage(message: Message): Promise<boolean> {
    if (!message.Body || !message.ReceiptHandle) return false;
    const event = parseOrderCreatedEvent(message.Body);
    if (!event) {
      console.error('Invalid order event; leaving message for retry or DLQ');
      return false;
    }
    if (this.processed.has(event.orderId)) {
      await this.queue.delete(message.ReceiptHandle);
      return true;
    }
    try {
      console.log(JSON.stringify({ event: 'order_event_received', orderId: event.orderId }));
      await this.notifications.publish(event);
      this.processed.add(event.orderId);
      await this.queue.delete(message.ReceiptHandle);
      console.log(JSON.stringify({ event: 'order_event_processed', orderId: event.orderId }));
      return true;
    } catch (error) {
      console.error(
        JSON.stringify({
          event: 'order_event_failed',
          orderId: event.orderId,
          error: String(error),
        }),
      );
      return false;
    }
  }

  async pollOnce(): Promise<void> {
    for (const message of await this.queue.receive()) await this.processMessage(message);
  }
}
