import { describe, expect, it } from 'vitest';
import { parsePrice } from './parser';

describe('parsePrice: symbol before amount', () => {
  it('parses $49.99 as USD', () => {
    expect(parsePrice('$49.99')).toMatchObject({ amount: 49.99, currency: 'USD' });
  });

  it('parses with surrounding text', () => {
    expect(parsePrice('Buy now for $49.99 today!')).toMatchObject({
      amount: 49.99,
      currency: 'USD',
      raw: '$49.99',
    });
  });

  it('parses €120 as EUR', () => {
    expect(parsePrice('€120')).toMatchObject({ amount: 120, currency: 'EUR' });
  });

  it('parses £ 12 with space after symbol', () => {
    expect(parsePrice('£ 12')).toMatchObject({ amount: 12, currency: 'GBP' });
  });

  it('parses ¥3,000 as JPY by default', () => {
    expect(parsePrice('¥3,000')).toMatchObject({ amount: 3000, currency: 'JPY' });
  });

  it('parses ₹500 as INR', () => {
    expect(parsePrice('₹500')).toMatchObject({ amount: 500, currency: 'INR' });
  });

  it('parses ₩10000 as KRW', () => {
    expect(parsePrice('₩10000')).toMatchObject({ amount: 10000, currency: 'KRW' });
  });

  it('parses ฿250 as THB', () => {
    expect(parsePrice('฿250')).toMatchObject({ amount: 250, currency: 'THB' });
  });
});

describe('parsePrice: compound dollar symbols', () => {
  it('parses A$30 as AUD', () => {
    expect(parsePrice('A$30')).toMatchObject({ amount: 30, currency: 'AUD' });
  });

  it('parses C$25.50 as CAD', () => {
    expect(parsePrice('C$25.50')).toMatchObject({ amount: 25.5, currency: 'CAD' });
  });

  it('parses NZ$99 as NZD', () => {
    expect(parsePrice('NZ$99')).toMatchObject({ amount: 99, currency: 'NZD' });
  });

  it('parses HK$1,200 as HKD', () => {
    expect(parsePrice('HK$1,200')).toMatchObject({ amount: 1200, currency: 'HKD' });
  });

  it('parses S$45 as SGD', () => {
    expect(parsePrice('S$45')).toMatchObject({ amount: 45, currency: 'SGD' });
  });

  it('parses R$ 99,90 as BRL with comma decimal', () => {
    expect(parsePrice('R$ 99,90')).toMatchObject({ amount: 99.9, currency: 'BRL' });
  });

  it('parses US$ 1,000 as USD', () => {
    expect(parsePrice('US$ 1,000')).toMatchObject({ amount: 1000, currency: 'USD' });
  });
});

describe('parsePrice: symbol after amount', () => {
  it('parses 49,99 € as EUR with comma decimal', () => {
    expect(parsePrice('49,99 €')).toMatchObject({ amount: 49.99, currency: 'EUR' });
  });

  it('parses 1.234,56 € (European grouping)', () => {
    expect(parsePrice('1.234,56 €')).toMatchObject({ amount: 1234.56, currency: 'EUR' });
  });

  it('parses 100kr as SEK by default', () => {
    expect(parsePrice('100kr')).toMatchObject({ amount: 100, currency: 'SEK' });
  });

  it('parses 25 zł as PLN', () => {
    expect(parsePrice('25 zł')).toMatchObject({ amount: 25, currency: 'PLN' });
  });
});

describe('parsePrice: ISO codes', () => {
  it('parses USD 49', () => {
    expect(parsePrice('USD 49')).toMatchObject({ amount: 49, currency: 'USD' });
  });

  it('parses 49.99 LKR', () => {
    expect(parsePrice('49.99 LKR')).toMatchObject({ amount: 49.99, currency: 'LKR' });
  });

  it('parses 15,000 LKR', () => {
    expect(parsePrice('15,000 LKR')).toMatchObject({ amount: 15000, currency: 'LKR' });
  });

  it('parses EUR 1.234,56', () => {
    expect(parsePrice('EUR 1.234,56')).toMatchObject({ amount: 1234.56, currency: 'EUR' });
  });

  it('does not treat lowercase words as codes ("all 40" is not ALL)', () => {
    expect(parsePrice('all 40')).toBeNull();
  });

  it('rejects unknown 3-letter uppercase strings', () => {
    expect(parsePrice('XYZ 40')).toBeNull();
  });
});

