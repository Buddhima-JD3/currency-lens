import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Currency Lens',
    description:
      'Highlight any price on any page to instantly convert it to your currency.',
    permissions: ['storage'],
    host_permissions: [
      'https://open.er-api.com/*',
      'https://api.frankfurter.dev/*',
    ],
    browser_specific_settings: {
      gecko: {
        id: 'currency-lens@jayasinghe.dev',
      },
    },
  },
});
