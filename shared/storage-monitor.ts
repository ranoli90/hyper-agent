/**
 * Storage quota monitoring for Chrome extension storage.
 * Warns when approaching limits and helps prevent data loss.
 */

const QUOTA_WARNING_THRESHOLD = 0.8; // 80% of quota
const QUOTA_CRITICAL_THRESHOLD = 0.95; // 95% of quota
const DEFAULT_QUOTA = 5 * 1024 * 1024; // 5MB default
const UNLIMITED_STORAGE_QUOTA = 10 * 1024 * 1024; // 10MB with unlimitedStorage

export interface StorageStats {
  bytesUsed: number;
  bytesTotal: number;
  percentUsed: number;
  isNearLimit: boolean;
  isCritical: boolean;
  keysBySize: { key: string; size: number }[];
}

export async function getStorageStats(): Promise<StorageStats> {
  let bytesUsed = 0;
  const keysBySize: { key: string; size: number }[] = [];

  try {
    // Get all storage data
    const data = await chrome.storage.local.get(null);
    
    for (const [key, value] of Object.entries(data)) {
      const size = new Blob([JSON.stringify(value)]).size;
      keysBySize.push({ key, size });
      bytesUsed += size;
    }

    // Sort by size descending
    keysBySize.sort((a, b) => b.size - a.size);
  } catch (err) {
    console.warn('[StorageMonitor] Failed to calculate storage:', err);
  }

  // Chrome extension storage quota
  const bytesTotal = UNLIMITED_STORAGE_QUOTA; // We have unlimitedStorage permission
  const percentUsed = bytesUsed / bytesTotal;

  return {
    bytesUsed,
    bytesTotal,
    percentUsed,
    isNearLimit: percentUsed >= QUOTA_WARNING_THRESHOLD,
    isCritical: percentUsed >= QUOTA_CRITICAL_THRESHOLD,
    keysBySize: keysBySize.slice(0, 10), // Top 10 largest keys
  };
}

export async function checkStorageQuota(): Promise<{ ok: boolean; message?: string }> {
  const stats = await getStorageStats();

  if (stats.isCritical) {
    return {
      ok: false,
      message: `Storage critically full: ${(stats.percentUsed * 100).toFixed(1)}% used. Consider clearing old data.`,
    };
  }

  if (stats.isNearLimit) {
    return {
      ok: true,
      message: `Storage warning: ${(stats.percentUsed * 100).toFixed(1)}% used.`,
    };
  }

  return { ok: true };
}

export async function cleanupOldStorage(prefix: string, maxAge: number): Promise<number> {
  const data = await chrome.storage.local.get(null);
  const now = Date.now();
  const keysToRemove: string[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith(prefix)) {
      const item = value as { timestamp?: number };
      if (item.timestamp && (now - item.timestamp) > maxAge) {
        keysToRemove.push(key);
      }
    }
  }

  if (keysToRemove.length > 0) {
    await chrome.storage.local.remove(keysToRemove);
  }

  return keysToRemove.length;
}
