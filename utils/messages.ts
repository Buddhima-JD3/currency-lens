import type { RateTable } from './rates';

export const GET_RATES = 'currency-lens:get-rates';

export interface GetRatesRequest {
  type: typeof GET_RATES;
}

export type GetRatesResponse =
  | { ok: true; table: RateTable; stale: boolean }
  | { ok: false; error: string };
