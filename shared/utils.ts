/**
 * Shared utility functions
 */

/**
 * Debounce function - delays execution until after wait milliseconds have elapsed
 * since the last time the debounced function was invoked.
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  return function (this: any, ...args: Parameters<T>): void {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, wait);
  };
}

/**
 * Throttle function - limits execution to once per wait milliseconds
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let lastTime = 0;
  
  return function (this: any, ...args: Parameters<T>): void {
    const now = Date.now();
    if (now - lastTime >= wait) {
      lastTime = now;
      func.apply(this, args);
    }
  };
}

/**
 * Sleep function for async operations
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Truncate text at a sentence boundary (. ! ?) to avoid cutting mid-sentence.
 * If no boundary found before maxLen, truncates at maxLen.
 */
export function truncateAtSentenceBoundary(text: string, maxLen: number): string {
  if (!text || maxLen <= 0) return '';
  if (text.length <= maxLen) return text;
  const slice = text.slice(0, maxLen + 1);
  const lastBoundary = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('! '),
    slice.lastIndexOf('? '),
    slice.lastIndexOf('.\n'),
    slice.lastIndexOf('!\n'),
    slice.lastIndexOf('?\n')
  );
  if (lastBoundary > maxLen * 0.5) return text.slice(0, lastBoundary + 1).trim();
  return text.slice(0, maxLen).trim();
}
