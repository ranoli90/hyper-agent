export interface TestRunSummary {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
  successRate: number;
  environment: string;
  tags: string[];
}

export interface TestMetricEntry {
  testId: string;
  testName: string;
  metric: string;
  value: number;
  timestamp: number;
  runId: string;
  tags?: Record<string, string>;
}

export interface TrendData {
  metric: string;
  points: { timestamp: number; value: number }[];
  trend: 'improving' | 'degrading' | 'stable';
  slope: number;
  forecast: number[];
}

export interface AnalyticsReport {
  id: string;
  title: string;
  generatedAt: number;
  period: { start: number; end: number };
  summary: ReportSummary;
  trends: TrendData[];
  topFailures: FailureEntry[];
  flakyTests: FlakyTestEntry[];
  performanceMetrics: PerformanceEntry[];
  recommendations: string[];
}

export interface ReportSummary {
  totalRuns: number;
  totalTests: number;
  averageSuccessRate: number;
  averageDuration: number;
  totalFailures: number;
  flakyTestCount: number;
  improvementFromPrevious: number;
}

export interface FailureEntry {
  testName: string;
  failureCount: number;
  lastFailure: number;
  commonError: string;
  affectedRuns: string[];
}

export interface FlakyTestEntry {
  testName: string;
  totalRuns: number;
  flakyRuns: number;
  flakyRate: number;
  lastFlaky: number;
}

export interface PerformanceEntry {
  testName: string;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  p95Duration: number;
  trend: 'faster' | 'slower' | 'stable';
}

export enum ReportFormat {
  JSON = 'json',
  CSV = 'csv',
  HTML = 'html',
}

const STORAGE_KEY = 'hyperagent_test_analytics';
const MAX_RUNS = 500;
const MAX_METRICS = 10000;

export class TestAnalyticsEngine {
  private runs: TestRunSummary[] = [];
  private metrics: TestMetricEntry[] = [];
  private flakyTracker: Map<string, { passed: number; failed: number; timestamps: number[] }> = new Map();

  recordRun(run: TestRunSummary): void {
    this.runs.push(run);
    if (this.runs.length > MAX_RUNS) {
      this.runs.shift();
    }
  }

  recordMetric(entry: TestMetricEntry): void {
    this.metrics.push(entry);
    if (this.metrics.length > MAX_METRICS) {
      this.metrics = this.metrics.slice(-MAX_METRICS / 2);
    }
  }

  recordTestResult(testId: string, testName: string, passed: boolean): void {
    const tracker = this.flakyTracker.get(testId) || { passed: 0, failed: 0, timestamps: [] };
    if (passed) {
      tracker.passed++;
    } else {
      tracker.failed++;
    }
    tracker.timestamps.push(Date.now());
    if (tracker.timestamps.length > 100) {
      tracker.timestamps.shift();
    }
    this.flakyTracker.set(testId, tracker);
  }

  getRuns(filter?: { start?: number; end?: number; tags?: string[] }): TestRunSummary[] {
    let filtered = this.runs;

    if (filter?.start) {
      filtered = filtered.filter(r => r.startTime >= filter.start!);
    }
    if (filter?.end) {
      filtered = filtered.filter(r => r.endTime <= filter.end!);
    }
    if (filter?.tags?.length) {
      filtered = filtered.filter(r => filter.tags!.some(t => r.tags.includes(t)));
    }

    return filtered;
  }

  getSuccessRateOverTime(windowMs: number = 24 * 60 * 60 * 1000): { timestamp: number; rate: number }[] {
    const now = Date.now();
    const bucketCount = 20;
    const bucketSize = windowMs / bucketCount;
    const result: { timestamp: number; rate: number }[] = [];

    for (let i = 0; i < bucketCount; i++) {
      const start = now - windowMs + i * bucketSize;
      const end = start + bucketSize;
      const runsInBucket = this.runs.filter(r => r.startTime >= start && r.startTime < end);

      if (runsInBucket.length > 0) {
        const totalTests = runsInBucket.reduce((s, r) => s + r.totalTests, 0);
        const passedTests = runsInBucket.reduce((s, r) => s + r.passed, 0);
        result.push({
          timestamp: start + bucketSize / 2,
          rate: totalTests > 0 ? passedTests / totalTests : 0,
        });
      }
    }

    return result;
  }

