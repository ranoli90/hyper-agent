export interface TestCandidate {
  id: string;
  name: string;
  path: string;
  lastRun?: number;
  lastResult?: 'passed' | 'failed' | 'skipped';
  averageDuration: number;
  failureRate: number;
  flakyRate: number;
  priority: number;
  tags: string[];
  dependencies: string[];
  affectedFiles: string[];
  complexity: number;
}

export interface SelectionCriteria {
  strategy: SelectionStrategy;
  maxTests?: number;
  maxDuration?: number;
  changedFiles?: string[];
  priorityThreshold?: number;
  includeFlaky?: boolean;
  includeTags?: string[];
  excludeTags?: string[];
}

export enum SelectionStrategy {
  ALL = 'all',
  CHANGED_FILES = 'changed_files',
  FAILURE_FIRST = 'failure_first',
  PRIORITY_BASED = 'priority_based',
  RISK_BASED = 'risk_based',
  TIME_BUDGET = 'time_budget',
  SMART = 'smart',
}

export interface SelectionResult {
  selected: TestCandidate[];
  excluded: TestCandidate[];
  reason: Map<string, string>;
  estimatedDuration: number;
  coverage: number;
  strategy: SelectionStrategy;
}

export interface TestHistory {
  testId: string;
  results: { timestamp: number; passed: boolean; duration: number }[];
}

const STORAGE_KEY = 'hyperagent_test_selection';

export class IntelligentTestSelector {
  private candidates: Map<string, TestCandidate> = new Map();
  private history: Map<string, TestHistory> = new Map();

  addCandidate(candidate: TestCandidate): void {
    this.candidates.set(candidate.id, candidate);
  }

  addCandidates(candidates: TestCandidate[]): void {
    for (const c of candidates) {
      this.candidates.set(c.id, c);
    }
  }

  removeCandidate(testId: string): boolean {
    return this.candidates.delete(testId);
  }

  recordResult(testId: string, passed: boolean, duration: number): void {
    const history = this.history.get(testId) || { testId, results: [] };
    history.results.push({ timestamp: Date.now(), passed, duration });
    if (history.results.length > 100) {
      history.results.shift();
    }
    this.history.set(testId, history);

    const candidate = this.candidates.get(testId);
    if (candidate) {
      candidate.lastRun = Date.now();
      candidate.lastResult = passed ? 'passed' : 'failed';
      this.updateCandidateMetrics(candidate);
    }
  }

  select(criteria: SelectionCriteria): SelectionResult {
    const allCandidates = Array.from(this.candidates.values());
    let filtered = this.applyTagFilters(allCandidates, criteria);

    switch (criteria.strategy) {
      case SelectionStrategy.ALL:
        return this.buildResult(filtered, [], criteria);

      case SelectionStrategy.CHANGED_FILES:
        return this.selectByChangedFiles(filtered, criteria);

      case SelectionStrategy.FAILURE_FIRST:
        return this.selectByFailureRate(filtered, criteria);

      case SelectionStrategy.PRIORITY_BASED:
        return this.selectByPriority(filtered, criteria);

      case SelectionStrategy.RISK_BASED:
        return this.selectByRisk(filtered, criteria);

      case SelectionStrategy.TIME_BUDGET:
        return this.selectByTimeBudget(filtered, criteria);

      case SelectionStrategy.SMART:
        return this.smartSelect(filtered, criteria);

      default:
        return this.buildResult(filtered, [], criteria);
    }
  }

  getCandidate(testId: string): TestCandidate | undefined {
    return this.candidates.get(testId);
  }

  getAllCandidates(): TestCandidate[] {
    return Array.from(this.candidates.values());
  }

  getHistory(testId: string): TestHistory | undefined {
    return this.history.get(testId);
  }

  async persist(): Promise<void> {
    try {
      if (!chrome?.storage?.local) return;
      await chrome.storage.local.set({
        [STORAGE_KEY]: {
          candidates: Array.from(this.candidates.entries()),
          history: Array.from(this.history.entries()),
        },
      });
    } catch (err) {
      console.error('[TestSelector] Persist failed:', err);
    }
  }

