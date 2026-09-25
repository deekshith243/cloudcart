import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi, catalogApi } from './api';

const storage = new Map<string, string>();

globalThis.sessionStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => void storage.set(key, value),
  removeItem: (key: string) => void storage.delete(key),
  clear: () => void storage.clear(),
  key: (index: number) => [...storage.keys()][index] ?? null,
  get length() {
    return storage.size;
  },
} as Storage;

describe('frontend auth API', () => {
  beforeEach(() => {
    storage.clear();
    vi.restoreAllMocks();
  });

  it('stores the access token after login and sends it to /me', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              user: { id: '1', name: 'Jane', email: 'jane@example.com', role: 'CUSTOMER' },
              token: 'token-123',
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: { id: '1', name: 'Jane', email: 'jane@example.com', role: 'CUSTOMER' },
          }),
          { status: 200 },
        ),
      );

    await authApi.login('jane@example.com', 'Password123!');
    const user = await authApi.me();

    expect(user.email).toBe('jane@example.com');
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      headers: expect.objectContaining({ Authorization: 'Bearer token-123' }),
    });
  });

  it('clears the access token on logout', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            user: { id: '1', name: 'Jane', email: 'jane@example.com', role: 'CUSTOMER' },
            token: 'token-123',
          },
        }),
        { status: 200 },
      ),
    );
    await authApi.login('jane@example.com', 'Password123!');

    authApi.logout();

    expect(authApi.hasToken()).toBe(false);
  });

  it('requests the public product listing with query parameters', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: { items: [], pagination: { page: 1, limit: 9, totalItems: 0, totalPages: 0 } },
        }),
        { status: 200 },
      ),
    );

    await catalogApi.listProducts('search=speaker&limit=9');

    expect(fetchMock.mock.calls[0]?.[0]).toContain('/api/v1/products?search=speaker&limit=9');
  });
});
