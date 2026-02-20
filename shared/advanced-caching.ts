// ─── Advanced Multi-Level Caching System with Intelligent Invalidation ──
// Enterprise-grade caching with compression, analytics, and cross-tab sync

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  accessCount: number;
  lastAccessed: number;
  size: number; // Approximate size in bytes
  tags: string[]; // For tag-based invalidation
  metadata?: Record<string, any>;
}

export interface CacheConfig {
  maxSize: number; // Max entries
  maxMemorySize: number; // Max memory usage in bytes
  defaultTTL: number; // Default TTL in milliseconds
  compressionEnabled: boolean;
  enablePersistence: boolean;
  enableAnalytics: boolean;
  evictionPolicy: 'lru' | 'lfu' | 'size' | 'ttl';
  syncAcrossTabs: boolean;
  enablePrefetch: boolean;
}

export interface CacheStats {
  totalEntries: number;
  memoryUsage: number;
  hitRate: number;
  missRate: number;
  evictionCount: number;
  compressionRatio: number;
  averageAccessTime: number;
  cacheEfficiency: number;
}

export class AdvancedCache<T = any> {
  private memoryCache = new Map<string, CacheEntry<T>>();
  private persistentCache = new Map<string, CacheEntry<T>>();
  protected config: CacheConfig;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    sets: 0,
    deletes: 0,
    accessTimes: [] as number[],
    compressionSavings: 0,
  };
  private cleanupInterval?: number;
  private syncChannel?: BroadcastChannel;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 1000,
      maxMemorySize: 50 * 1024 * 1024, // 50MB
      defaultTTL: 30 * 60 * 1000, // 30 minutes
      compressionEnabled: true,
      enablePersistence: true,
      enableAnalytics: true,
      evictionPolicy: 'lru',
      syncAcrossTabs: true,
      enablePrefetch: false,
      ...config,
    };

    // Defer all async/timer initialization to avoid keeping Node.js alive during bundling.
    // chrome.storage is only available at runtime in the extension.
    if (typeof chrome !== 'undefined' && chrome?.storage) {
      this.initializeCache();
      this.setupCleanup();
      this.setupCrossTabSync();
    }
  }

  // ─── Core Cache Operations ───────────────────────────────────────────
  async get(key: string): Promise<T | null> {
    const startTime = performance.now();

    // Check memory cache first
    let entry = this.memoryCache.get(key);

    if (!entry) {
      // Check persistent cache
      entry = this.persistentCache.get(key);
      if (entry) {
        // Move to memory cache
        this.memoryCache.set(key, entry);
      }
    }

    if (!entry) {
      this.stats.misses++;
      this.recordAccessTime(performance.now() - startTime);
      return null;
    }

    // Check TTL
    if (this.isExpired(entry)) {
      await this.delete(key);
      this.stats.misses++;
      this.recordAccessTime(performance.now() - startTime);
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    this.stats.hits++;
    this.recordAccessTime(performance.now() - startTime);

    return this.decompressIfNeeded(entry.value);
  }

  async set(
    key: string,
    value: T,
    options: {
      ttl?: number;
      tags?: string[];
      metadata?: Record<string, any>;
      skipCompression?: boolean;
    } = {}
  ): Promise<void> {
    const ttl = options.ttl || this.config.defaultTTL;
    const compressedValue =
      options.skipCompression || !this.config.compressionEnabled
        ? value
        : this.compressIfNeeded(value);

    const entry: CacheEntry<T> = {
      key,
      value: compressedValue,
      timestamp: Date.now(),
      ttl,
      accessCount: 0,
      lastAccessed: Date.now(),
      size: this.calculateSize(compressedValue),
      tags: options.tags || [],
      metadata: options.metadata,
    };

    // Update stats
    this.stats.sets++;

    // Store in memory cache
    this.memoryCache.set(key, entry);

    // Persist if enabled
    if (this.config.enablePersistence) {
      await this.persistEntry(entry);
      this.persistentCache.set(key, entry);
    }

    // Check size limits and evict if necessary
    await this.enforceSizeLimits();

    // Sync across tabs
    if (this.config.syncAcrossTabs) {
      this.syncEntry(entry, 'set');
    }
  }

  async delete(key: string): Promise<boolean> {
    const deletedFromMemory = this.memoryCache.delete(key);
    const deletedFromPersistent = this.persistentCache.delete(key);

    if (deletedFromMemory || deletedFromPersistent) {
      this.stats.deletes++;

      // Remove from persistent storage
      if (this.config.enablePersistence) {
        await this.removeFromStorage(key);
      }

      // Sync across tabs
      if (this.config.syncAcrossTabs) {
        this.syncEntry({ key } as CacheEntry, 'delete');
      }

      return true;
    }

    return false;
  }

  async clear(): Promise<void> {
    this.memoryCache.clear();
    this.persistentCache.clear();

    if (this.config.enablePersistence) {
      await this.clearStorage();
    }

    // Reset stats
    this.resetStats();

    // Sync across tabs
    if (this.config.syncAcrossTabs) {
      this.syncClear();
    }
  }

  // ─── Advanced Cache Operations ───────────────────────────────────────
  async getMultiple(keys: string[]): Promise<Map<string, T>> {
    const results = new Map<string, T>();

    // Process in parallel for better performance
    const promises = keys.map(async key => {
      const value = await this.get(key);
      if (value !== null) {
        results.set(key, value);
      }
    });

    await Promise.all(promises);
    return results;
  }

  async setMultiple(entries: Array<{ key: string; value: T; options?: any }>): Promise<void> {
    const promises = entries.map(({ key, value, options }) => this.set(key, value, options));
    await Promise.all(promises);
  }

  async invalidateByTag(tag: string): Promise<number> {
    const keysToDelete: string[] = [];

    // Find entries with the tag
    for (const [key, entry] of this.memoryCache) {
      if (entry.tags.includes(tag)) {
        keysToDelete.push(key);
      }
    }

    for (const [key, entry] of this.persistentCache) {
      if (entry.tags.includes(tag) && !keysToDelete.includes(key)) {
        keysToDelete.push(key);
      }
    }

    // Delete all matching entries
    const deletePromises = keysToDelete.map(key => this.delete(key));
    await Promise.all(deletePromises);

    return keysToDelete.length;
  }

  async invalidateByPattern(pattern: RegExp): Promise<number> {
    const keysToDelete: string[] = [];

    // Find entries matching the pattern
    for (const [key] of this.memoryCache) {
      if (pattern.test(key)) {
        keysToDelete.push(key);
      }
    }

    for (const [key] of this.persistentCache) {
      if (pattern.test(key) && !keysToDelete.includes(key)) {
        keysToDelete.push(key);
      }
    }

    // Delete all matching entries
    const deletePromises = keysToDelete.map(key => this.delete(key));
    await Promise.all(deletePromises);

    return keysToDelete.length;
  }

  async prefetch(keys: string[]): Promise<void> {
    if (!this.config.enablePrefetch) return;

    // Prefetch entries that are likely to be accessed soon
    const prefetchPromises = keys.map(async key => {
      // Check if already in memory
      if (!this.memoryCache.has(key)) {
        const entry = this.persistentCache.get(key);
        if (entry && !this.isExpired(entry)) {
          this.memoryCache.set(key, entry);
        }
      }
    });

    await Promise.all(prefetchPromises);
  }

  // ─── Cache Maintenance ───────────────────────────────────────────────
  private async enforceSizeLimits(): Promise<void> {
    // Check memory size limit
    let totalMemorySize = 0;
    for (const entry of this.memoryCache.values()) {
      totalMemorySize += entry.size;
    }

    if (totalMemorySize > this.config.maxMemorySize) {
      await this.evictEntries('size');
    }

    // Check entry count limit
    if (this.memoryCache.size > this.config.maxSize) {
      await this.evictEntries(this.config.evictionPolicy);
    }
  }

  private async evictEntries(policy: CacheConfig['evictionPolicy']): Promise<void> {
    const entries = Array.from(this.memoryCache.entries());
    let entriesToEvict: string[] = [];

    switch (policy) {
      case 'lru':
        // Least Recently Used
        entriesToEvict = entries
          .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed)
          .slice(0, Math.ceil(entries.length * 0.1)) // Evict 10%
          .map(([key]) => key);
        break;

      case 'lfu':
        // Least Frequently Used
        entriesToEvict = entries
          .sort(([, a], [, b]) => a.accessCount - b.accessCount)
          .slice(0, Math.ceil(entries.length * 0.1))
          .map(([key]) => key);
        break;

      case 'ttl':
        // Expired entries
        entriesToEvict = entries.filter(([, entry]) => this.isExpired(entry)).map(([key]) => key);
        break;

      case 'size':
        // Largest entries
        entriesToEvict = entries
          .sort(([, a], [, b]) => b.size - a.size)
          .slice(0, Math.ceil(entries.length * 0.1))
          .map(([key]) => key);
        break;
    }

    // Evict selected entries
    for (const key of entriesToEvict) {
      this.memoryCache.delete(key);
      this.persistentCache.delete(key);
      this.stats.evictions++;

      if (this.config.enablePersistence) {
        await this.removeFromStorage(key);
      }
    }
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  // ─── Compression ─────────────────────────────────────────────────────
  private compressIfNeeded(value: T): T {
    if (!this.config.compressionEnabled) return value;

    try {
      // Simple compression for strings
      if (typeof value === 'string' && value.length > 1000) {
        // Convert to base64 (not real compression, but reduces size for storage)
        const compressed = btoa(encodeURIComponent(value));
        this.stats.compressionSavings += value.length - compressed.length;
        return compressed as unknown as T;
      }
    } catch (error) {
      // If compression fails, return original
      console.warn('[Cache] Compression failed:', error);
    }

    return value;
  }

  private decompressIfNeeded(value: T): T {
    if (!this.config.compressionEnabled) return value;

    try {
      // Decompress strings
      if (typeof value === 'string' && value.startsWith('data:')) {
        return decodeURIComponent(atob(value)) as unknown as T;
      }
    } catch (error) {
      // If decompression fails, return as-is
      console.warn('[Cache] Decompression failed:', error);
    }

    return value;
  }

  private calculateSize(value: T): number {
    if (typeof value === 'string') return value.length * 2; // Rough estimate
    if (typeof value === 'number') return 8;
    if (typeof value === 'boolean') return 1;
    if (value === null || value === undefined) return 0;

    // For objects, estimate based on JSON string length
    try {
      return JSON.stringify(value).length * 2;
    } catch {
      return 1000; // Fallback estimate
    }
  }

  // ─── Persistence Layer ───────────────────────────────────────────────
  private async persistEntry(entry: CacheEntry): Promise<void> {
    try {
      const storageKey = `hyperagent_cache_${entry.key}`;
      await chrome.storage.local.set({ [storageKey]: entry });
    } catch (error) {
      console.warn('[Cache] Failed to persist entry:', error);
    }
  }

  private async removeFromStorage(key: string): Promise<void> {
    try {
      const storageKey = `hyperagent_cache_${key}`;
      await chrome.storage.local.remove(storageKey);
    } catch (error) {
      console.warn('[Cache] Failed to remove from storage:', error);
    }
  }

  private async clearStorage(): Promise<void> {
    try {
      const data = await chrome.storage.local.get(null);
      const cacheKeys = Object.keys(data).filter(key => key.startsWith('hyperagent_cache_'));
      await chrome.storage.local.remove(cacheKeys);
    } catch (error) {
      console.warn('[Cache] Failed to clear storage:', error);
    }
  }

  private async initializeCache(): Promise<void> {
    if (!this.config.enablePersistence) return;

    try {
      const data = await chrome.storage.local.get(null);
      const cacheKeys = Object.keys(data).filter(key => key.startsWith('hyperagent_cache_'));

      for (const storageKey of cacheKeys) {
        const entry = data[storageKey] as CacheEntry<T>;
        if (entry && !this.isExpired(entry)) {
          this.persistentCache.set(entry.key, entry);
        } else {
          // Clean up expired entries
          await chrome.storage.local.remove(storageKey);
        }
      }

      console.log(`[Cache] Loaded ${this.persistentCache.size} entries from storage`);
    } catch (error) {
      console.warn('[Cache] Failed to initialize from storage:', error);
    }
  }

  // ─── Cross-Tab Synchronization ──────────────────────────────────────
  private setupCrossTabSync(): void {
    if (!this.config.syncAcrossTabs) return;

    try {
      this.syncChannel = new BroadcastChannel('hyperagent-cache-sync');

      this.syncChannel.onmessage = event => {
        const { type, entry, key } = event.data;

        switch (type) {
          case 'set':
            if (entry && !this.memoryCache.has(entry.key)) {
              this.memoryCache.set(entry.key, entry);
            }
            break;
          case 'delete':
            if (key) {
              this.memoryCache.delete(key);
              this.persistentCache.delete(key);
            }
            break;
          case 'clear':
            this.memoryCache.clear();
            this.persistentCache.clear();
            break;
        }
      };
    } catch (error) {
      console.warn('[Cache] Cross-tab sync not available:', error);
    }
  }

  private syncEntry(entry: CacheEntry, type: 'set' | 'delete'): void {
    if (this.syncChannel) {
      this.syncChannel.postMessage({ type, entry, key: entry.key });
    }
  }

  private syncClear(): void {
    if (this.syncChannel) {
      this.syncChannel.postMessage({ type: 'clear' });
    }
  }

  // ─── Maintenance ─────────────────────────────────────────────────────
  private setupCleanup(): void {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = globalThis.setInterval(
      () => {
        this.cleanup();
      },
      5 * 60 * 1000
    );
  }

  private async cleanup(): Promise<void> {
    const expiredKeys: string[] = [];

    // Find expired entries
    for (const [key, entry] of this.memoryCache) {
      if (this.isExpired(entry)) {
        expiredKeys.push(key);
      }
    }

    for (const [key, entry] of this.persistentCache) {
      if (this.isExpired(entry)) {
        expiredKeys.push(key);
      }
    }

    // Remove expired entries
    for (const key of expiredKeys) {
      this.memoryCache.delete(key);
      this.persistentCache.delete(key);

      if (this.config.enablePersistence) {
        await this.removeFromStorage(key);
      }
    }

    if (expiredKeys.length > 0) {
      console.log(`[Cache] Cleaned up ${expiredKeys.length} expired entries`);
    }

    // Enforce size limits
    await this.enforceSizeLimits();
  }

  // ─── Analytics and Monitoring ────────────────────────────────────────
  private recordAccessTime(time: number): void {
    this.stats.accessTimes.push(time);

    // Keep only last 1000 access times
    if (this.stats.accessTimes.length > 1000) {
      this.stats.accessTimes.shift();
    }
  }

  private resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      sets: 0,
      deletes: 0,
      accessTimes: [],
      compressionSavings: 0,
    };
  }

  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const avgAccessTime =
      this.stats.accessTimes.length > 0
        ? this.stats.accessTimes.reduce((a, b) => a + b, 0) / this.stats.accessTimes.length
        : 0;

    let totalMemorySize = 0;
    for (const entry of this.memoryCache.values()) {
      totalMemorySize += entry.size;
    }

    return {
      totalEntries: this.memoryCache.size,
      memoryUsage: totalMemorySize,
      hitRate: totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0,
      missRate: totalRequests > 0 ? (this.stats.misses / totalRequests) * 100 : 0,
      evictionCount: this.stats.evictions,
      compressionRatio:
        this.stats.compressionSavings > 0
          ? (this.stats.compressionSavings / (this.stats.compressionSavings + totalMemorySize)) *
            100
          : 0,
      averageAccessTime: avgAccessTime,
      cacheEfficiency:
        totalRequests > 0 ? (this.stats.hits / (this.stats.hits + this.stats.evictions)) * 100 : 0,
    };
  }

  // ─── Advanced Features ───────────────────────────────────────────────
  async warmCache(keys: string[]): Promise<void> {
    console.log(`[Cache] Warming cache with ${keys.length} entries...`);
    await this.prefetch(keys);
  }

  async exportCache(): Promise<Record<string, CacheEntry>> {
    const exportData: Record<string, CacheEntry> = {};

    // Export memory cache
    for (const [key, entry] of this.memoryCache) {
      exportData[key] = entry;
    }

    // Export persistent cache
    for (const [key, entry] of this.persistentCache) {
      if (!exportData[key]) {
        // Prefer memory cache version
        exportData[key] = entry;
      }
    }

    return exportData;
  }

  async importCache(importData: Record<string, CacheEntry>): Promise<void> {
    console.log(`[Cache] Importing ${Object.keys(importData).length} cache entries...`);

    const entries = Object.values(importData);
    await this.setMultiple(
      entries.map(entry => ({
        key: entry.key,
        value: entry.value,
        options: {
          ttl: entry.ttl,
          tags: entry.tags,
          metadata: entry.metadata,
          skipCompression: true, // Already compressed in export
        },
      }))
    );
  }

  // ─── Lifecycle Management ────────────────────────────────────────────
  destroy(): void {
    if (this.cleanupInterval) {
      globalThis.clearInterval(this.cleanupInterval);
    }

    if (this.syncChannel) {
      this.syncChannel.close();
    }

    this.memoryCache.clear();
    this.persistentCache.clear();
    this.resetStats();

    console.log('[Cache] Cache destroyed and cleaned up');
  }
}

