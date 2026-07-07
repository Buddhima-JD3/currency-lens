import { browser, defineContentScript } from '#imports';
import { GET_RATES, type GetRatesResponse } from '@/utils/messages';
import { parsePrice, type ParsedPrice } from '@/utils/parser';
import { convert, type RateTable } from '@/utils/rates';
import { SETTINGS_KEY, defaultSettings, type Settings } from '@/utils/settings';

const MAX_SELECTION_LENGTH = 200;
const SETTLE_DELAY_MS = 60;

interface TooltipView {
  converted: string;
  rateLine: string;
  freshness: string;
  alternatives: string[];
  onAlternative: (code: string) => void;
}

class Tooltip {
  private host: HTMLDivElement;
  private card: HTMLDivElement;

  constructor() {
    this.host = document.createElement('div');
    this.host.dataset.currencyLens = 'tooltip';
    this.host.style.cssText =
      'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;';
    const root = this.host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      .card {
        position: fixed;
        max-width: 320px;
        background: #111827;
        color: #f9fafb;
        border-radius: 10px;
        box-shadow: 0 8px 24px rgba(0,0,0,.35);
        padding: 10px 14px;
        font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        cursor: default;
        user-select: none;
      }
      .amount {
        font-size: 18px;
        font-weight: 650;
        cursor: pointer;
        letter-spacing: .01em;
      }
      .amount:hover { color: #5eead4; }
      .meta { color: #9ca3af; font-size: 11px; margin-top: 2px; }
      .alts { margin-top: 6px; display: flex; gap: 6px; }
      .alts button {
        all: unset;
        cursor: pointer;
        font-size: 11px;
        color: #5eead4;
        border: 1px solid #134e4a;
        border-radius: 999px;
        padding: 1px 8px;
      }
      .alts button:hover { background: #134e4a; }
    `;
    root.append(style);

    this.card = document.createElement('div');
    this.card.className = 'card';
    this.card.style.visibility = 'hidden';
    root.append(this.card);
  }

  show(view: TooltipView, anchor: DOMRect): void {
    if (!this.host.isConnected) document.documentElement.append(this.host);
    this.card.replaceChildren();

    const amount = document.createElement('div');
    amount.className = 'amount';
    amount.textContent = view.converted;
    amount.title = 'Click to copy';
    amount.addEventListener('click', () => {
      navigator.clipboard?.writeText(view.converted).then(() => {
        amount.textContent = 'Copied ✓';
        setTimeout(() => (amount.textContent = view.converted), 900);
      });
    });
    this.card.append(amount);

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `${view.rateLine} · ${view.freshness}`;
    this.card.append(meta);

    if (view.alternatives.length > 0) {
      const alts = document.createElement('div');
      alts.className = 'alts';
      for (const code of view.alternatives) {
        const button = document.createElement('button');
        button.textContent = `${code}?`;
        button.addEventListener('click', () => view.onAlternative(code));
        alts.append(button);
      }
      this.card.append(alts);
    }

    this.card.style.visibility = 'hidden';
    this.card.style.top = '0px';
    this.card.style.left = '0px';
    // Measure after render, then position above the selection (below if cramped).
    requestAnimationFrame(() => {
      const { offsetWidth: w, offsetHeight: h } = this.card;
      const left = Math.min(
        Math.max(anchor.left + anchor.width / 2 - w / 2, 8),
        window.innerWidth - w - 8,
      );
      let top = anchor.top - h - 8;
      if (top < 8) top = anchor.bottom + 8;
      this.card.style.left = `${left}px`;
      this.card.style.top = `${top}px`;
      this.card.style.visibility = 'visible';
    });
  }

  hide(): void {
    this.card.style.visibility = 'hidden';
  }

  containsEvent(event: Event): boolean {
    return event.composedPath().includes(this.host);
  }
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: amount >= 1000 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function formatRate(rate: number): string {
  if (rate >= 100) return rate.toFixed(1);
  if (rate >= 1) return rate.toFixed(2);
  return rate.toPrecision(3);
}

function formatFreshness(fetchedAt: number, stale: boolean): string {
  const ageMs = Date.now() - fetchedAt;
  const days = Math.floor(ageMs / 86_400_000);
  if (days < 1) return 'rates: today';
  const label = days === 1 ? 'rates: 1 day old' : `rates: ${days} days old`;
  return stale ? `${label} (offline)` : label;
}

export default defineContentScript({
  matches: ['<all_urls>'],
  async main() {
    let settings: Settings = await loadSettings();
    browser.storage.sync.onChanged.addListener(async () => {
      settings = await loadSettings();
    });

    const tooltip = new Tooltip();
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    let requestToken = 0;

    async function loadSettings(): Promise<Settings> {
      const stored = await browser.storage.sync.get(SETTINGS_KEY);
      return (
        (stored[SETTINGS_KEY] as Settings | undefined) ??
        defaultSettings(navigator.language)
      );
    }

    function render(
      parsed: ParsedPrice,
      table: RateTable,
      stale: boolean,
      anchor: DOMRect,
      fromOverride?: string,
    ): void {
      const from = fromOverride ?? parsed.currency;
      const to = settings.homeCurrency;
      if (from === to) {
        tooltip.hide();
        return;
      }
      const value = convert(table, parsed.amount, from, to);
      const rate = convert(table, 1, from, to);
      if (value === null || rate === null) {
        tooltip.hide();
        return;
      }
      tooltip.show(
        {
          converted: formatMoney(value, to),
          rateLine: `1 ${from} = ${formatRate(rate)} ${to}`,
          freshness: formatFreshness(table.fetchedAt, stale),
          alternatives: [parsed.currency, ...parsed.alternatives].filter(
            (c) => c !== from,
          ),
          onAlternative: (code) => render(parsed, table, stale, anchor, code),
        },
        anchor,
      );
    }

    async function handleSelection(): Promise<void> {
      const token = ++requestToken;
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        tooltip.hide();
        return;
      }

      const text = selection.toString().trim();
      if (!text || text.length > MAX_SELECTION_LENGTH) {
        tooltip.hide();
        return;
      }

      const parsed = parsePrice(text, { symbolDefaults: settings.symbolDefaults });
      if (!parsed) {
        tooltip.hide();
        return;
      }

      const anchor = selection.getRangeAt(0).getBoundingClientRect();
      const response = (await browser.runtime
        .sendMessage({ type: GET_RATES })
        .catch(() => null)) as GetRatesResponse | null;
      if (token !== requestToken) return; // a newer selection superseded this one
      if (!response?.ok) {
        tooltip.hide();
        return;
      }

      render(parsed, response.table, response.stale, anchor);
    }

    function scheduleHandle(): void {
      clearTimeout(settleTimer);
      settleTimer = setTimeout(handleSelection, SETTLE_DELAY_MS);
    }

    document.addEventListener('mouseup', (event) => {
      if (tooltip.containsEvent(event)) return;
      scheduleHandle();
    });

    document.addEventListener('keyup', (event) => {
      // Keyboard selection (shift + arrows / cmd-A).
      if (event.shiftKey || event.key === 'Shift') scheduleHandle();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') tooltip.hide();
    });

    document.addEventListener('mousedown', (event) => {
      if (!tooltip.containsEvent(event)) tooltip.hide();
    });

    window.addEventListener('scroll', () => tooltip.hide(), {
      capture: true,
      passive: true,
    });
  },
});
