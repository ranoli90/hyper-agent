import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'HyperAgent',
    description: 'Hyper-intelligent browser agent with deep semantic understanding, self-healing locators, vision capabilities, and adaptive automation.',
    version: '2.16.0',
    permissions: [
      'sidePanel',
      'tabs',
      'activeTab',
      'scripting',
      'storage',
      'unlimitedStorage',
      'contextMenus',
      'alarms',
    ],
    host_permissions: ['<all_urls>'],
    action: {
      default_title: 'Open HyperAgent',
      default_icon: {
        16: 'icon/16.png',
        32: 'icon/32.png',
        48: 'icon/48.png',
        128: 'icon/128.png',
      },
    },
    background: {
      service_worker: 'background.js',
      type: 'module',
    },
    content_scripts: [
      {
        matches: ['<all_urls>'],
        js: ['content-scripts/content.js'],
        run_at: 'document_idle',
      },
    ],
    side_panel: {
      default_path: 'sidepanel.html',
    },
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      128: 'icon/128.png',
    },
    web_accessible_resources: [
      {
        resources: ['icon/*', 'assets/*', 'chunks/*'],
        matches: ['<all_urls>'],
      },
    ],
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'",
    },
  },
});
