// ─── Advanced Memory Management & Leak Prevention System ─────────────
// Comprehensive memory monitoring, leak detection, and automatic cleanup
// for long-running Chrome extensions

export interface MemorySnapshot {
  timestamp: number;
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  usedPercentage: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  gcEvents: number;
  allocations: number;
}

export interface MemoryLeak {
  id: string;
  type: 'persistent_object' | 'growing_collection' | 'uncleaned_event_listener' | 'orphaned_timer';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location?: string;
  sizeEstimate?: number;
  firstDetected: number;
  lastSeen: number;
  occurrences: number;
}

export interface MemoryConfig {
  monitoringEnabled: boolean;
  leakDetectionEnabled: boolean;
  autoCleanupEnabled: boolean;
  maxMemoryPercentage: number; // Max % of heap to use
  cleanupInterval: number; // ms
  snapshotInterval: number; // ms
  leakCheckInterval: number; // ms
  gcThreshold: number; // Memory increase threshold to trigger GC
  warningThreshold: number; // Memory % to trigger warnings
  criticalThreshold: number; // Memory % to trigger emergency cleanup
}

export class MemoryManager {
  private config: MemoryConfig;
  private snapshots: MemorySnapshot[] = [];
  private detectedLeaks: Map<string, MemoryLeak> = new Map();
  private eventListeners = new WeakMap<object, Set<string>>();
  private timers = new Set<number>();
  private intervals = new Set<number>();
  private observers = new Set<MutationObserver | IntersectionObserver | PerformanceObserver>();
  private weakRefs = new Set<WeakRef<object>>();
  private monitoringInterval?: number;
  private cleanupInterval?: number;
  private leakCheckInterval?: number;

  constructor(config: Partial<MemoryConfig> = {}) {
    this.config = {
      monitoringEnabled: true,
      leakDetectionEnabled: true,
      autoCleanupEnabled: true,
      maxMemoryPercentage: 80,
      cleanupInterval: 300000, // 5 minutes
      snapshotInterval: 60000, // 1 minute
      leakCheckInterval: 300000, // 5 minutes
      gcThreshold: 50 * 1024 * 1024, // 50MB increase triggers GC
      warningThreshold: 70,
      criticalThreshold: 85,
      ...config,
    };

    // Only start monitoring in browser/service-worker environments to avoid
    // keeping the Node.js process alive during bundling.
    if (this.config.monitoringEnabled &&
        (typeof (globalThis as any).document !== 'undefined' || typeof (globalThis as any).ServiceWorkerGlobalScope !== 'undefined')) {
      this.startMonitoring();
    }
  }

  // ─── Memory Monitoring ─────────────────────────────────────────────────
  private startMonitoring(): void {
    // Take initial snapshot
    this.takeMemorySnapshot();

    // Start periodic monitoring
    this.monitoringInterval = window.setInterval(() => {
      this.takeMemorySnapshot();
      this.checkMemoryThresholds();
    }, this.config.snapshotInterval);

    // Start leak detection
    if (this.config.leakDetectionEnabled) {
      this.leakCheckInterval = window.setInterval(() => {
        this.detectMemoryLeaks();
      }, this.config.leakCheckInterval);
    }

    // Start automatic cleanup
    if (this.config.autoCleanupEnabled) {
      this.cleanupInterval = window.setInterval(() => {
        this.performAutomaticCleanup();
      }, this.config.cleanupInterval);
    }

    console.log('[MemoryManager] Memory monitoring started');
  }

  private takeMemorySnapshot(): void {
    const memInfo = (performance as any).memory;
    if (!memInfo) return;

    const current: MemorySnapshot = {
      timestamp: Date.now(),
      usedJSHeapSize: memInfo.usedJSHeapSize,
      totalJSHeapSize: memInfo.totalJSHeapSize,
      jsHeapSizeLimit: memInfo.jsHeapSizeLimit,
      usedPercentage: (memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit) * 100,
      trend: 'stable',
      gcEvents: 0, // Would need performance.memory API extension
      allocations: 0,
    };

    // Calculate trend
    if (this.snapshots.length > 0) {
      const previous = this.snapshots[this.snapshots.length - 1];
      const diff = current.usedJSHeapSize - previous.usedJSHeapSize;

      if (diff > 1024 * 1024) {
        // 1MB increase
        current.trend = 'increasing';
      } else if (diff < -1024 * 1024) {
        // 1MB decrease
        current.trend = 'decreasing';
      }
    }

    this.snapshots.push(current);

    // Keep only last 100 snapshots
    if (this.snapshots.length > 100) {
      this.snapshots.shift();
    }

    // Trigger GC if memory usage is high
    if (current.usedPercentage > this.config.warningThreshold) {
      this.attemptGarbageCollection();
    }
  }

