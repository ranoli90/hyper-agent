/**
 * @fileoverview Safe regex utilities.
 * Prevents ReDoS from user-controlled workflow conditions.
 */

import safeRegex from 'safe-regex';

const MAX_PATTERN_LENGTH = 256;

/**
 * Check if a regex pattern is safe to use (valid, within length limits, and ReDoS-safe).
 * Uses safe-regex package to detect catastrophic backtracking patterns.
 */
export function isSafeRegex(pattern: string, maxLength = MAX_PATTERN_LENGTH): boolean {
  if (typeof pattern !== 'string' || pattern.length === 0 || pattern.length > maxLength) {
    return false;
  }
  try {
    const re = new RegExp(pattern);
    return safeRegex(re);
  } catch {
    return false;
  }
}
