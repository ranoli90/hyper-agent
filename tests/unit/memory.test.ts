import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Memory Module', () => {
  let mockStorage: Record<string, any> = {};

  beforeEach(() => {
    mockStorage = {};
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: vi.fn((keys: string | string[] | null) => {
            if (keys === null) return Promise.resolve(mockStorage);
            if (Array.isArray(keys)) {
              const result: Record<string, any> = {};
              for (const key of keys) {
                if (key in mockStorage) result[key] = mockStorage[key];
              }
              return Promise.resolve(result);
            }
            return Promise.resolve(
              mockStorage[keys as string]
                ? { [keys as string]: mockStorage[keys as string] }
                : {},
            );
          }),
          set: vi.fn((data: Record<string, any>) => {
            Object.assign(mockStorage, data);
            return Promise.resolve();
          }),
          remove: vi.fn((keys: string | string[]) => {
            const list = Array.isArray(keys) ? keys : [keys];
            for (const key of list) delete mockStorage[key];
            return Promise.resolve();
          }),
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('applies shorter TTL for selected high-churn domains', async () => {
    const { __test_getDomainTTL } = await import('../../shared/memory');

    const amazonTtl = __test_getDomainTTL('amazon.com');
    const facebookTtl = __test_getDomainTTL('facebook.com');
    const defaultTtl = __test_getDomainTTL('example.com');

    // Sanity: all TTLs are positive
    expect(amazonTtl).toBeGreaterThan(0);
    expect(facebookTtl).toBeGreaterThan(0);
    expect(defaultTtl).toBeGreaterThan(0);

    // Amazon should use a shorter TTL than the default (7 days vs ~30 days)
    expect(amazonTtl).toBeLessThan(defaultTtl);

    // Social sites should typically be shorter or equal to default
    expect(facebookTtl).toBeLessThanOrEqual(defaultTtl);
  });
}

