import { z } from 'zod';

export const imageMimeTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const imageUploadSchema = z.object({
  mimeType: z.enum(imageMimeTypes),
  size: z
    .number()
    .int()
    .positive()
    .max(5 * 1024 * 1024),
  extension: z.enum(['jpg', 'jpeg', 'png', 'webp']),
});
