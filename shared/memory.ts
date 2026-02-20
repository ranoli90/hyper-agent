import { STORAGE_KEYS } from './config';
import type { SiteStrategy, ActionLogEntry, Locator, Action } from './types';
import { extractDomain } from './url-utils';

// Re-export for consumers that import from memory
export { extractDomain } from './url-utils';

// Constants for memory management
const MAX_ENTRIES_PER_DOMAIN = 100;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

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
  // Clean up old entries first (older than 30 days)
  const cutoff = Date.now() - THIRTY_DAYS_MS;
  const cleaned = history.filter(entry => entry.timestamp > cutoff);
  
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
    };
  }

  const strategy = strategies[domain];
  strategy.lastUsed = Date.now();

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

  // Get successful locators sorted by success count
  const successful = strategy.successfulLocators
    .filter(s => s.actionType === actionType)
    .sort((a, b) => b.successCount - a.successCount);

  return successful.slice(0, 3).map(s => s.locator);
}

// ─── Clear all memory ────────────────────────────────────────────
export async function clearMemory(): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.SITE_STRATEGIES]: {},
    [STORAGE_KEYS.ACTION_HISTORY]: [],
  });
}

// ─── Get memory stats ─────────────────────────────────────────────
export async function getMemoryStats(): Promise<{
  domainsCount: number;
  totalActions: number;
  oldestEntry: number | null;
}> {
  const strategies = await loadStrategies();
  const history = await loadActionHistory();

  return {
    domainsCount: Object.keys(strategies).length,
    totalActions: history.length,
    oldestEntry: history.length > 0 ? Math.min(...history.map(h => h.timestamp)) : null,
  };
}
