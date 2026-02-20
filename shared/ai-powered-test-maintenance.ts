import type { Action, ActionResult, PageContext } from './types';

export interface TestSuiteHealth {
  suiteId: string;
  totalTests: number;
  passingTests: number;
  failingTests: number;
  flakyTests: number;
  averageDuration: number;
  healthScore: number;
  lastAnalyzed: number;
  issues: TestIssue[];
  recommendations: MaintenanceRecommendation[];
}

export interface TestIssue {
  id: string;
  type: IssueType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  testId: string;
  testName: string;
  description: string;
  suggestedFix: string;
  autoFixable: boolean;
  detectedAt: number;
}

export enum IssueType {
  BROKEN_LOCATOR = 'broken_locator',
  FLAKY_TEST = 'flaky_test',
  SLOW_TEST = 'slow_test',
  DUPLICATE_TEST = 'duplicate_test',
  MISSING_ASSERTION = 'missing_assertion',
  OUTDATED_DATA = 'outdated_data',
  DEAD_CODE = 'dead_code',
  BRITTLE_SELECTOR = 'brittle_selector',
  HARDCODED_VALUE = 'hardcoded_value',
  MISSING_CLEANUP = 'missing_cleanup',
}

export interface MaintenanceRecommendation {
  type: 'update' | 'remove' | 'refactor' | 'add' | 'merge';
  priority: number;
  testId: string;
  description: string;
  estimatedEffort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  autoApplicable: boolean;
}

export interface TestEvolution {
  testId: string;
  originalActions: Action[];
  evolvedActions: Action[];
  changes: EvolutionChange[];
  version: number;
  timestamp: number;
}

export interface EvolutionChange {
  type: 'locator_update' | 'step_added' | 'step_removed' | 'step_modified' | 'assertion_update';
  stepIndex?: number;
  before?: any;
  after?: any;
  reason: string;
  automated: boolean;
}

export interface LocatorHealth {
  locator: any;
  reliability: number;
  failureCount: number;
  lastSuccess: number;
  lastFailure: number;
  alternatives: { locator: any; confidence: number }[];
}

export interface TestRunRecord {
  testId: string;
  testName: string;
  actions: Action[];
  results: ActionResult[];
  passed: boolean;
  duration: number;
  timestamp: number;
  failures: { actionIndex: number; error: string; errorType: string }[];
}

const STORAGE_KEY = 'hyperagent_test_maintenance';
const MAX_RUN_RECORDS = 1000;

export class TestMaintenanceEngine {
  private runRecords: TestRunRecord[] = [];
  private locatorHealth: Map<string, LocatorHealth> = new Map();
  private testEvolutions: Map<string, TestEvolution[]> = new Map();
  private issueHistory: TestIssue[] = [];

  recordTestRun(record: TestRunRecord): void {
    this.runRecords.push(record);
    if (this.runRecords.length > MAX_RUN_RECORDS) {
      this.runRecords = this.runRecords.slice(-MAX_RUN_RECORDS / 2);
    }

    for (let i = 0; i < record.actions.length; i++) {
      const action = record.actions[i];
      if ('locator' in action) {
        this.updateLocatorHealth(
          (action as any).locator,
          record.results[i]?.success ?? false
        );
      }
    }
  }

