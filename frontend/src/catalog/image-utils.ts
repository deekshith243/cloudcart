import { catalogApi } from '../auth/api';

const IMAGE_URL_TIMEOUT_MS = 8_000;
const IMAGE_URL_CACHE_TTL_MS = 5 * 60_000;
const resolvedImageUrls = new Map<string, { url: string | null; expiresAt: number }>();
const pendingImageUrls = new Map<string, Promise<string | null>>();

export const resolveImageSource = async (
  productId: string,
  imageReference: string | null,
): Promise<string | null> => {
  if (!imageReference) return null;
  if (!imageReference.startsWith('s3://')) return imageReference;

  const cacheKey = `${productId}:${imageReference}`;
  const cached = resolvedImageUrls.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const pending = pendingImageUrls.get(cacheKey);
  if (pending) return pending;

  const resolution = (async () => {
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), IMAGE_URL_TIMEOUT_MS);
    try {
      const response = await catalogApi.getProductImageUrl(productId, controller.signal);
      const url = response.data.url;
      resolvedImageUrls.set(cacheKey, {
        url,
        expiresAt: Date.now() + IMAGE_URL_CACHE_TTL_MS,
      });
      return url;
    } finally {
      globalThis.clearTimeout(timeout);
    }
  })();

  pendingImageUrls.set(cacheKey, resolution);
  try {
    return await resolution;
  } finally {
    pendingImageUrls.delete(cacheKey);
  }
};