  async restore(): Promise<void> {
    try {
      if (!chrome?.storage?.local) return;
      const data = await chrome.storage.local.get(STORAGE_KEY);
      const stored = data[STORAGE_KEY];
      if (!stored) return;

      if (Array.isArray(stored.candidates)) {
        for (const [id, c] of stored.candidates) this.candidates.set(id, c);
      }
      if (Array.isArray(stored.history)) {
        for (const [id, h] of stored.history) this.history.set(id, h);
      }
    } catch (err) {
      console.error('[TestSelector] Restore failed:', err);
    }
  }

  private selectByChangedFiles(candidates: TestCandidate[], criteria: SelectionCriteria): SelectionResult {
    const changedFiles = criteria.changedFiles || [];
    if (changedFiles.length === 0) {
      return this.buildResult(candidates, [], criteria);
    }

    const selected: TestCandidate[] = [];
    const excluded: TestCandidate[] = [];
    const reasons = new Map<string, string>();

    for (const candidate of candidates) {
      const isAffected = candidate.affectedFiles.some(file =>
        changedFiles.some(changed => file.includes(changed) || changed.includes(file))
      );

      if (isAffected) {
        selected.push(candidate);
        reasons.set(candidate.id, 'Affected by changed files');
      } else {
        excluded.push(candidate);
        reasons.set(candidate.id, 'Not affected by changes');
      }
    }

    return this.buildResult(selected, excluded, criteria, reasons);
  }

  private selectByFailureRate(candidates: TestCandidate[], criteria: SelectionCriteria): SelectionResult {
    const sorted = [...candidates].sort((a, b) => b.failureRate - a.failureRate);
    const maxTests = criteria.maxTests || sorted.length;
    const selected = sorted.slice(0, maxTests);
    const excluded = sorted.slice(maxTests);

    const reasons = new Map<string, string>();
    for (const c of selected) {
      reasons.set(c.id, `Failure rate: ${(c.failureRate * 100).toFixed(1)}%`);
    }

    return this.buildResult(selected, excluded, criteria, reasons);
  }

  private selectByPriority(candidates: TestCandidate[], criteria: SelectionCriteria): SelectionResult {
    const threshold = criteria.priorityThreshold ?? 5;
    const sorted = [...candidates].sort((a, b) => b.priority - a.priority);

    const selected = sorted.filter(c => c.priority >= threshold);
    const excluded = sorted.filter(c => c.priority < threshold);

    const reasons = new Map<string, string>();
    for (const c of selected) reasons.set(c.id, `Priority: ${c.priority}`);
    for (const c of excluded) reasons.set(c.id, `Priority ${c.priority} below threshold ${threshold}`);

    return this.buildResult(selected, excluded, criteria, reasons);
  }

  private selectByRisk(candidates: TestCandidate[], criteria: SelectionCriteria): SelectionResult {
    const scored = candidates.map(c => ({
      candidate: c,
      riskScore: this.calculateRiskScore(c),
    }));

    scored.sort((a, b) => b.riskScore - a.riskScore);
    const maxTests = criteria.maxTests || scored.length;
    const selected = scored.slice(0, maxTests).map(s => s.candidate);
    const excluded = scored.slice(maxTests).map(s => s.candidate);

    const reasons = new Map<string, string>();
    for (const s of scored) {
      reasons.set(s.candidate.id, `Risk score: ${s.riskScore.toFixed(2)}`);
    }

    return this.buildResult(selected, excluded, criteria, reasons);
  }

  private selectByTimeBudget(candidates: TestCandidate[], criteria: SelectionCriteria): SelectionResult {
    const budget = criteria.maxDuration || 300000;
    const scored = candidates.map(c => ({
      candidate: c,
      riskScore: this.calculateRiskScore(c),
    }));

    scored.sort((a, b) => b.riskScore - a.riskScore);

    const selected: TestCandidate[] = [];
    const excluded: TestCandidate[] = [];
    let totalDuration = 0;

    for (const { candidate } of scored) {
      if (totalDuration + candidate.averageDuration <= budget) {
        selected.push(candidate);
        totalDuration += candidate.averageDuration;
      } else {
        excluded.push(candidate);
      }
    }

    return this.buildResult(selected, excluded, criteria);
  }

