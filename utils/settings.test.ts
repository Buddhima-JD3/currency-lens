import { describe, expect, it } from 'vitest';
import { defaultSettings, guessHomeCurrency } from './settings';

describe('guessHomeCurrency', () => {
  it('maps Sri Lankan locales to LKR', () => {
    expect(guessHomeCurrency('si-LK')).toBe('LKR');
    expect(guessHomeCurrency('en-LK')).toBe('LKR');
  });

  it('maps common locales', () => {
    expect(guessHomeCurrency('en-US')).toBe('USD');
    expect(guessHomeCurrency('de-DE')).toBe('EUR');
    expect(guessHomeCurrency('en-GB')).toBe('GBP');
    expect(guessHomeCurrency('ja-JP')).toBe('JPY');
    expect(guessHomeCurrency('en-IN')).toBe('INR');
  });

  it('falls back to USD for unknown or region-less locales', () => {
    expect(guessHomeCurrency('xx-ZZ')).toBe('USD');
    expect(guessHomeCurrency('en')).toBe('USD');
    expect(guessHomeCurrency('')).toBe('USD');
  });
});

describe('defaultSettings', () => {
  it('uses the locale guess as home currency', () => {
    expect(defaultSettings('si-LK').homeCurrency).toBe('LKR');
  });

  it('aligns ambiguous symbols with the home currency when it belongs to the group', () => {
    const lk = defaultSettings('si-LK');
    expect(lk.symbolDefaults.Rs).toBe('LKR');

    const india = defaultSettings('en-IN');
    expect(india.symbolDefaults.Rs).toBe('INR');

    const australia = defaultSettings('en-AU');
    expect(australia.symbolDefaults.$).toBe('AUD');

    const norway = defaultSettings('nb-NO');
    expect(norway.symbolDefaults.kr).toBe('NOK');
  });

  it('keeps group defaults when home currency is outside the group', () => {
    const us = defaultSettings('en-US');
    expect(us.symbolDefaults.$).toBe('USD');
    expect(us.symbolDefaults['¥']).toBe('JPY');
    expect(us.symbolDefaults.kr).toBe('SEK');
  });
});
