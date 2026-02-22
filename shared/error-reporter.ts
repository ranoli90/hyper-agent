/**
 * Error reporting module - configurable for future Sentry/external integration.
 * Currently logs locally with optional remote reporting when configured.
 */

interface ErrorReportConfig {
  enabled: boolean;
  dsn?: string;
  environment: 'development' | 'production';
  release?: string;
  sampleRate: number;
}

interface ErrorContext {
  context: string;
  message: string;
  stack?: string;
  url?: string;
  userAgent?: string;
  timestamp: number;
}

const config: ErrorReportConfig = {
  enabled: false,
  environment: 'development',
  sampleRate: 1.0,
};

const errorBuffer: ErrorContext[] = [];
const MAX_BUFFER = 100;

export function initErrorReporter(options: Partial<ErrorReportConfig> = {}): void {
  Object.assign(config, options);
  
  if (config.enabled) {
    globalThis.addEventListener?.('error', (event) => {
      captureError('global', event.error || new Error(event.message), {
        url: event.filename,
        line: event.lineno,
        col: event.colno,
      });
    });

    globalThis.addEventListener?.('unhandledrejection', (event) => {
      captureError('unhandled-promise', event.reason);
    });
  }
}

export function captureError(
  context: string,
  error: Error | unknown,
  extra?: Record<string, unknown>
): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  const record: ErrorContext = {
    context,
    message,
    stack,
    url: typeof globalThis !== 'undefined' ? (globalThis as any).window?.location?.href : undefined,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    timestamp: Date.now(),
    ...extra,
  };

  errorBuffer.push(record);
  if (errorBuffer.length > MAX_BUFFER) {
    errorBuffer.shift();
  }

  console.error(`[ErrorReporter:${context}]`, message, extra || '');

  // Future: Send to external service when DSN configured
  if (config.enabled && config.dsn && Math.random() < config.sampleRate) {
    sendToExternalService(record).catch(() => {});
  }
}

async function sendToExternalService(record: ErrorContext): Promise<void> {
  // Placeholder for Sentry/external integration
  // When DSN is configured, this would POST to the error reporting endpoint
  if (!config.dsn) return;
  
  const payload = {
    ...record,
    environment: config.environment,
    release: config.release,
  };

  // Redact sensitive patterns before sending
  const redacted = redactSensitive(JSON.stringify(payload));
  
  // Future: Implement actual HTTP POST to error reporting service
  console.log('[ErrorReporter] Would send:', redacted);
}

function redactSensitive(text: string): string {
  // Redact API keys, tokens, passwords
  return text
    .replaceAll(/sk-[a-zA-Z0-9]{20,}/g, 'sk-***REDACTED***')
    .replaceAll(/api[_-]?key["\s:=]+["']?[^"'&,]+/gi, 'api_key=***REDACTED***')
    .replaceAll(/token["\s:=]+["']?[^"'&,]+/gi, 'token=***REDACTED***')
    .replaceAll(/password["\s:=]+["']?[^"'&,]+/gi, 'password=***REDACTED***');
}

export function getErrorBuffer(): ErrorContext[] {
  return [...errorBuffer];
}

export function clearErrorBuffer(): void {
  errorBuffer.length = 0;
}

export function getErrorReporterConfig(): ErrorReportConfig {
  return { ...config };
}
