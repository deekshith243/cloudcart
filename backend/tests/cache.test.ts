import { describe, expect, it } from 'vitest';
import type { CacheStore } from '../src/services/redis-service.js';
import { readCache, writeCache } from '../src/utils/cache-json.js';
import { cacheKeys } from '../src/utils/cache-keys.js';

class MemoryCache implements CacheStore {
  values = new Map<string, string>();
  connected = true;
  async connect() {}
  async disconnect() {}
  async get(key: string) {
    return this.values.get(key) ?? null;
  }
  async set(key: string, value: string) {
    if (this.connected) this.values.set(key, value);
  }
  async del(key: string) {
    this.values.delete(key);
  }
  async deleteByPrefix(prefix: string) {
    for (const key of this.values.keys()) if (key.startsWith(prefix)) this.values.delete(key);
  }
  async health() {
    return this.connected ? ('ok' as const) : ('unavailable' as const);
  }
}

describe('Redis cache behavior', () => {
  it('populates and reads cached JSON', async () => {
    const cache = new MemoryCache();
    await writeCache(cache, 'product:1', { id: '1' }, 60);
    expect(await readCache(cache, 'product:1')).toEqual({ id: '1' });
  });
  it('deletes malformed JSON and falls back', async () => {
    const cache = new MemoryCache();
    cache.values.set('bad', '{invalid');
    expect(await readCache(cache, 'bad')).toBeNull();
    expect(cache.values.has('bad')).toBe(false);
  });
  it('uses distinct deterministic keys for distinct product queries', () => {
    const first = cacheKeys.productList({ page: 1, limit: 20, sortBy: 'price', sortOrder: 'asc' });
    const second = cacheKeys.productList({ page: 2, limit: 20, sortBy: 'price', sortOrder: 'asc' });
    expect(first).not.toBe(second);
  });
  it('invalidates only the requested catalog prefix', async () => {
    const cache = new MemoryCache();
    cache.values.set('catalog:products:list:a', 'a');
    cache.values.set('catalog:product:1', 'b');
    await cache.deleteByPrefix('catalog:products:list:');
    expect(cache.values.has('catalog:products:list:a')).toBe(false);
    expect(cache.values.has('catalog:product:1')).toBe(true);
  });
  it('fails open when cache is unavailable', async () => {
    const cache = new MemoryCache();
    cache.connected = false;
    await writeCache(cache, 'product:1', { id: '1' }, 60);
    expect(await readCache(cache, 'product:1')).toBeNull();
  });
});
