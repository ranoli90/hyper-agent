import type { Action, ErrorType } from './types';

export enum FailureType {
  ELEMENT_NOT_FOUND = 'element_not_found',
  ELEMENT_NOT_VISIBLE = 'element_not_visible',
  ELEMENT_DISABLED = 'element_disabled',
  ACTION_FAILED = 'action_failed',
  TIMEOUT = 'timeout',
  NAVIGATION_ERROR = 'navigation_error',
  NETWORK_ERROR = 'network_error',
  UNKNOWN = 'unknown',
}

export enum StrategyType {
  RETRY_WITH_BACKOFF = 'retry_with_backoff',
  WAIT_AND_RETRY = 'wait_and_retry',
  ALTERNATIVE_LOCATOR = 'alternative_locator',
  SCROLL_BEFORE_ACTION = 'scroll_before_action',
  REFRESH_AND_RETRY = 'refresh_and_retry',
  SKIP_AND_CONTINUE = 'skip_and_continue',
}

export interface FailureAnalysis {
  failureType: FailureType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  isRecoverable: boolean;
  suggestedStrategies: StrategyType[];
  confidence: number;
}

export interface RecoveryContext {
  action: Action;
  error: string;
  errorType: ErrorType;
  attempt: number;
  pageUrl: string;
  timestamp: number;
}

export interface RecoveryResult {
  success: boolean;
  strategy: StrategyType | null;
  action?: Action;
  waitMs?: number;
  message?: string;
}

class FailureRecoverySystemImpl {
  private recoveryHistory: RecoveryContext[] = [];
  private maxHistory = 100;
  private strategyStats: Map<StrategyType, { attempts: number; successes: number }> = new Map();

  constructor() {
    Object.values(StrategyType).forEach(s => {
      this.strategyStats.set(s, { attempts: 0, successes: 0 });
    });
  }

  analyzeFailure(errorType: ErrorType, errorMessage: string, action: Action): FailureAnalysis {
    let failureType: FailureType;
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
    let isRecoverable = true;

    switch (errorType) {
      case 'ELEMENT_NOT_FOUND':
        failureType = FailureType.ELEMENT_NOT_FOUND;
        severity = 'medium';
        break;
      case 'ELEMENT_NOT_VISIBLE':
        failureType = FailureType.ELEMENT_NOT_VISIBLE;
        severity = 'low';
        break;
      case 'ELEMENT_DISABLED':
        failureType = FailureType.ELEMENT_DISABLED;
        severity = 'medium';
        break;
      case 'TIMEOUT':
        failureType = FailureType.TIMEOUT;
        severity = 'high';
        break;
      case 'NAVIGATION_ERROR':
        failureType = FailureType.NAVIGATION_ERROR;
        severity = 'high';
        break;
      case 'ACTION_FAILED':
        failureType = FailureType.ACTION_FAILED;
        severity = 'medium';
        break;
      default:
        failureType = FailureType.UNKNOWN;
        severity = 'medium';
    }

    const suggestedStrategies = this.getSuggestedStrategies(failureType, action);

    return {
      failureType,
      severity,
      isRecoverable,
      suggestedStrategies,
      confidence: 0.8,
    };
  }

   
  private getSuggestedStrategies(failureType: FailureType, _action: Action): StrategyType[] {
    switch (failureType) {
      case FailureType.ELEMENT_NOT_FOUND:
        return [
          StrategyType.SCROLL_BEFORE_ACTION,
          StrategyType.WAIT_AND_RETRY,
          StrategyType.ALTERNATIVE_LOCATOR,
        ];
      case FailureType.ELEMENT_NOT_VISIBLE:
        return [StrategyType.SCROLL_BEFORE_ACTION, StrategyType.WAIT_AND_RETRY];
      case FailureType.ELEMENT_DISABLED:
        return [StrategyType.WAIT_AND_RETRY, StrategyType.SKIP_AND_CONTINUE];
      case FailureType.TIMEOUT:
        return [StrategyType.RETRY_WITH_BACKOFF, StrategyType.REFRESH_AND_RETRY];
      case FailureType.NAVIGATION_ERROR:
        return [StrategyType.RETRY_WITH_BACKOFF, StrategyType.REFRESH_AND_RETRY];
      case FailureType.ACTION_FAILED:
        return [StrategyType.RETRY_WITH_BACKOFF, StrategyType.WAIT_AND_RETRY];
      default:
        return [StrategyType.RETRY_WITH_BACKOFF];
    }
  }

  getRecoveryStrategy(analysis: FailureAnalysis, attempt: number): RecoveryResult {
    const strategies = analysis.suggestedStrategies;

    if (attempt > strategies.length) {
      return {
        success: false,
        strategy: null,
        message: `All recovery strategies exhausted after ${attempt} attempts`,
      };
    }

    const strategy = strategies[Math.min(attempt - 1, strategies.length - 1)];

    switch (strategy) {
      case StrategyType.RETRY_WITH_BACKOFF:
        const waitMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        return {
          success: true,
          strategy,
          waitMs,
          message: `Retrying with ${waitMs}ms backoff`,
        };

      case StrategyType.WAIT_AND_RETRY:
        return {
          success: true,
          strategy,
          waitMs: 1500,
          message: 'Waiting 1.5s before retry',
        };

      case StrategyType.SCROLL_BEFORE_ACTION:
        return {
          success: true,
          strategy,
          action: { type: 'scroll', direction: 'down', amount: 400 } as Action,
          waitMs: 500,
          message: 'Scrolling to find element',
        };

      case StrategyType.REFRESH_AND_RETRY:
        return {
          success: true,
          strategy,
          action: { type: 'navigate' } as any,
          waitMs: 2000,
          message: 'Refreshing page before retry',
        };

      case StrategyType.ALTERNATIVE_LOCATOR:
        return {
          success: true,
          strategy,
          message: 'Try alternative locator strategy',
        };

      case StrategyType.SKIP_AND_CONTINUE:
        return {
          success: true,
          strategy,
          message: 'Skipping action and continuing',
        };

      default:
        return {
          success: false,
          strategy: null,
          message: 'Unknown recovery strategy',
        };
    }
  }

   
  recordRecovery(context: RecoveryContext, _success: boolean): void {
    this.recoveryHistory.push(context);
    if (this.recoveryHistory.length > this.maxHistory) {
      this.recoveryHistory.shift();
    }
  }

  getStats(): {
    totalRecoveries: number;
    successRate: number;
    byStrategy: Record<string, { attempts: number; successes: number }>;
  } {
    const stats = {
      totalRecoveries: this.recoveryHistory.length,
      successRate: 0,
      byStrategy: {} as Record<string, { attempts: number; successes: number }>,
    };

    this.strategyStats.forEach((value, key) => {
      stats.byStrategy[key] = value;
    });

    return stats;
  }

  getRecentFailures(count: number = 10): RecoveryContext[] {
    return this.recoveryHistory.slice(-count);
  }

  shouldAbort(errorType: ErrorType, attempt: number): boolean {
    const maxAttempts: Record<ErrorType, number> = {
      ELEMENT_NOT_FOUND: 3,
      ELEMENT_NOT_VISIBLE: 2,
      ELEMENT_DISABLED: 2,
      ACTION_FAILED: 3,
      TIMEOUT: 2,
      NAVIGATION_ERROR: 2,
      RATE_LIMIT: 1,
      SECURITY_POLICY: 0,
      UNKNOWN: 2,
    };

    return attempt >= (maxAttempts[errorType] ?? 2);
  }
}

export const failureRecovery = new FailureRecoverySystemImpl();
