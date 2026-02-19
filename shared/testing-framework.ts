// ─── Comprehensive Automated Testing Suite ─────────────────────────────
// Enterprise-grade testing framework for Chrome extensions with unit,
// integration, and end-to-end testing capabilities

export interface TestResult {
  testName: string;
  status: 'passed' | 'failed' | 'skipped' | 'error';
  duration: number;
  error?: Error;
  assertions: number;
  coverage?: TestCoverage;
  metadata?: Record<string, any>;
}

export interface TestSuite {
  name: string;
  tests: TestCase[];
  setup?: () => Promise<void> | void;
  teardown?: () => Promise<void> | void;
  timeout?: number;
}

export interface TestCase {
  name: string;
  test: () => Promise<void> | void;
  timeout?: number;
  skip?: boolean;
  only?: boolean;
}

export interface TestCoverage {
  lines: number;
  functions: number;
  branches: number;
  statements: number;
}

export interface TestReport {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  errors: number;
  duration: number;
  coverage?: TestCoverage;
  results: TestResult[];
  timestamp: number;
}

// ─── Test Framework Core ───────────────────────────────────────────────
export class TestRunner {
  private suites: TestSuite[] = [];
  private currentSuite: TestSuite | null = null;
  private results: TestResult[] = [];
  private globalSetup?: () => Promise<void> | void;
  private globalTeardown?: () => Promise<void> | void;

  // ─── Suite Management ────────────────────────────────────────────────
  describe(name: string, fn: () => void): void {
    const suite: TestSuite = {
      name,
      tests: [],
      timeout: 5000
    };

    const previousSuite = this.currentSuite;
    this.currentSuite = suite;

    try {
      fn();
      this.suites.push(suite);
    } finally {
      this.currentSuite = previousSuite;
    }
  }

  it(name: string, test: () => Promise<void> | void, options: { timeout?: number; skip?: boolean; only?: boolean } = {}): void {
    if (!this.currentSuite) {
      throw new Error('Test case must be defined within a describe block');
    }

    this.currentSuite.tests.push({
      name,
      test,
      timeout: options.timeout || this.currentSuite.timeout,
      skip: options.skip,
      only: options.only
    });
  }

  beforeAll(fn: () => Promise<void> | void): void {
    if (this.currentSuite) {
      this.currentSuite.setup = fn;
    } else {
      this.globalSetup = fn;
    }
  }

  afterAll(fn: () => Promise<void> | void): void {
    if (this.currentSuite) {
      this.currentSuite.teardown = fn;
    } else {
      this.globalTeardown = fn;
    }
  }

  beforeEach(fn: () => Promise<void> | void): void {
    // Store for later execution
    if (this.currentSuite) {
      const originalSetup = this.currentSuite.setup;
      this.currentSuite.setup = async () => {
        if (originalSetup) await originalSetup();
        await fn();
      };
    }
  }

  afterEach(fn: () => Promise<void> | void): void {
    // Store for later execution
    if (this.currentSuite) {
      const originalTeardown = this.currentSuite.teardown;
      this.currentSuite.teardown = async () => {
        await fn();
        if (originalTeardown) await originalTeardown();
      };
    }
  }

  // ─── Test Execution ──────────────────────────────────────────────────
  async runTests(options: { verbose?: boolean; bail?: boolean; pattern?: string } = {}): Promise<TestReport> {
    const startTime = Date.now();
    this.results = [];

    console.log('🧪 Starting test suite execution...');

    // Run global setup
    if (this.globalSetup) {
      await this.safeExecute(this.globalSetup, 'Global Setup');
    }

    // Filter suites if pattern provided
    let suitesToRun = this.suites;
    if (options.pattern) {
      const regex = new RegExp(options.pattern, 'i');
      suitesToRun = this.suites.filter(suite =>
        regex.test(suite.name) ||
        suite.tests.some(test => regex.test(test.name))
      );
    }

    // Check for "only" tests
    const hasOnlyTests = suitesToRun.some(suite =>
      suite.tests.some(test => test.only)
    );

    for (const suite of suitesToRun) {
      await this.runSuite(suite, options, hasOnlyTests);

      if (options.bail && this.results.some(r => r.status === 'failed' || r.status === 'error')) {
        break;
      }
    }

    // Run global teardown
    if (this.globalTeardown) {
      await this.safeExecute(this.globalTeardown, 'Global Teardown');
    }

    const report = this.generateReport(startTime);
    this.printReport(report, options.verbose);

    return report;
  }

