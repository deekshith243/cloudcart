export const workerAwsConfig = {
  region: process.env.AWS_REGION,
  queueUrl: process.env.AWS_SQS_ORDER_QUEUE_URL,
  topicArn: process.env.AWS_SNS_ORDER_TOPIC_ARN,
};

export type OrderCreatedEvent = {
  eventType: 'ORDER_CREATED';
  orderId: string;
  userId: string;
  timestamp: string;
};

export const parseOrderCreatedEvent = (body: string): OrderCreatedEvent | null => {
  try {
    const value = JSON.parse(body) as Partial<OrderCreatedEvent>;
    if (
      value.eventType !== 'ORDER_CREATED' ||
      typeof value.orderId !== 'string' ||
      typeof value.userId !== 'string' ||
      typeof value.timestamp !== 'string'
    )
      return null;
    return value as OrderCreatedEvent;
  } catch {
    return null;
  }
};
