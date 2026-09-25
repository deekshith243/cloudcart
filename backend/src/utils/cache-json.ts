import type { CacheStore } from '../services/redis-service.js';

export const readCache = async <T>(cache: CacheStore, key: string): Promise<T | null> => {
  let value: string | null;
  try {
    value = await cache.get(key);
  } catch {
    return null;
  }
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    try {
      await cache.del(key);
    } catch {
      // A malformed cache entry is still treated as a miss if deletion fails.
    }
    return null;
  }
};

export const writeCache = async <T>(
  cache: CacheStore,
  key: string,
  value: T,
  ttlSeconds: number,
): Promise<void> => {
  try {
    await cache.set(key, JSON.stringify(value), ttlSeconds);
  } catch {
    // Cache writes are best effort; PostgreSQL remains authoritative.
  }
};
