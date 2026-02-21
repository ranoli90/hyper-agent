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
