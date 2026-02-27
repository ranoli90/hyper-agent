import { loadSettings, LogLevel } from './config';
import { RedactionService } from './security';

interface LogEntry {
  timestamp: string;
  level: keyof typeof LogLevel;
  subsystem: string;
  message: string;
  [key: string]: any; // Allow for additional structured data
}

class DebugService {
  private currentLogLevel: LogLevel = LogLevel.INFO; // Default to INFO
  private debugMode = false;
  private redactionService: RedactionService;

  constructor() {
    this.redactionService = new RedactionService();
    this.loadDebugSettings();
  }

  private async loadDebugSettings() {
    const settings = await loadSettings();
    this.debugMode = settings.debugMode || false;
    this.currentLogLevel = settings.logLevel || LogLevel.INFO;
  }

  public setDebugSettings(debugMode: boolean, logLevel: LogLevel) {
    this.debugMode = debugMode;
    this.currentLogLevel = logLevel;
  }

  public log(level: LogLevel, subsystem: string, message: string, data?: Record<string, any>): void {
    if (level > this.currentLogLevel && !this.debugMode) {
      return; // Filter out logs below current level unless in debug mode
    }

    let logData: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level] as keyof typeof LogLevel,
      subsystem,
      message,
      ...(data || {}),
    };

    if (this.debugMode && level <= LogLevel.DEBUG) {
      // In debug mode, redact sensitive fields for lower verbosity logs
      logData = this.redactionService.redact(logData);
    }

    const logMessage = `[${logData.timestamp}] [${logData.level}] [${logData.subsystem}] ${logData.message}`;
    const fullLog = data ? { ...logData, message: logMessage } : logMessage;

    switch (level) {
      case LogLevel.ERROR:
        console.error(fullLog);
        break;
      case LogLevel.WARN:
        console.warn(fullLog);
        break;
      case LogLevel.INFO:
        console.info(fullLog);
        break;
      case LogLevel.DEBUG:
      case LogLevel.VERBOSE:
        console.debug(fullLog);
        break;
      default:
        console.log(fullLog);
    }

    // Store log entry if in debug mode
    if (this.debugMode) {
      this.logEntries.push(logData);
      if (this.logEntries.length > 1000) {
        this.logEntries.shift(); // Remove oldest entry
      }
    }
  }

  // Convenience methods
  public error(subsystem: string, message: string, data?: Record<string, any>): void {
    this.log(LogLevel.ERROR, subsystem, message, data);
  }

  public warn(subsystem: string, message: string, data?: Record<string, any>): void {
    this.log(LogLevel.WARN, subsystem, message, data);
  }

  public info(subsystem: string, message: string, data?: Record<string, any>): void {
    this.log(LogLevel.INFO, subsystem, message, data);
  }

  public debug(subsystem: string, message: string, data?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, subsystem, message, data);
  }

  public verbose(subsystem: string, message: string, data?: Record<string, any>): void {
    this.log(LogLevel.VERBOSE, subsystem, message, data);
  }

  private logEntries: LogEntry[] = [];

  public getLogEntries(): LogEntry[] {
    return this.logEntries;
  }
}

export const debugService = new DebugService();

export function generateCorrelationId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}
