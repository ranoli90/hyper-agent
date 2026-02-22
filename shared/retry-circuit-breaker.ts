// ─── Advanced Retry Logic with Circuit Breaker Patterns ───────────────
// Enterprise-grade retry and circuit breaker system for resilient operations
// in distributed systems and API integrations

// ─── Type Aliases ────────────────────────────────────────────────

type CircuitBreakerState = 'closed' | 'open' | 'half-open';
type OperationError = Error | unknown;

export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number; // exponential backoff multiplier
  jitterEnabled: boolean; // add randomness to prevent thundering herd
  retryCondition?: (error: OperationError) => boolean; // custom retry logic
  timeout?: number; // per-attempt timeout
  onRetry?: (attempt: number, error: OperationError) => void; // retry callback
  onFailure?: (error: OperationError) => void; // final failure callback
}

export interface CircuitBreakerConfig {
  failureThreshold: number; // number of failures before opening
  recoveryTimeout: number; // milliseconds before trying again
  monitoringPeriod: number; // milliseconds to track failures
  successThreshold: number; // successes needed to close circuit
  name: string; // identifier for logging/metrics
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: OperationError;
  attempts: number;
  totalDuration: number;
  circuitBreakerState?: CircuitBreakerState;
}

// ─── Circuit Breaker Implementation ────────────────────────────────────
export class CircuitBreaker {
  private state: CircuitBreakerState = 'closed';
  private failures = 0;
  private successes = 0;
  private lastFailureTime = 0;
  private nextAttemptTime = 0;

  constructor(private config: CircuitBreakerConfig) {}

  async execute<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<{ success: boolean; result?: T; error?: OperationError; circuitState: string }> {
    if (this.state === 'open') {
      if (Date.now() < this.nextAttemptTime) {
        // Circuit is open, use fallback or fail
        if (fallback) {
          console.log(`[CircuitBreaker:${this.config.name}] Circuit open, using fallback`);
          try {
            const result = await fallback();
            return { success: true, result, circuitState: this.state };
          } catch (error_) {
            console.error(`[CircuitBreaker:${this.config.name}] Fallback also failed:`, error_);
            return { success: false, error: error_, circuitState: this.state };
          }
        }
        return { success: false, error: new Error('Circuit breaker is open'), circuitState: this.state };
      } else {
        // Time to try again - move to half-open
        this.state = 'half-open' as CircuitBreakerState;
        console.log(`[CircuitBreaker:${this.config.name}] Attempting recovery (half-open)`);
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return { success: true, result, circuitState: this.state };
    } catch (error) {
      this.onFailure(error);
      return { success: false, error, circuitState: this.state };
    }
  }

  private onSuccess(): void {
    this.failures = 0;

    if (this.state === 'half-open') {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.state = 'closed' as CircuitBreakerState;
        this.successes = 0;
        console.log(`[CircuitBreaker:${this.config.name}] Circuit closed (recovery successful)`);
      }
    }
  }

  private onFailure(_error: OperationError): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === 'half-open') {
      // Half-open failure - back to open
      this.state = 'open' as CircuitBreakerState;
      this.nextAttemptTime = Date.now() + this.config.recoveryTimeout;
      this.successes = 0;
      console.log(`[CircuitBreaker:${this.config.name}] Recovery failed, circuit remains open`);
    } else if (this.failures >= this.config.failureThreshold) {
      // Closed to open transition
      this.state = 'open' as CircuitBreakerState;
      this.nextAttemptTime = Date.now() + this.config.recoveryTimeout;
      console.log(`[CircuitBreaker:${this.config.name}] Circuit opened (failure threshold reached)`);
    }
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  getStats(): {
    state: string;
    failures: number;
    successes: number;
    lastFailureTime: number;
    nextAttemptTime: number;
  } {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime
    };
  }

  reset(): void {
    this.state = 'closed' as CircuitBreakerState;
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = 0;
    this.nextAttemptTime = 0;
    console.log(`[CircuitBreaker:${this.config.name}] Circuit reset to closed`);
  }
}

