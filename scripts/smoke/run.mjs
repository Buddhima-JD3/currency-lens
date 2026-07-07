// End-to-end smoke test: loads the built extension into Chrome, selects
// prices on a local test page, and asserts the conversion tooltip behavior.
// Usage: node scripts/smoke/run.mjs [--headful]
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const extensionPath = join(here, '..', '..', '.output', 'chrome-mv3');
const headless = !process.argv.includes('--headful');

// Content scripts don't run on file:// URLs by default, so serve the page.
const html = readFileSync(join(here, 'test-page.html'));
const server = createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end(html);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const pageUrl = `http://127.0.0.1:${server.address().port}/`;

const failures = [];
const pass = (name) => console.log(`  ok - ${name}`);
const fail = (name, detail) => {
  failures.push(name);
  console.error(`  FAIL - ${name}: ${detail}`);
};

const context = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless,
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
  ],
});

try {
  const worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent('serviceworker', { timeout: 10_000 }));

  const page = await context.newPage();
  await page.goto(pageUrl);
  // Give the background worker a moment to fetch rates on install.
  await page.waitForTimeout(2500);

  // Pin settings so assertions don't depend on the machine's locale. Done
  // after startup so onInstalled's first-run defaults can't overwrite it;
  // the content script picks the change up via storage.sync.onChanged.
  await worker.evaluate(async () => {
    await chrome.storage.sync.set({
      settings: {
        homeCurrency: 'USD',
        symbolDefaults: { $: 'USD', '¥': 'JPY', Rs: 'LKR', kr: 'SEK' },
      },
    });
  });
  await page.waitForTimeout(300);

  async function selectAndRead(id) {
    await page.evaluate((elementId) => {
      const el = document.getElementById(elementId);
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel.removeAllRanges();
      if (el) range && sel.addRange(range);
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    }, id);
    await page.waitForTimeout(800);
    return page.evaluate(() => {
      const host = document.querySelector('div[data-currency-lens="tooltip"]');
      const card = host?.shadowRoot?.querySelector('.card');
      if (!card || card.style.visibility === 'hidden') return null;
      return {
        amount: card.querySelector('.amount')?.textContent ?? '',
        meta: card.querySelector('.meta')?.textContent ?? '',
        alts: [...card.querySelectorAll('.alts button')].map((b) => b.textContent),
      };
    });
  }

  console.log('smoke: highlight-to-convert (home currency pinned to USD)');

  const eur = await selectAndRead('eur-price');
  if (eur && /\$\s?\d/.test(eur.amount) && eur.meta.includes('1 EUR ='))
    pass(`€120 → ${eur.amount} (${eur.meta})`);
  else fail('EUR conversion tooltip', JSON.stringify(eur));
  await page.screenshot({ path: join(here, 'last-run.png') });

  const lkr = await selectAndRead('lkr-price');
  if (lkr && /\$/.test(lkr.amount) && lkr.meta.includes('1 LKR ='))
    pass(`Rs. 15,000 → ${lkr.amount} (${lkr.meta})`);
  else fail('LKR conversion tooltip', JSON.stringify(lkr));
  if (lkr && lkr.alts.some((a) => a.includes('INR')))
    pass(`rupee alternatives offered: ${lkr.alts.join(' ')}`);
  else fail('rupee alternatives', JSON.stringify(lkr?.alts));

  const usd = await selectAndRead('usd-price');
  if (usd === null) pass('$1.2k (same as home currency) shows no tooltip');
  else fail('same-currency suppression', JSON.stringify(usd));

  const plain = await selectAndRead('plain-text');
  if (plain === null) pass('plain text shows no tooltip');
  else fail('plain-text suppression', JSON.stringify(plain));
} finally {
  await context.close();
  server.close();
}

if (failures.length > 0) {
  console.error(`\nsmoke: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log('\nsmoke: all checks passed');
