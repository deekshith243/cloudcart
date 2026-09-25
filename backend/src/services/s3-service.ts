import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { awsConfig, isAwsConfigured } from '../config/aws.js';
import { AppError } from '../errors/app-error.js';

export type ImageUpload = {
  productId: string;
  body: Buffer;
  contentType: string;
  extension: string;
};
export interface ImageStorage {
  uploadObject(input: ImageUpload): Promise<string>;
  deleteObject(reference: string): Promise<void>;
}

export class S3ImageService implements ImageStorage {
  private readonly client = new S3Client({ region: awsConfig.region });

  async uploadObject(input: ImageUpload): Promise<string> {
    if (!isAwsConfigured(awsConfig.region) || !isAwsConfigured(awsConfig.s3Bucket)) {
      throw new AppError(503, 'Image storage is not configured');
    }
    const key = `products/${input.productId}/${randomUUID()}.${input.extension}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: awsConfig.s3Bucket,
        Key: key,
        Body: input.body,
        ContentType: input.contentType,
      }),
    );
    return `s3://${awsConfig.s3Bucket}/${key}`;
  }

  async deleteObject(reference: string): Promise<void> {
    const parsed = this.parseReference(reference);
    if (!parsed || !isAwsConfigured(awsConfig.region) || !isAwsConfigured(awsConfig.s3Bucket))
      return;
    await this.client.send(new DeleteObjectCommand({ Bucket: parsed.bucket, Key: parsed.key }));
  }

  private parseReference(reference: string): { bucket: string; key: string } | null {
    if (!reference.startsWith('s3://')) return null;
    const withoutScheme = reference.slice('s3://'.length);
    const separator = withoutScheme.indexOf('/');
    if (separator < 1) return null;
    return { bucket: withoutScheme.slice(0, separator), key: withoutScheme.slice(separator + 1) };
  }
}