  private smartSelect(candidates: TestCandidate[], criteria: SelectionCriteria): SelectionResult {
    const scored = candidates.map(c => {
      let score = 0;

      score += c.failureRate * 30;
      score += c.flakyRate * 20;
      score += (c.priority / 10) * 25;

      if (c.lastResult === 'failed') score += 15;
      if (!c.lastRun || Date.now() - c.lastRun > 24 * 60 * 60 * 1000) score += 10;

      if (criteria.changedFiles?.length) {
        const isAffected = c.affectedFiles.some(f =>
          criteria.changedFiles!.some(cf => f.includes(cf) || cf.includes(f))
        );
        if (isAffected) score += 40;
      }

      score += c.complexity * 5;

      return { candidate: c, score };
    });

    scored.sort((a, b) => b.score - a.score);

    let selected: { candidate: TestCandidate; score: number }[];
    let excluded: { candidate: TestCandidate; score: number }[];

    if (criteria.maxDuration) {
      const budget = criteria.maxDuration;
      let total = 0;
      const split = scored.findIndex(s => {
        total += s.candidate.averageDuration;
        return total > budget;
      });
      selected = split === -1 ? scored : scored.slice(0, split);
      excluded = split === -1 ? [] : scored.slice(split);
    } else {
      const maxTests = criteria.maxTests || scored.length;
      selected = scored.slice(0, maxTests);
      excluded = scored.slice(maxTests);
    }

    const reasons = new Map<string, string>();
    for (const s of scored) {
      reasons.set(s.candidate.id, `Smart score: ${s.score.toFixed(1)}`);
    }

    return this.buildResult(
      selected.map(s => s.candidate),
      excluded.map(s => s.candidate),
      criteria,
      reasons
    );
  }

  private calculateRiskScore(candidate: TestCandidate): number {
    let score = 0;
    score += candidate.failureRate * 40;
    score += candidate.flakyRate * 20;
    score += (candidate.priority / 10) * 20;
    score += candidate.complexity * 10;

    if (candidate.lastResult === 'failed') score += 10;
    if (!candidate.lastRun) score += 5;

    return Math.min(100, score);
  }

  private updateCandidateMetrics(candidate: TestCandidate): void {
    const history = this.history.get(candidate.id);
    if (!history || history.results.length === 0) return;

    const results = history.results;
    const failures = results.filter(r => !r.passed).length;
    candidate.failureRate = failures / results.length;
    candidate.averageDuration = results.reduce((s, r) => s + r.duration, 0) / results.length;

    if (results.length >= 5) {
      let flips = 0;
      for (let i = 1; i < results.length; i++) {
        if (results[i].passed !== results[i - 1].passed) flips++;
      }
      candidate.flakyRate = flips / (results.length - 1);
    }
  }

  private applyTagFilters(candidates: TestCandidate[], criteria: SelectionCriteria): TestCandidate[] {
    let filtered = candidates;

    if (criteria.includeTags?.length) {
      filtered = filtered.filter(c =>
        criteria.includeTags!.some(t => c.tags.includes(t))
      );
    }

    if (criteria.excludeTags?.length) {
      filtered = filtered.filter(c =>
        !criteria.excludeTags!.some(t => c.tags.includes(t))
      );
    }

    if (!criteria.includeFlaky) {
      filtered = filtered.filter(c => c.flakyRate < 0.5);
    }

    return filtered;
  }

  private buildResult(
    selected: TestCandidate[],
    excluded: TestCandidate[],
    criteria: SelectionCriteria,
    reasons?: Map<string, string>
  ): SelectionResult {
    const totalDuration = selected.reduce((s, c) => s + c.averageDuration, 0);
    const allCount = selected.length + excluded.length;

    return {
      selected,
      excluded,
      reason: reasons || new Map(),
      estimatedDuration: totalDuration,
      coverage: allCount > 0 ? selected.length / allCount : 0,
      strategy: criteria.strategy,
    };
  }
}

export const testSelector = new IntelligentTestSelector();
