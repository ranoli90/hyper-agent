import { STORAGE_KEYS, DEFAULTS } from './config';
import type { SiteConfig } from './types';

// ─── Default Site Configurations ────────────────────────────────────────
const DEFAULT_SITE_CONFIGS: SiteConfig[] = [
  {
    domain: 'amazon.com',
    description: 'Amazon - E-commerce with infinite scroll and dynamic content',
    maxRetries: 4,
    scrollBeforeLocate: true,
    waitAfterAction: 800,
    customSelectors: ['[data-asin]', '.s-item', '[data-component-type="s-search-result"]'],
  },
  {
    domain: 'www.amazon.com',
    description: 'Amazon - E-commerce with infinite scroll and dynamic content',
    maxRetries: 4,
    scrollBeforeLocate: true,
    waitAfterAction: 800,
    customSelectors: ['[data-asin]', '.s-item', '[data-component-type="s-search-result"]'],
  },
  {
    domain: 'google.com',
    description: 'Google - Search with dynamic results',
    maxRetries: 2,
    scrollBeforeLocate: false,
    waitAfterAction: 300,
  },
  {
    domain: 'www.google.com',
    description: 'Google - Search with dynamic results',
    maxRetries: 2,
    scrollBeforeLocate: false,
    waitAfterAction: 300,
  },
  {
    domain: 'facebook.com',
    description: 'Facebook - Social media with infinite scroll',
    maxRetries: 3,
    scrollBeforeLocate: true,
    waitAfterAction: 600,
  },
  {
    domain: 'www.facebook.com',
    description: 'Facebook - Social media with infinite scroll',
    maxRetries: 3,
    scrollBeforeLocate: true,
    waitAfterAction: 600,
  },
  {
    domain: 'twitter.com',
    description: 'Twitter/X - Social media with timeline',
    maxRetries: 3,
    scrollBeforeLocate: true,
    waitAfterAction: 500,
  },
  {
    domain: 'x.com',
    description: 'X (Twitter) - Social media with timeline',
    maxRetries: 3,
    scrollBeforeLocate: true,
    waitAfterAction: 500,
  },
  {
    domain: 'www.x.com',
    description: 'X (Twitter) - Social media with timeline',
    maxRetries: 3,
    scrollBeforeLocate: true,
    waitAfterAction: 500,
  },
  {
    domain: 'github.com',
    description: 'GitHub - Code hosting with dynamic loading',
    maxRetries: 2,
    scrollBeforeLocate: false,
    waitAfterAction: 400,
  },
  {
    domain: 'www.github.com',
    description: 'GitHub - Code hosting with dynamic loading',
    maxRetries: 2,
    scrollBeforeLocate: false,
    waitAfterAction: 400,
  },
  {
    domain: 'reddit.com',
    description: 'Reddit - Social news with infinite scroll',
    maxRetries: 3,
    scrollBeforeLocate: true,
    waitAfterAction: 500,
  },
  {
    domain: 'www.reddit.com',
    description: 'Reddit - Social news with infinite scroll',
    maxRetries: 3,
    scrollBeforeLocate: true,
    waitAfterAction: 500,
  },
  {
    domain: 'linkedin.com',
    description: 'LinkedIn - Professional network with lazy loading',
    maxRetries: 3,
    scrollBeforeLocate: true,
    waitAfterAction: 600,
  },
  {
    domain: 'www.linkedin.com',
    description: 'LinkedIn - Professional network with lazy loading',
    maxRetries: 3,
    scrollBeforeLocate: true,
    waitAfterAction: 600,
  },
  {
    domain: 'youtube.com',
    description: 'YouTube - Video platform with dynamic content',
    maxRetries: 3,
    scrollBeforeLocate: true,
    waitAfterAction: 500,
    customSelectors: ['#video-title', 'ytd-grid-video-renderer', 'ytd-rich-item-renderer'],
  },
  {
    domain: 'www.youtube.com',
    description: 'YouTube - Video platform with dynamic content',
    maxRetries: 3,
    scrollBeforeLocate: true,
    waitAfterAction: 500,
    customSelectors: ['#video-title', 'ytd-grid-video-renderer', 'ytd-rich-item-renderer'],
  },
  {
    domain: 'gmail.com',
    description: 'Gmail - Email with complex DOM and shadow DOM',
    maxRetries: 3,
    scrollBeforeLocate: false,
    waitAfterAction: 400,
  },
  {
    domain: 'mail.google.com',
    description: 'Gmail - Email with complex DOM and shadow DOM',
    maxRetries: 3,
    scrollBeforeLocate: false,
    waitAfterAction: 400,
  },
  {
    domain: 'shopify.com',
    description: 'Shopify - E-commerce with infinite scroll',
    maxRetries: 4,
    scrollBeforeLocate: true,
    waitAfterAction: 700,
  },
  {
    domain: '*.shopify.com',
    description: 'Shopify stores - E-commerce with infinite scroll',
    maxRetries: 4,
    scrollBeforeLocate: true,
    waitAfterAction: 700,
  },
];

