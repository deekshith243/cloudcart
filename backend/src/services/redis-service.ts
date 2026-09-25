import { createClient, type RedisClientType } from 'redis';

export interface CacheStore {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  deleteByPrefix(prefix: string): Promise<void>;
  health(): Promise<'ok' | 'unavailable' | 'disabled'>;
}

export class RedisCacheService implements CacheStore {
  private readonly client: RedisClientType;
  private connected = false;
  private readonly enabled: boolean;

  constructor(private readonly url = process.env.REDIS_URL) {
    this.enabled = Boolean(url);
    this.client = createClient({ url }) as RedisClientType;
    this.client.on('error', (error: unknown) => console.warn('Redis cache unavailable', error));
  }

  async connect(): Promise<void> {
    if (!this.enabled || this.connected) return;
    try {
      await this.client.connect();
      this.connected = true;
    } catch (error) {
      console.warn('Redis connection failed; continuing without cache', error);
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    try {
      await this.client.quit();
    } catch (error) {
      console.warn('Redis disconnect failed', error);
    } finally {
      this.connected = false;
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.connected) return null;
    try {
      return await this.client.get(key);
    } catch (error) {
      console.warn(`Redis GET failed for ${key}`, error);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (!this.connected) return;
    try {
      await this.client.set(key, value, { EX: ttlSeconds });
    } catch (error) {
      console.warn(`Redis SET failed for ${key}`, error);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.connected) return;
    try {
      await this.client.del(key);
    } catch (error) {
      console.warn(`Redis DEL failed for ${key}`, error);
    }
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    if (!this.connected) return;
    try {
      for await (const key of this.client.scanIterator({ MATCH: `${prefix}*`, COUNT: 100 })) {
        await this.client.del(key);
      }
    } catch (error) {
      console.warn(`Redis prefix invalidation failed for ${prefix}`, error);
    }
  }

  async health(): Promise<'ok' | 'unavailable' | 'disabled'> {
    if (!this.enabled) return 'disabled';
    if (!this.connected) return 'unavailable';
    try {
      await this.client.ping();
      return 'ok';
    } catch {
      return 'unavailable';
    }
  }
}

export const redisCache = new RedisCacheService();