  private async runSuite(suite: TestSuite, options: any, hasOnlyTests: boolean): Promise<void> {
    if (options.verbose) {
      console.log(`\n📋 Running suite: ${suite.name}`);
    }

    // Run suite setup
    if (suite.setup) {
      await this.safeExecute(suite.setup, `${suite.name} Setup`);
    }

    // Filter tests (respect "only" flag)
    let testsToRun = suite.tests;
    if (hasOnlyTests) {
      testsToRun = suite.tests.filter(test => test.only);
    }

    for (const test of testsToRun) {
      if (test.skip) {
        this.results.push({
          testName: `${suite.name} > ${test.name}`,
          status: 'skipped',
          duration: 0,
          assertions: 0
        });
        continue;
      }

      await this.runTest(suite, test, options);
    }

    // Run suite teardown
    if (suite.teardown) {
      await this.safeExecute(suite.teardown, `${suite.name} Teardown`);
    }
  }

  private async runTest(suite: TestSuite, test: TestCase, options: any): Promise<void> {
    const testName = `${suite.name} > ${test.name}`;
    const startTime = Date.now();

    if (options.verbose) {
      console.log(`  🧪 ${test.name}`);
    }

    try {
      // Create test context
      const context = new TestContext(testName);

      // Set up test timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Test timeout after ${test.timeout}ms`)), test.timeout);
      });

      // Run the test
      await Promise.race([
        test.test(),
        timeoutPromise
      ]);

      const duration = Date.now() - startTime;

      this.results.push({
        testName,
        status: 'passed',
        duration,
        assertions: context.assertionCount,
        metadata: context.metadata
      });

