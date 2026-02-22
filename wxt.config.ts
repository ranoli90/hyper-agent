import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'HyperAgent',
    minimum_chrome_version: '114', // sidePanel API required
    author: { email: 'support@hyperagent.ai' },
    homepage_url: 'https://hyperagent.ai/privacy',
    description: 'Hyper-intelligent browser agent with deep semantic understanding, self-healing locators, vision capabilities, and adaptive automation.',
    version: '3.1.0',
    permissions: [
      'sidePanel',
      'tabs',
      'activeTab',
      'scripting',
      'storage',
      'unlimitedStorage',
      'contextMenus',
      'alarms',
      'notifications',
    ],
    host_permissions: ['<all_urls>'],
    action: {
      default_title: 'Open HyperAgent',
      // Icons from public/icons/ (16, 32, 48, 128 px) — copied to output root
      default_icon: {
        16: 'icons/16.png',
        32: 'icons/32.png',
        48: 'icons/48.png',
        128: 'icons/128.png',
      },
    },
    side_panel: {
      default_path: 'sidepanel.html',
    },
    icons: {
      16: 'icons/16.png',
      32: 'icons/32.png',
      48: 'icons/48.png',
      128: 'icons/128.png',
    },
    web_accessible_resources: [
      {
        resources: ['icons/*', 'assets/*', 'chunks/*'],
        matches: ['<all_urls>'],
      },
    ],
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'",
    },
  },
});
