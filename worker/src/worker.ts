import 'dotenv/config';
import { OrderEventConsumer, AwsNotificationClient, AwsQueueClient } from './sqs-consumer.js';
import { workerAwsConfig } from './aws.js';

const consumer = new OrderEventConsumer(new AwsQueueClient(), new AwsNotificationClient());
let running = true;

const shutdown = (signal: string) => {
  console.log(`Received ${signal}; shutting down order worker`);
  running = false;
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

const main = async () => {
  if (!workerAwsConfig.queueUrl) {
    console.log('SQS queue is not configured; worker is idle');
    return;
  }
  console.log('CloudCart order worker started');
  while (running) {
    try {
      await consumer.pollOnce();
    } catch (error) {
      console.error('SQS polling failed', error);
    }
  }
};

void main();
