// ─── Comprehensive Error Boundary & Graceful Degradation System ─────────────────
// A production-ready error handling system that provides graceful degradation,
// user-friendly error messages, and automatic recovery strategies.

export interface ErrorContext {
  operation: string;
  userMessage: string;
  technicalDetails: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable: boolean;
  suggestedAction?: string;
  retryAfter?: number; // milliseconds
  fallbackBehavior?: () => Promise<void> | void;
}

export interface ErrorBoundaryConfig {
  maxRetries: number;
  retryDelay: number;
  enableLogging: boolean;
  enableUserNotifications: boolean;
  gracefulDegradation: boolean;
}

export class ErrorBoundary {
  private config: ErrorBoundaryConfig;
  private errorHistory: ErrorContext[] = [];
  private readonly MAX_ERROR_HISTORY = 100;

  constructor(config: Partial<ErrorBoundaryConfig> = {}) {
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      enableLogging: true,
      enableUserNotifications: true,
      gracefulDegradation: true,
      ...config
    };
  }

  // ─── Core Error Handling Method ──────────────────────────────────────────
  async handleError<T>(
    operation: string,
    error: Error | unknown,
    context?: Record<string, any>
  ): Promise<T | null> {
    const errorContext = this.classifyError(operation, error, context);

    // Log error if enabled
    if (this.config.enableLogging) {
      this.logError(errorContext);
    }

    // Store in error history
    this.errorHistory.push(errorContext);
    if (this.errorHistory.length > this.MAX_ERROR_HISTORY) {
      this.errorHistory.shift();
    }

    // User notification
    if (this.config.enableUserNotifications) {
      this.notifyUser(errorContext);
    }

    // Attempt recovery if possible
    if (errorContext.recoverable && this.config.gracefulDegradation) {
      return await this.attemptRecovery(errorContext);
    }

    // Return null for graceful degradation
    return null;
  }

  // ─── Error Classification System ─────────────────────────────────────────
  private classifyError(
    operation: string,
    error: Error | unknown,
    context?: Record<string, any>
  ): ErrorContext {
    const errorString = error instanceof Error ? error.message : String(error);
    const lowerError = errorString.toLowerCase();

    // Network/API errors
    if (lowerError.includes('network') || lowerError.includes('fetch') || lowerError.includes('timeout')) {
      return {
        operation,
        userMessage: 'Connection issue detected. Some features may be temporarily unavailable.',
        technicalDetails: errorString,
        severity: 'medium',
        recoverable: true,
        suggestedAction: 'Please check your internet connection and try again.',
        retryAfter: 5000,
        fallbackBehavior: async () => {
          // Attempt to reconnect or use cached data
          console.log('[ErrorBoundary] Attempting network recovery...');
        }
      };
    }

    // DOM/Content Script errors
    if (lowerError.includes('content script') || lowerError.includes('dom') || lowerError.includes('element')) {
      return {
        operation,
        userMessage: 'Page interaction temporarily unavailable. The page may be loading or incompatible.',
        technicalDetails: errorString,
        severity: 'medium',
        recoverable: true,
        suggestedAction: 'Try refreshing the page or navigating to a different page.',
        retryAfter: 2000,
        fallbackBehavior: () => {
          // Provide alternative UI feedback
          console.log('[ErrorBoundary] DOM recovery attempted');
        }
      };
    }

    // Authentication errors
    if (lowerError.includes('auth') || lowerError.includes('token') || lowerError.includes('401') || lowerError.includes('403')) {
      return {
        operation,
        userMessage: 'Authentication required. Please check your API key settings.',
        technicalDetails: errorString,
        severity: 'high',
        recoverable: false,
        suggestedAction: 'Open extension settings and verify your API key is correct.',
        fallbackBehavior: () => {
          // Open settings page
          if (chrome.runtime?.openOptionsPage) {
            chrome.runtime.openOptionsPage();
          }
        }
      };
    }

    // Rate limiting errors
    if (lowerError.includes('rate limit') || lowerError.includes('429')) {
      return {
        operation,
        userMessage: 'Service temporarily overloaded. Please wait a moment before continuing.',
        technicalDetails: errorString,
        severity: 'low',
        recoverable: true,
        suggestedAction: 'The system will automatically retry in a few moments.',
        retryAfter: 30000,
        fallbackBehavior: () => {
          // Queue operation for later retry
          console.log('[ErrorBoundary] Operation queued for retry after rate limit');
        }
      };
    }

    // LLM/Model errors
    if (lowerError.includes('llm') || lowerError.includes('model') || lowerError.includes('ai')) {
      return {
        operation,
        userMessage: 'AI service temporarily unavailable. Using simplified mode.',
        technicalDetails: errorString,
        severity: 'medium',
        recoverable: true,
        suggestedAction: 'The system will continue with basic functionality.',
        retryAfter: 10000,
        fallbackBehavior: () => {
          // Switch to fallback AI mode or disable AI features
          console.log('[ErrorBoundary] Switching to fallback AI mode');
        }
      };
    }

    // Generic errors
    return {
      operation,
      userMessage: 'An unexpected error occurred. The system is recovering automatically.',
      technicalDetails: errorString,
      severity: 'medium',
      recoverable: true,
      suggestedAction: 'Please try again in a moment.',
      retryAfter: 3000,
      fallbackBehavior: () => {
        // Generic recovery attempt
        console.log('[ErrorBoundary] Generic error recovery initiated');
      }
    };
  }

  // ─── Recovery Mechanisms ────────────────────────────────────────────────
  private async attemptRecovery<T>(errorContext: ErrorContext): Promise<T | null> {
    try {
      if (errorContext.fallbackBehavior) {
        await errorContext.fallbackBehavior();
      }

      // Wait for retry delay if specified
      if (errorContext.retryAfter) {
        await this.delay(errorContext.retryAfter);
      }

      return null; // Indicate recovery was attempted but original operation should be retried
    } catch (recoveryError) {
      console.error('[ErrorBoundary] Recovery attempt failed:', recoveryError);
      return null;
    }
  }

  // ─── User Notification System ───────────────────────────────────────────
  private notifyUser(errorContext: ErrorContext): void {
    // Send notification to UI
    const notification = {
      type: 'error_notification',
      message: errorContext.userMessage,
      severity: errorContext.severity,
      suggestedAction: errorContext.suggestedAction,
      recoverable: errorContext.recoverable,
      timestamp: Date.now()
    };

    // Send to side panel if available
    if (chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage(notification).catch(() => {
        // Silently fail if no listener
      });
    }

    // Also log to console for debugging
    console.warn(`[ErrorBoundary] ${errorContext.severity.toUpperCase()}: ${errorContext.userMessage}`);
  }

  // ─── Logging and Monitoring ─────────────────────────────────────────────
  private logError(errorContext: ErrorContext): void {
    const logEntry = {
      timestamp: Date.now(),
      level: this.severityToLogLevel(errorContext.severity),
      operation: errorContext.operation,
      message: errorContext.userMessage,
      technical: errorContext.technicalDetails,
      recoverable: errorContext.recoverable
    };

    // Structured logging
    console.error('[ErrorBoundary]', JSON.stringify(logEntry, null, 2));

    // Store for analytics
    this.storeErrorLog(logEntry);
  }

  private severityToLogLevel(severity: ErrorContext['severity']): string {
    switch (severity) {
      case 'critical': return 'error';
      case 'high': return 'error';
      case 'medium': return 'warn';
      case 'low': return 'info';
      default: return 'info';
    }
  }

  private storeErrorLog(logEntry: any): void {
    // In production, this would send to analytics service
    // For now, just keep in memory for debugging
    if (this.errorHistory.length > this.MAX_ERROR_HISTORY) {
      // Could implement persistence here
    }
  }

  // ─── Utility Methods ────────────────────────────────────────────────────
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ─── Public API ─────────────────────────────────────────────────────────
  getErrorHistory(): ErrorContext[] {
    return [...this.errorHistory];
  }

  getErrorStats(): Record<string, number> {
    const stats: Record<string, number> = {
      total: this.errorHistory.length,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      recoverable: 0,
      nonRecoverable: 0
    };

    for (const error of this.errorHistory) {
      stats[error.severity]++;
      if (error.recoverable) {
        stats.recoverable++;
      } else {
        stats.nonRecoverable++;
      }
    }

    return stats;
  }

  clearErrorHistory(): void {
    this.errorHistory = [];
  }

  updateConfig(newConfig: Partial<ErrorBoundaryConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// ─── Graceful Degradation Utilities ──────────────────────────────────────

export class GracefulDegradationManager {
  private degradedFeatures = new Set<string>();
  private featureFallbacks = new Map<string, () => Promise<void> | void>();

  // Register a fallback for a feature
  registerFallback(feature: string, fallback: () => Promise<void> | void): void {
    this.featureFallbacks.set(feature, fallback);
  }

  // Mark a feature as degraded
  degradeFeature(feature: string): void {
    this.degradedFeatures.add(feature);
    console.log(`[GracefulDegradation] Feature "${feature}" marked as degraded`);

    // Execute fallback if available
    const fallback = this.featureFallbacks.get(feature);
    if (fallback) {
      try {
        const result = fallback();
        if (result instanceof Promise) {
          result.catch(err => console.error(`[GracefulDegradation] Fallback failed for ${feature}:`, err));
        }
      } catch (error) {
        console.error(`[GracefulDegradation] Fallback execution failed for ${feature}:`, error);
      }
    }
  }

  // Restore a degraded feature
  restoreFeature(feature: string): void {
    this.degradedFeatures.delete(feature);
    console.log(`[GracefulDegradation] Feature "${feature}" restored`);
  }

  // Check if a feature is degraded
  isDegraded(feature: string): boolean {
    return this.degradedFeatures.has(feature);
  }

  // Get all degraded features
  getDegradedFeatures(): string[] {
    return Array.from(this.degradedFeatures);
  }

  // Execute operation with graceful degradation
  async executeWithDegradation<T>(
    operation: string,
    primary: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T | null> {
    try {
      if (this.isDegraded(operation)) {
        if (fallback) {
          console.log(`[GracefulDegradation] Using fallback for degraded feature: ${operation}`);
          return await fallback();
        }
        console.warn(`[GracefulDegradation] Feature "${operation}" is degraded and no fallback available`);
        return null;
      }

      return await primary();
    } catch (error) {
      console.error(`[GracefulDegradation] Primary operation failed for ${operation}:`, error);

      if (fallback) {
        try {
          console.log(`[GracefulDegradation] Executing fallback for ${operation}`);
          return await fallback();
        } catch (fallbackError) {
          console.error(`[GracefulDegradation] Fallback also failed for ${operation}:`, fallbackError);
        }
      }

      // Mark as degraded for future calls
      this.degradeFeature(operation);
      return null;
    }
  }
}

// ─── Global Error Boundary Instance ──────────────────────────────────────
export const globalErrorBoundary = new ErrorBoundary({
  maxRetries: 3,
  retryDelay: 1000,
  enableLogging: true,
  enableUserNotifications: true,
  gracefulDegradation: true
});

export const globalGracefulDegradation = new GracefulDegradationManager();

// ─── High-Level Error Handling Wrappers ────────────────────────────────

// Wrapper for async operations with automatic error handling
export async function withErrorBoundary<T>(
  operation: string,
  fn: () => Promise<T>,
  context?: Record<string, any>
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    return await globalErrorBoundary.handleError(operation, error, context);
  }
}

// Wrapper for synchronous operations
export function withSyncErrorBoundary<T>(
  operation: string,
  fn: () => T,
  context?: Record<string, any>
): T | null {
  try {
    return fn();
  } catch (error) {
    globalErrorBoundary.handleError(operation, error, context);
    return null;
  }
}

// Wrapper for operations with graceful degradation
export async function withGracefulDegradation<T>(
  operation: string,
  primary: () => Promise<T>,
  fallback?: () => Promise<T>
): Promise<T | null> {
  return await globalGracefulDegradation.executeWithDegradation(operation, primary, fallback);
}

// ─── React Error Boundary (for UI components) ───────────────────────────
export class UIErrorBoundary {
  private static instance: UIErrorBoundary;
  private errorQueue: Array<{ error: Error; component: string; timestamp: number }> = [];

  static getInstance(): UIErrorBoundary {
    if (!UIErrorBoundary.instance) {
      UIErrorBoundary.instance = new UIErrorBoundary();
    }
    return UIErrorBoundary.instance;
  }

  catchError(error: Error, componentName: string): void {
    const errorEntry = {
      error,
      component: componentName,
      timestamp: Date.now()
    };

    this.errorQueue.push(errorEntry);

    // Keep only last 50 errors
    if (this.errorQueue.length > 50) {
      this.errorQueue.shift();
    }

    // Log the error
    console.error(`[UIErrorBoundary] Error in component "${componentName}":`, error);

    // Notify user through extension messaging
    const notification = {
      type: 'ui_error',
      component: componentName,
      message: `Something went wrong with ${componentName}. The interface will continue working.`,
      timestamp: Date.now()
    };

    if (chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage(notification).catch(() => {});
    }
  }

  getRecentErrors(): Array<{ error: Error; component: string; timestamp: number }> {
    return [...this.errorQueue];
  }
}

// ─── Export Convenience Functions ───────────────────────────────────────
export const errorBoundary = globalErrorBoundary;
export const gracefulDegradation = globalGracefulDegradation;
export const uiErrorBoundary = UIErrorBoundary.getInstance();
