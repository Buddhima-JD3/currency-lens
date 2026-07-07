import { describe, expect, it, vi } from 'vitest';
import {
  CACHE_KEY,
  RATES_TTL_MS,
  type KVStore,
  type RateTable,
  convert,
  getRates,
} from './rates';

function memoryStore(initial: Record<string, unknown> = {}): KVStore {
  const map = new Map(Object.entries(initial));
  return {
    get: async (key) => map.get(key),
    set: async (key, value) => {
      map.set(key, value);
    },
  };
}

function okJson(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

const ER_API_BODY = {
  result: 'success',
  rates: { USD: 1, EUR: 0.9, LKR: 300, JPY: 150 },
};

const FRANKFURTER_BODY = {
  base: 'USD',
  rates: { EUR: 0.91, JPY: 151 },
};

const NOW = 1_750_000_000_000;

function cachedTable(fetchedAt: number): RateTable {
  return {
    base: 'USD',
    rates: { USD: 1, EUR: 0.85, LKR: 290 },
    fetchedAt,
    provider: 'test-cache',
  };
}

describe('getRates', () => {
  it('fetches from er-api and caches when cache is empty', async () => {
    const store = memoryStore();
    const fetchFn = vi.fn(async (_url: RequestInfo | URL) => okJson(ER_API_BODY));

    const { table, stale } = await getRates({ store, fetchFn, now: () => NOW });

    expect(stale).toBe(false);
    expect(table.rates.LKR).toBe(300);
    expect(table.rates.USD).toBe(1);
    expect(table.fetchedAt).toBe(NOW);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(String(fetchFn.mock.calls[0][0])).toContain('open.er-api.com');
    expect(await store.get(CACHE_KEY)).toMatchObject({ fetchedAt: NOW });
  });

  it('returns fresh cache without fetching', async () => {
    const store = memoryStore({ [CACHE_KEY]: cachedTable(NOW - 1000) });
    const fetchFn = vi.fn();

    const { table, stale } = await getRates({ store, fetchFn, now: () => NOW });

    expect(stale).toBe(false);
    expect(table.provider).toBe('test-cache');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('refetches when the cache is older than the TTL', async () => {
    const store = memoryStore({
      [CACHE_KEY]: cachedTable(NOW - RATES_TTL_MS - 1),
    });
    const fetchFn = vi.fn(async () => okJson(ER_API_BODY));

    const { table, stale } = await getRates({ store, fetchFn, now: () => NOW });

    expect(stale).toBe(false);
    expect(table.provider).toBe('open.er-api.com');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('falls back to Frankfurter when er-api fails', async () => {
    const store = memoryStore();
    const fetchFn = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).includes('er-api')) throw new Error('network down');
      return okJson(FRANKFURTER_BODY);
    });

    const { table, stale } = await getRates({ store, fetchFn, now: () => NOW });

    expect(stale).toBe(false);
    expect(table.provider).toBe('frankfurter.dev');
    expect(table.rates.USD).toBe(1); // Frankfurter omits the base; we add it
    expect(table.rates.EUR).toBe(0.91);
  });

  it('returns stale cache when every provider fails', async () => {
    const store = memoryStore({
      [CACHE_KEY]: cachedTable(NOW - RATES_TTL_MS * 10),
    });
    const fetchFn = vi.fn(async () => {
      throw new Error('offline');
    });

    const { table, stale } = await getRates({ store, fetchFn, now: () => NOW });

    expect(stale).toBe(true);
    expect(table.provider).toBe('test-cache');
  });

  it('throws when providers fail and there is no cache', async () => {
    const store = memoryStore();
    const fetchFn = vi.fn(async () => {
      throw new Error('offline');
    });

    await expect(getRates({ store, fetchFn, now: () => NOW })).rejects.toThrow();
  });

  it('treats a non-2xx response as a provider failure', async () => {
    const store = memoryStore();
    const fetchFn = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).includes('er-api')) return new Response('nope', { status: 500 });
      return okJson(FRANKFURTER_BODY);
    });

    const { table } = await getRates({ store, fetchFn, now: () => NOW });
    expect(table.provider).toBe('frankfurter.dev');
  });
});

describe('convert', () => {
  const table = cachedTable(NOW);

  it('converts via the USD base', () => {
    // 100 EUR -> LKR: 100 / 0.85 * 290
    expect(convert(table, 100, 'EUR', 'LKR')).toBeCloseTo((100 / 0.85) * 290);
  });

  it('is identity for same currency', () => {
    expect(convert(table, 42, 'USD', 'USD')).toBe(42);
  });

  it('returns null for unknown currencies', () => {
    expect(convert(table, 100, 'EUR', 'XXX')).toBeNull();
    expect(convert(table, 100, 'XXX', 'EUR')).toBeNull();
  });
});
