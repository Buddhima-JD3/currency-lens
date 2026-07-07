/**
 * Exchange-rate fetching, caching, and conversion. Storage, fetch, and clock
 * are injected so the module stays unit-testable; the background worker wires
 * in `browser.storage.local` and real `fetch`.
 */

export interface RateTable {
  base: 'USD';
  /** Units of each currency per 1 USD. */
  rates: Record<string, number>;
  fetchedAt: number;
  provider: string;
}

export interface KVStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

export interface RatesDeps {
  store: KVStore;
  fetchFn?: typeof fetch;
  now?: () => number;
}

export const RATES_TTL_MS = 12 * 60 * 60 * 1000;
export const CACHE_KEY = 'rateTable';

interface Provider {
  name: string;
  url: string;
  parse(body: unknown): Record<string, number>;
}

const PROVIDERS: Provider[] = [
  {
    name: 'open.er-api.com',
    url: 'https://open.er-api.com/v6/latest/USD',
    parse(body) {
      const data = body as { result?: string; rates?: Record<string, number> };
      if (data.result !== 'success' || !data.rates) {
        throw new Error('unexpected er-api response');
      }
      return { ...data.rates, USD: 1 };
    },
  },
  {
    name: 'frankfurter.dev',
    url: 'https://api.frankfurter.dev/v1/latest?base=USD',
    parse(body) {
      const data = body as { rates?: Record<string, number> };
      if (!data.rates) throw new Error('unexpected frankfurter response');
      return { ...data.rates, USD: 1 };
    },
  },
];

async function fetchFromProviders(
  fetchFn: typeof fetch,
  now: number,
): Promise<RateTable> {
  let lastError: unknown;
  for (const provider of PROVIDERS) {
    try {
      const response = await fetchFn(provider.url);
      if (!response.ok) throw new Error(`${provider.name}: HTTP ${response.status}`);
      const rates = provider.parse(await response.json());
      return { base: 'USD', rates, fetchedAt: now, provider: provider.name };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error('all rate providers failed');
}

/**
 * Returns the rate table: fresh cache if within TTL, otherwise a new fetch
 * (with provider fallback), otherwise stale cache with `stale: true`.
 * Throws only when there are no rates available at all.
 */
export async function getRates(
  deps: RatesDeps,
): Promise<{ table: RateTable; stale: boolean }> {
  const { store, fetchFn = fetch, now = Date.now } = deps;
  const cached = (await store.get(CACHE_KEY)) as RateTable | undefined;
  const currentTime = now();

  if (cached && currentTime - cached.fetchedAt < RATES_TTL_MS) {
    return { table: cached, stale: false };
  }

  try {
    const table = await fetchFromProviders(fetchFn, currentTime);
    await store.set(CACHE_KEY, table);
    return { table, stale: false };
  } catch (error) {
    if (cached) return { table: cached, stale: true };
    throw error;
  }
}

export function convert(
  table: RateTable,
  amount: number,
  from: string,
  to: string,
): number | null {
  const fromRate = table.rates[from];
  const toRate = table.rates[to];
  if (!fromRate || !toRate) return null;
  return (amount / fromRate) * toRate;
}