  private checkMemoryThresholds(): void {
    const latest = this.snapshots[this.snapshots.length - 1];
    if (!latest) return;

    if (latest.usedPercentage >= this.config.criticalThreshold) {
      console.error(
        `[MemoryManager] CRITICAL: Memory usage at ${latest.usedPercentage.toFixed(1)}%`
      );
      this.performEmergencyCleanup();

      // Notify user through extension
      this.notifyUserOfMemoryIssue('critical', latest.usedPercentage);
    } else if (latest.usedPercentage >= this.config.warningThreshold) {
      console.warn(`[MemoryManager] WARNING: Memory usage at ${latest.usedPercentage.toFixed(1)}%`);
      this.notifyUserOfMemoryIssue('warning', latest.usedPercentage);
    }
  }

  private notifyUserOfMemoryIssue(severity: 'warning' | 'critical', percentage: number): void {
    const message = {
      type: 'memory_warning',
      severity,
      message: `Memory usage is high (${percentage.toFixed(1)}%). Consider refreshing the extension.`,
      percentage,
      timestamp: Date.now(),
    };

    if (chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage(message).catch(() => {});
    }
  }

  // ─── Garbage Collection ────────────────────────────────────────────────
  private attemptGarbageCollection(): void {
    // Force garbage collection (Chrome DevTools only)
    if ((window as any).gc) {
      (window as any).gc();
      console.log('[MemoryManager] Manual garbage collection triggered');
    }

    // Clear unused caches and references
    this.clearUnusedCaches();
  }

