// ─── Enterprise-Grade Logging System ────────────────────────────────
// Comprehensive logging with structured JSON output, log rotation,
// performance monitoring, and analytics integration

export interface LogEntry {
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error' | 'critical';
  category: string;
  message: string;
  data?: Record<string, any>;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  duration?: number;
  memoryUsage?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  context?: {
    url?: string;
    userAgent?: string;
    platform?: string;
    extensionVersion?: string;
  };
}

export interface LogConfig {
  level: 'debug' | 'info' | 'warn' | 'error' | 'critical';
  enableConsole: boolean;
  enableStorage: boolean;
  maxEntries: number;
  rotationSize: number; // KB
  compressionEnabled: boolean;
  remoteLoggingEnabled: boolean;
  remoteEndpoint?: string;
  includePerformanceMetrics: boolean;
  includeMemoryMetrics: boolean;
}

export class StructuredLogger {
  private config: LogConfig;
  private logs: LogEntry[] = [];
  private currentLogSize = 0;
  private rotationCount = 0;
  private performanceMarks = new Map<string, number>();

  constructor(config: Partial<LogConfig> = {}) {
    this.config = {
      level: 'info',
      enableConsole: true,
      enableStorage: true,
      maxEntries: 10000,
      rotationSize: 1024, // 1MB
      compressionEnabled: false,
      remoteLoggingEnabled: false,
      includePerformanceMetrics: true,
      includeMemoryMetrics: true,
      ...config
    };

    // Clean up old logs on initialization
    this.initializeLogCleanup();

    // Start periodic log rotation check
    setInterval(() => this.checkLogRotation(), 60000); // Every minute
  }

  // ─── Core Logging Methods ──────────────────────────────────────────────
  debug(category: string, message: string, data?: Record<string, any>): void {
    this.log('debug', category, message, data);
  }

  info(category: string, message: string, data?: Record<string, any>): void {
    this.log('info', category, message, data);
  }

  warn(category: string, message: string, data?: Record<string, any>): void {
    this.log('warn', category, message, data);
  }

  error(category: string, message: string, error?: Error | unknown, data?: Record<string, any>): void {
    const errorData = this.formatError(error);
    this.log('error', category, message, { ...data, ...errorData });
  }

  critical(category: string, message: string, error?: Error | unknown, data?: Record<string, any>): void {
    const errorData = this.formatError(error);
    this.log('critical', category, message, { ...data, ...errorData });
  }

