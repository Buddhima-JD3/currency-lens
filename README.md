# Currency Lens

Highlight any price on any webpage — `$49.99`, `€120`, `Rs. 15,000`, `¥3,000`,
`USD 49`, `₹1.5 lakh` — and a tooltip instantly shows it converted to your
home currency, using daily mid-market exchange rates.

Built with [WXT](https://wxt.dev) (Manifest V3, TypeScript). One codebase
builds for Chrome, Firefox, and Edge.

## Features

- **Highlight to convert** — select text containing a price; a tooltip appears
  with the converted amount, the rate used, and rate freshness. Click the
  amount to copy it.
- **Understands real-world price formats** — symbols before/after, ISO codes,
  `1,234.56` and `1.234,56` separators, Indian grouping (`1,50,000`),
  magnitude suffixes (`1.2k`, `3M`, `1.5 lakh`, `2 crore`), and compound
  symbols (`A$`, `HK$`, `R$`, …).
- **Ambiguous symbols handled honestly** — `$` defaults to USD, `Rs` to your
  locale's rupee, `¥` to JPY, `kr` to SEK; the tooltip offers one-click
  alternatives and the popup lets you change the defaults.
- **160+ currencies** via [open.er-api.com](https://www.exchangerate-api.com)
  (primary) and [Frankfurter](https://frankfurter.dev) (fallback), cached for
  12 hours; stale rates are served offline with their age shown.
- **Private by design** — no analytics, no accounts, no page scanning. The
  only network calls are to the two rate APIs. Permissions: `storage` only.

## Development

```sh
npm install
npm run dev            # live-reload dev mode (Chrome)
npm test               # unit tests (parser, rates, settings)
npm run build          # production build -> .output/chrome-mv3
npm run build:firefox  # -> .output/firefox-mv2
npm run zip            # store-ready zip
node scripts/smoke/run.mjs   # end-to-end smoke test in headless Chromium
```

To load manually: `chrome://extensions` → enable Developer mode →
"Load unpacked" → pick `.output/chrome-mv3`.

## Architecture

| Piece | File | Responsibility |
|---|---|---|
| Price parser | `utils/parser.ts` | Pure text → `{amount, currency}`; the core IP, heavily unit-tested |
| Rates service | `utils/rates.ts` | Provider fetch + fallback, 12h cache, conversion math |
| Settings | `utils/settings.ts` | Home currency, locale guessing, symbol defaults |
| Content script | `entrypoints/content.ts` | Selection handling + shadow-DOM tooltip |
| Background | `entrypoints/background.ts` | Owns the rate cache, answers rate requests |
| Popup | `entrypoints/popup/` | Settings UI + quick converter |

Design spec: `docs/superpowers/specs/2026-07-07-currency-lens-design.md`.