// ─── Storage helpers ────────────────────────────────────────────────────

/**
 * Get all site configs (including defaults and user configs)
 */
export async function getAllSiteConfigs(): Promise<SiteConfig[]> {
  const data = await chrome.storage.local.get([STORAGE_KEYS.SITE_CONFIGS]);
  const userConfigs: SiteConfig[] = data[STORAGE_KEYS.SITE_CONFIGS] || [];
  
  // Merge default configs with user configs (user configs take precedence)
  const mergedConfigs: Map<string, SiteConfig> = new Map();
  
  // Add default configs first
  for (const config of DEFAULT_SITE_CONFIGS) {
    mergedConfigs.set(config.domain, config);
  }
  
  // Override with user configs
  for (const config of userConfigs) {
    mergedConfigs.set(config.domain, config);
  }
  
  return Array.from(mergedConfigs.values());
}

/**
 * Get config for a specific domain
 */
export async function getSiteConfig(domain: string): Promise<SiteConfig | null> {
  const configs = await getAllSiteConfigs();
  
  // Exact match first
  let match = configs.find(c => c.domain === domain);
  
  // Try wildcard match
  if (!match) {
    match = configs.find(c => {
      if (c.domain.startsWith('*.')) {
        const wildcard = c.domain.slice(2);
        return domain.endsWith(wildcard);
      }
      return false;
    });
  }
  
  return match || null;
}

/**
 * Set config for a domain (creates or updates)
 */
export async function setSiteConfig(config: SiteConfig): Promise<void> {
  const data = await chrome.storage.local.get([STORAGE_KEYS.SITE_CONFIGS]);
  const configs: SiteConfig[] = data[STORAGE_KEYS.SITE_CONFIGS] || [];
  
  // Remove existing config for this domain
  const filtered = configs.filter(c => c.domain !== config.domain);
  
  // Add new/updated config
  filtered.push(config);
  
  await chrome.storage.local.set({
    [STORAGE_KEYS.SITE_CONFIGS]: filtered,
  });
}

/**
 * Delete config for a domain
 */
export async function deleteSiteConfig(domain: string): Promise<void> {
  const data = await chrome.storage.local.get([STORAGE_KEYS.SITE_CONFIGS]);
  const configs: SiteConfig[] = data[STORAGE_KEYS.SITE_CONFIGS] || [];
  
  // Remove config for this domain
  const filtered = configs.filter(c => c.domain !== domain);
  
  await chrome.storage.local.set({
    [STORAGE_KEYS.SITE_CONFIGS]: filtered,
  });
}

/**
 * Get only user-defined configs (excluding defaults)
 */
export async function getUserSiteConfigs(): Promise<SiteConfig[]> {
  const data = await chrome.storage.local.get([STORAGE_KEYS.SITE_CONFIGS]);
  return data[STORAGE_KEYS.SITE_CONFIGS] || [];
}

/**
 * Check if a domain has custom config
 */
export async function hasCustomConfig(domain: string): Promise<boolean> {
  const userConfigs = await getUserSiteConfigs();
  return userConfigs.some(c => c.domain === domain);
}
