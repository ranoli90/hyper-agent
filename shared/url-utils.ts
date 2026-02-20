/**
 * @fileoverview Shared URL utilities.
 * Single source of truth for extractDomain and related helpers.
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
