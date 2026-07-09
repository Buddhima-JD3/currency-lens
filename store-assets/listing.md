# Store Listing Copy

## Name

Currency Lens — Highlight to Convert Currency

*(Chrome Web Store name limit is 75 chars; this is 45.)*

## Short description (132 chars max)

> Highlight any price on any page to instantly convert it to your currency. 160+ currencies, every price format, totally private.

*(129 chars.)*

## Category

Productivity → Tools (Chrome) / Shopping (alternative)

## Detailed description

Shopping on foreign sites and tired of opening a converter tab for every
price? Highlight the price. That's it.

Currency Lens shows the converted amount in a small tooltip right next to
your selection — with the exchange rate used and how fresh it is. Click the
amount to copy it.

WORKS WITH REAL-WORLD PRICES
Most converters choke on anything unusual. Currency Lens understands:
• $49.99, €120, £12, ¥3,000, ₹500, ₩10,000, ฿250 …
• ISO codes: USD 49, 15,000 LKR, EUR 1.234,56
• Rupee notation: Rs. 15,000, ₨ 500 — with LKR / INR / PKR / NPR handled properly
• European and US separators: 1,234.56 and 1.234,56 and 1 234,56
• Indian grouping: ₹1,50,000, and lakh / crore: ₹1.5 lakh, Rs 2 crore
• Shorthand: $1.2k, €3M, $2bn
• Compound symbols: A$, C$, NZ$, HK$, S$, R$, US$ …

AMBIGUOUS SYMBOLS, HANDLED HONESTLY
Is $ USD or CAD? Is ¥ yen or yuan? Currency Lens picks a sensible default
(you can change it), and the tooltip offers one-click alternatives so you're
never silently shown the wrong number.

160+ CURRENCIES, DAILY MID-MARKET RATES
The same mid-market rates you see on Google, updated daily and cached for
speed. Works offline with the last known rates (age clearly shown).

PRIVATE BY DESIGN
• No account, no analytics, no tracking
• Never reads or scans pages — it only acts on text you select
• The only network requests are to two public exchange-rate APIs
• Only permission: storage (to remember your settings)

Plus a popup with a quick converter and your preferences: home currency and
how to resolve $, ¥, Rs, and kr.

Highlight a price. Know what it costs. That's Currency Lens.

## Keywords / search terms

currency converter, exchange rate, highlight, price converter, LKR, INR,
convert currency, shopping, travel, mid-market rate

## Permissions justification (for the review form)

- `storage` — saves the user's home currency and symbol preferences, and
  caches exchange rates for 12 hours.
- Host permissions (`open.er-api.com`, `api.frankfurter.dev`) — fetches
  daily exchange rates. No other network activity.
- Content script on all sites — the tooltip must work on any page the user
  shops on. It only responds to explicit text selection; it never reads or
  modifies the page otherwise.

## Single-purpose statement

Converts a highlighted price into the user's chosen currency and displays it
in a tooltip.

## Assets checklist

- [x] Icons 16/32/48/128 (built into the package)
- [x] Screenshots 1280×800: `screenshot-1-tooltip.png`, `screenshot-2-popup.png`
- [ ] Optional small promo tile 440×280 (can be added later)
- [x] Privacy policy URL: https://github.com/Buddhima-JD3/currency-lens/blob/main/store-assets/privacy-policy.md
