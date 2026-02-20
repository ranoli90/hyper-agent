/**
 * Shared URL utilities - single source of truth to avoid duplication.
 */

/**
 * Extract hostname from a URL string.
 */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown';
  }
}
