# Currency Lens — Design Spec

**Date:** 2026-07-07
**Status:** Approved by user (conversation, 2026-07-07)

## What

A browser extension: highlight any price on any webpage (`$49.99`, `€120`, `Rs. 15,000`, `USD 49`) and a tooltip appears next to the selection showing that price converted to the user's home currency, using daily mid-market exchange rates (the same rates Google displays).

## Decisions (user-approved)

| Decision | Choice |
|---|---|
| Rate source | Free API: **open.er-api.com** primary (160+ currencies incl. LKR, no key), Frankfurter (ECB) as fallback. No backend. |
| Target currency | User picks home currency once in popup; pre-guessed from browser locale. |
| Trigger | **Highlight only** for MVP. No hover detection, no whole-page rewriting. |
| Stack | **WXT** framework, TypeScript, Vite, Vitest. Builds Chrome/Firefox/Edge from one codebase. Manifest V3. |

## Architecture

Three parts, communicating via extension messaging:

1. **Content script** (all pages): listens for selection end (`mouseup` + keyboard selection), extracts selected text (capped at 200 chars), runs the price parser locally, and if a price is found asks the background for rates and renders the tooltip. Idle otherwise — no DOM scanning.
2. **Background service worker**: owns rates. Fetches from the provider, caches in `chrome.storage.local` with a 12-hour TTL, serves `{from, to, rate, fetchedAt}` to content scripts. One fetch serves all tabs.
3. **Popup**: settings (home currency dropdown, ambiguous-symbol overrides) + a manual mini-converter.

Permissions: `storage` + host permissions for the two rate APIs only.

### Module layout

- `utils/parser.ts` — pure price parser (no DOM, no chrome APIs). The core IP.
- `utils/rates.ts` — provider interface + open.er-api.com / Frankfurter implementations + cache/TTL logic (injectable clock & storage for tests).
- `utils/settings.ts` — settings schema, defaults, locale→currency guess.
- `entrypoints/content.ts` — selection handling + shadow-DOM tooltip.
- `entrypoints/background.ts` — message router, rate cache owner.
- `entrypoints/popup/` — settings UI (plain TS + HTML).

## Price parser requirements

Input: selected text string. Output: `{ amount, currency, alternatives?, raw }` or `null`.

- Symbol before/after amount, with/without space: `$49.99`, `49,99 €`, `£ 12`
- ISO codes either side: `USD 49`, `49.99 LKR`
- Prefix notations: `Rs. 15,000`, `Rs15000`, `R$ 99`, `A$/C$/HK$/S$/NZ$`
- Separators: `1,234.56`, `1.234,56`, `1 234,56`, `1'234.56`, Indian grouping `1,50,000`
- Magnitude suffixes: `1.2k`, `3M`, `2bn`, `1.5 lakh`, `2 crore`
- Ambiguous symbols with configurable defaults: `$`→USD, `¥`→JPY, `£`→GBP, `Rs`→locale rupee (LKR/INR/PKR/NPR), `kr`→SEK, `₨`→locale rupee. Alternatives returned so the tooltip can offer them.
- First valid price in the selection wins (MVP).
- Never guess: if amount or currency can't be determined confidently, return `null`.

## Rates & conversion

- Provider returns USD-based table: `rates[code] = units per 1 USD`. Convert: `amount × rates[to] / rates[from]`.
- Cache: `{ rates, fetchedAt }` in `chrome.storage.local`, TTL 12h. Serve stale on fetch failure with age surfaced to UI ("rates from N days ago"). No cache + offline → tooltip explains rates unavailable.
- Provider failure → try fallback provider before falling back to stale cache.

## Tooltip UI

- Host element appended to `documentElement`, shadow root (`mode: open`), fixed positioning above the selection rect (below if no room).
- Content: converted amount (prominent) · `1 USD = 302.40 LKR · rates: today` (subtle) · click amount to copy.
- Ambiguous currency: small "USD? · CAD? · AUD?" row to switch interpretation.
- Dismiss on: mousedown outside, scroll, Escape, new selection.
- No tooltip when no price is parsed — silence over noise.

## Error handling summary

| Failure | Behavior |
|---|---|
| Rate API down | Fallback provider → stale cache with age note |
| No cache + offline | Tooltip: "exchange rates unavailable" |
| Unparseable/ambiguous text | No tooltip |
| Unknown currency code | No tooltip |

## Testing

- **Vitest** unit tests: parser (large format matrix — the regression net), rates cache/TTL/fallback (mock fetch + storage), conversion math.
- Smoke test: load built extension into Chromium (Playwright, `--load-extension`) against a local test page with assorted prices; assert tooltip renders with correct conversion.
- Manual pass on real sites (Amazon, eBay, AliExpress, local LK stores) before store submission.

## Competitive landscape (researched 2026-07-07)

Direct competitors exist and validate demand: CurrencyMan, Selection Converter, Highlight Convert, Currency Converter Pro (all highlight-to-convert, free), Universal Automatic Currency Converter (page rewriting, low users), Currency.Wiki (~50k users — category leader). The market is fragmented and weakly held: dated UIs, weak parsing (miss `Rs. 15,000`, `1.234,56`, `$1.2k`), no meaningful monetization anywhere.

**Implications:** win on parsing quality and regional-currency support (LKR/INR, lakh/crore) — that is the moat. Revenue expectations modest; this is polish-led consolidation of a sleepy category.

## Strategy & monetization

- Ship free MVP to Chrome Web Store, then Firefox/Edge (near-free via WXT; less crowded stores rank easier).
- Listing positioning: "understands every price format, every currency — including yours."
- Freemium later via ExtensionPay (~$10–15/yr): whole-page conversion, multiple pinned currencies, rate-history sparkline, custom fee margins. Not in MVP scope.
- Never: ads, data selling, affiliate injection.

## MVP scope (this build)

Everything above except premium features, hover detection, and whole-page conversion. Free-only, highlight-only, Chrome + Firefox builds.
