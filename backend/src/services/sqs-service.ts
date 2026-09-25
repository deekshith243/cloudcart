import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { awsConfig, isAwsConfigured } from '../config/aws.js';

export type OrderCreatedEvent = {
  eventType: 'ORDER_CREATED';
  orderId: string;
  userId: string;
  timestamp: string;
};
export interface OrderEventPublisher {
  publishOrderCreated(event: OrderCreatedEvent): Promise<void>;
}

export class SqsOrderEventService implements OrderEventPublisher {
  private readonly client = new SQSClient({ region: awsConfig.region });

  async publishOrderCreated(event: OrderCreatedEvent): Promise<void> {
    if (!isAwsConfigured(awsConfig.region) || !isAwsConfigured(awsConfig.sqsQueueUrl)) return;
    await this.client.send(
      new SendMessageCommand({
        QueueUrl: awsConfig.sqsQueueUrl,
        MessageBody: JSON.stringify(event),
        MessageAttributes: { eventType: { DataType: 'String', StringValue: event.eventType } },
      }),
    );
  }
}
