/**
 * Error Boundary utilities for graceful error handling throughout the extension.
 * Wraps async operations with structured error logging and optional fallback behavior.
 */

interface ErrorRecord {
    context: string;
    error: string;
    timestamp: number;
    stack?: string;
}

/** Recent error log for diagnostics (bounded FIFO) */
const recentErrors: ErrorRecord[] = [];
const MAX_ERROR_LOG = 50;

function recordError(context: string, err: unknown): void {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;

    recentErrors.push({ context, error: errorMessage, timestamp: Date.now(), stack });
    if (recentErrors.length > MAX_ERROR_LOG) {
        recentErrors.shift();
    }

    console.error(`[HyperAgent:${context}]`, errorMessage);
}

/**
 * Execute an async function with error boundary — logs errors and re-throws.
 * Use when the caller needs to know about failures.
 */
export async function withErrorBoundary<T>(context: string, fn: () => Promise<T>): Promise<T> {
    try {
        return await fn();
    } catch (err) {
        recordError(context, err);
        throw err;
    }
}

/**
 * Execute an async function with graceful degradation — logs errors, returns undefined.
 * Use when the operation is optional and failure should not crash the caller.
 */
export async function withGracefulDegradation<T>(
    context: string,
    fn: () => Promise<T>,
    fallback?: T
): Promise<T | undefined> {
    try {
        return await fn();
    } catch (err) {
        recordError(context, err);
        return fallback;
    }
}

/**
 * Synchronous error boundary wrapper (no-op by design, placeholder for decorator pattern).
 */
export function errorBoundary(): void { }

/**
 * Synchronous graceful degradation wrapper (no-op by design, placeholder for decorator pattern).
 */
export function gracefulDegradation(): void { }

/**
 * Get recent error records for diagnostics.
 */
export function getRecentErrors(): ErrorRecord[] {
    return [...recentErrors];
}

/**
 * Clear the error log.
 */
export function clearErrorLog(): void {
    recentErrors.length = 0;
}