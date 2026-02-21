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

  describe('runWorkflow with conditions', () => {
    it('should evaluate condition and follow onError when condition fails', async () => {
      const { saveWorkflow, runWorkflow } = await import('../../shared/workflows');
      const workflow = {
        id: 'cond-workflow',
        name: 'Conditional Workflow',
        startStep: 'step1',
        steps: [
          {
            id: 'step1',
            action: { type: 'wait' as const, ms: 1 },
            condition: { type: 'textContains' as const, value: 'NEVER_FOUND' },
            onSuccess: 'step2',
            onError: 'step3',
          },
          { id: 'step2', action: { type: 'wait' as const, ms: 1 } },
          { id: 'step3', action: { type: 'wait' as const, ms: 1 } },
        ],
      };
      await saveWorkflow(workflow);

      const results: any[] = [];
      const executeActionFn = async (action: any) => {
        results.push({ action });
        return { success: true };
      };
      const getContextFn = async () => ({
        url: 'https://example.com',
        title: 'Example',
        bodyText: 'Hello world',
        metaDescription: '',
        formCount: 0,
        semanticElements: [],
        timestamp: Date.now(),
        scrollPosition: { x: 0, y: 0 },
        viewportSize: { width: 800, height: 600 },
        pageHeight: 1000,
      });

      const result = await runWorkflow('cond-workflow', executeActionFn, getContextFn);

      expect(result.success).toBe(true);
      expect(results.length).toBe(1);
      expect(results[0].action.type).toBe('wait');
      expect(results[0].action.ms).toBe(1);
    });
  });
});