// ─── Specialized Caches for Different Data Types ──────────────────────

export class APICache extends AdvancedCache {
  constructor() {
    super({
      maxSize: 500,
      defaultTTL: 15 * 60 * 1000, // 15 minutes for API responses
      evictionPolicy: 'ttl',
      enablePersistence: true,
      enableAnalytics: true,
    });
  }

  async getAPIResponse(endpoint: string, params?: Record<string, any>): Promise<any> {
    const cacheKey = this.generateAPIKey(endpoint, params);
    return await this.get(cacheKey);
  }

  async setAPIResponse(
    endpoint: string,
    params: Record<string, any> | undefined,
    response: any,
    ttl?: number
  ): Promise<void> {
    const cacheKey = this.generateAPIKey(endpoint, params);
    await this.set(cacheKey, response, {
      ttl: ttl || this.config.defaultTTL,
      tags: ['api', endpoint.split('/')[1] || 'unknown'],
      metadata: { endpoint, params, responseType: typeof response },
    });
  }

  private generateAPIKey(endpoint: string, params?: Record<string, any>): string {
    const paramString = params ? JSON.stringify(params) : '';
    return `api_${btoa(endpoint + paramString)
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 32)}`;
  }
}

export class DOMCache extends AdvancedCache<Document | Element> {
  constructor() {
    super({
      maxSize: 100,
      defaultTTL: 5 * 60 * 1000, // 5 minutes for DOM elements
      evictionPolicy: 'lru',
      enablePersistence: false, // DOM elements can't be persisted
      enableAnalytics: true,
    });
  }

