import { SYMBOL_GROUPS } from './parser';

export interface Settings {
  homeCurrency: string;
  /** Ambiguous-symbol resolution, keyed by symbol group ($, ¥, Rs, kr). */
  symbolDefaults: Record<string, string>;
}

export const SETTINGS_KEY = 'settings';

/** Locale region → currency for first-run guessing. */
const REGION_CURRENCY: Record<string, string> = {
  AE: 'AED', AR: 'ARS', AT: 'EUR', AU: 'AUD', BD: 'BDT', BE: 'EUR',
  BR: 'BRL', CA: 'CAD', CH: 'CHF', CL: 'CLP', CN: 'CNY', CO: 'COP',
  CZ: 'CZK', DE: 'EUR', DK: 'DKK', EG: 'EGP', ES: 'EUR', FI: 'EUR',
  FR: 'EUR', GB: 'GBP', GR: 'EUR', HK: 'HKD', HU: 'HUF', ID: 'IDR',
  IE: 'EUR', IL: 'ILS', IN: 'INR', IS: 'ISK', IT: 'EUR', JP: 'JPY',
  KE: 'KES', KR: 'KRW', LK: 'LKR', MX: 'MXN', MY: 'MYR', NG: 'NGN',
  NL: 'EUR', NO: 'NOK', NP: 'NPR', NZ: 'NZD', PH: 'PHP', PK: 'PKR',
  PL: 'PLN', PT: 'EUR', QA: 'QAR', RO: 'RON', RU: 'RUB', SA: 'SAR',
  SE: 'SEK', SG: 'SGD', TH: 'THB', TR: 'TRY', TW: 'TWD', UA: 'UAH',
  US: 'USD', VN: 'VND', ZA: 'ZAR',
};

export function guessHomeCurrency(locale: string): string {
  const region = locale.split('-')[1]?.toUpperCase();
  return (region && REGION_CURRENCY[region]) || 'USD';
}

export function defaultSettings(locale: string): Settings {
  const homeCurrency = guessHomeCurrency(locale);
  const symbolDefaults: Record<string, string> = {};
  for (const [key, group] of Object.entries(SYMBOL_GROUPS)) {
    symbolDefaults[key] = group.all.includes(homeCurrency)
      ? homeCurrency
      : group.default;
  }
  return { homeCurrency, symbolDefaults };
}
