/**
 * Pure price parser: finds the first price (amount + currency) in a text
 * selection. No DOM or extension APIs — fully unit-testable.
 */

export interface ParsedPrice {
  amount: number;
  /** ISO 4217 code chosen for the match. */
  currency: string;
  /** Other plausible currencies when the symbol is ambiguous (e.g. `$`). */
  alternatives: string[];
  /** The exact substring that matched. */
  raw: string;
}

export interface ParserOptions {
  /**
   * Overrides for ambiguous symbols, keyed by symbol group
   * (e.g. `{ $: 'CAD', '¥': 'CNY', Rs: 'INR', kr: 'NOK' }`).
   */
  symbolDefaults?: Record<string, string>;
}

/** ISO 4217 codes we accept. Matches open.er-api.com coverage for majors. */
export const CURRENCY_CODES = new Set([
  'AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN',
  'BAM', 'BBD', 'BDT', 'BGN', 'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BRL',
  'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHF', 'CLP', 'CNY',
  'COP', 'CRC', 'CUP', 'CVE', 'CZK', 'DJF', 'DKK', 'DOP', 'DZD', 'EGP',
  'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL', 'GHS', 'GIP', 'GMD',
  'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HRK', 'HTG', 'HUF', 'IDR', 'ILS',
  'INR', 'IQD', 'IRR', 'ISK', 'JMD', 'JOD', 'JPY', 'KES', 'KGS', 'KHR',
  'KMF', 'KRW', 'KWD', 'KYD', 'KZT', 'LAK', 'LBP', 'LKR', 'LRD', 'LSL',
  'LYD', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP', 'MRU', 'MUR',
  'MVR', 'MWK', 'MXN', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO', 'NOK', 'NPR',
  'NZD', 'OMR', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN', 'PYG', 'QAR',
  'RON', 'RSD', 'RUB', 'RWF', 'SAR', 'SBD', 'SCR', 'SDG', 'SEK', 'SGD',
  'SHP', 'SLE', 'SOS', 'SRD', 'SSP', 'STN', 'SYP', 'SZL', 'THB', 'TJS',
  'TMT', 'TND', 'TOP', 'TRY', 'TTD', 'TWD', 'TZS', 'UAH', 'UGX', 'USD',
  'UYU', 'UZS', 'VES', 'VND', 'VUV', 'WST', 'XAF', 'XCD', 'XOF', 'XPF',
  'YER', 'ZAR', 'ZMW', 'ZWL',
]);

interface CurrencyGroup {
  default: string;
  all: string[];
}

/**
 * Ambiguous symbol groups, keyed by the identifier used for settings
 * overrides. `Rs` defaults to LKR here; the settings layer re-defaults it
 * from the browser locale (INR for en-IN, PKR for ur-PK, ...).
 */
export const SYMBOL_GROUPS: Record<string, CurrencyGroup> = {
  $: { default: 'USD', all: ['USD', 'CAD', 'AUD', 'NZD', 'SGD', 'HKD', 'MXN'] },
  '¥': { default: 'JPY', all: ['JPY', 'CNY'] },
  Rs: { default: 'LKR', all: ['LKR', 'INR', 'PKR', 'NPR'] },
  kr: { default: 'SEK', all: ['SEK', 'NOK', 'DKK', 'ISK'] },
};

/** Symbol literal → group key (ambiguous) or fixed ISO code. */
const SYMBOLS: Array<{ literal: string; key: string }> = [
  { literal: 'US$', key: 'USD' },
  { literal: 'AU$', key: 'AUD' },
  { literal: 'A$', key: 'AUD' },
  { literal: 'CA$', key: 'CAD' },
  { literal: 'C$', key: 'CAD' },
  { literal: 'NZ$', key: 'NZD' },
  { literal: 'HK$', key: 'HKD' },
  { literal: 'NT$', key: 'TWD' },
  { literal: 'S$', key: 'SGD' },
  { literal: 'R$', key: 'BRL' },
  { literal: 'MX$', key: 'MXN' },
  { literal: '$', key: '$' },
  { literal: '€', key: 'EUR' },
  { literal: '£', key: 'GBP' },
  { literal: '¥', key: '¥' },
  { literal: '₹', key: 'INR' },
  { literal: '₩', key: 'KRW' },
  { literal: '₽', key: 'RUB' },
  { literal: '₺', key: 'TRY' },
  { literal: '₦', key: 'NGN' },
  { literal: '฿', key: 'THB' },
  { literal: '₫', key: 'VND' },
  { literal: '₱', key: 'PHP' },
  { literal: '₪', key: 'ILS' },
  { literal: '₴', key: 'UAH' },
  { literal: '৳', key: 'BDT' },
  { literal: 'Rs.', key: 'Rs' },
  { literal: 'Rs', key: 'Rs' },
  { literal: '₨', key: 'Rs' },
  { literal: 'kr', key: 'kr' },
  { literal: 'zł', key: 'PLN' },
  { literal: 'Kč', key: 'CZK' },
  { literal: 'Ft', key: 'HUF' },
  { literal: 'RM', key: 'MYR' },
  { literal: 'Rp', key: 'IDR' },
  { literal: 'lei', key: 'RON' },
];

// A number: either grouped (1,234 / 1.234,56 / 1 50 000-style) or a plain
// digit run, each with an optional 1-4 digit decimal part.
const NUM = String.raw`(?:\d{1,3}(?:[.,'’    ]\d{2,3})+(?:[.,]\d{1,4})?|\d+(?:[.,]\d{1,4})?)`;