  async getDOMElement(selector: string, context?: Element): Promise<Document | Element | null> {
    const cacheKey = `dom_${selector}_${context ? context.tagName : 'document'}`;
    return await this.get(cacheKey);
  }

  async setDOMElement(selector: string, element: Element, context?: Element): Promise<void> {
    const cacheKey = `dom_${selector}_${context ? context.tagName : 'document'}`;
    await this.set(cacheKey, element, {
      ttl: this.config.defaultTTL,
      tags: ['dom', selector.split(' ')[0]],
      metadata: { selector, contextTag: context?.tagName },
    });
  }
}

export class AssetCache extends AdvancedCache<string> {
  constructor() {
    super({
      maxSize: 200,
      defaultTTL: 24 * 60 * 60 * 1000, // 24 hours for assets
      evictionPolicy: 'size',
      enablePersistence: true,
      enableAnalytics: true,
      compressionEnabled: true,
    });
  }

  async getAsset(url: string): Promise<string | null> {
    const cacheKey = `asset_${btoa(url)
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 32)}`;
    return await this.get(cacheKey);
  }

  async setAsset(url: string, content: string): Promise<void> {
    const cacheKey = `asset_${btoa(url)
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 32)}`;
    await this.set(cacheKey, content, {
      ttl: this.config.defaultTTL,
      tags: ['asset', this.getAssetType(url)],
      metadata: { url, size: content.length },
    });
  }