  getTopFailures(limit: number = 10): FailureEntry[] {
    const failureMap = new Map<string, { count: number; lastFailure: number; error: string; runs: Set<string> }>();

    for (const run of this.runs) {
      if (run.failed > 0) {
        const key = run.name;
        const entry = failureMap.get(key) || { count: 0, lastFailure: 0, error: '', runs: new Set() };
        entry.count += run.failed;
        entry.lastFailure = Math.max(entry.lastFailure, run.endTime);
        entry.runs.add(run.id);
        failureMap.set(key, entry);
      }
    }

    return Array.from(failureMap.entries())
      .map(([testName, data]) => ({
        testName,
        failureCount: data.count,
        lastFailure: data.lastFailure,
        commonError: data.error || 'Unknown',
        affectedRuns: Array.from(data.runs),
      }))
      .sort((a, b) => b.failureCount - a.failureCount)
      .slice(0, limit);
  }

  getFlakyTests(threshold: number = 0.1): FlakyTestEntry[] {
    const result: FlakyTestEntry[] = [];

    for (const [testName, tracker] of this.flakyTracker) {
      const total = tracker.passed + tracker.failed;
      if (total < 3) continue;

      const passRate = tracker.passed / total;
      if (passRate > threshold && passRate < 1 - threshold) {
        result.push({
          testName,
          totalRuns: total,
          flakyRuns: Math.min(tracker.passed, tracker.failed),
          flakyRate: 1 - Math.abs(2 * passRate - 1),
          lastFlaky: tracker.timestamps[tracker.timestamps.length - 1],
        });
      }
    }

    return result.sort((a, b) => b.flakyRate - a.flakyRate);
  }

  getPerformanceTrends(testName?: string): PerformanceEntry[] {
    const groupedMetrics = new Map<string, number[]>();

    for (const metric of this.metrics) {
      if (metric.metric !== 'duration') continue;
      if (testName && metric.testName !== testName) continue;

      const durations = groupedMetrics.get(metric.testName) || [];
      durations.push(metric.value);
      groupedMetrics.set(metric.testName, durations);
    }

    return Array.from(groupedMetrics.entries()).map(([name, durations]) => {
      const sorted = [...durations].sort((a, b) => a - b);
      const avg = durations.reduce((s, v) => s + v, 0) / durations.length;

      let trend: 'faster' | 'slower' | 'stable' = 'stable';
      if (durations.length >= 5) {
        const recentAvg = durations.slice(-5).reduce((s, v) => s + v, 0) / 5;
        const earlierAvg = durations.slice(0, 5).reduce((s, v) => s + v, 0) / Math.min(5, durations.length);
        const change = earlierAvg !== 0 ? (recentAvg - earlierAvg) / earlierAvg : 0;
        if (change > 0.1) trend = 'slower';
        else if (change < -0.1) trend = 'faster';
      }

      return {
        testName: name,
        avgDuration: avg,
        minDuration: sorted[0] || 0,
        maxDuration: sorted[sorted.length - 1] || 0,
        p95Duration: sorted[Math.floor(sorted.length * 0.95)] || 0,
        trend,
      };
    });
  }