  private clearUnusedCaches(): void {
    // Clear any extension-specific caches
    try {
      // Clear image caches
      const images = document.querySelectorAll('img[data-cache]');
      images.forEach(img => {
        if ((img as any)._cacheTimeout) {
          clearTimeout((img as any)._cacheTimeout);
          (img as any)._cacheTimeout = null;
        }
      });

      // Clear fetch caches if available
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => {
            if (name.includes('temp') || name.includes('cache')) {
              caches.delete(name);
            }
          });
        });
      }
    } catch (error) {
      console.warn('[MemoryManager] Error clearing caches:', error);
    }
  }

  // ─── Memory Leak Detection ────────────────────────────────────────────
  private detectMemoryLeaks(): void {
    // Check for persistent objects
    this.detectPersistentObjects();

    // Check for growing collections
    this.detectGrowingCollections();

    // Check for uncleaned event listeners
    this.detectUncleanedEventListeners();

    // Check for orphaned timers
    this.detectOrphanedTimers();

    // Report detected leaks
    this.reportDetectedLeaks();
  }

  private detectPersistentObjects(): void {
    // Check for objects that persist longer than expected
    // This is a simplified implementation
    const persistentObjects = new Set();

    // Check global object for unexpected properties
    for (const key in window) {
      if (key.startsWith('temp_') || key.startsWith('cache_')) {
        persistentObjects.add(key);
      }
    }

    if (persistentObjects.size > 10) {
      // Arbitrary threshold
      this.recordLeak({
        id: 'persistent_global_objects',
        type: 'persistent_object',
        severity: 'medium',
        description: `Found ${persistentObjects.size} persistent global objects`,
        sizeEstimate: persistentObjects.size * 1000, // Rough estimate
        firstDetected: Date.now(),
        lastSeen: Date.now(),
        occurrences: 1,
      });
    }
  }

  private detectGrowingCollections(): void {
    // Monitor collections that keep growing
    // This would require tracking collection sizes over time
    // Simplified implementation
    const largeCollections = [];

    // Check for large arrays/maps/sets in global scope
    for (const key in window) {
      const value = (window as any)[key];
      if (Array.isArray(value) && value.length > 10000) {
        largeCollections.push({ name: key, size: value.length });
      } else if (value instanceof Map && value.size > 1000) {
        largeCollections.push({ name: key, size: value.size });
      } else if (value instanceof Set && value.size > 1000) {
        largeCollections.push({ name: key, size: value.size });
      }
    }

    largeCollections.forEach(collection => {
      this.recordLeak({
        id: `growing_collection_${collection.name}`,
        type: 'growing_collection',
        severity: 'high',
        description: `Large collection detected: ${collection.name} (${collection.size} items)`,
        sizeEstimate: collection.size * 100, // Rough estimate
        firstDetected: Date.now(),
        lastSeen: Date.now(),
        occurrences: 1,
      });
    });
  }

  private detectUncleanedEventListeners(): void {
    // Check for potential uncleaned event listeners
    // This is difficult to detect directly, so we use heuristics
    const elements = document.querySelectorAll('*');
    let totalListeners = 0;

    elements.forEach(element => {
      const listeners = (element as any).__listeners;
      if (listeners) {
        totalListeners += Object.keys(listeners).length;
      }
    });

    if (totalListeners > 1000) {
      // Arbitrary threshold
      this.recordLeak({
        id: 'uncleaned_event_listeners',
        type: 'uncleaned_event_listener',
        severity: 'medium',
        description: `High number of event listeners detected: ${totalListeners}`,
        sizeEstimate: totalListeners * 50, // Rough estimate per listener
        firstDetected: Date.now(),
        lastSeen: Date.now(),
        occurrences: 1,
      });
    }
  }

  private detectOrphanedTimers(): void {
    // Check for orphaned timers
    if (this.timers.size > 50) {
      // Arbitrary threshold
      this.recordLeak({
        id: 'orphaned_timers',
        type: 'orphaned_timer',
        severity: 'low',
        description: `High number of active timers: ${this.timers.size}`,
        firstDetected: Date.now(),
        lastSeen: Date.now(),
        occurrences: 1,
      });
    }
  }

  private recordLeak(leak: MemoryLeak): void {
    const existing = this.detectedLeaks.get(leak.id);
    if (existing) {
      existing.occurrences++;
      existing.lastSeen = Date.now();
      existing.sizeEstimate = Math.max(existing.sizeEstimate || 0, leak.sizeEstimate || 0);
    } else {
      this.detectedLeaks.set(leak.id, leak);
    }
  }

  private reportDetectedLeaks(): void {
    const criticalLeaks = Array.from(this.detectedLeaks.values()).filter(
      leak => leak.severity === 'critical'
    );

    const highLeaks = Array.from(this.detectedLeaks.values()).filter(
      leak => leak.severity === 'high'
    );

    if (criticalLeaks.length > 0) {
      console.error('[MemoryManager] CRITICAL LEAKS DETECTED:', criticalLeaks);
    }

    if (highLeaks.length > 0) {
      console.warn('[MemoryManager] HIGH PRIORITY LEAKS DETECTED:', highLeaks);
    }

    // Send leak report to extension
    const leakReport = {
      type: 'memory_leak_report',
      criticalLeaks: criticalLeaks.length,
      highLeaks: highLeaks.length,
      totalLeaks: this.detectedLeaks.size,
      timestamp: Date.now(),
    };

    if (chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage(leakReport).catch(() => {});
    }
  }

  // ─── Automatic Cleanup ─────────────────────────────────────────────────
  private performAutomaticCleanup(): void {
    console.log('[MemoryManager] Performing automatic cleanup...');

    // Clear expired caches
    this.clearExpiredCaches();

    // Clean up unused DOM elements
    this.cleanupUnusedDOM();

    // Force garbage collection if available
    this.attemptGarbageCollection();

    // Clean up old snapshots
    this.cleanupOldSnapshots();
  }

  private performEmergencyCleanup(): void {
    console.log('[MemoryManager] Performing EMERGENCY cleanup...');

    // Aggressive cleanup measures
    this.clearAllCaches();
    this.cleanupAllTimers();
    this.cleanupAllObservers();
    this.attemptGarbageCollection();

    // Clear detected leaks (they might be cleaned up now)
    this.detectedLeaks.clear();
  }

  private clearExpiredCaches(): void {
    // Clear any cached data older than 1 hour
    const cutoff = Date.now() - 60 * 60 * 1000;

    try {
      // Clear localStorage caches
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('cache_') || key.startsWith('temp_')) {
          const data = localStorage.getItem(key);
          if (data) {
            try {
              const parsed = JSON.parse(data);
              if (parsed.timestamp && parsed.timestamp < cutoff) {
                localStorage.removeItem(key);
              }
            } catch {
              // Invalid JSON, remove it
              localStorage.removeItem(key);
            }
          }
        }
      });

      // Clear chrome.storage caches
      chrome.storage.local
        .get(null)
        .then((data: Record<string, any>) => {
          const keysToRemove = Object.keys(data).filter(key => {
            if (key.startsWith('cache_') || key.startsWith('temp_')) {
              const item = data[key];
              return item.timestamp && item.timestamp < cutoff;
            }
            return false;
          });

          if (keysToRemove.length > 0) {
            chrome.storage.local.remove(keysToRemove);
          }
        })
        .catch(() => {});
    } catch (error) {
      console.warn('[MemoryManager] Error clearing expired caches:', error);
    }
  }

  private clearAllCaches(): void {
    // Emergency cache clearing
    try {
      // Clear all cache-like localStorage entries
      const keys = Object.keys(localStorage);
      const cacheKeys = keys.filter(
        key => key.startsWith('cache_') || key.startsWith('temp_') || key.includes('log')
      );
      cacheKeys.forEach(key => localStorage.removeItem(key));

      console.log(`[MemoryManager] Cleared ${cacheKeys.length} cache entries`);
    } catch (error) {
      console.warn('[MemoryManager] Error clearing all caches:', error);
    }
  }

  private cleanupUnusedDOM(): void {
    // Remove unused DOM elements
    try {
      // Remove orphaned elements
      const orphaned = document.querySelectorAll('[data-temp], [data-cache]');
      orphaned.forEach(element => {
        if (!element.isConnected) {
          element.remove();
        }
      });

      // Clean up extension-specific elements
      const extensionElements = document.querySelectorAll('[data-extension-temp]');
      extensionElements.forEach(element => element.remove());
    } catch (error) {
      console.warn('[MemoryManager] Error cleaning up DOM:', error);
    }
  }

  private cleanupAllTimers(): void {
    // Clear all tracked timers
    this.timers.forEach(timerId => {
      clearTimeout(timerId);
    });
    this.timers.clear();

    this.intervals.forEach(intervalId => {
      clearInterval(intervalId);
    });
    this.intervals.clear();

    console.log('[MemoryManager] Cleared all tracked timers');
  }

  private cleanupAllObservers(): void {
    // Disconnect all tracked observers
    this.observers.forEach(observer => {
      observer.disconnect();
    });
    this.observers.clear();

    console.log('[MemoryManager] Disconnected all tracked observers');
  }

  private cleanupOldSnapshots(): void {
    // Keep only last 24 hours of snapshots
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const oldCount = this.snapshots.length;
    this.snapshots = this.snapshots.filter(snapshot => snapshot.timestamp > cutoff);

    if (oldCount > this.snapshots.length) {
      console.log(`[MemoryManager] Cleaned up ${oldCount - this.snapshots.length} old snapshots`);
    }
  }

  // ─── Resource Tracking ────────────────────────────────────────────────
  trackTimer(timerId: number, isInterval = false): void {
    if (isInterval) {
      this.intervals.add(timerId);
    } else {
      this.timers.add(timerId);
    }
  }

  untrackTimer(timerId: number, isInterval = false): void {
    if (isInterval) {
      this.intervals.delete(timerId);
    } else {
      this.timers.delete(timerId);
    }
  }

  trackObserver(observer: MutationObserver | IntersectionObserver | PerformanceObserver): void {
    this.observers.add(observer);
  }

  untrackObserver(observer: MutationObserver | IntersectionObserver | PerformanceObserver): void {
    this.observers.delete(observer);
  }

  trackWeakRef(ref: WeakRef<object>): void {
    this.weakRefs.add(ref);
  }

  // ─── Public API ───────────────────────────────────────────────────────
  getMemoryStats(): {
    currentUsage: MemorySnapshot | null;
    averageUsage: number;
    peakUsage: number;
    trend: string;
    leakCount: number;
    criticalLeaks: number;
  } {
    const current = this.snapshots[this.snapshots.length - 1] || null;
    const usages = this.snapshots.map(s => s.usedJSHeapSize);
    const averageUsage = usages.length > 0 ? usages.reduce((a, b) => a + b, 0) / usages.length : 0;
    const peakUsage = usages.length > 0 ? Math.max(...usages) : 0;
    const trend = current?.trend || 'unknown';

    const leaks = Array.from(this.detectedLeaks.values());
    const criticalLeaks = leaks.filter(l => l.severity === 'critical').length;

    return {
      currentUsage: current,
      averageUsage,
      peakUsage,
      trend,
      leakCount: this.detectedLeaks.size,
      criticalLeaks,
    };
  }

  getLeaks(): MemoryLeak[] {
    return Array.from(this.detectedLeaks.values());
  }

  forceCleanup(): void {
    this.performEmergencyCleanup();
  }

  updateConfig(newConfig: Partial<MemoryConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  destroy(): void {
    // Clean up all resources
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.leakCheckInterval) {
      clearInterval(this.leakCheckInterval);
    }

    this.cleanupAllTimers();
    this.cleanupAllObservers();
    this.clearAllCaches();

    this.snapshots = [];
    this.detectedLeaks.clear();

    console.log('[MemoryManager] Memory manager destroyed and cleaned up');
  }
}