  analyzeTestHealth(testId: string): TestSuiteHealth {
    const records = this.runRecords.filter(r => r.testId === testId);
    const issues: TestIssue[] = [];
    const recommendations: MaintenanceRecommendation[] = [];

    const total = records.length;
    const passed = records.filter(r => r.passed).length;
    const failed = total - passed;

    const durations = records.map(r => r.duration);
    const avgDuration = durations.length > 0 ? durations.reduce((s, d) => s + d, 0) / durations.length : 0;

    const flakyCount = this.detectFlakiness(records);
    if (flakyCount > 0) {
      issues.push({
        id: `issue_flaky_${testId}`,
        type: IssueType.FLAKY_TEST,
        severity: flakyCount > 3 ? 'high' : 'medium',
        testId,
        testName: records[0]?.testName || testId,
        description: `Test is flaky: ${flakyCount} result flips detected`,
        suggestedFix: 'Add wait conditions or stabilize locators',
        autoFixable: false,
        detectedAt: Date.now(),
      });
    }

    if (avgDuration > 30000) {
      issues.push({
        id: `issue_slow_${testId}`,
        type: IssueType.SLOW_TEST,
        severity: avgDuration > 60000 ? 'high' : 'medium',
        testId,
        testName: records[0]?.testName || testId,
        description: `Average duration ${(avgDuration / 1000).toFixed(1)}s exceeds 30s threshold`,
        suggestedFix: 'Optimize test steps or split into smaller tests',
        autoFixable: false,
        detectedAt: Date.now(),
      });
    }

    const failingLocators = this.findFailingLocators(records);
    for (const locator of failingLocators) {
      issues.push({
        id: `issue_locator_${testId}_${Date.now()}`,
        type: IssueType.BROKEN_LOCATOR,
        severity: 'high',
        testId,
        testName: records[0]?.testName || testId,
        description: `Locator frequently failing: ${JSON.stringify(locator).slice(0, 80)}`,
        suggestedFix: 'Update locator strategy or use more resilient selector',
        autoFixable: true,
        detectedAt: Date.now(),
      });
    }

    this.detectBrittleSelectors(records, testId, issues);
    this.detectHardcodedValues(records, testId, issues);

    if (failed > 0 && total > 3) {
      recommendations.push({
        type: 'update',
        priority: 9,
        testId,
        description: `Test has ${(failed / total * 100).toFixed(0)}% failure rate. Review and fix failing actions.`,
        estimatedEffort: 'medium',
        impact: 'high',
        autoApplicable: false,
      });
    }

    if (flakyCount > 2) {
      recommendations.push({
        type: 'refactor',
        priority: 8,
        testId,
        description: 'Refactor flaky test with explicit waits and stable locators',
        estimatedEffort: 'medium',
        impact: 'high',
        autoApplicable: false,
      });
    }

    const healthScore = this.calculateHealthScore(total, passed, flakyCount, avgDuration, issues.length);

    this.issueHistory.push(...issues);
    if (this.issueHistory.length > 500) {
      this.issueHistory = this.issueHistory.slice(-250);
    }

    return {
      suiteId: testId,
      totalTests: total,
      passingTests: passed,
      failingTests: failed,
      flakyTests: flakyCount,
      averageDuration: avgDuration,
      healthScore,
      lastAnalyzed: Date.now(),
      issues,
      recommendations: recommendations.sort((a, b) => b.priority - a.priority),
    };
  }

  suggestLocatorFix(action: Action, context: PageContext): { fixedAction: Action; confidence: number } | null {
    if (!('locator' in action)) return null;

    const description = (action as any).description || '';
    const elements = context.semanticElements;

    const keywords = description.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    let bestMatch: any = null;
    let bestScore = 0;

    for (const element of elements) {
      const elementText = [element.visibleText, element.ariaLabel, element.name, element.placeholder]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      let score = 0;
      for (const kw of keywords) {
        if (elementText.includes(kw)) score++;
      }
      const normalizedScore = keywords.length > 0 ? score / keywords.length : 0;

      if (normalizedScore > bestScore && normalizedScore > 0.3) {
        bestScore = normalizedScore;
        bestMatch = element;
      }
    }

    if (bestMatch) {
      const fixedAction = { ...action } as any;
      if (bestMatch.id) {
        fixedAction.locator = { strategy: 'id', value: bestMatch.id };
      } else if (bestMatch.ariaLabel) {
        fixedAction.locator = { strategy: 'ariaLabel', value: bestMatch.ariaLabel };
      } else if (bestMatch.visibleText) {
        fixedAction.locator = { strategy: 'text', value: bestMatch.visibleText };
      } else {
        fixedAction.locator = { strategy: 'index', value: String(bestMatch.index) };
      }

      return { fixedAction, confidence: bestScore };
    }

    return null;
  }

