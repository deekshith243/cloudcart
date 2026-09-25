export const awsConfig = {
  region: process.env.AWS_REGION,
  s3Bucket: process.env.AWS_S3_BUCKET,
  sqsQueueUrl: process.env.AWS_SQS_ORDER_QUEUE_URL,
  snsTopicArn: process.env.AWS_SNS_ORDER_TOPIC_ARN,
};

export const isAwsConfigured = (value: string | undefined): value is string =>
  Boolean(value?.trim());
