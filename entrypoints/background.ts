import { browser, defineBackground } from '#imports';
import { GET_RATES, type GetRatesResponse } from '@/utils/messages';
import { getRates, type KVStore } from '@/utils/rates';
import { SETTINGS_KEY, defaultSettings } from '@/utils/settings';

const localStore: KVStore = {
  get: async (key) => (await browser.storage.local.get(key))[key],
  set: async (key, value) => browser.storage.local.set({ [key]: value }),
};

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(async () => {
    const stored = await browser.storage.sync.get(SETTINGS_KEY);
    if (!stored[SETTINGS_KEY]) {
      await browser.storage.sync.set({
        [SETTINGS_KEY]: defaultSettings(navigator.language),
      });
    }
    // Warm the rate cache so the first highlight is instant.
    getRates({ store: localStore }).catch(() => {});
  });

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if ((message as { type?: string })?.type !== GET_RATES) return;
    (async (): Promise<GetRatesResponse> => {
      try {
        const { table, stale } = await getRates({ store: localStore });
        return { ok: true, table, stale };
      } catch (error) {
        return { ok: false, error: String(error) };
      }
    })().then(sendResponse);
    return true; // keep the message channel open for the async response
  });
});