  private getAssetType(url: string): string {
    const extension = url.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'js':
        return 'javascript';
      case 'css':
        return 'stylesheet';
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'webp':
        return 'image';
      case 'woff':
      case 'woff2':
      case 'ttf':
        return 'font';
      default:
        return 'unknown';
    }
  }
}

// ─── Global Cache Instances ────────────────────────────────────────────
export const apiCache = new APICache();
export const domCache = new DOMCache();
export const assetCache = new AssetCache();

// General-purpose cache
export const generalCache = new AdvancedCache({
  maxSize: 1000,
  defaultTTL: 30 * 60 * 1000, // 30 minutes
  evictionPolicy: 'lru',
  enablePersistence: true,
  enableAnalytics: true,
  syncAcrossTabs: true,
});

// ─── Cache Manager for Orchestrating Multiple Caches ──────────────────
export class CacheManager {
  private caches = new Map<string, AdvancedCache>();

  registerCache(name: string, cache: AdvancedCache): void {
    this.caches.set(name, cache);
  }

  getCache(name: string): AdvancedCache | undefined {
    return this.caches.get(name);
  }

  async clearAllCaches(): Promise<void> {
    const clearPromises = Array.from(this.caches.values()).map(cache => cache.clear());
    await Promise.all(clearPromises);
  }

