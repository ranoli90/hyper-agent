import { getMemoryStats, saveActionOutcome } from './memory';

export interface GlobalPattern {
  id: string;
  pattern: string;
  category: PatternCategory;
  successRate: number;
  occurrences: number;
  domains: string[];
  lastSeen: number;
  metadata?: Record<string, any>;
}

export enum PatternCategory {
  LOCATOR_STRATEGY = 'locator_strategy',
  ACTION_SEQUENCE = 'action_sequence',
  ERROR_RECOVERY = 'error_recovery',
  USER_PREFERENCE = 'user_preference',
  SITE_BEHAVIOR = 'site_behavior',
  FORM_FILLING = 'form_filling',
  NAVIGATION = 'navigation',
}

export interface SharedLearning {
  patterns: GlobalPattern[];
  lastSync: number;
  version: string;
}

const GLOBAL_LEARNING_KEY = 'hyperagent_global_learning';
const PATTERN_MIN_OCCURRENCES = 3;
const PATTERN_MIN_SUCCESS_RATE = 0.6;

class GlobalLearningImpl {
  private patterns: Map<string, GlobalPattern> = new Map();
  private lastSync: number = 0;
  private syncInterval: number = 60 * 60 * 1000; // 1 hour
  private version: string = '1.0.0';

  constructor() {
    this.loadFromStorage();
  }

  private async loadFromStorage(): Promise<void> {
    try {
      const data = await chrome.storage.local.get(GLOBAL_LEARNING_KEY);
      if (data[GLOBAL_LEARNING_KEY]) {
        const learning: SharedLearning = data[GLOBAL_LEARNING_KEY];
        this.lastSync = learning.lastSync;
        this.version = learning.version;
        learning.patterns.forEach(p => this.patterns.set(p.id, p));
      }
    } catch (err) {
      console.warn('[GlobalLearning] Failed to load from storage:', err);
    }
  }

  private async saveToStorage(): Promise<void> {
    try {
      const learning: SharedLearning = {
        patterns: Array.from(this.patterns.values()),
        lastSync: this.lastSync,
        version: this.version,
      };
      await chrome.storage.local.set({ [GLOBAL_LEARNING_KEY]: learning });
    } catch (err) {
      console.warn('[GlobalLearning] Failed to save to storage:', err);
    }
  }

  async learn(
    domain: string,
    action: string,
    success: boolean,
    metadata?: Record<string, any>
  ): Promise<void> {
    const patternId = `${domain}:${action}`;

    let pattern = this.patterns.get(patternId);

    if (!pattern) {
      pattern = {
        id: patternId,
        pattern: action,
        category: this.categorizeAction(action),
        successRate: success ? 1 : 0,
        occurrences: 1,
        domains: [domain],
        lastSeen: Date.now(),
        metadata,
      };
      this.patterns.set(patternId, pattern);
    } else {
      pattern.occurrences++;
      pattern.successRate =
        (pattern.successRate * (pattern.occurrences - 1) + (success ? 1 : 0)) / pattern.occurrences;
      pattern.lastSeen = Date.now();
      if (!pattern.domains.includes(domain)) {
        pattern.domains.push(domain);
      }
      if (metadata) {
        pattern.metadata = { ...pattern.metadata, ...metadata };
      }
    }

    if (pattern.occurrences % 5 === 0) {
      await this.saveToStorage();
    }
  }

  private categorizeAction(action: string): PatternCategory {
    const actionLower = action.toLowerCase();

    if (actionLower.includes('click') || actionLower.includes('tap')) {
      return PatternCategory.LOCATOR_STRATEGY;
    }
    if (
      actionLower.includes('fill') ||
      actionLower.includes('input') ||
      actionLower.includes('type')
    ) {
      return PatternCategory.FORM_FILLING;
    }
    if (
      actionLower.includes('navigate') ||
      actionLower.includes('goto') ||
      actionLower.includes('url')
    ) {
      return PatternCategory.NAVIGATION;
    }
    if (
      actionLower.includes('error') ||
      actionLower.includes('retry') ||
      actionLower.includes('recover')
    ) {
      return PatternCategory.ERROR_RECOVERY;
    }
    if (actionLower.includes('extract') || actionLower.includes('scrape')) {
      return PatternCategory.ACTION_SEQUENCE;
    }

    return PatternCategory.SITE_BEHAVIOR;
  }

  async fetchGlobalWisdom(): Promise<GlobalPattern[]> {
    this.lastSync = Date.now();

    const localStats = await getMemoryStats();

    const significantPatterns = Array.from(this.patterns.values())
      .filter(
        p => p.occurrences >= PATTERN_MIN_OCCURRENCES && p.successRate >= PATTERN_MIN_SUCCESS_RATE
      )
      .sort((a, b) => b.successRate * b.occurrences - a.successRate * a.occurrences);

    await this.saveToStorage();

    return significantPatterns;
  }

  async publishPatterns(): Promise<void> {
    const publishablePatterns = Array.from(this.patterns.values()).filter(
      p => p.occurrences >= PATTERN_MIN_OCCURRENCES && p.successRate >= PATTERN_MIN_SUCCESS_RATE
    );

    if (publishablePatterns.length > 0) {
      console.log(`[GlobalLearning] Published ${publishablePatterns.length} patterns`);
    }

    await this.saveToStorage();
  }

  getPatternsByCategory(category: PatternCategory): GlobalPattern[] {
    return Array.from(this.patterns.values())
      .filter(p => p.category === category)
      .sort((a, b) => b.successRate - a.successRate);
  }

  getPatternsForDomain(domain: string): GlobalPattern[] {
    return Array.from(this.patterns.values())
      .filter(p => p.domains.includes(domain))
      .sort((a, b) => b.successRate - a.successRate);
  }

  getBestPattern(action: string): GlobalPattern | null {
    const patterns = Array.from(this.patterns.values())
      .filter(p => p.pattern.includes(action) || action.includes(p.pattern))
      .sort((a, b) => b.successRate * b.occurrences - a.successRate * a.occurrences);

    return patterns[0] || null;
  }

  getSuccessRate(domain: string, action: string): number {
    const patternId = `${domain}:${action}`;
    const pattern = this.patterns.get(patternId);
    return pattern?.successRate ?? 0.5;
  }

  shouldUsePattern(domain: string, action: string): boolean {
    const patternId = `${domain}:${action}`;
    const pattern = this.patterns.get(patternId);

    if (!pattern) return false;
    if (pattern.occurrences < PATTERN_MIN_OCCURRENCES) return false;
    if (pattern.successRate < PATTERN_MIN_SUCCESS_RATE) return false;

    return true;
  }

  getStats(): {
    totalPatterns: number;
    avgSuccessRate: number;
    categories: Record<string, number>;
  } {
    const patterns = Array.from(this.patterns.values());
    const avgSuccessRate =
      patterns.length > 0
        ? patterns.reduce((sum, p) => sum + p.successRate, 0) / patterns.length
        : 0;

    const categories: Record<string, number> = {};
    patterns.forEach(p => {
      categories[p.category] = (categories[p.category] || 0) + 1;
    });

    return {
      totalPatterns: patterns.length,
      avgSuccessRate,
      categories,
    };
  }

  clear(): void {
    this.patterns.clear();
    this.saveToStorage();
  }
}

export const globalLearning = new GlobalLearningImpl();
