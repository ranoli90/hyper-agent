import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Storage Module', () => {
  let mockStorage: Record<string, any> = {};
  
  beforeEach(() => {
    mockStorage = {};
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: vi.fn((keys) => {
            if (keys === null) return Promise.resolve(mockStorage);
            if (Array.isArray(keys)) {
              const result: Record<string, any> = {};
              for (const key of keys) {
                if (key in mockStorage) result[key] = mockStorage[key];
              }
              return Promise.resolve(result);
            }
            return Promise.resolve(mockStorage[keys] ? { [keys]: mockStorage[keys] } : {});
          }),
          set: vi.fn((data) => {
            Object.assign(mockStorage, data);
            return Promise.resolve();
          }),
          remove: vi.fn((keys) => {
            const keysArray = Array.isArray(keys) ? keys : [keys];
            for (const key of keysArray) {
              delete mockStorage[key];
            }
            return Promise.resolve();
          }),
          clear: vi.fn(() => {
            mockStorage = {};
            return Promise.resolve();
          }),
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('Storage Keys', () => {
    it('should have consistent key naming', async () => {
      const { STORAGE_KEYS } = await import('../../shared/config');
      
      for (const [name, key] of Object.entries(STORAGE_KEYS)) {
        expect(key).toMatch(/^hyperagent_/);
        expect(typeof key).toBe('string');
      }
    });

    it('should include schema version key', async () => {
      const { STORAGE_KEYS } = await import('../../shared/config');
      expect(STORAGE_KEYS.SCHEMA_VERSION).toBe('hyperagent_schema_version');
    });
  });

  describe('safeStorageGet', () => {
    it('should return default value when key does not exist', async () => {
      const { safeStorageGet } = await import('../../shared/config');
      const result = await safeStorageGet('nonexistent', 'default');
      expect(result).toBe('default');
    });

    it('should return stored value when it exists', async () => {
      mockStorage['test_key'] = 'stored_value';
      const { safeStorageGet } = await import('../../shared/config');
      const result = await safeStorageGet('test_key', 'default');
      expect(result).toBe('stored_value');
    });

    it('should handle null values', async () => {
      mockStorage['null_key'] = null;
      const { safeStorageGet } = await import('../../shared/config');
      const result = await safeStorageGet('null_key', 'default');
      expect(result).toBe('default');
    });
  });

  describe('safeStorageSet', () => {
    it('should successfully set a value', async () => {
      const { safeStorageSet } = await import('../../shared/config');
      const result = await safeStorageSet('test_key', 'test_value');
      expect(result).toBe(true);
      expect(mockStorage['test_key']).toBe('test_value');
    });
  });

  describe('validateStorageIntegrity', () => {
    it('should detect and repair string "undefined" values', async () => {
      mockStorage['bad_key'] = 'undefined';
      const { validateStorageIntegrity } = await import('../../shared/config');
      const result = await validateStorageIntegrity();
      
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.repaired).toBe(true);
      expect(mockStorage['bad_key']).toBeUndefined();
    });

    it('should detect and repair string "null" values', async () => {
      mockStorage['null_string'] = 'null';
      const { validateStorageIntegrity } = await import('../../shared/config');
      const result = await validateStorageIntegrity();
      
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.repaired).toBe(true);
    });

    it('should return healthy for valid storage', async () => {
      mockStorage['good_key'] = { valid: true };
      mockStorage['hyperagent_schema_version'] = 1;
      const { validateStorageIntegrity } = await import('../../shared/config');
      const result = await validateStorageIntegrity();
      
      expect(result.healthy).toBe(true);
      expect(result.issues).toEqual([]);
    });
  });

  describe('Storage Version', () => {
    it('should define STORAGE_VERSION constant', async () => {
      const { STORAGE_VERSION } = await import('../../shared/config');
      expect(typeof STORAGE_VERSION).toBe('number');
      expect(STORAGE_VERSION).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Import Validation', () => {
    it('should validate import data schema', async () => {
      const { validateAndFilterImportData, STORAGE_KEYS } = await import('../../shared/config');
      
      const validData = {
        [STORAGE_KEYS.API_KEY]: 'test-key',
        [STORAGE_KEYS.MAX_STEPS]: 10,
        'unknown_key': 'should be filtered',
      };
      
      const result = validateAndFilterImportData(validData);
      
      expect(result.filtered[STORAGE_KEYS.API_KEY]).toBe('test-key');
      expect(result.filtered[STORAGE_KEYS.MAX_STEPS]).toBe(10);
      expect(result.filtered['unknown_key']).toBeUndefined();
      expect(result.errors).toContain('Rejected unknown key: unknown_key');
    });

    it('should reject API keys exceeding max length', async () => {
      const { validateAndFilterImportData, STORAGE_KEYS } = await import('../../shared/config');
      
      const invalidData = {
        [STORAGE_KEYS.API_KEY]: 'a'.repeat(2000),
      };
      
      const result = validateAndFilterImportData(invalidData);
      
      expect(result.filtered[STORAGE_KEYS.API_KEY]).toBeUndefined();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate maxSteps range', async () => {
      const { validateAndFilterImportData, STORAGE_KEYS } = await import('../../shared/config');
      
      const invalidData = {
        [STORAGE_KEYS.MAX_STEPS]: 100,
      };
      
      const result = validateAndFilterImportData(invalidData);
      
      expect(result.filtered[STORAGE_KEYS.MAX_STEPS]).toBeUndefined();
    });
  });
});
