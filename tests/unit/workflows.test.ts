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
      remove: vi.fn((keys) => {
        const keyArray = Array.isArray(keys) ? keys : [keys];
        keyArray.forEach(k => delete mockStorage[k]);
        return Promise.resolve();
      }),
    },
  },
});

describe('Workflows Module', () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
  });

  describe('saveWorkflow', () => {
    it('should save a valid workflow', async () => {
      const { saveWorkflow } = await import('../../shared/workflows');
      const workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        steps: [
          { id: 'step1', action: { type: 'navigate' as const, url: 'https://example.com' } }
        ],
      };
      await saveWorkflow(workflow);
      expect(mockStorage['hyperagent_workflows']).toBeDefined();
    });
  });

  describe('getWorkflows', () => {
    it('should return empty array when no workflows exist', async () => {
      const { getWorkflows } = await import('../../shared/workflows');
      const workflows = await getWorkflows();
      expect(workflows).toEqual([]);
    });
  });
});