      if (options.verbose) {
        console.log(`    ✅ Passed (${duration}ms, ${context.assertionCount} assertions)`);
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      const isError = error instanceof Error && error.message.includes('Test timeout');

      this.results.push({
        testName,
        status: isError ? 'error' : 'failed',
        duration,
        error: error instanceof Error ? error : new Error(String(error)),
        assertions: 0
      });

      if (options.verbose) {
        console.log(`    ❌ ${isError ? 'Error' : 'Failed'} (${duration}ms): ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  private async safeExecute(fn: () => Promise<void> | void, context: string): Promise<void> {
    try {
      const result = fn();
      if (result instanceof Promise) {
        await result;
      }
    } catch (error) {
      console.error(`Error in ${context}:`, error);
      this.results.push({
        testName: context,
        status: 'error',
        duration: 0,
        error: error instanceof Error ? error : new Error(String(error)),
        assertions: 0
      });
    }
  }

  private generateReport(startTime: number): TestReport {
    const duration = Date.now() - startTime;
    const passed = this.results.filter(r => r.status === 'passed').length;
    const failed = this.results.filter(r => r.status === 'failed').length;
    const skipped = this.results.filter(r => r.status === 'skipped').length;
    const errors = this.results.filter(r => r.status === 'error').length;

    return {
      totalTests: this.results.length,
      passed,
      failed,
      skipped,
      errors,
      duration,
      results: this.results,
      timestamp: Date.now()
    };
  }

  private printReport(report: TestReport, verbose: boolean = false): void {
    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST REPORT');
    console.log('='.repeat(50));
    console.log(`Total Tests: ${report.totalTests}`);
    console.log(`✅ Passed: ${report.passed}`);
    console.log(`❌ Failed: ${report.failed}`);
    console.log(`⚠️  Errors: ${report.errors}`);
    console.log(`⏭️  Skipped: ${report.skipped}`);
    console.log(`⏱️  Duration: ${report.duration}ms`);
    console.log(`📈 Success Rate: ${report.totalTests > 0 ? ((report.passed / report.totalTests) * 100).toFixed(1) : 0}%`);

    if (report.failed > 0 || report.errors > 0) {
      console.log('\n❌ FAILED TESTS:');
      const failedTests = report.results.filter(r => r.status === 'failed' || r.status === 'error');
      failedTests.forEach(test => {
        console.log(`  • ${test.testName}: ${test.error?.message || 'Unknown error'}`);
      });
    }

    if (verbose) {
      console.log('\n📋 ALL TESTS:');
      report.results.forEach(test => {
        const icon = test.status === 'passed' ? '✅' : test.status === 'failed' ? '❌' : test.status === 'error' ? '🚨' : '⏭️';
        console.log(`  ${icon} ${test.testName} (${test.duration}ms)`);
      });
    }

    console.log('='.repeat(50));
  }
}

// ─── Test Context for Assertions ───────────────────────────────────────
export class TestContext {
  public assertionCount = 0;
  public metadata: Record<string, any> = {};

  expect<T>(actual: T) {
    return new Assertion(actual, () => this.assertionCount++);
  }

  assert(condition: boolean, message?: string): void {
    this.assertionCount++;
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  }

  addMetadata(key: string, value: any): void {
    this.metadata[key] = value;
  }
}

// ─── Assertion Library ─────────────────────────────────────────────────
export class Assertion<T> {
  constructor(private actual: T, private countAssertion: () => void) {}

  toBe(expected: T): Assertion<T> {
    this.countAssertion();
    if (this.actual !== expected) {
      throw new Error(`Expected ${expected}, but got ${this.actual}`);
    }
    return this;
  }

  toEqual(expected: T): Assertion<T> {
    this.countAssertion();
    if (!this.deepEqual(this.actual, expected)) {
      throw new Error(`Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(this.actual)}`);
    }
    return this;
  }

  toBeTruthy(): Assertion<T> {
    this.countAssertion();
    if (!this.actual) {
      throw new Error(`Expected truthy value, but got ${this.actual}`);
    }
    return this;
  }

  toBeFalsy(): Assertion<T> {
    this.countAssertion();
    if (this.actual) {
      throw new Error(`Expected falsy value, but got ${this.actual}`);
    }
    return this;
  }

  toBeNull(): Assertion<T> {
    this.countAssertion();
    if (this.actual !== null) {
      throw new Error(`Expected null, but got ${this.actual}`);
    }
    return this;
  }

  toBeUndefined(): Assertion<T> {
    this.countAssertion();
    if (this.actual !== undefined) {
      throw new Error(`Expected undefined, but got ${this.actual}`);
    }
    return this;
  }

  toBeInstanceOf(expected: any): Assertion<T> {
    this.countAssertion();
    if (!(this.actual instanceof expected)) {
      throw new Error(`Expected instance of ${expected.name}, but got ${this.actual?.constructor?.name || typeof this.actual}`);
    }
    return this;
  }

  toContain(expected: any): Assertion<T> {
    this.countAssertion();
    if (!Array.isArray(this.actual) && typeof this.actual !== 'string') {
      throw new Error('toContain can only be used with arrays or strings');
    }

    if (Array.isArray(this.actual)) {
      if (!this.actual.includes(expected)) {
        throw new Error(`Expected array to contain ${expected}`);
      }
    } else if (typeof this.actual === 'string') {
      if (!this.actual.includes(expected)) {
        throw new Error(`Expected string to contain "${expected}"`);
      }
    }
    return this;
  }

  toHaveLength(expected: number): Assertion<T> {
    this.countAssertion();
    if (!Array.isArray(this.actual) && typeof this.actual !== 'string') {
      throw new Error('toHaveLength can only be used with arrays or strings');
    }

    const length = Array.isArray(this.actual) ? this.actual.length : (this.actual as string).length;
    if (length !== expected) {
      throw new Error(`Expected length ${expected}, but got ${length}`);
    }
    return this;
  }

  toMatch(expected: RegExp): Assertion<T> {
    this.countAssertion();
    if (typeof this.actual !== 'string') {
      throw new Error('toMatch can only be used with strings');
    }

    if (!expected.test(this.actual)) {
      throw new Error(`Expected string to match ${expected}, but got "${this.actual}"`);
    }
    return this;
  }

  toThrow(expected?: string | RegExp | Error): Assertion<T> {
    this.countAssertion();
    if (typeof this.actual !== 'function') {
      throw new Error('toThrow can only be used with functions');
    }

    try {
      (this.actual as Function)();
      throw new Error('Expected function to throw, but it did not');
    } catch (error) {
      if (expected) {
        if (typeof expected === 'string') {
          if (!(error instanceof Error) || error.message !== expected) {
            throw new Error(`Expected function to throw "${expected}", but got "${error instanceof Error ? error.message : error}"`);
          }
        } else if (expected instanceof RegExp) {
          if (!(error instanceof Error) || !expected.test(error.message)) {
            throw new Error(`Expected function to throw matching ${expected}, but got "${error instanceof Error ? error.message : error}"`);
          }
        } else if (expected instanceof Error) {
          if (!(error instanceof expected.constructor)) {
            throw new Error(`Expected function to throw ${expected.constructor.name}, but got ${error?.constructor?.name || typeof error}`);
          }
        }
      }
    }
    return this;
  }

  private deepEqual(a: any, b: any): boolean {
    if (a === b) return true;

    if (a == null || b == null) return a === b;

    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!this.deepEqual(a[i], b[i])) return false;
      }
      return true;
    }

    if (typeof a === 'object' && typeof b === 'object') {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);

      if (keysA.length !== keysB.length) return false;

      for (const key of keysA) {
        if (!keysB.includes(key)) return false;
        if (!this.deepEqual(a[key], b[key])) return false;
      }
      return true;
    }

    return false;
  }
}

// ─── Mocking System ────────────────────────────────────────────────────
export class MockSystem {
  private mocks = new Map<string, any>();

  mockFunction<T extends (...args: any[]) => any>(
    object: any,
    methodName: string,
    implementation?: T
  ): jest.MockedFunction<T> {
    const original = object[methodName];
    const mock = jest.fn(implementation || (() => {}));

    object[methodName] = mock;
    this.mocks.set(`${object.constructor.name}.${methodName}`, { original, mock });

    return mock as jest.MockedFunction<T>;
  }

  mockModule(modulePath: string, mockImplementation: any): void {
    // In a real implementation, this would use Jest's module mocking
    // For now, we'll just store the mock
    this.mocks.set(`module:${modulePath}`, mockImplementation);
  }

  spyOn<T extends (...args: any[]) => any>(
    object: any,
    methodName: string
  ): jest.MockedFunction<T> {
    const original = object[methodName];
    const spy = jest.fn().mockImplementation((...args) => original.apply(object, args));

    object[methodName] = spy;
    this.mocks.set(`spy:${object.constructor.name}.${methodName}`, { original, spy });

    return spy as jest.MockedFunction<T>;
  }

  restoreAll(): void {
    for (const [key, mockData] of this.mocks) {
      if (key.startsWith('spy:') || key.startsWith('mock:')) {
        const [objectName, methodName] = key.split('.');
        const object = this.findObjectByName(objectName);
        if (object && mockData.original) {
          object[methodName] = mockData.original;
        }
      }
    }
    this.mocks.clear();
  }

  private findObjectByName(name: string): any {
    // This is a simplified implementation
    // In a real system, you'd have a registry of named objects
    return (window as any)[name] || global[name];
  }
}

// ─── Chrome Extension Test Utilities ───────────────────────────────────
export class ChromeExtensionTestUtils {
  static mockChromeAPI(): void {
    // Mock chrome API for testing
    (global as any).chrome = {
      runtime: {
        sendMessage: jest.fn(),
        onMessage: {
          addListener: jest.fn(),
          removeListener: jest.fn()
        }
      },
      tabs: {
        query: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        remove: jest.fn(),
        get: jest.fn()
      },
      storage: {
        local: {
          get: jest.fn(),
          set: jest.fn(),
          remove: jest.fn()
        }
      },
      scripting: {
        executeScript: jest.fn()
      },
      sidePanel: {
        open: jest.fn(),
        setPanelBehavior: jest.fn()
      },
      contextMenus: {
        create: jest.fn(),
        onClicked: {
          addListener: jest.fn()
        }
      }
    };
  }

  static mockDOM(): void {
    // Create a minimal DOM for testing
    const jsdom = require('jsdom');
    const { JSDOM } = jsdom;
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');

    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    (global as any).navigator = dom.window.navigator;
  }

  static async simulateUserAction(action: {
    type: 'click' | 'input' | 'submit';
    selector: string;
    value?: string;
  }): Promise<void> {
    const element = document.querySelector(action.selector) as HTMLElement;
    if (!element) {
      throw new Error(`Element not found: ${action.selector}`);
    }

    switch (action.type) {
      case 'click':
        element.click();
        break;
      case 'input':
        if (element instanceof HTMLInputElement && action.value !== undefined) {
          element.value = action.value;
          element.dispatchEvent(new Event('input', { bubbles: true }));
        }
        break;
      case 'submit':
        if (element instanceof HTMLFormElement) {
          element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        }
        break;
    }

    // Wait for event handling
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

// ─── Performance Testing Utilities ─────────────────────────────────────
export class PerformanceTestUtils {
  static async measurePerformance<T>(
    operation: () => Promise<T>,
    options: { iterations?: number; warmup?: number } = {}
  ): Promise<{
    result: T;
    duration: number;
    memoryDelta: number;
    averageDuration: number;
  }> {
    const { iterations = 1, warmup = 0 } = options;

    // Warmup runs
    for (let i = 0; i < warmup; i++) {
      await operation();
    }

    const startMemory = performance.memory?.usedJSHeapSize || 0;
    const startTime = performance.now();

    let result: T;
    const durations: number[] = [];

    // Actual measurement runs
    for (let i = 0; i < iterations; i++) {
      const iterationStart = performance.now();
      result = await operation();
      const iterationDuration = performance.now() - iterationStart;
      durations.push(iterationDuration);
    }

    const endTime = performance.now();
    const endMemory = performance.memory?.usedJSHeapSize || 0;

    const totalDuration = endTime - startTime;
    const averageDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

    return {
      result: result!,
      duration: totalDuration,
      memoryDelta: endMemory - startMemory,
      averageDuration
    };
  }

  static async measureMemoryUsage(operation: () => Promise<void>): Promise<{
    before: number;
    after: number;
    delta: number;
  }> {
    const before = performance.memory?.usedJSHeapSize || 0;
    await operation();
    const after = performance.memory?.usedJSHeapSize || 0;

    return {
      before,
      after,
      delta: after - before
    };
  }
}

// ─── Integration Test Helpers ──────────────────────────────────────────
export class IntegrationTestHelpers {
  static async setupExtensionEnvironment(): Promise<void> {
    // Set up a mock extension environment
    ChromeExtensionTestUtils.mockChromeAPI();
    ChromeExtensionTestUtils.mockDOM();

    // Initialize any global state
    console.log('🔧 Extension environment set up for testing');
  }

  static async teardownExtensionEnvironment(): Promise<void> {
    // Clean up test environment
    jest.clearAllMocks();
    console.log('🧹 Extension environment cleaned up');
  }

  static async simulateMessageFlow(
    messages: Array<{ type: string; data?: any; response?: any }>
  ): Promise<void> {
    for (const message of messages) {
      // Simulate sending a message to background script
      chrome.runtime.sendMessage(message);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 10));

      // Check if response matches expected
      if (message.response) {
        // In a real test, you'd capture the actual response
        console.log(`Message ${message.type} processed`);
      }
    }
  }

  static createMockPageContext(overrides: Partial<any> = {}): any {
    return {
      url: 'https://example.com',
      title: 'Test Page',
      bodyText: 'This is a test page',
      semanticElements: [
        {
          index: 0,
          tag: 'button',
          text: 'Click me',
          role: 'button',
          type: 'button'
        }
      ],
      timestamp: Date.now(),
      ...overrides
    };
  }
}

// ─── Global Test Runner Instance ───────────────────────────────────────
export const testRunner = new TestRunner();
export const mockSystem = new MockSystem();

// ─── Convenience Functions ────────────────────────────────────────────
export const describe = testRunner.describe.bind(testRunner);
export const it = testRunner.it.bind(testRunner);
export const beforeAll = testRunner.beforeAll.bind(testRunner);
export const afterAll = testRunner.afterAll.bind(testRunner);
export const beforeEach = testRunner.beforeEach.bind(testRunner);
export const afterEach = testRunner.afterEach.bind(testRunner);

// ─── Export Default ────────────────────────────────────────────────────
export default testRunner;