// ─── Global Memory Manager Instance ────────────────────────────────────
export const memoryManager = new MemoryManager({
  monitoringEnabled: true,
  leakDetectionEnabled: true,
  autoCleanupEnabled: true,
  maxMemoryPercentage: 80,
  cleanupInterval: 300000, // 5 minutes
  snapshotInterval: 60000, // 1 minute
  leakCheckInterval: 300000, // 5 minutes
  gcThreshold: 50 * 1024 * 1024, // 50MB
  warningThreshold: 70,
  criticalThreshold: 85,
});

// ─── Convenience Functions ────────────────────────────────────────────
export const mem = {
  trackTimer: (timerId: number, isInterval = false) =>
    memoryManager.trackTimer(timerId, isInterval),
  untrackTimer: (timerId: number, isInterval = false) =>
    memoryManager.untrackTimer(timerId, isInterval),
  trackObserver: (observer: MutationObserver | IntersectionObserver | PerformanceObserver) =>
    memoryManager.trackObserver(observer),
  untrackObserver: (observer: MutationObserver | IntersectionObserver | PerformanceObserver) =>
    memoryManager.untrackObserver(observer),
  trackWeakRef: (ref: WeakRef<object>) => memoryManager.trackWeakRef(ref),
  getStats: () => memoryManager.getMemoryStats(),
  forceCleanup: () => memoryManager.forceCleanup(),
};

