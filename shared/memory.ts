/**
 * @fileoverview Site strategy learning.
 * Persists successful/failed locators per domain for adaptive element resolution.
 */

import { STORAGE_KEYS, loadSettings } from './config';
import type { SiteStrategy, ActionLogEntry, Locator, Action } from './types';
import { extractDomain } from './url-utils';

// Re-export for consumers that import from memory
export { extractDomain } from './url-utils';

// Constants for memory management
const MAX_ENTRIES_PER_DOMAIN = 100;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_DOMAIN_TTL_MS = THIRTY_DAYS_MS;

// ─── Helper: Per-domain TTL (simple policy) ─────────────────────────────
// This keeps only the last N days of history per domain, with the ability
// to tune high-churn domains more aggressively.
function getDomainTTL(domain: string): number {
  const shortTtlDaysByDomain: Record<string, number> = {
    'amazon.com': 7,
    'www.amazon.com': 7,
    'facebook.com': 14,
    'www.facebook.com': 14,
    'twitter.com': 14,
    'x.com': 14,
    'www.x.com': 14,
  };
  const days = shortTtlDaysByDomain[domain] ?? (DEFAULT_DOMAIN_TTL_MS / (24 * 60 * 60 * 1000));
  return days * 24 * 60 * 60 * 1000;
}

// Expose TTL helper under a test-only name so unit tests can assert policy
// without relying on private implementation details elsewhere.
// This is not used in production code paths.
// eslint-disable-next-line @typescript-eslint/naming-convention
export const __test_getDomainTTL = getDomainTTL;

// ─── Helper: Serialize locator for comparison ─────────────────────
function serializeLocator(locator: Locator): string {
  if (typeof locator === 'string') return locator;
  return JSON.stringify(locator);
}

// ─── Load all site strategies ─────────────────────────────────────
async function loadStrategies(): Promise<Record<string, SiteStrategy>> {
  const data = await chrome.storage.local.get(STORAGE_KEYS.SITE_STRATEGIES);
  return data[STORAGE_KEYS.SITE_STRATEGIES] || {};
}

// ─── Save all site strategies ────────────────────────────────────
async function saveStrategies(strategies: Record<string, SiteStrategy>): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.SITE_STRATEGIES]: strategies,
  });
}

// ─── Load action history ─────────────────────────────────────────
async function loadActionHistory(): Promise<ActionLogEntry[]> {
  const data = await chrome.storage.local.get(STORAGE_KEYS.ACTION_HISTORY);
  return data[STORAGE_KEYS.ACTION_HISTORY] || [];
}

// ─── Save action history ─────────────────────────────────────────
async function saveActionHistory(history: ActionLogEntry[]): Promise<void> {
  const now = Date.now();

  // Clean up old entries first, respecting per-domain TTL.
  const cleaned = history.filter(entry => {
    const ttl = getDomainTTL(entry.domain);
    return now - entry.timestamp <= ttl;
  });

  await chrome.storage.local.set({
    [STORAGE_KEYS.ACTION_HISTORY]: cleaned,
  });
}

// ─── Save action outcome ─────────────────────────────────────────
export async function saveActionOutcome(
  url: string,
  action: Action,
  success: boolean,
  errorType?: string
): Promise<void> {
  // Respect global learning toggle: when disabled, do not persist any
  // site-strategy memory or action history.
  try {
    const settings = await loadSettings();
    if (!settings.learningEnabled) {
      return;
    }
  } catch {
    // If settings cannot be loaded, fail closed (no learning writes).
    return;
  }

  const domain = extractDomain(url);
  if (!domain) return;

  const locator = (action as any).locator;
  const actionType = action.type;

  // Update action history
  const history = await loadActionHistory();
  const logEntry: ActionLogEntry = {
    timestamp: Date.now(),
    domain,
    actionType,
    locator: locator || '',
    success,
    errorType,
  };
  history.push(logEntry);

  // Keep only the last MAX_ENTRIES_PER_DOMAIN * 10 entries total
  const trimmedHistory = history.slice(-MAX_ENTRIES_PER_DOMAIN * 10);
  await saveActionHistory(trimmedHistory);

  // Update site strategy
  const strategies = await loadStrategies();
  
  if (!strategies[domain]) {
    strategies[domain] = {
      domain,
      successfulLocators: [],
      failedLocators: [],
      lastUsed: Date.now(),
      memoryVersion: 1,
      summary: '',
    };
  }

  const strategy = strategies[domain];
  strategy.lastUsed = Date.now();
  strategy.memoryVersion = strategy.memoryVersion ?? 1;

  if (success) {
    // Add to successful locators
    const locatorStr = serializeLocator(locator);
    const existing = strategy.successfulLocators.find(
      s => s.actionType === actionType && serializeLocator(s.locator) === locatorStr
    );
    
    if (existing) {
      existing.successCount++;
    } else {
      strategy.successfulLocators.push({
        locator: locator || '',
        actionType,
        successCount: 1,
      });
    }

    // Remove from failed locators if present
    const failedIdx = strategy.failedLocators.findIndex(
      f => f.errorType === errorType && serializeLocator(f.locator) === locatorStr
    );
    if (failedIdx >= 0) {
      strategy.failedLocators.splice(failedIdx, 1);
    }
  } else {
    // Add to failed locators
    const locatorStr = serializeLocator(locator);
    const existing = strategy.failedLocators.find(
      f => f.errorType === errorType && serializeLocator(f.locator) === locatorStr
    );
    
    if (existing) {
      existing.failCount++;
    } else {
      strategy.failedLocators.push({
        locator: locator || '',
        errorType: errorType || 'UNKNOWN',
        failCount: 1,
      });
    }

    // Remove from successful locators if count is too low
    const successIdx = strategy.successfulLocators.findIndex(
      s => s.actionType === actionType && serializeLocator(s.locator) === locatorStr
    );
    if (successIdx >= 0 && strategy.successfulLocators[successIdx].successCount < 2) {
      strategy.successfulLocators.splice(successIdx, 1);
    }
  }

  // Recompute a compact summary of top success patterns for this domain.
  const byAction: Record<string, number> = {};
  for (const s of strategy.successfulLocators) {
    byAction[s.actionType] = (byAction[s.actionType] || 0) + 1;
  }
  const parts = Object.entries(byAction)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([actionType, count]) => `${actionType} (${count})`);
  strategy.summary = parts.length
    ? `Top successful locator patterns: ${parts.join(', ')}`
    : 'No successful locator patterns yet.';

  await saveStrategies(strategies);
}