  getAllStats(): Record<string, CacheStats> {
    const stats: Record<string, CacheStats> = {};
    for (const [name, cache] of this.caches) {
      stats[name] = cache.getStats();
    }
    return stats;
  }

  async invalidateByTag(tag: string): Promise<number> {
    let totalInvalidated = 0;
    for (const cache of this.caches.values()) {
      totalInvalidated += await cache.invalidateByTag(tag);
    }
    return totalInvalidated;
  }

  async warmCaches(prefetchData: Record<string, string[]>): Promise<void> {
    const warmPromises = Object.entries(prefetchData).map(async ([cacheName, keys]) => {
      const cache = this.caches.get(cacheName);
      if (cache) {
        await cache.prefetch(keys);
      }
    });
    await Promise.all(warmPromises);
  }
}

// ─── Global Cache Manager Instance ────────────────────────────────────
export const cacheManager = new CacheManager();

// Register default caches
cacheManager.registerCache('api', apiCache);
cacheManager.registerCache('dom', domCache);
cacheManager.registerCache('asset', assetCache);
cacheManager.registerCache('general', generalCache);

// ─── Export Convenience Functions ────────────────────────────────────
export const cache = {
  get: (key: string) => generalCache.get(key),
  set: (key: string, value: any, options?: any) => generalCache.set(key, value, options),
  delete: (key: string) => generalCache.delete(key),
  clear: () => generalCache.clear(),
  getMultiple: (keys: string[]) => generalCache.getMultiple(keys),
  setMultiple: (entries: any[]) => generalCache.setMultiple(entries),
  invalidateByTag: (tag: string) => generalCache.invalidateByTag(tag),
  invalidateByPattern: (pattern: RegExp) => generalCache.invalidateByPattern(pattern),
  getStats: () => generalCache.getStats(),
  warm: (keys: string[]) => generalCache.warmCache(keys),
};

// ─── Export Default ────────────────────────────────────────────────────
export default generalCache;
