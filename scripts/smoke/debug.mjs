import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const extensionPath = join(here, '..', '..', '.output', 'chrome-mv3');

const html = readFileSync(join(here, 'test-page.html'));
const server = createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end(html);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const pageUrl = `http://127.0.0.1:${server.address().port}/`;

const context = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless: !process.argv.includes('--headful'),
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
  ],
});

console.log('service workers:', context.serviceWorkers().map((w) => w.url()));
context.on('serviceworker', (w) => console.log('sw registered:', w.url()));

const page = await context.newPage();
page.on('console', (msg) => console.log('page console:', msg.type(), msg.text()));
page.on('pageerror', (err) => console.log('page error:', err.message));
await page.goto(pageUrl);
await page.waitForTimeout(3000);

console.log('service workers after load:', context.serviceWorkers().map((w) => w.url()));

const state = await page.evaluate(() => {
  const el = document.getElementById('eur-price');
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  return { selection: sel.toString() };
});
console.log('selection made:', state);

await page.waitForTimeout(1500);

const dom = await page.evaluate(() => ({
  host: !!document.querySelector('div[data-currency-lens="tooltip"]'),
  bodyChildren: [...document.documentElement.children].map((c) => c.tagName),
}));
console.log('dom check:', dom);

const sw = context.serviceWorkers()[0];
if (sw) {
  const cache = await sw.evaluate(async () => {
    const data = await chrome.storage.local.get('rateTable');
    const settings = await chrome.storage.sync.get('settings');
    return {
      hasRates: !!data.rateTable,
      provider: data.rateTable?.provider,
      settings: settings.settings,
    };
  });
  console.log('background state:', JSON.stringify(cache));
}

await context.close();
server.close();