// ─── Advanced Retry Logic ──────────────────────────────────────────────
export class RetryManager {
  private circuitBreakers = new Map<string, CircuitBreaker>();

  async retry<T>(
    operation: () => Promise<T>,
    config: RetryConfig,
    circuitBreakerKey?: string
  ): Promise<RetryResult<T>> {
    const startTime = Date.now();
    let lastError: OperationError;
    let attempts = 0;

    // Get or create circuit breaker
    let circuitBreaker: CircuitBreaker | undefined;
    if (circuitBreakerKey) {
      circuitBreaker = this.circuitBreakers.get(circuitBreakerKey);
      if (!circuitBreaker) {
        // Create default circuit breaker config
        circuitBreaker = new CircuitBreaker({
          failureThreshold: 5,
          recoveryTimeout: 30000, // 30 seconds
          monitoringPeriod: 60000, // 1 minute
          successThreshold: 2,
          name: circuitBreakerKey
        });
        this.circuitBreakers.set(circuitBreakerKey, circuitBreaker);
      }
    }

    while (attempts < config.maxAttempts) {
      attempts++;

      try {
        // Check circuit breaker
        if (circuitBreaker) {
          const circuitResult = await circuitBreaker.execute(operation);
          if (circuitResult.success) {
            return {
              success: true,
              result: circuitResult.result,
              attempts,
              totalDuration: Date.now() - startTime,
              circuitBreakerState: circuitBreaker.getState()
            };
          } else {
            lastError = circuitResult.error;
          }
        } else {
          // Direct execution without circuit breaker
          const result = await this.executeWithTimeout(operation, config.timeout);
          return {
            success: true,
            result,
            attempts,
            totalDuration: Date.now() - startTime
          };
        }
      } catch (error) {
        lastError = error;

        // Check if we should retry this error
        if (!this.shouldRetry(error, config, attempts)) {
          break;
        }

        // Call retry callback if provided
        if (config.onRetry) {
          try {
            config.onRetry(attempts, error);
          } catch (error_) {
            console.warn('[RetryManager] Retry callback error:', error_);
          }
        }

        // Calculate delay for next attempt
        if (attempts < config.maxAttempts) {
          const delay = this.calculateDelay(attempts, config);
          console.log(`[RetryManager] Attempt ${attempts} failed, retrying in ${delay}ms:`, error);
          await this.delay(delay);
        }
      }
    }

    // All attempts failed
    if (config.onFailure) {
      try {
        config.onFailure(lastError);
      } catch (error_) {
        console.warn('[RetryManager] Failure callback error:', error_);
      }
    }

    return {
      success: false,
      error: lastError,
      attempts,
      totalDuration: Date.now() - startTime,
      circuitBreakerState: circuitBreaker?.getState()
    };
  }

  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeout?: number
  ): Promise<T> {
    if (!timeout) {
      return await operation();
    }

    return new Promise((resolve, reject) => {
      const timeoutId = globalThis.setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeout}ms`));
      }, timeout);

      operation()
        .then(result => {
          globalThis.clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          globalThis.clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  private shouldRetry(error: OperationError, config: RetryConfig, attempt: number): boolean {
    // Check max attempts
    if (attempt >= config.maxAttempts) {
      return false;
    }

    // Use custom retry condition if provided
    if (config.retryCondition) {
      return config.retryCondition(error);
    }

    // Default retry logic
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // Don't retry certain types of errors
      if (message.includes('authentication') ||
          message.includes('authorization') ||
          message.includes('forbidden') ||
          message.includes('not found') ||
          message.includes('bad request')) {
        return false;
      }

      // Retry network and timeout errors
      if (message.includes('network') ||
          message.includes('timeout') ||
          message.includes('connection') ||
          message.includes('server error') ||
          message.includes('rate limit')) {
        return true;
      }
    }

    // Retry unknown errors
    return true;
  }

  private calculateDelay(attempt: number, config: RetryConfig): number {
    // Exponential backoff with jitter
    let delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    delay = Math.min(delay, config.maxDelay);

    if (config.jitterEnabled) {
      // Add random jitter (±25% of delay)
      const jitter = delay * 0.25 * (Math.random() * 2 - 1);
      delay += jitter;
    }

    return Math.max(0, Math.floor(delay));
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => globalThis.setTimeout(resolve, ms));
  }

  // Circuit breaker management
  getCircuitBreaker(name: string): CircuitBreaker | undefined {
    return this.circuitBreakers.get(name);
  }

  createCircuitBreaker(name: string, config: CircuitBreakerConfig): CircuitBreaker {
    const circuitBreaker = new CircuitBreaker(config);
    this.circuitBreakers.set(name, circuitBreaker);
    return circuitBreaker;
  }

  resetCircuitBreaker(name: string): void {
    const circuitBreaker = this.circuitBreakers.get(name);
    if (circuitBreaker) {
      circuitBreaker.reset();
    }
  }

  getAllCircuitBreakerStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    for (const [name, breaker] of this.circuitBreakers) {
      stats[name] = breaker.getStats();
    }
    return stats;
  }
}

// ─── Specialized Retry Policies ────────────────────────────────────────

// Network retry policy - good for API calls
export const networkRetryPolicy: RetryConfig = {
  maxAttempts: 5,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitterEnabled: true,
  retryCondition: (error) => {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return message.includes('network') ||
             message.includes('timeout') ||
             message.includes('connection') ||
             message.includes('server error') ||
             message.includes('rate limit');
    }
    return true;
  },
  onRetry: (attempt, error) => {
    console.log(`[NetworkRetry] Attempt ${attempt} failed, retrying:`, error);
  },
  onFailure: (error) => {
    console.error('[NetworkRetry] All attempts failed:', error);
  }
};

// Database retry policy - conservative for data operations
export const databaseRetryPolicy: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 500,
  maxDelay: 5000,
  backoffMultiplier: 1.5,
  jitterEnabled: true,
  retryCondition: (error) => {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return message.includes('timeout') ||
             message.includes('connection') ||
             message.includes('temporary');
    }
    return false; // Don't retry unknown database errors
  }
};

// User action retry policy - minimal retries for UX
export const userActionRetryPolicy: RetryConfig = {
  maxAttempts: 2,
  initialDelay: 500,
  maxDelay: 2000,
  backoffMultiplier: 1.5,
  jitterEnabled: true,
  retryCondition: (error) => {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return message.includes('network') || message.includes('timeout');
    }
    return false; // Don't retry user action errors
  }
};

// ─── High-Level Retry Wrappers ────────────────────────────────────────

// Retry with network policy
export async function withNetworkRetry<T>(
  operation: () => Promise<T>,
  circuitBreakerKey?: string
): Promise<RetryResult<T>> {
  return await retryManager.retry(operation, networkRetryPolicy, circuitBreakerKey);
}

// Retry with database policy
export async function withDatabaseRetry<T>(
  operation: () => Promise<T>,
  circuitBreakerKey?: string
): Promise<RetryResult<T>> {
  return await retryManager.retry(operation, databaseRetryPolicy, circuitBreakerKey);
}

// Retry with user action policy
export async function withUserActionRetry<T>(
  operation: () => Promise<T>,
  circuitBreakerKey?: string
): Promise<RetryResult<T>> {
  return await retryManager.retry(operation, userActionRetryPolicy, circuitBreakerKey);
}

// Custom retry configuration
export async function withCustomRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig,
  circuitBreakerKey?: string
): Promise<RetryResult<T>> {
  return await retryManager.retry(operation, config, circuitBreakerKey);
}

// ─── Circuit Breaker Convenience Functions ────────────────────────────
export async function withCircuitBreaker<T>(
  name: string,
  operation: () => Promise<T>,
  config?: Partial<CircuitBreakerConfig>,
  fallback?: () => Promise<T>
): Promise<{ success: boolean; result?: T; error?: OperationError; circuitState: string }> {
  let circuitBreaker = retryManager.getCircuitBreaker(name);

  if (!circuitBreaker) {
    circuitBreaker = retryManager.createCircuitBreaker(name, {
      failureThreshold: 5,
      recoveryTimeout: 30000,
      monitoringPeriod: 60000,
      successThreshold: 2,
      name,
      ...config
    });
  }

  return await circuitBreaker.execute(operation, fallback);
}

// ─── Bulk Operations with Retry ────────────────────────────────────────
export class BulkRetryManager {
  async executeWithRetry<T>(
    operations: Array<{ id: string; operation: () => Promise<T> }>,
    config: RetryConfig,
    concurrencyLimit = 3
  ): Promise<Array<{ id: string; result: RetryResult<T> }>> {
    const results: Array<{ id: string; result: RetryResult<T> }> = [];
    const semaphore = new Semaphore(concurrencyLimit);

    const promises = operations.map(async ({ id, operation }) => {
      await semaphore.acquire();

      try {
        const result = await retryManager.retry(operation, config, `bulk_${id}`);
        results.push({ id, result });
      } finally {
        semaphore.release();
      }
    });

    await Promise.all(promises);
    return results;
  }
}

// ─── Semaphore for Concurrency Control ────────────────────────────────
class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise(resolve => {
      this.waiting.push(resolve);
    });
  }

  release(): void {
    this.permits++;
    if (this.waiting.length > 0) {
      const resolve = this.waiting.shift()!;
      this.permits--;
      resolve();
    }
  }
}

// ─── Metrics and Monitoring ────────────────────────────────────────────
export class RetryMetricsCollector {
  private metrics = {
    totalRetries: 0,
    successfulRetries: 0,
    failedRetries: 0,
    averageAttempts: 0,
    circuitBreakerTrips: 0,
    retryDurations: [] as number[]
  };

  recordRetry(result: RetryResult<any>): void {
    this.metrics.totalRetries++;

    if (result.success) {
      this.metrics.successfulRetries++;
    } else {
      this.metrics.failedRetries++;
    }

    // Update average attempts
    const totalAttempts = this.metrics.averageAttempts * (this.metrics.totalRetries - 1) + result.attempts;
    this.metrics.averageAttempts = totalAttempts / this.metrics.totalRetries;

    // Record duration
    this.metrics.retryDurations.push(result.totalDuration);

    // Keep only last 1000 durations
    if (this.metrics.retryDurations.length > 1000) {
      this.metrics.retryDurations.shift();
    }

    // Check for circuit breaker trips
    if (result.circuitBreakerState === 'open') {
      this.metrics.circuitBreakerTrips++;
    }
  }

  getMetrics(): typeof this.metrics & {
    successRate: number;
    averageDuration: number;
  } {
    const successRate = this.metrics.totalRetries > 0
      ? (this.metrics.successfulRetries / this.metrics.totalRetries) * 100
      : 0;

    const averageDuration = this.metrics.retryDurations.length > 0
      ? this.metrics.retryDurations.reduce((a, b) => a + b, 0) / this.metrics.retryDurations.length
      : 0;

    return {
      ...this.metrics,
      successRate,
      averageDuration
    };
  }

  reset(): void {
    this.metrics = {
      totalRetries: 0,
      successfulRetries: 0,
      failedRetries: 0,
      averageAttempts: 0,
      circuitBreakerTrips: 0,
      retryDurations: []
    };
  }
}

// ─── Global Instances ──────────────────────────────────────────────────
export const retryManager = new RetryManager();
export const bulkRetryManager = new BulkRetryManager();
export const retryMetrics = new RetryMetricsCollector();

// ─── Export Default ────────────────────────────────────────────────────
export default retryManager;
