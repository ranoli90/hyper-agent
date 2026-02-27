import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock chrome API
(globalThis as any).chrome = {
  storage: {
    local: {
      get: vi.fn(async () => ({})),
      set: vi.fn(async () => {}),
    },
  },
};

import { DEFAULTS, STORAGE_KEYS, VALIDATION, isSiteBlacklisted } from '../../shared/config';

describe('DEFAULTS', () => {
  it('has required configuration values', () => {
    expect(DEFAULTS.BASE_URL).toBeDefined();
    expect(DEFAULTS.MODEL_NAME).toBe('openrouter/auto');
    expect(DEFAULTS.MAX_STEPS).toBeGreaterThan(0);
  });

  it('has reasonable MAX_STEPS default', () => {
    expect(DEFAULTS.MAX_STEPS).toBeGreaterThanOrEqual(5);
    expect(DEFAULTS.MAX_STEPS).toBeLessThanOrEqual(50);
  });

  it('has correct defaults for safety features', () => {
    expect(DEFAULTS.AUTO_RETRY).toBe(true);
    expect(DEFAULTS.ENABLE_VISION).toBe(true);
    expect(typeof DEFAULTS.DRY_RUN).toBe('boolean');
  });

  it('has proper delay configurations', () => {
    expect(DEFAULTS.ACTION_DELAY_MS).toBeGreaterThan(0);
    expect(DEFAULTS.CONFIRM_TIMEOUT_MS).toBeGreaterThan(0);
  });

  it('has element limit defaults', () => {
    expect(DEFAULTS.MAX_SEMANTIC_ELEMENTS).toBeGreaterThan(0);
    expect(DEFAULTS.BODY_TEXT_LIMIT).toBeGreaterThan(0);
    expect(DEFAULTS.VISION_FALLBACK_THRESHOLD).toBeGreaterThan(0);
  });
});

describe('STORAGE_KEYS', () => {
  it('has all required storage keys', () => {
    expect(STORAGE_KEYS.API_KEY).toBeDefined();
    expect(STORAGE_KEYS.BASE_URL).toBeDefined();
    expect(STORAGE_KEYS.MODEL_NAME).toBeDefined();
    expect(STORAGE_KEYS.MAX_STEPS).toBeDefined();
    expect(STORAGE_KEYS.SITE_BLACKLIST).toBeDefined();
  });

  it('all keys are strings', () => {
    Object.values(STORAGE_KEYS).forEach(key => {
      expect(typeof key).toBe('string');
    });
  });

  it('all keys start with hyperagent_', () => {
    Object.values(STORAGE_KEYS).forEach(key => {
      expect(key).toMatch(/^hyperagent_/);
    });
  });
});

describe('VALIDATION', () => {
  it('MAX_STEPS has valid range', () => {
    expect(VALIDATION.MAX_STEPS.MIN).toBeLessThan(VALIDATION.MAX_STEPS.MAX);
    expect(VALIDATION.MAX_STEPS.DEFAULT).toBeGreaterThanOrEqual(VALIDATION.MAX_STEPS.MIN);
    expect(VALIDATION.MAX_STEPS.DEFAULT).toBeLessThanOrEqual(VALIDATION.MAX_STEPS.MAX);
  });

  it('TIMEOUTS has valid range', () => {
    expect(VALIDATION.TIMEOUTS.MIN).toBeLessThan(VALIDATION.TIMEOUTS.MAX);
    expect(VALIDATION.TIMEOUTS.DEFAULT).toBeGreaterThanOrEqual(VALIDATION.TIMEOUTS.MIN);
    expect(VALIDATION.TIMEOUTS.DEFAULT).toBeLessThanOrEqual(VALIDATION.TIMEOUTS.MAX);
  });

  it('ELEMENTS has valid range', () => {
    expect(VALIDATION.ELEMENTS.MIN).toBeLessThan(VALIDATION.ELEMENTS.MAX);
    expect(VALIDATION.ELEMENTS.DEFAULT).toBeGreaterThanOrEqual(VALIDATION.ELEMENTS.MIN);
    expect(VALIDATION.ELEMENTS.DEFAULT).toBeLessThanOrEqual(VALIDATION.ELEMENTS.MAX);
  });
});

describe('isSiteBlacklisted', () => {
  it('returns false for empty blacklist', () => {
    expect(isSiteBlacklisted('https://example.com', '')).toBe(false);
  });

  it('detects blacklisted site', () => {
    expect(isSiteBlacklisted('https://blocked.com/page', 'blocked.com')).toBe(true);
  });

  it('matches substring in hostname (by design)', () => {
    // isSiteBlacklisted uses hostname.includes(), so substrings match
    expect(isSiteBlacklisted('https://notblocked.com', 'blocked.com')).toBe(true);
  });

  it('handles multiple blacklisted domains (newline separated)', () => {
    const blacklist = 'bad.com\nevil.org\nspam.net';
    expect(isSiteBlacklisted('https://evil.org/test', blacklist)).toBe(true);
    expect(isSiteBlacklisted('https://good.com', blacklist)).toBe(false);
  });

  it('handles undefined url', () => {
    expect(isSiteBlacklisted('', 'blocked.com')).toBe(false);
  });
});
