export interface VisualTestResult {
  testId: string;
  baselineScreenshot?: string;
  actualScreenshot?: string;
  diffPercentage: number;
  passed: boolean;
  regions: DiffRegion[];
  timestamp: number;
}

export interface DiffRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  diffPercentage: number;
  severity: 'minor' | 'moderate' | 'major';
}

export interface APITestConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  expectedStatus: number;
  expectedResponseSchema?: Record<string, any>;
  timeout: number;
  retries: number;
}

export interface APITestResult {
  testId: string;
  url: string;
  method: string;
  status: number;
  responseTime: number;
  passed: boolean;
  errors: string[];
  responseBody?: any;
  responseHeaders?: Record<string, string>;
}

export interface PerformanceTestConfig {
  url: string;
  type: PerformanceTestType;
  duration: number;
  concurrency: number;
  rampUpTime: number;
  thresholds: PerformanceThresholds;
}

export enum PerformanceTestType {
  LOAD = 'load',
  STRESS = 'stress',
  SPIKE = 'spike',
  ENDURANCE = 'endurance',
}

export interface PerformanceThresholds {
  maxResponseTimeMs: number;
  maxErrorRate: number;
  minThroughputRps: number;
  maxP95ResponseTimeMs: number;
}

export interface PerformanceTestResult {
  testId: string;
  type: PerformanceTestType;
  duration: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  throughput: number;
  errorRate: number;
  passed: boolean;
  thresholdViolations: string[];
}

export interface AccessibilityTestResult {
  testId: string;
  url: string;
  violations: AccessibilityViolation[];
  passes: number;
  incomplete: number;
  score: number;
  wcagLevel: 'A' | 'AA' | 'AAA';
}

export interface AccessibilityViolation {
  id: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  description: string;
  help: string;
  helpUrl: string;
  nodes: number;
  wcagCriteria: string[];
}

export interface MultiModalTestSuite {
  id: string;
  name: string;
  visual: VisualTestResult[];
  api: APITestResult[];
  performance: PerformanceTestResult[];
  accessibility: AccessibilityTestResult[];
  overallScore: number;
  timestamp: number;
}

export class VisualTestingEngine {
  private baselines: Map<string, string> = new Map();
  private threshold = 0.05;

  setThreshold(threshold: number): void {
    this.threshold = Math.max(0, Math.min(1, threshold));
  }

  setBaseline(testId: string, screenshot: string): void {
    this.baselines.set(testId, screenshot);
  }

  getBaseline(testId: string): string | undefined {
    return this.baselines.get(testId);
  }

  compare(testId: string, actualScreenshot: string): VisualTestResult {
    const baseline = this.baselines.get(testId);

    if (!baseline) {
      this.baselines.set(testId, actualScreenshot);
      return {
        testId,
        actualScreenshot,
        diffPercentage: 0,
        passed: true,
        regions: [],
        timestamp: Date.now(),
      };
    }

    const diffPercentage = this.calculateDiff(baseline, actualScreenshot);
    const regions = this.identifyDiffRegions(baseline, actualScreenshot);

    return {
      testId,
      baselineScreenshot: baseline,
      actualScreenshot,
      diffPercentage,
      passed: diffPercentage <= this.threshold,
      regions,
      timestamp: Date.now(),
    };
  }

  private calculateDiff(baseline: string, actual: string): number {
    if (baseline === actual) return 0;
    if (!baseline || !actual) return 1;

    const baseLen = baseline.length;
    const actualLen = actual.length;
    const lenDiff = Math.abs(baseLen - actualLen);
    const maxLen = Math.max(baseLen, actualLen);

    if (maxLen === 0) return 0;

    let charDiffs = 0;
    const minLen = Math.min(baseLen, actualLen);
    const sampleSize = Math.min(minLen, 1000);
    const step = Math.max(1, Math.floor(minLen / sampleSize));

    for (let i = 0; i < minLen; i += step) {
      if (baseline[i] !== actual[i]) charDiffs++;
    }

    const sampleDiffRate = sampleSize > 0 ? charDiffs / (sampleSize / step) : 0;
    return Math.min(1, sampleDiffRate + lenDiff / maxLen);
  }

  private identifyDiffRegions(_baseline: string, _actual: string): DiffRegion[] {
    return [];
  }
}

export class APITestingEngine {
  private results: APITestResult[] = [];
  private maxResults = 500;