  evolveTest(testId: string, originalActions: Action[], newActions: Action[], reason: string): TestEvolution {
    const changes: EvolutionChange[] = [];

    const maxLen = Math.max(originalActions.length, newActions.length);
    for (let i = 0; i < maxLen; i++) {
      if (i >= originalActions.length) {
        changes.push({
          type: 'step_added',
          stepIndex: i,
          after: newActions[i],
          reason: `New step added: ${(newActions[i] as any).description || newActions[i].type}`,
          automated: false,
        });
      } else if (i >= newActions.length) {
        changes.push({
          type: 'step_removed',
          stepIndex: i,
          before: originalActions[i],
          reason: `Step removed: ${(originalActions[i] as any).description || originalActions[i].type}`,
          automated: false,
        });
      } else if (JSON.stringify(originalActions[i]) !== JSON.stringify(newActions[i])) {
        const changeType = this.classifyChange(originalActions[i], newActions[i]);
        changes.push({
          type: changeType,
          stepIndex: i,
          before: originalActions[i],
          after: newActions[i],
          reason,
          automated: false,
        });
      }
    }

    const evolutions = this.testEvolutions.get(testId) || [];
    const evolution: TestEvolution = {
      testId,
      originalActions,
      evolvedActions: newActions,
      changes,
      version: evolutions.length + 1,
      timestamp: Date.now(),
    };

    evolutions.push(evolution);
    this.testEvolutions.set(testId, evolutions);

    return evolution;
  }

  getLocatorHealth(locatorKey: string): LocatorHealth | undefined {
    return this.locatorHealth.get(locatorKey);
  }

  getAllLocatorHealth(): LocatorHealth[] {
    return Array.from(this.locatorHealth.values());
  }

  getUnhealthyLocators(reliabilityThreshold: number = 0.7): LocatorHealth[] {
    return this.getAllLocatorHealth().filter(lh => lh.reliability < reliabilityThreshold);
  }

  getIssueHistory(testId?: string): TestIssue[] {
    if (testId) return this.issueHistory.filter(i => i.testId === testId);
    return [...this.issueHistory];
  }

  getEvolutionHistory(testId: string): TestEvolution[] {
    return this.testEvolutions.get(testId) || [];
  }

  async persist(): Promise<void> {
    try {
      if (!chrome?.storage?.local) return;
      await chrome.storage.local.set({
        [STORAGE_KEY]: {
          runRecords: this.runRecords.slice(-200),
          locatorHealth: Array.from(this.locatorHealth.entries()),
          issues: this.issueHistory.slice(-100),
        },
      });
    } catch (err) {
      console.error('[TestMaintenance] Persist failed:', err);
    }
  }

  async restore(): Promise<void> {
    try {
      if (!chrome?.storage?.local) return;
      const data = await chrome.storage.local.get(STORAGE_KEY);
      const stored = data[STORAGE_KEY];
      if (!stored) return;

      if (Array.isArray(stored.runRecords)) this.runRecords = stored.runRecords;
      if (Array.isArray(stored.locatorHealth)) {
        for (const [key, value] of stored.locatorHealth) {
          this.locatorHealth.set(key, value);
        }
      }
      if (Array.isArray(stored.issues)) this.issueHistory = stored.issues;
    } catch (err) {
      console.error('[TestMaintenance] Restore failed:', err);
    }
  }

  private updateLocatorHealth(locator: any, success: boolean): void {
    const key = JSON.stringify(locator);
    const health = this.locatorHealth.get(key) || {
      locator,
      reliability: 1,
      failureCount: 0,
      lastSuccess: 0,
      lastFailure: 0,
      alternatives: [],
    };

    if (success) {
      health.lastSuccess = Date.now();
      health.reliability = Math.min(1, health.reliability + 0.05);
    } else {
      health.lastFailure = Date.now();
      health.failureCount++;
      health.reliability = Math.max(0, health.reliability - 0.1);
    }

    this.locatorHealth.set(key, health);
  }