// ─── Enhanced Timer/Observer Wrappers ────────────────────────────────

// Safe setTimeout that tracks memory usage
export function safeSetTimeout(callback: () => void, delay: number): number {
  const timerId = window.setTimeout(() => {
    memoryManager.untrackTimer(timerId);
    callback();
  }, delay);

  memoryManager.trackTimer(timerId);
  return timerId;
}

// Safe setInterval that tracks memory usage
export function safeSetInterval(callback: () => void, delay: number): number {
  const intervalId = window.setInterval(callback, delay);
  memoryManager.trackTimer(intervalId, true);
  return intervalId;
}

// Safe clearTimeout that updates tracking
export function safeClearTimeout(timerId: number): void {
  memoryManager.untrackTimer(timerId);
  clearTimeout(timerId);
}

// Safe clearInterval that updates tracking
export function safeClearInterval(intervalId: number): void {
  memoryManager.untrackTimer(intervalId, true);
  clearInterval(intervalId);
}

// Safe observer creation with automatic tracking
export function createTrackedObserver<
  T extends MutationObserver | IntersectionObserver | PerformanceObserver,
>(
  ObserverClass: new (callback: (entries: any[]) => void) => T,
  callback: (entries: any[]) => void
): T {
  const observer = new ObserverClass(callback);
  memoryManager.trackObserver(observer);
  return observer;
}

// ─── Memory-Safe Data Structures ──────────────────────────────────────

// WeakMap-based cache with automatic cleanup
export class MemorySafeCache<K extends object, V> {
  private cache = new WeakMap<K, { value: V; timestamp: number; ttl: number }>();
  private cleanupInterval: number;

  constructor(cleanupInterval = 300000) {
    // 5 minutes
    this.cleanupInterval = window.setInterval(() => {
      this.cleanup();
    }, cleanupInterval);
    memoryManager.trackTimer(this.cleanupInterval, true);
  }

  set(key: K, value: V, ttl = 300000): void {
    // 5 minutes default TTL
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl,
    });
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache = new WeakMap();
  }

  size(): number {
    // WeakMap size is not enumerable, so we can't get exact size
    // This is a limitation of WeakMap for memory safety
    return 0; // Unknown
  }

  private cleanup(): void {
    // WeakMap automatically cleans up when keys are garbage collected
    // We can't manually iterate, but we can suggest GC
    if ((window as any).gc) {
      (window as any).gc();
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    memoryManager.untrackTimer(this.cleanupInterval, true);
    this.clear();
  }
}

// ─── Export Default ────────────────────────────────────────────────────
export default memoryManager;
