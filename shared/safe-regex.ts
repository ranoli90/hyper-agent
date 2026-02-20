/**
 * @fileoverview Safe regex utilities.
 * Prevents ReDoS from user-controlled workflow conditions.
 */

const MAX_PATTERN_LENGTH = 256;

/**
 * Check if a regex pattern is safe to use (valid and within length limits).
 * Does not guarantee ReDoS safety but mitigates common issues.
 */
export function isSafeRegex(pattern: string, maxLength = MAX_PATTERN_LENGTH): boolean {
  if (typeof pattern !== 'string' || pattern.length === 0 || pattern.length > maxLength) {
    return false;
  }
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}