  async executeTest(config: APITestConfig): Promise<APITestResult> {
    const testId = `api_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const errors: string[] = [];
    let lastError: Error | null = null;
    let result: APITestResult | null = null;

    for (let attempt = 0; attempt <= config.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), config.timeout);
        const startTime = performance.now();

        const response = await fetch(config.url, {
          method: config.method,
          headers: config.headers,
          body: config.body ? JSON.stringify(config.body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeout);
        const responseTime = performance.now() - startTime;

        let responseBody: any;
        try {
          responseBody = await response.json();
        } catch {
          responseBody = await response.text();
        }

        const statusMatch = response.status === config.expectedStatus;
        if (!statusMatch) {
          errors.push(`Expected status ${config.expectedStatus}, got ${response.status}`);
        }

        if (config.expectedResponseSchema) {
          const schemaErrors = this.validateSchema(responseBody, config.expectedResponseSchema);
          errors.push(...schemaErrors);
        }

        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        result = {
          testId,
          url: config.url,
          method: config.method,
          status: response.status,
          responseTime,
          passed: statusMatch && errors.length === 0,
          errors,
          responseBody,
          responseHeaders,
        };

        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt === config.retries) {
          errors.push(lastError.message);
        }
      }
    }

    if (!result) {
      result = {
        testId,
        url: config.url,
        method: config.method,
        status: 0,
        responseTime: 0,
        passed: false,
        errors: [lastError?.message || 'Unknown error'],
      };
    }

    this.results.push(result);
    if (this.results.length > this.maxResults) {
      this.results.shift();
    }

    return result;
  }

  getResults(): APITestResult[] {
    return [...this.results];
  }

  private validateSchema(data: any, schema: Record<string, any>): string[] {
    const errors: string[] = [];
    if (!data || typeof data !== 'object') {
      errors.push('Response is not an object');
      return errors;
    }

    for (const [key, expectedType] of Object.entries(schema)) {
      if (!(key in data)) {
        errors.push(`Missing field: ${key}`);
      } else if (typeof expectedType === 'string' && typeof data[key] !== expectedType) {
        errors.push(`Field '${key}' expected ${expectedType}, got ${typeof data[key]}`);
      }
    }

    return errors;
  }
}

export class PerformanceTestingEngine {
  async runLoadTest(config: PerformanceTestConfig): Promise<PerformanceTestResult> {
    const testId = `perf_${Date.now()}`;
    const responseTimes: number[] = [];
    let successCount = 0;
    let failCount = 0;
    const startTime = Date.now();
    const endTime = startTime + config.duration;

    const batchSize = Math.min(config.concurrency, 10);
    let iteration = 0;

    while (Date.now() < endTime) {
      const currentConcurrency = config.rampUpTime > 0
        ? Math.ceil(batchSize * Math.min(1, (Date.now() - startTime) / config.rampUpTime))
        : batchSize;

      const batch = Array.from({ length: currentConcurrency }, async () => {
        const reqStart = performance.now();
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);
          const response = await fetch(config.url, { signal: controller.signal });
          clearTimeout(timeout);
          const elapsed = performance.now() - reqStart;
          responseTimes.push(elapsed);
          if (response.ok) successCount++;
          else failCount++;
        } catch {
          failCount++;
          responseTimes.push(performance.now() - reqStart);
        }
      });

      await Promise.allSettled(batch);
      iteration++;

      if (iteration > 1000) break;
    }

    const totalRequests = successCount + failCount;
    const sorted = [...responseTimes].sort((a, b) => a - b);
    const duration = Date.now() - startTime;
    const throughput = totalRequests / (duration / 1000);
    const errorRate = totalRequests > 0 ? failCount / totalRequests : 0;

    const thresholdViolations: string[] = [];
    const avg = sorted.length > 0 ? sorted.reduce((s, v) => s + v, 0) / sorted.length : 0;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;

    if (avg > config.thresholds.maxResponseTimeMs) {
      thresholdViolations.push(`Avg response time ${avg.toFixed(0)}ms exceeds ${config.thresholds.maxResponseTimeMs}ms`);
    }
    if (errorRate > config.thresholds.maxErrorRate) {
      thresholdViolations.push(`Error rate ${(errorRate * 100).toFixed(1)}% exceeds ${(config.thresholds.maxErrorRate * 100).toFixed(1)}%`);
    }
    if (throughput < config.thresholds.minThroughputRps) {
      thresholdViolations.push(`Throughput ${throughput.toFixed(1)} rps below ${config.thresholds.minThroughputRps} rps`);
    }
    if (p95 > config.thresholds.maxP95ResponseTimeMs) {
      thresholdViolations.push(`P95 response time ${p95.toFixed(0)}ms exceeds ${config.thresholds.maxP95ResponseTimeMs}ms`);
    }

    return {
      testId,
      type: config.type,
      duration,
      totalRequests,
      successfulRequests: successCount,
      failedRequests: failCount,
      averageResponseTime: avg,
      p50ResponseTime: sorted[Math.floor(sorted.length * 0.5)] || 0,
      p95ResponseTime: p95,
      p99ResponseTime: sorted[Math.floor(sorted.length * 0.99)] || 0,
      throughput,
      errorRate,
      passed: thresholdViolations.length === 0,
      thresholdViolations,
    };
  }
}

export class AccessibilityTestingEngine {
  analyzeFromContext(url: string, elements: { tag: string; role: string; ariaLabel: string; visibleText: string; id: string }[]): AccessibilityTestResult {
    const testId = `a11y_${Date.now()}`;
    const violations: AccessibilityViolation[] = [];
    let passes = 0;

    const imagesWithoutAlt = elements.filter(el => el.tag === 'img' && !el.ariaLabel);
    if (imagesWithoutAlt.length > 0) {
      violations.push({
        id: 'image-alt',
        impact: 'serious',
        description: 'Images must have alternate text',
        help: 'All <img> elements should have an alt attribute',
        helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/non-text-content',
        nodes: imagesWithoutAlt.length,
        wcagCriteria: ['1.1.1'],
      });
    } else {
      passes++;
    }

    const buttonsWithoutLabel = elements.filter(
      el => (el.tag === 'button' || el.role === 'button') && !el.ariaLabel && !el.visibleText
    );
    if (buttonsWithoutLabel.length > 0) {
      violations.push({
        id: 'button-name',
        impact: 'critical',
        description: 'Buttons must have discernible text',
        help: 'All buttons should have accessible names',
        helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value',
        nodes: buttonsWithoutLabel.length,
        wcagCriteria: ['4.1.2'],
      });
    } else {
      passes++;
    }

    const linksWithoutText = elements.filter(
      el => el.tag === 'a' && !el.ariaLabel && !el.visibleText
    );
    if (linksWithoutText.length > 0) {
      violations.push({
        id: 'link-name',
        impact: 'serious',
        description: 'Links must have discernible text',
        help: 'All links should have accessible names',
        helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/link-purpose-in-context',
        nodes: linksWithoutText.length,
        wcagCriteria: ['2.4.4'],
      });
    } else {
      passes++;
    }

    const inputsWithoutLabel = elements.filter(
      el => (el.tag === 'input' || el.tag === 'textarea' || el.tag === 'select') && !el.ariaLabel && !el.id
    );
    if (inputsWithoutLabel.length > 0) {
      violations.push({
        id: 'label',
        impact: 'critical',
        description: 'Form elements must have labels',
        help: 'All form inputs should have associated labels',
        helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions',
        nodes: inputsWithoutLabel.length,
        wcagCriteria: ['3.3.2'],
      });
    } else {
      passes++;
    }

    const totalChecks = violations.length + passes;
    const score = totalChecks > 0 ? passes / totalChecks : 1;

    return {
      testId,
      url,
      violations,
      passes,
      incomplete: 0,
      score,
      wcagLevel: score >= 0.9 ? 'AA' : score >= 0.7 ? 'A' : 'A',
    };
  }
}

export class TestIntegrationOrchestrator {
  private visualEngine = new VisualTestingEngine();
  private apiEngine = new APITestingEngine();
  private perfEngine = new PerformanceTestingEngine();
  private a11yEngine = new AccessibilityTestingEngine();

  getVisualEngine(): VisualTestingEngine { return this.visualEngine; }
  getAPIEngine(): APITestingEngine { return this.apiEngine; }
  getPerformanceEngine(): PerformanceTestingEngine { return this.perfEngine; }
  getAccessibilityEngine(): AccessibilityTestingEngine { return this.a11yEngine; }

  async runSuite(name: string, tests: {
    visual?: { testId: string; screenshot: string }[];
    api?: APITestConfig[];
    performance?: PerformanceTestConfig[];
    accessibility?: { url: string; elements: any[] }[];
  }): Promise<MultiModalTestSuite> {
    const suite: MultiModalTestSuite = {
      id: `suite_${Date.now()}`,
      name,
      visual: [],
      api: [],
      performance: [],
      accessibility: [],
      overallScore: 0,
      timestamp: Date.now(),
    };

    if (tests.visual) {
      for (const vt of tests.visual) {
        suite.visual.push(this.visualEngine.compare(vt.testId, vt.screenshot));
      }
    }

    if (tests.api) {
      for (const apiConfig of tests.api) {
        suite.api.push(await this.apiEngine.executeTest(apiConfig));
      }
    }

    if (tests.performance) {
      for (const perfConfig of tests.performance) {
        suite.performance.push(await this.perfEngine.runLoadTest(perfConfig));
      }
    }

    if (tests.accessibility) {
      for (const a11y of tests.accessibility) {
        suite.accessibility.push(this.a11yEngine.analyzeFromContext(a11y.url, a11y.elements));
      }
    }

    suite.overallScore = this.calculateOverallScore(suite);
    return suite;
  }

  private calculateOverallScore(suite: MultiModalTestSuite): number {
    let total = 0;
    let count = 0;

    if (suite.visual.length > 0) {
      const passed = suite.visual.filter(v => v.passed).length;
      total += passed / suite.visual.length;
      count++;
    }
    if (suite.api.length > 0) {
      const passed = suite.api.filter(a => a.passed).length;
      total += passed / suite.api.length;
      count++;
    }
    if (suite.performance.length > 0) {
      const passed = suite.performance.filter(p => p.passed).length;
      total += passed / suite.performance.length;
      count++;
    }
    if (suite.accessibility.length > 0) {
      const avgScore = suite.accessibility.reduce((s, a) => s + a.score, 0) / suite.accessibility.length;
      total += avgScore;
      count++;
    }

    return count > 0 ? total / count : 0;
  }
}

export const testOrchestrator = new TestIntegrationOrchestrator();
