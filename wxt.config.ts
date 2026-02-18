import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'HyperAgent',
    description: 'Hyper-intelligent browser agent with deep semantic understanding, self-healing locators, vision capabilities, and adaptive automation.',
    version: '2.15.0',
    permissions: [
      'sidePanel',
      'tabs',
      'activeTab',
      'scripting',
      'storage',
      'contextMenus',
    ],
    host_permissions: ['<all_urls>'],
    action: {
      default_title: 'Open HyperAgent',
    },
    side_panel: {
      default_path: 'sidepanel.html',
    },
  },
});
