import { DEFAULTS } from './config';
import { loadFromStorage, saveToStorage } from './llmClient'; // Reusing existing storage helpers

const DOMAIN_ACTION_TRACKING_KEY = 'hyperagent_domain_action_counts';

interface DomainActionCounts {
  [domain: string]: number;
}

export class DomainActionTracker {
  private domainCounts: DomainActionCounts = {};
  private initialized = false;

  constructor() {
    this.init();
  }

  private async init() {
    this.domainCounts = await loadFromStorage<DomainActionCounts>(DOMAIN_ACTION_TRACKING_KEY) || {};
    this.initialized = true;
  }

  private async saveCounts() {
    if (this.initialized) {
      await saveToStorage(DOMAIN_ACTION_TRACKING_KEY, this.domainCounts);
    }
  }

  async incrementActionCount(domain: string): Promise<void> {
    if (!this.initialized) await this.init();
    
    if (domain) {
      this.domainCounts[domain] = (this.domainCounts[domain] || 0) + 1;
      await this.saveCounts();
    }
  }

  async getActionCount(domain: string): Promise<number> {
    if (!this.initialized) await this.init();
    return this.domainCounts[domain] || 0;
  }

  async isOverLimit(domain: string): Promise<boolean> {
    if (!this.initialized) await this.init();
    const count = this.domainCounts[domain] || 0;
    const limit = DEFAULTS.MAX_ACTIONS_PER_DOMAIN;
    return limit !== -1 && count >= limit;
  }

  async resetDomain(domain: string): Promise<void> {
    if (!this.initialized) await this.init();
    if (this.domainCounts[domain]) {
      delete this.domainCounts[domain];
      await this.saveCounts();
    }
  }

  async resetAllDomains(): Promise<void> {
    if (!this.initialized) await this.init();
    this.domainCounts = {};
    await this.saveCounts();
  }
}