  private detectFlakiness(records: TestRunRecord[]): number {
    if (records.length < 3) return 0;

    let flips = 0;
    for (let i = 1; i < records.length; i++) {
      if (records[i].passed !== records[i - 1].passed) flips++;
    }

    return flips;
  }

  private findFailingLocators(records: TestRunRecord[]): any[] {
    const locatorFailures = new Map<string, number>();

    for (const record of records) {
      for (const failure of record.failures) {
        if (failure.errorType === 'ELEMENT_NOT_FOUND' && record.actions[failure.actionIndex]) {
          const action = record.actions[failure.actionIndex] as any;
          if (action.locator) {
            const key = JSON.stringify(action.locator);
            locatorFailures.set(key, (locatorFailures.get(key) || 0) + 1);
          }
        }
      }
    }

    return Array.from(locatorFailures.entries())
      .filter(([_, count]) => count >= 2)
      .map(([key]) => {
        try { return JSON.parse(key); } catch { return key; }
      });
  }

  private detectBrittleSelectors(records: TestRunRecord[], testId: string, issues: TestIssue[]): void {
    for (const record of records) {
      for (const action of record.actions) {
        if ('locator' in action) {
          const locator = (action as any).locator;
          if (typeof locator === 'object' && locator.strategy === 'css') {
            const value = locator.value || '';
            if (value.includes(':nth-child') || value.split('>').length > 4 || value.split(' ').length > 5) {
              issues.push({
                id: `issue_brittle_${testId}_${Date.now()}`,
                type: IssueType.BRITTLE_SELECTOR,
                severity: 'medium',
                testId,
                testName: record.testName,
                description: `Brittle CSS selector: ${value.slice(0, 80)}`,
                suggestedFix: 'Use id, aria-label, or data-testid instead',
                autoFixable: true,
                detectedAt: Date.now(),
              });
              return;
            }
          }
        }
      }
    }
  }

  private detectHardcodedValues(records: TestRunRecord[], testId: string, issues: TestIssue[]): void {
    for (const record of records) {
      for (const action of record.actions) {
        if (action.type === 'fill') {
          const value = (action as any).value || '';
          if (value.match(/\d{4}-\d{2}-\d{2}/) || value.match(/\d{2}\/\d{2}\/\d{4}/)) {
            issues.push({
              id: `issue_hardcoded_${testId}_${Date.now()}`,
              type: IssueType.HARDCODED_VALUE,
              severity: 'low',
              testId,
              testName: record.testName,
              description: `Hardcoded date value: ${value}`,
              suggestedFix: 'Use dynamic date generation',
              autoFixable: true,
              detectedAt: Date.now(),
            });
            return;
          }
        }
      }
    }
  }

  private classifyChange(original: Action, updated: Action): EvolutionChange['type'] {
    if (original.type !== updated.type) return 'step_modified';
    if ('locator' in original && 'locator' in updated) {
      if (JSON.stringify((original as any).locator) !== JSON.stringify((updated as any).locator)) {
        return 'locator_update';
      }
    }
    return 'step_modified';
  }

  private calculateHealthScore(
    total: number, passed: number, flaky: number, avgDuration: number, issueCount: number
  ): number {
    if (total === 0) return 100;

    let score = 100;

    const passRate = passed / total;
    score -= (1 - passRate) * 40;

    const flakyRate = flaky / total;
    score -= flakyRate * 20;

    if (avgDuration > 30000) score -= 10;
    if (avgDuration > 60000) score -= 10;

    score -= Math.min(20, issueCount * 5);

    return Math.max(0, Math.min(100, score));
  }
}

export const testMaintenanceEngine = new TestMaintenanceEngine();