// ─── Get strategies for domain ───────────────────────────────────
export async function getStrategiesForDomain(url: string): Promise<SiteStrategy | null> {
  const domain = extractDomain(url);
  if (!domain) return null;

  const strategies = await loadStrategies();
  return strategies[domain] || null;
}

// ─── Get top locator for domain and action type ─────────────────
export async function getTopLocator(
  url: string,
  actionType: string
): Promise<Locator | null> {
  const strategy = await getStrategiesForDomain(url);
  if (!strategy) return null;

  // Find successful locators for this action type
  const successful = strategy.successfulLocators
    .filter(s => s.actionType === actionType)
    .sort((a, b) => b.successCount - a.successCount);

  if (successful.length > 0) {
    return successful[0].locator;
  }

  return null;
}

// ─── Get recommended fallback locators ────────────────────────────
export async function getRecommendedLocators(
  url: string,
  actionType: string
): Promise<Locator[]> {
  const strategy = await getStrategiesForDomain(url);
  if (!strategy) return [];

  // Build a quick lookup of failure counts per locator to bias away from
  // strategies that have repeatedly failed for this domain/action type.
  const failureCounts = new Map<string, number>();
  for (const f of strategy.failedLocators) {
    const key = `${f.errorType || 'UNKNOWN'}|${serializeLocator(f.locator)}`;
    failureCounts.set(key, (failureCounts.get(key) || 0) + f.failCount);
  }

  // Get successful locators sorted by score: successCount penalized by failures.
  const successful = strategy.successfulLocators
    .filter(s => s.actionType === actionType)
    .map(s => {
      const key = `${'ANY'}|${serializeLocator(s.locator)}`;
      const fails = failureCounts.get(key) ?? 0;
      const score = s.successCount - fails * 2;
      return { ...s, score };
    })
    .sort((a, b) => b.score - a.score || b.successCount - a.successCount);

  return successful.slice(0, 3).map(s => s.locator);
}

// ─── Clear all memory ────────────────────────────────────────────
export async function clearMemory(): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.SITE_STRATEGIES]: {},
    [STORAGE_KEYS.ACTION_HISTORY]: [],
  });
}

// ─── Clear memory for a single domain ───────────────────────────
export async function clearDomainMemory(url: string): Promise<void> {
  const domain = extractDomain(url);
  if (!domain) return;

  const [strategies, history] = await Promise.all([
    loadStrategies(),
    loadActionHistory(),
  ]);

  if (strategies[domain]) {
    delete strategies[domain];
  }

  const filteredHistory = history.filter(entry => entry.domain !== domain);

  await Promise.all([
    saveStrategies(strategies),
    saveActionHistory(filteredHistory),
  ]);
}

// ─── Get memory stats ─────────────────────────────────────────────
export async function getMemoryStats(): Promise<{
  domainsCount: number;
  totalActions: number;
  oldestEntry: number | null;
  /** Number of successful strategies per domain. */
  strategiesPerDomain: Record<string, number>;
  /** Domains with the largest number of logged actions. */
  largestDomains: { domain: string; actions: number }[];
  /** Total sessions count is provided for convenience; computed elsewhere today. */
  totalSessions: number;
}> {
  const strategies = await loadStrategies();
  const history = await loadActionHistory();
  const domains = Object.keys(strategies);

  const strategiesPerDomain: Record<string, number> = {};
  for (const domain of domains) {
    const s = strategies[domain];
    strategiesPerDomain[domain] = s?.successfulLocators?.length ?? 0;
  }

  const actionsPerDomain: Record<string, number> = {};
  for (const entry of history) {
    actionsPerDomain[entry.domain] = (actionsPerDomain[entry.domain] || 0) + 1;
  }

  const largestDomains = Object.entries(actionsPerDomain)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([domain, actions]) => ({ domain, actions }));

  return {
    domainsCount: domains.length,
    totalActions: history.length,
    oldestEntry: history.length > 0 ? Math.min(...history.map(h => h.timestamp)) : null,
    strategiesPerDomain,
    largestDomains,
    totalSessions: 0,
  };
}
