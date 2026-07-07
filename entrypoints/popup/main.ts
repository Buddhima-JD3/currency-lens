import { browser } from '#imports';
import { GET_RATES, type GetRatesResponse } from '@/utils/messages';
import { SYMBOL_GROUPS } from '@/utils/parser';
import { convert, type RateTable } from '@/utils/rates';
import { SETTINGS_KEY, defaultSettings, type Settings } from '@/utils/settings';

const $ = <T extends HTMLElement>(id: string): T =>
  document.getElementById(id) as T;

const currencyNames = (() => {
  try {
    return new Intl.DisplayNames(undefined, { type: 'currency' });
  } catch {
    return null;
  }
})();

function currencyLabel(code: string): string {
  const name = currencyNames?.of(code);
  return name && name !== code ? `${code} — ${name}` : code;
}

function fillCurrencySelect(
  select: HTMLSelectElement,
  codes: string[],
  selected: string,
): void {
  select.replaceChildren();
  for (const code of codes) {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = currencyLabel(code);
    option.selected = code === selected;
    select.append(option);
  }
}

async function loadSettings(): Promise<Settings> {
  const stored = await browser.storage.sync.get(SETTINGS_KEY);
  return (
    (stored[SETTINGS_KEY] as Settings | undefined) ??
    defaultSettings(navigator.language)
  );
}

async function saveSettings(settings: Settings): Promise<void> {
  await browser.storage.sync.set({ [SETTINGS_KEY]: settings });
}

async function main(): Promise<void> {
  const settings = await loadSettings();
  const status = $('status');

  const response = (await browser.runtime
    .sendMessage({ type: GET_RATES })
    .catch(() => null)) as GetRatesResponse | null;

  let table: RateTable | null = null;
  if (response?.ok) {
    table = response.table;
    const updated = new Date(table.fetchedAt).toLocaleString();
    status.textContent = `Rates: ${table.provider} · updated ${updated}`;
  } else {
    status.textContent = 'Exchange rates unavailable — check your connection.';
  }

  const codes = table
    ? Object.keys(table.rates).sort()
    : [settings.homeCurrency];

  // Home currency
  const home = $<HTMLSelectElement>('home');
  fillCurrencySelect(home, codes, settings.homeCurrency);
  home.addEventListener('change', async () => {
    settings.homeCurrency = home.value;
    await saveSettings(settings);
  });

  // Ambiguous symbol defaults
  const grid = $('symbol-defaults');
  for (const [symbol, group] of Object.entries(SYMBOL_GROUPS)) {
    const label = document.createElement('label');
    const caption = document.createElement('span');
    caption.textContent = symbol;
    const select = document.createElement('select');
    for (const code of group.all) {
      const option = document.createElement('option');
      option.value = code;
      option.textContent = code;
      option.selected = (settings.symbolDefaults[symbol] ?? group.default) === code;
      select.append(option);
    }
    select.addEventListener('change', async () => {
      settings.symbolDefaults[symbol] = select.value;
      await saveSettings(settings);
    });
    label.append(caption, select);
    grid.append(label);
  }

  // Quick converter
  const amount = $<HTMLInputElement>('amount');
  const from = $<HTMLSelectElement>('from');
  const to = $<HTMLSelectElement>('to');
  const result = $<HTMLOutputElement>('result');
  fillCurrencySelect(from, codes, 'USD');
  fillCurrencySelect(to, codes, settings.homeCurrency);

  function updateResult(): void {
    if (!table) {
      result.textContent = '—';
      return;
    }
    const value = convert(table, Number(amount.value) || 0, from.value, to.value);
    result.textContent =
      value === null
        ? '—'
        : new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: to.value,
          }).format(value);
  }

  for (const element of [amount, from, to]) {
    element.addEventListener('input', updateResult);
  }
  updateResult();
}

main();
