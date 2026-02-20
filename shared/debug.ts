/**
 * Debug logging that strips in production build.
 * Controlled by Vite's import.meta.env.PROD flag.
 */

const isProd = typeof import.meta !== 'undefined' && import.meta.env?.PROD;

export const debug = {
  log: isProd ? () => {} : console.log.bind(console),
  warn: isProd ? () => {} : console.warn.bind(console),
  error: console.error.bind(console), // Always log errors
  info: isProd ? () => {} : console.info.bind(console),
};

export function devOnly(fn: () => void): void {
  if (!isProd) fn();
}
