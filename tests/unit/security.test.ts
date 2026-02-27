import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock chrome.storage
const mockStorage: Record<string, any> = {};
vi.stubGlobal('chrome', {
  storage: {
    local: {
      get: vi.fn((keys) => Promise.resolve(
        typeof keys === 'string' ? { [keys]: mockStorage[keys] } : mockStorage
      )),
      set: vi.fn((data) => {
        Object.assign(mockStorage, data);
        return Promise.resolve();
      }),
    },
  },
});

describe('Security Module', () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
  });

  describe('Input Sanitization', () => {
    it('should sanitize script tags', async () => {
      const { inputSanitizer } = await import('../../shared/input-sanitization');
      const result = inputSanitizer.sanitize('<script>alert("xss")</script>');
      expect(result.sanitizedValue).not.toContain('<script>');
    });

    it('should handle empty input', async () => {
      const { inputSanitizer } = await import('../../shared/input-sanitization');
      const result = inputSanitizer.sanitize('');
      expect(result.isValid).toBe(false);
    });

    it('should enforce max length', async () => {
      const { inputSanitizer } = await import('../../shared/input-sanitization');
      const longInput = 'a'.repeat(2000);
      const result = inputSanitizer.sanitize(longInput, { maxLength: 100 });
      expect(result.sanitizedValue.length).toBeLessThanOrEqual(100);
    });
  });

  describe('URL Sanitization', () => {
    it('should reject javascript: URLs', async () => {
      const { inputSanitizer } = await import('../../shared/input-sanitization');
      const result = inputSanitizer.sanitizeUrl('javascript:alert(1)');
      expect(result.isValid).toBe(false);
    });

    it('should reject data: URLs', async () => {
      const { inputSanitizer } = await import('../../shared/input-sanitization');
      const result = inputSanitizer.sanitizeUrl('data:text/html,<script>alert(1)</script>');
      expect(result.isValid).toBe(false);
    });

    it('should accept valid URLs', async () => {
      const { inputSanitizer } = await import('../../shared/input-sanitization');
      const result = inputSanitizer.sanitizeUrl('https://example.com/path');
      // Check it's a valid URL format
      expect(result.sanitizedValue).toContain('example.com');
    });
  });

  describe('Redaction', () => {
    it('should redact API key patterns', async () => {
      const { redact } = await import('../../shared/security');
      const text = 'API key: sk-or-v1-1234567890abcdef1234567890abcdef';
      const redacted = redact(text);
      expect(redacted).toContain('REDACTED');
    });
  });
});

describe('Safe Regex', () => {
  it('should detect ReDoS patterns', async () => {
    const { isSafeRegex } = await import('../../shared/safe-regex');
    // Pattern with catastrophic backtracking potential
    expect(isSafeRegex('(a+)+$')).toBe(false);
  });

  it('should allow safe patterns', async () => {
    const { isSafeRegex } = await import('../../shared/safe-regex');
    expect(isSafeRegex('^https://example\.com')).toBe(true);
  });

  it('should reject invalid regex', async () => {
    const { isSafeRegex } = await import('../../shared/safe-regex');
    expect(isSafeRegex('[invalid')).toBe(false);
  });
});

describe('Domain and action security policies', () => {
  it('checkDomainAllowed respects allowedDomains and blockedDomains with suffix matching', async () => {
    const { setPrivacySettings, checkDomainAllowed } = await import('../../shared/security');

    // Allow only example.com and subdomains, block evil.com
    await setPrivacySettings({
      allowedDomains: ['example.com'],
      blockedDomains: ['evil.com'],
    });

    expect(await checkDomainAllowed('https://example.com')).toBe(true);
    expect(await checkDomainAllowed('https://sub.example.com')).toBe(true);
    expect(await checkDomainAllowed('https://evil.com')).toBe(false);
    expect(await checkDomainAllowed('https://sub.evil.com')).toBe(false);
    // Not explicitly allowed
    expect(await checkDomainAllowed('https://other.com')).toBe(false);
  });

  it('checkActionAllowed enforces external navigation policy', async () => {
    const { setSecurityPolicy, checkActionAllowed } = await import('../../shared/security');

    await setSecurityPolicy({
      allowExternalUrls: false,
      requireConfirmationFor: ['navigate'],
    });

    const sameDomain = await checkActionAllowed(
      { type: 'navigate', url: 'https://example.com/page' } as any,
      'https://example.com/home',
    );
    expect(sameDomain.allowed).toBe(true);
    expect(sameDomain.requiresConfirmation).toBe(true);

    const external = await checkActionAllowed(
      { type: 'navigate', url: 'https://other.com' } as any,
      'https://example.com/home',
    );
    expect(external.allowed).toBe(false);
    expect(external.reason).toContain('External URLs are not allowed');
  });

  it('checkRateLimit limits actions per minute', async () => {
    const { setSecurityPolicy, checkRateLimit } = await import('../../shared/security');

    await setSecurityPolicy({
      maxActionsPerMinute: 2,
      requireConfirmationFor: [],
      allowExternalUrls: true,
    });

    const first = await checkRateLimit('click');
    const second = await checkRateLimit('click');
    const third = await checkRateLimit('click');

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.waitTimeMs).toBeGreaterThan(0);
  });
});