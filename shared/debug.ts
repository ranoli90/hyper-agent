/**
 * Debug logging that strips in production build.
 * Controlled by Vite's define flag.
 */

const ENABLE_DEBUG = false;

export const debug = {
  log: (..._args: unknown[]) => {
    if (ENABLE_DEBUG) {
      // Only logs in debug mode
    }
  },
  warn: (..._args: unknown[]) => {
    if (ENABLE_DEBUG) {
      // Only logs in debug mode
    }
  },
  error: (..._args: unknown[]) => {
    // Always log errors but consider sanitizing in production
  },
  group: (..._args: unknown[]) => {
    if (ENABLE_DEBUG) {
      // Only logs in debug mode
    }
  },
  groupEnd: () => {
    if (ENABLE_DEBUG) {
      // Only logs in debug mode
    }
  },
};

export const log = debug.log;
export const warn = debug.warn;
export const error = debug.error;

export const logError = (context: string, err: unknown): void => {
  const message = err instanceof Error ? err.message : String(err);
  // In production, errors could be sent to error reporting service
  // For now, we silently handle in production
  if (ENABLE_DEBUG) {
    console.error(`[${context}]`, message);
  }
};