  generateReport(period: { start: number; end: number }): AnalyticsReport {
    const runs = this.getRuns(period);
    const totalTests = runs.reduce((s, r) => s + r.totalTests, 0);
    const totalPassed = runs.reduce((s, r) => s + r.passed, 0);
    const totalFailed = runs.reduce((s, r) => s + r.failed, 0);
    const totalDuration = runs.reduce((s, r) => s + r.duration, 0);

    const previousPeriodDuration = period.end - period.start;
    const previousRuns = this.getRuns({
      start: period.start - previousPeriodDuration,
      end: period.start,
    });
    const prevRate = previousRuns.length > 0
      ? previousRuns.reduce((s, r) => s + r.passed, 0) /
        Math.max(1, previousRuns.reduce((s, r) => s + r.totalTests, 0))
      : 0;
    const currentRate = totalTests > 0 ? totalPassed / totalTests : 0;

    const recommendations: string[] = [];
    const flakyTests = this.getFlakyTests();
    const topFailures = this.getTopFailures();

    if (flakyTests.length > 5) {
      recommendations.push(`${flakyTests.length} flaky tests detected. Consider stabilizing the top offenders.`);
    }
    if (currentRate < 0.95) {
      recommendations.push(`Success rate is ${(currentRate * 100).toFixed(1)}%. Target is 95%.`);
    }
    if (topFailures.length > 0) {
      recommendations.push(`Top failing test: "${topFailures[0].testName}" with ${topFailures[0].failureCount} failures.`);
    }

    return {
      id: `report_${Date.now()}`,
      title: `Test Analytics Report`,
      generatedAt: Date.now(),
      period,
      summary: {
        totalRuns: runs.length,
        totalTests,
        averageSuccessRate: currentRate,
        averageDuration: runs.length > 0 ? totalDuration / runs.length : 0,
        totalFailures: totalFailed,
        flakyTestCount: flakyTests.length,
        improvementFromPrevious: currentRate - prevRate,
      },
      trends: this.computeTrends(period),
      topFailures,
      flakyTests,
      performanceMetrics: this.getPerformanceTrends(),
      recommendations,
    };
  }

  exportReport(report: AnalyticsReport, format: ReportFormat): string {
    switch (format) {
      case ReportFormat.JSON:
        return JSON.stringify(report, null, 2);

      case ReportFormat.CSV: {
        const lines: string[] = [];
        lines.push('Metric,Value');
        lines.push(`Total Runs,${report.summary.totalRuns}`);
        lines.push(`Total Tests,${report.summary.totalTests}`);
        lines.push(`Success Rate,${(report.summary.averageSuccessRate * 100).toFixed(1)}%`);
        lines.push(`Average Duration,${report.summary.averageDuration.toFixed(0)}ms`);
        lines.push(`Total Failures,${report.summary.totalFailures}`);
        lines.push(`Flaky Tests,${report.summary.flakyTestCount}`);
        lines.push('');
        lines.push('Top Failures');
        lines.push('Test Name,Failure Count,Last Failure');
        for (const f of report.topFailures) {
          lines.push(`"${f.testName}",${f.failureCount},${new Date(f.lastFailure).toISOString()}`);
        }
        return lines.join('\n');
      }

      case ReportFormat.HTML: {
        return `<!DOCTYPE html>
<html><head><title>${report.title}</title>
<style>body{font-family:sans-serif;max-width:800px;margin:0 auto;padding:20px}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:left}
th{background:#f4f4f4}.good{color:green}.bad{color:red}.stat{font-size:2em;font-weight:bold}</style>
</head><body>
<h1>${report.title}</h1>
<p>Generated: ${new Date(report.generatedAt).toLocaleString()}</p>
<h2>Summary</h2>
<table>
<tr><td>Total Runs</td><td class="stat">${report.summary.totalRuns}</td></tr>
<tr><td>Total Tests</td><td class="stat">${report.summary.totalTests}</td></tr>
<tr><td>Success Rate</td><td class="stat ${report.summary.averageSuccessRate >= 0.95 ? 'good' : 'bad'}">${(report.summary.averageSuccessRate * 100).toFixed(1)}%</td></tr>
<tr><td>Average Duration</td><td>${report.summary.averageDuration.toFixed(0)}ms</td></tr>
<tr><td>Total Failures</td><td class="${report.summary.totalFailures > 0 ? 'bad' : ''}">${report.summary.totalFailures}</td></tr>
<tr><td>Flaky Tests</td><td>${report.summary.flakyTestCount}</td></tr>
</table>
<h2>Top Failures</h2>
<table><tr><th>Test Name</th><th>Failures</th><th>Last Failure</th></tr>
${report.topFailures.map(f => `<tr><td>${f.testName}</td><td>${f.failureCount}</td><td>${new Date(f.lastFailure).toLocaleString()}</td></tr>`).join('')}
</table>
<h2>Recommendations</h2>
<ul>${report.recommendations.map(r => `<li>${r}</li>`).join('')}</ul>
</body></html>`;
      }

      default:
        return JSON.stringify(report);
    }
  }

