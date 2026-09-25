import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { awsConfig, isAwsConfigured } from '../config/aws.js';
import type { OrderCreatedEvent } from './sqs-service.js';

export interface NotificationPublisher {
  publishOrderCreated(event: OrderCreatedEvent): Promise<void>;
}

export class SnsNotificationService implements NotificationPublisher {
  private readonly client = new SNSClient({ region: awsConfig.region });

  async publishOrderCreated(event: OrderCreatedEvent): Promise<void> {
    if (!isAwsConfigured(awsConfig.region) || !isAwsConfigured(awsConfig.snsTopicArn)) return;
    await this.client.send(
      new PublishCommand({
        TopicArn: awsConfig.snsTopicArn,
        Message: JSON.stringify(event),
        MessageAttributes: { eventType: { DataType: 'String', StringValue: event.eventType } },
      }),
    );
  }
}