// Optional magnitude suffix. The trailing lookahead stops "kettles" from
// being read as "k".
const SUFFIX = String.raw`(?:\s?([cC]rore|[cC]r|[lL]akh|[lL]ac|[bB]n|[mM]n|[kKmMbB]))?(?![\p{L}])`;

const SUFFIX_MULTIPLIERS: Record<string, number> = {
  k: 1e3,
  m: 1e6,
  mn: 1e6,
  b: 1e9,
  bn: 1e9,
  lakh: 1e5,
  lac: 1e5,
  cr: 1e7,
  crore: 1e7,
};

const MAX_INPUT_LENGTH = 500;
const MAX_AMOUNT = 1e15;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface Matcher {
  regex: RegExp;
  key: string; // group key or ISO code; 'ISO' means read code from match
  numGroup: number;
  suffixGroup?: number;
  codeGroup?: number;
}

const MATCHERS: Matcher[] = [];

for (const { literal, key } of SYMBOLS) {
  const sym = escapeRegExp(literal);
  MATCHERS.push({
    regex: new RegExp(`(?<![\\p{L}\\p{N}])${sym}\\s?(${NUM})${SUFFIX}`, 'gu'),
    key,
    numGroup: 1,
    suffixGroup: 2,
  });
  MATCHERS.push({
    regex: new RegExp(`(${NUM})\\s?${sym}(?![\\p{L}\\p{N}])`, 'gu'),
    key,
    numGroup: 1,
  });
}

// ISO codes must be uppercase: "USD 49" matches, "all 40" must not.
MATCHERS.push({
  regex: new RegExp(`(?<![A-Za-z])([A-Z]{3})\\s?(${NUM})${SUFFIX}`, 'gu'),
  key: 'ISO',
  codeGroup: 1,
  numGroup: 2,
  suffixGroup: 3,
});
MATCHERS.push({
  regex: new RegExp(`(${NUM})\\s?([A-Z]{3})(?![A-Za-z])`, 'gu'),
  key: 'ISO',
  numGroup: 1,
  codeGroup: 2,
});

/**
 * Turns a raw numeric token into a number, resolving grouping vs decimal
 * separators. `1,234` and `1.234` are read as grouping (three trailing
 * digits); `12,34` and `12.34` as decimals.
 */
export function parseAmount(token: string): number | null {
  let s = token.replace(/[    '’]/g, '');
  const commas = (s.match(/,/g) ?? []).length;
  const dots = (s.match(/\./g) ?? []).length;

  if (commas > 0 && dots > 0) {
    const decimal = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.';
    const grouping = decimal === ',' ? '.' : ',';
    if ((decimal === ',' ? commas : dots) > 1) return null;
    s = s.split(grouping).join('').replace(decimal, '.');
  } else if (commas === 1 || dots === 1) {
    const sep = commas === 1 ? ',' : '.';
    const digitsAfter = s.length - s.indexOf(sep) - 1;
    s = digitsAfter === 3 ? s.replace(sep, '') : s.replace(sep, '.');
  } else if (commas > 1) {
    s = s.split(',').join('');
  } else if (dots > 1) {
    s = s.split('.').join('');
  }

  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0 || n > MAX_AMOUNT) return null;
  return n;
}

interface Candidate {
  index: number;
  raw: string;
  amount: number;
  currency: string;
  alternatives: string[];
}

function resolveCurrency(
  key: string,
  overrides: Record<string, string>,
): { currency: string; alternatives: string[] } {
  const group = SYMBOL_GROUPS[key];
  if (!group) return { currency: key, alternatives: [] };
  const override = overrides[key];
  const currency =
    override && CURRENCY_CODES.has(override) ? override : group.default;
  return {
    currency,
    alternatives: group.all.filter((c) => c !== currency),
  };
}

export function parsePrice(
  text: string,
  options: ParserOptions = {},
): ParsedPrice | null {
  if (!text) return null;
  const input = text.slice(0, MAX_INPUT_LENGTH);
  const overrides = options.symbolDefaults ?? {};

  let best: Candidate | null = null;

  for (const matcher of MATCHERS) {
    matcher.regex.lastIndex = 0;
    for (const m of input.matchAll(matcher.regex)) {
      let currency: string;
      let alternatives: string[];

      if (matcher.key === 'ISO') {
        const code = m[matcher.codeGroup!];
        if (!CURRENCY_CODES.has(code)) continue;
        currency = code;
        alternatives = [];
      } else {
        ({ currency, alternatives } = resolveCurrency(matcher.key, overrides));
      }

      let amount = parseAmount(m[matcher.numGroup]);
      if (amount === null) continue;

      const suffix = matcher.suffixGroup ? m[matcher.suffixGroup] : undefined;
      if (suffix) amount *= SUFFIX_MULTIPLIERS[suffix.toLowerCase()];
      if (amount > MAX_AMOUNT) continue;

      const candidate: Candidate = {
        index: m.index!,
        raw: m[0],
        amount,
        currency,
        alternatives,
      };

      if (
        !best ||
        candidate.index < best.index ||
        (candidate.index === best.index && candidate.raw.length > best.raw.length)
      ) {
        best = candidate;
      }
    }
  }

  if (!best) return null;
  const { amount, currency, alternatives, raw } = best;
  return { amount, currency, alternatives, raw };
}