  async persist(): Promise<void> {
    try {
      if (!chrome?.storage?.local) return;
      await chrome.storage.local.set({
        [STORAGE_KEY]: {
          runs: this.runs.slice(-100),
          metrics: this.metrics.slice(-1000),
          flakyTracker: Array.from(this.flakyTracker.entries()),
        },
      });
    } catch (err) {
      console.error('[TestAnalytics] Persist failed:', err);
    }
  }

  async restore(): Promise<void> {
    try {
      if (!chrome?.storage?.local) return;
      const data = await chrome.storage.local.get(STORAGE_KEY);
      const stored = data[STORAGE_KEY];
      if (!stored) return;

      if (Array.isArray(stored.runs)) this.runs = stored.runs;
      if (Array.isArray(stored.metrics)) this.metrics = stored.metrics;
      if (Array.isArray(stored.flakyTracker)) {
        for (const [key, value] of stored.flakyTracker) {
          this.flakyTracker.set(key, value);
        }
      }
    } catch (err) {
      console.error('[TestAnalytics] Restore failed:', err);
    }
  }

  private computeTrends(period: { start: number; end: number }): TrendData[] {
    const durationTrend = this.computeMetricTrend('duration', period);
    const successTrend = this.computeSuccessRateTrend(period);
    return [durationTrend, successTrend].filter(Boolean) as TrendData[];
  }

  private computeMetricTrend(metric: string, period: { start: number; end: number }): TrendData | null {
    const relevantMetrics = this.metrics.filter(
      m => m.metric === metric && m.timestamp >= period.start && m.timestamp <= period.end
    );
    if (relevantMetrics.length < 3) return null;

    const points = relevantMetrics.map(m => ({ timestamp: m.timestamp, value: m.value }));
    const values = points.map(p => p.value);
    const slope = this.linearSlope(values);
    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    const slopePercent = avg !== 0 ? (slope / avg) * 100 : 0;

    return {
      metric,
      points,
      trend: Math.abs(slopePercent) < 5 ? 'stable' : slope > 0 ? 'degrading' : 'improving',
      slope,
      forecast: Array.from({ length: 5 }, (_, i) => values[values.length - 1] + slope * (i + 1)),
    };
  }

  private computeSuccessRateTrend(period: { start: number; end: number }): TrendData | null {
    const runs = this.getRuns(period);
    if (runs.length < 3) return null;

    const points = runs.map(r => ({ timestamp: r.startTime, value: r.successRate }));
    const values = points.map(p => p.value);
    const slope = this.linearSlope(values);

    return {
      metric: 'success_rate',
      points,
      trend: Math.abs(slope) < 0.01 ? 'stable' : slope > 0 ? 'improving' : 'degrading',
      slope,
      forecast: Array.from({ length: 5 }, (_, i) =>
        Math.max(0, Math.min(1, values[values.length - 1] + slope * (i + 1)))
      ),
    };
  }

  private linearSlope(values: number[]): number {
    const n = values.length;
    if (n < 2) return 0;

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumX2 += i * i;
    }

    const denom = n * sumX2 - sumX * sumX;
    return denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  }
}

export const testAnalytics = new TestAnalyticsEngine();