describe('parsePrice: rupee notations', () => {
  it('parses Rs. 15,000 with default rupee currency LKR', () => {
    expect(parsePrice('Rs. 15,000')).toMatchObject({ amount: 15000, currency: 'LKR' });
  });

  it('parses Rs15000 without space', () => {
    expect(parsePrice('Rs15000')).toMatchObject({ amount: 15000, currency: 'LKR' });
  });

  it('parses ₨ 500', () => {
    expect(parsePrice('₨ 500')).toMatchObject({ amount: 500, currency: 'LKR' });
  });

  it('respects rupee override to INR', () => {
    expect(
      parsePrice('Rs. 15,000', { symbolDefaults: { Rs: 'INR' } }),
    ).toMatchObject({ amount: 15000, currency: 'INR' });
  });

  it('offers rupee alternatives', () => {
    const result = parsePrice('Rs 100');
    expect(result?.alternatives).toEqual(expect.arrayContaining(['INR', 'PKR', 'NPR']));
  });

  it('does not match Rs inside a word', () => {
    expect(parsePrice('cars 4000')).toBeNull();
  });
});

describe('parsePrice: separators and grouping', () => {
  it('parses 1,234.56 (US grouping)', () => {
    expect(parsePrice('$1,234.56')).toMatchObject({ amount: 1234.56 });
  });

  it('parses 1 234,56 (space grouping)', () => {
    expect(parsePrice('1 234,56 €')).toMatchObject({ amount: 1234.56 });
  });

  it("parses 1'234.50 (Swiss grouping)", () => {
    expect(parsePrice("CHF 1'234.50")).toMatchObject({ amount: 1234.5, currency: 'CHF' });
  });

  it('parses Indian grouping 1,50,000', () => {
    expect(parsePrice('₹1,50,000')).toMatchObject({ amount: 150000, currency: 'INR' });
  });

  it('treats single separator with 3 trailing digits as grouping', () => {
    expect(parsePrice('$1,234')).toMatchObject({ amount: 1234 });
    expect(parsePrice('€1.234')).toMatchObject({ amount: 1234 });
  });

  it('treats single separator with 2 trailing digits as decimal', () => {
    expect(parsePrice('$12,34')).toMatchObject({ amount: 12.34 });
  });

  it('parses multi-group European numbers', () => {
    expect(parsePrice('€1.234.567')).toMatchObject({ amount: 1234567 });
  });

  it('parses non-breaking-space grouping', () => {
    expect(parsePrice('1 234,56 €')).toMatchObject({ amount: 1234.56 });
  });
});

describe('parsePrice: magnitude suffixes', () => {
  it('parses $1.2k', () => {
    expect(parsePrice('$1.2k')).toMatchObject({ amount: 1200 });
  });

  it('parses €3M', () => {
    expect(parsePrice('€3M')).toMatchObject({ amount: 3_000_000 });
  });

  it('parses $2bn', () => {
    expect(parsePrice('$2bn')).toMatchObject({ amount: 2_000_000_000 });
  });

  it('parses ₹1.5 lakh', () => {
    expect(parsePrice('₹1.5 lakh')).toMatchObject({ amount: 150_000 });
  });

  it('parses Rs 2 crore', () => {
    expect(parsePrice('Rs 2 crore')).toMatchObject({ amount: 20_000_000 });
  });

  it('does not treat a following word starting with k as a suffix', () => {
    expect(parsePrice('$5 kettles')).toMatchObject({ amount: 5 });
  });
});

describe('parsePrice: ambiguity metadata', () => {
  it('returns alternatives for $', () => {
    const result = parsePrice('$100');
    expect(result?.alternatives).toEqual(expect.arrayContaining(['CAD', 'AUD']));
  });

  it('returns no alternatives for unambiguous €', () => {
    expect(parsePrice('€100')?.alternatives).toEqual([]);
  });

  it('respects $ override to CAD', () => {
    expect(parsePrice('$100', { symbolDefaults: { $: 'CAD' } })).toMatchObject({
      currency: 'CAD',
    });
  });

  it('respects ¥ override to CNY', () => {
    expect(parsePrice('¥100', { symbolDefaults: { '¥': 'CNY' } })).toMatchObject({
      currency: 'CNY',
    });
  });
});

describe('parsePrice: non-prices return null', () => {
  it('plain text', () => {
    expect(parsePrice('hello world')).toBeNull();
  });

  it('bare number without currency', () => {
    expect(parsePrice('1234.56')).toBeNull();
  });

  it('empty string', () => {
    expect(parsePrice('')).toBeNull();
  });

  it('percentage', () => {
    expect(parsePrice('50% off')).toBeNull();
  });

  it('time-like text', () => {
    expect(parsePrice('12:30')).toBeNull();
  });

  it('model numbers with $ far away', () => {
    expect(parsePrice('iPhone 15 Pro')).toBeNull();
  });
});

describe('parsePrice: first match wins', () => {
  it('picks the first price in the selection', () => {
    expect(parsePrice('Was $99.99, now $79.99')).toMatchObject({
      amount: 99.99,
      raw: '$99.99',
    });
  });
});
