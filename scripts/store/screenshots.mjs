// Generates 1280x800 Chrome Web Store screenshots using the real built
// extension: the tooltip converting a price, and the settings popup.
// Usage: node scripts/store/screenshots.mjs
import { mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const extensionPath = join(root, '.output', 'chrome-mv3');
const outDir = join(root, 'store-assets');
mkdirSync(outDir, { recursive: true });

const html = readFileSync(join(here, 'demo-page.html'));
const server = createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end(html);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

const context = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless: true,
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
  ],
});

try {
  const worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent('serviceworker', { timeout: 10_000 }));
  const extensionId = new URL(worker.url()).host;

  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForTimeout(2500);

  // Screenshot 1: tooltip converting the price (home currency: LKR).
  await worker.evaluate(async () => {
    await chrome.storage.sync.set({
      settings: {
        homeCurrency: 'LKR',
        symbolDefaults: { $: 'USD', '¥': 'JPY', Rs: 'LKR', kr: 'SEK' },
      },
    });
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const el = document.getElementById('price');
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });
  await page.waitForTimeout(1000);
  const tooltipVisible = await page.evaluate(
    () =>
      document
        .querySelector('div[data-currency-lens="tooltip"]')
        ?.shadowRoot?.querySelector('.card')?.style.visibility === 'visible',
  );
  if (!tooltipVisible) throw new Error('tooltip did not appear on demo page');
  await page.screenshot({ path: join(outDir, 'screenshot-1-tooltip.png') });
  console.log('wrote store-assets/screenshot-1-tooltip.png');

  // Screenshot 2: the popup, centered on a neutral backdrop.
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.addStyleTag({
    content: `
      html { background: linear-gradient(135deg, #0f172a, #134e4a); }
      body {
        margin: 90px auto;
        border-radius: 14px;
        box-shadow: 0 24px 64px rgba(0,0,0,.5);
      }
    `,
  });
  await popup.waitForTimeout(1200);
  await popup.screenshot({ path: join(outDir, 'screenshot-2-popup.png') });
  console.log('wrote store-assets/screenshot-2-popup.png');
} finally {
  await context.close();
  server.close();
}