  // ─── Performance Logging ───────────────────────────────────────────────
  startTimer(operation: string): string {
    const timerId = `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.performanceMarks.set(timerId, performance.now());
    return timerId;
  }

  endTimer(timerId: string, category: string, message: string, data?: Record<string, any>): void {
    const startTime = this.performanceMarks.get(timerId);
    if (!startTime) {
      this.warn('performance', `Timer ${timerId} not found`);
      return;
    }

    const duration = performance.now() - startTime;
    this.performanceMarks.delete(timerId);

    this.log('info', category, message, {
      ...data,
      duration,
      performance: true
    });
  }

  // ─── Private Methods ───────────────────────────────────────────────────
  protected log(level: LogEntry['level'], category: string, message: string, data?: Record<string, any>): void {
    // Check if this log level should be processed
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      category,
      message,
      data,
      duration: data?.duration,
      memoryUsage: this.config.includeMemoryMetrics ? this.getMemoryUsage() : undefined,
      context: this.getContextInfo()
    };

    // Add to in-memory log
    this.logs.push(entry);
    this.currentLogSize += JSON.stringify(entry).length;

    // Maintain max entries limit
    if (this.logs.length > this.config.maxEntries) {
      this.logs.shift();
    }

    // Console output
    if (this.config.enableConsole) {
      this.outputToConsole(entry);
    }

    // Storage persistence
    if (this.config.enableStorage) {
      this.persistLogEntry(entry);
    }

    // Remote logging
    if (this.config.remoteLoggingEnabled && this.config.remoteEndpoint) {
      this.sendToRemote(entry);
    }
  }

  private shouldLog(level: LogEntry['level']): boolean {
    const levels = ['debug', 'info', 'warn', 'error', 'critical'];
    const currentLevelIndex = levels.indexOf(this.config.level);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  private formatError(error: Error | unknown): { error?: LogEntry['error'] } {
    if (!error) return {};

    if (error instanceof Error) {
      return {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
          code: (error as any).code
        }
      };
    }

    return {
      error: {
        name: 'UnknownError',
        message: String(error)
      }
    };
  }

  private getMemoryUsage(): number | undefined {
    // Chrome extension memory monitoring
    if ((performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return undefined;
  }

  private getContextInfo(): LogEntry['context'] {
    try {
      return {
        url: window.location?.href,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        extensionVersion: chrome.runtime?.getManifest()?.version
      };
    } catch {
      // In service worker context, some globals may not be available
      return {
        platform: 'service_worker',
        extensionVersion: chrome.runtime?.getManifest()?.version
      };
    }
  }

  private outputToConsole(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toISOString();
    const prefix = `[${timestamp}] [${entry.category}]`;
    const message = `${prefix} ${entry.message}`;

    switch (entry.level) {
      case 'debug':
        console.debug(message, entry.data);
        break;
      case 'info':
        console.info(message, entry.data);
        break;
      case 'warn':
        console.warn(message, entry.data);
        break;
      case 'error':
      case 'critical':
        console.error(message, entry);
        break;
    }
  }

  private async persistLogEntry(entry: LogEntry): Promise<void> {
    try {
      const key = `hyperagent_log_${Date.now()}_${this.rotationCount}`;
      await chrome.storage.local.set({ [key]: entry });

      // Clean up old log entries periodically
      if (Math.random() < 0.01) { // 1% chance to trigger cleanup
        await this.cleanupOldLogEntries();
      }
    } catch (error) {
      console.error('[Logger] Failed to persist log entry:', error);
    }
  }

  private async cleanupOldLogEntries(): Promise<void> {
    try {
      const data = await chrome.storage.local.get(null);
      const logKeys = Object.keys(data).filter(key => key.startsWith('hyperagent_log_'));

      // Keep only the most recent 1000 entries
      if (logKeys.length > 1000) {
        const keysToRemove = logKeys
          .sort()
          .slice(0, logKeys.length - 1000);

        await chrome.storage.local.remove(keysToRemove);
      }
    } catch (error) {
      console.error('[Logger] Failed to cleanup old log entries:', error);
    }
  }

  private checkLogRotation(): void {
    const sizeKB = this.currentLogSize / 1024;

    if (sizeKB > this.config.rotationSize) {
      this.rotateLogs();
    }
  }

  private rotateLogs(): void {
    this.rotationCount++;

    // Archive current logs
    const archivedLogs = [...this.logs];
    this.logs = [];
    this.currentLogSize = 0;

    // In production, this would compress and store archived logs
    console.log(`[Logger] Rotated logs (rotation #${this.rotationCount}, archived ${archivedLogs.length} entries)`);

    // Store archived logs if compression is enabled
    if (this.config.compressionEnabled) {
      this.compressAndStoreArchivedLogs(archivedLogs);
    }
  }

  private async compressAndStoreArchivedLogs(logs: LogEntry[]): Promise<void> {
    try {
      // Simple JSON compression (in production, use proper compression)
      const compressed = btoa(JSON.stringify(logs));
      const key = `hyperagent_logs_archive_${Date.now()}`;

      await chrome.storage.local.set({ [key]: compressed });
    } catch (error) {
      console.error('[Logger] Failed to compress archived logs:', error);
    }
  }

  private async sendToRemote(entry: LogEntry): Promise<void> {
    if (!this.config.remoteEndpoint) return;

    try {
      await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entry),
      });
    } catch (error) {
      // Don't log remote logging failures to avoid loops
      console.warn('[Logger] Failed to send log to remote endpoint:', error);
    }
  }

  private initializeLogCleanup(): void {
    // Clean up logs older than 7 days on startup
    setTimeout(async () => {
      try {
        const data = await chrome.storage.local.get(null);
        const logKeys = Object.keys(data).filter(key => key.startsWith('hyperagent_log_'));
        const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days

        const keysToRemove = logKeys.filter(key => {
          const timestamp = parseInt(key.split('_')[2]);
          return timestamp < cutoffTime;
        });

        if (keysToRemove.length > 0) {
          await chrome.storage.local.remove(keysToRemove);
          console.log(`[Logger] Cleaned up ${keysToRemove.length} old log entries`);
        }
      } catch (error) {
        console.error('[Logger] Failed to cleanup old logs on startup:', error);
      }
    }, 5000); // Delay to avoid blocking startup
  }

  // ─── Public API ───────────────────────────────────────────────────────
  getLogs(level?: LogEntry['level'], category?: string, limit = 100): LogEntry[] {
    let filteredLogs = this.logs;

    if (level) {
      filteredLogs = filteredLogs.filter(log => log.level === level);
    }

    if (category) {
      filteredLogs = filteredLogs.filter(log => log.category === category);
    }

    return filteredLogs.slice(-limit);
  }

  getStats(): {
    totalLogs: number;
    logSizeKB: number;
    rotations: number;
    errorRate: number;
    performanceMetrics: { avgDuration: number; slowOperations: number };
  } {
    const totalLogs = this.logs.length;
    const errorLogs = this.logs.filter(log => log.level === 'error' || log.level === 'critical').length;
    const performanceLogs = this.logs.filter(log => log.data?.performance);

    const avgDuration = performanceLogs.length > 0
      ? performanceLogs.reduce((sum, log) => sum + (log.duration || 0), 0) / performanceLogs.length
      : 0;

    const slowOperations = performanceLogs.filter(log => (log.duration || 0) > 1000).length;

    return {
      totalLogs,
      logSizeKB: this.currentLogSize / 1024,
      rotations: this.rotationCount,
      errorRate: totalLogs > 0 ? (errorLogs / totalLogs) * 100 : 0,
      performanceMetrics: {
        avgDuration,
        slowOperations
      }
    };
  }

  clearLogs(): void {
    this.logs = [];
    this.currentLogSize = 0;
  }

  updateConfig(newConfig: Partial<LogConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// ─── Specialized Loggers ────────────────────────────────────────────────

export class UserActionLogger extends StructuredLogger {
  logUserAction(action: string, details: Record<string, any>, userId?: string, sessionId?: string): void {
    this.info('user_action', `User performed: ${action}`, {
      ...details,
      userId,
      sessionId,
      userAction: true
    });
  }

  logFeatureUsage(feature: string, duration?: number, success = true): void {
    const level = success ? 'info' : 'warn';
    this.log(level, 'feature_usage', `Feature used: ${feature}`, {
      feature,
      duration,
      success,
      featureUsage: true
    });
  }
}

export class PerformanceLogger extends StructuredLogger {
  logApiCall(endpoint: string, method: string, duration: number, statusCode: number): void {
    const level = statusCode >= 400 ? 'warn' : 'info';
    this.log(level, 'api_call', `API call: ${method} ${endpoint}`, {
      endpoint,
      method,
      duration,
      statusCode,
      apiCall: true
    });
  }

  logDatabaseOperation(operation: string, table: string, duration: number, recordsAffected?: number): void {
    this.info('database', `DB operation: ${operation} on ${table}`, {
      operation,
      table,
      duration,
      recordsAffected,
      databaseOperation: true
    });
  }

  logMemoryUsage(): void {
    const memInfo = (performance as any).memory;
    if (memInfo) {
      this.info('memory', 'Memory usage snapshot', {
        used: memInfo.usedJSHeapSize,
        total: memInfo.totalJSHeapSize,
        limit: memInfo.jsHeapSizeLimit,
        memorySnapshot: true
      });
    }
  }
}

export class ErrorLogger extends StructuredLogger {
  logApplicationError(error: Error, context: Record<string, any> = {}): void {
    this.error('application', 'Application error occurred', error, {
      ...context,
      applicationError: true
    });
  }

  logNetworkError(url: string, error: Error, statusCode?: number): void {
    this.error('network', `Network error for ${url}`, error, {
      url,
      statusCode,
      networkError: true
    });
  }

  logValidationError(field: string, value: any, reason: string): void {
    this.warn('validation', `Validation failed for ${field}`, {
      field,
      value: String(value),
      reason,
      validationError: true
    });
  }
}

// ─── Global Logger Instances ────────────────────────────────────────────
export const logger = new StructuredLogger({
  level: 'info',
  enableConsole: true,
  enableStorage: true,
  maxEntries: 5000,
  rotationSize: 512, // 512KB
  compressionEnabled: false,
  remoteLoggingEnabled: false,
  includePerformanceMetrics: true,
  includeMemoryMetrics: true
});

export const userActionLogger = new UserActionLogger({
  level: 'info',
  enableConsole: false, // Don't spam console with user actions
  enableStorage: true,
  maxEntries: 2000
});

export const performanceLogger = new PerformanceLogger({
  level: 'info',
  enableConsole: false,
  enableStorage: true,
  maxEntries: 1000
});

export const errorLogger = new ErrorLogger({
  level: 'warn', // Only log warnings and above
  enableConsole: true,
  enableStorage: true,
  maxEntries: 1000
});

// ─── Convenience Functions ──────────────────────────────────────────────
export const log = {
  debug: (category: string, message: string, data?: Record<string, any>) =>
    logger.debug(category, message, data),
  info: (category: string, message: string, data?: Record<string, any>) =>
    logger.info(category, message, data),
  warn: (category: string, message: string, data?: Record<string, any>) =>
    logger.warn(category, message, data),
  error: (category: string, message: string, error?: Error | unknown, data?: Record<string, any>) =>
    logger.error(category, message, error, data),
  critical: (category: string, message: string, error?: Error | unknown, data?: Record<string, any>) =>
    logger.critical(category, message, error, data)
};

export const perf = {
  start: (operation: string) => performanceLogger.startTimer(operation),
  end: (timerId: string, category: string, message: string, data?: Record<string, any>) =>
    performanceLogger.endTimer(timerId, category, message, data)
};

// ─── Export Default Logger ──────────────────────────────────────────────
export default logger;
