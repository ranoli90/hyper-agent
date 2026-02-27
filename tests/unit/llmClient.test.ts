import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

(globalThis as any).chrome = {
  storage: {
    local: {
      get: vi.fn(async () => ({})),
      set: vi.fn(async () => {}),
    },
  },
};

vi.mock('../../shared/config', () => ({
  DEFAULTS: {
    BASE_URL: 'https://openrouter.ai/api/v1',
    MODEL_NAME: 'openrouter/auto',
    MAX_STEPS: 12,
    LLM_TIMEOUT_MS: 45000,
    COST_WARNING_THRESHOLD: 5.0,
    MAX_TOKENS_PER_SESSION: 100000,
  },
  STORAGE_KEYS: {
    API_KEY: 'hyperagent_api_key',
    BASE_URL: 'hyperagent_base_url',
    MODEL_NAME: 'hyperagent_model_name',
  },
  loadSettings: vi.fn(),
}));

vi.mock('../../shared/security', () => ({
  sanitizeMessages: vi.fn((msgs) => msgs),
}));

vi.mock('../../shared/swarm-intelligence', () => ({
  SwarmCoordinator: class {
    coordinate = vi.fn();
  },
}));

vi.mock('../../shared/autonomous-intelligence', () => ({
  autonomousIntelligence: {
    setLLMClient: vi.fn(),
    understandAndPlan: vi.fn(),
  },
}));

vi.mock('../../shared/ai-types', () => ({
  IntelligenceContext: {},
}));

vi.mock('../../shared/advanced-caching', () => ({
  apiCache: {
    get: vi.fn(async () => null),
    set: vi.fn(async () => {}),
  },
}));

vi.mock('../../shared/contextManager', () => ({
  getContextManager: () => ({
    addContextItem: vi.fn(),
    getContextForLLM: vi.fn(() => []),
  }),
  ContextItem: {},
}));

vi.mock('../../shared/input-sanitization', () => ({
  inputSanitizer: {
    sanitize: vi.fn((input) => ({ sanitizedValue: input, isValid: true, warnings: [] })),
  },
}));

vi.mock('../../shared/retry-circuit-breaker', () => ({
  retryManager: {
    retry: vi.fn(async (fn) => {
      try {
        const result = await fn();
        return { success: true, result };
      } catch (error) {
        return { success: false, error };
      }
    }),
  },
  networkRetryPolicy: {},
}));

import { loadSettings } from '../../shared/config';
import { sanitizeMessages } from '../../shared/security';
import { EnhancedLLMClient } from '../../shared/llmClient';

const mockLoadSettings = vi.mocked(loadSettings);
const mockSanitizeMessages = vi.mocked(sanitizeMessages);

describe('LLMClient', () => {
  let client: EnhancedLLMClient;

  const defaultSettings = {
    apiKey: 'test-api-key',
    baseUrl: 'https://openrouter.ai/api/v1',
    modelName: 'openrouter/auto',
    maxSteps: 12,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadSettings.mockResolvedValue(defaultSettings as any);
    mockSanitizeMessages.mockImplementation((msgs) => msgs);
    client = new EnhancedLLMClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('API Configuration', () => {
    it('should use default endpoint when not configured', async () => {
      mockLoadSettings.mockResolvedValue({
        ...defaultSettings,
        baseUrl: 'https://openrouter.ai/api/v1',
      } as any);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"summary":"test","actions":[]}' } }],
        }),
      });

      await client.callLLM({ command: 'test' });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should use custom endpoint when configured', async () => {
      mockLoadSettings.mockResolvedValue({
        ...defaultSettings,
        baseUrl: 'https://custom.api.com/v1',
      } as any);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"summary":"test","actions":[]}' } }],
        }),
      });

      await client.callLLM({ command: 'test' });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom.api.com/v1/chat/completions',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should include correct headers for OpenRouter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"summary":"test","actions":[]}' } }],
        }),
      });

      await client.callLLM({ command: 'test' });

      const callArgs = mockFetch.mock.calls[0][1];
      expect(callArgs.headers).toMatchObject({
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-api-key',
        'HTTP-Referer': 'https://hyperagent.ai',
        'X-Title': 'HyperAgent',
      });
    });
  });

  describe('Request Building', () => {
    it('should build correct request body for chat completion', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"summary":"test","actions":[]}' } }],
        }),
      });

      await client.callLLM({ command: 'Click the submit button' });

      const callArgs = mockFetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);

      expect(body).toHaveProperty('model');
      expect(body).toHaveProperty('messages');
      expect(body).toHaveProperty('temperature');
      expect(body).toHaveProperty('max_tokens');
    });

    it('should include system prompt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"summary":"test","actions":[]}' } }],
        }),
      });

      await client.callLLM({ command: 'test' });

      const callArgs = mockFetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);

      const systemMessage = body.messages.find((m: any) => m.role === 'system');
      expect(systemMessage).toBeDefined();
      expect(systemMessage.content).toContain('HYPERAGENT');
    });

    it('should handle message history', async () => {
      const history = [
        { role: 'user' as const, userReply: 'Yes, proceed' },
        { role: 'assistant' as const, response: { summary: 'Done', actions: [] } },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"summary":"test","actions":[]}' } }],
        }),
      });

      await client.callLLM({ command: 'Continue', history });

      const callArgs = mockFetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);

      expect(body.messages.length).toBeGreaterThan(1);
    });
  });

  describe('Response Parsing', () => {
    it('should parse successful response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: 'Clicked the button',
                  actions: [{ type: 'click', locator: { strategy: 'css', value: '#btn' } }],
                  done: false,
                }),
              },
            },
          ],
        }),
      });

      const result = await client.callLLM({ command: 'Click button' });

      expect(result.summary).toBe('Clicked the button');
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe('click');
    });

    it('should extract content from choices', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: 'Extracted content',
                  actions: [],
                }),
              },
            },
          ],
        }),
      });

      const result = await client.callLLM({ command: 'Extract text' });

      expect(result.summary).toBe('Extracted content');
    });

    it('should handle empty responses gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '' } }],
        }),
      });

      const result = await client.callLLM({ command: 'test' });

      expect(result).toBeDefined();
      expect(result.actions).toEqual([]);
    });

    it('should parse JSON wrapped in markdown code fences', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: '```json\n{"summary":"Parsed from fence","actions":[]}\n```',
              },
            },
          ],
        }),
      });

      const result = await client.callLLM({ command: 'test' });

      expect(result.summary).toBe('Parsed from fence');
    });

    it('should handle invalid JSON response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'not valid json at all' } }],
        }),
      });

      const result = await client.callLLM({ command: 'test' });

      expect(result).toBeDefined();
      expect(result.actions).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should handle 401 Unauthorized (invalid API key)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      const result = await client.callLLM({ command: 'test' });

      expect(result).toBeDefined();
    });

    it('should handle 429 Rate Limited', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': '30' }),
        text: async () => 'Rate limited',
      });

      const result = await client.callLLM({ command: 'test' });

      expect(result).toBeDefined();
    });

    it('should handle 500 Server Error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const result = await client.callLLM({ command: 'test' });

      expect(result).toBeDefined();
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.callLLM({ command: 'test' });

      expect(result).toBeDefined();
    });

    it('should handle timeout on slow responses', async () => {
      const abortError = new Error('AbortError');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      const result = await client.callLLM({ command: 'test' });

      expect(result).toBeDefined();
    });

    it('should handle missing API key', async () => {
      mockLoadSettings.mockResolvedValue({
        ...defaultSettings,
        apiKey: '',
      } as any);

      await expect(client.callCompletion({ messages: [] })).rejects.toThrow('API Key not set');
    });
  });

  describe('Token Tracking', () => {
    it('should handle response with token usage', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({ summary: 'test', actions: [] }),
              },
            },
          ],
          usage: { total_tokens: 150, prompt_tokens: 100, completion_tokens: 50 },
        }),
      });

      const result = await client.callLLM({ command: 'test' });

      expect(result).toBeDefined();
    });
  });

  describe('Model Selection', () => {
    it('should use configured model', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"summary":"test","actions":[]}' } }],
        }),
      });

      await client.callLLM({ command: 'test' });

      const callArgs = mockFetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);

      expect(body.model).toBeDefined();
    });

    it('should use default model when not configured', async () => {
      mockLoadSettings.mockResolvedValue({
        ...defaultSettings,
        modelName: undefined,
      } as any);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"summary":"test","actions":[]}' } }],
        }),
      });

      await client.callLLM({ command: 'test' });

      const callArgs = mockFetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);

      expect(body.model).toBeDefined();
    });
  });

  describe('callCompletion', () => {
    it('should call API with correct parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Completion result' } }],
        }),
      });

      const result = await client.callCompletion({
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.5,
        maxTokens: 500,
      });

      expect(result).toBe('Completion result');

      const callArgs = mockFetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);

      expect(body.temperature).toBe(0.5);
      expect(body.max_tokens).toBe(500);
    });

    it('should handle rate limit in callCompletion', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': '45' }),
        text: async () => 'Rate limited',
      });

      await expect(
        client.callCompletion({ messages: [{ role: 'user', content: 'test' }] })
      ).rejects.toThrow('Rate limit exceeded');
    });

    it('should use default temperature and maxTokens when not specified', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'result' } }],
        }),
      });

      await client.callCompletion({
        messages: [{ role: 'user', content: 'test' }],
      });

      const callArgs = mockFetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);

      expect(body.temperature).toBe(0.7);
      expect(body.max_tokens).toBe(1000);
    });

    it('should return empty string for empty choices', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [] }),
      });

      const result = await client.callCompletion({
        messages: [{ role: 'user', content: 'test' }],
      });

      expect(result).toBe('');
    });
  });

  describe('getEmbedding', () => {
    it('should return embedding vector', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: [0.1, 0.2, 0.3] }],
        }),
      });

      const result = await client.getEmbedding('test text');

      expect(result).toEqual([0.1, 0.2, 0.3]);
    });

    it('should return empty array on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      const result = await client.getEmbedding('test text');

      expect(result).toEqual([]);
    });

    it('should return empty array on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.getEmbedding('test text');

      expect(result).toEqual([]);
    });

    it('should throw if API key not set', async () => {
      mockLoadSettings.mockResolvedValue({
        ...defaultSettings,
        apiKey: '',
      } as any);

      await expect(client.getEmbedding('test')).rejects.toThrow('API Key not set');
    });
  });

  describe('clearCache', () => {
    it('should clear internal cache', () => {
      expect(() => client.clearCache()).not.toThrow();
    });
  });

  describe('AbortSignal handling', () => {
    it('should pass abort signal to fetch', async () => {
      const controller = new AbortController();
      const signal = controller.signal;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"summary":"test","actions":[]}' } }],
        }),
      });

      await client.callLLM({ command: 'test' }, signal);

      const callArgs = mockFetch.mock.calls[0][1];
      expect(callArgs.signal).toBeDefined();
    });
  });

  describe('Action validation', () => {
    it('should filter invalid action types', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: 'test',
                  actions: [
                    { type: 'click', locator: { strategy: 'css', value: '#btn' } },
                    { type: 'invalidAction' },
                    { type: 'navigate', url: 'https://example.com' },
                  ],
                }),
              },
            },
          ],
        }),
      });

      const result = await client.callLLM({ command: 'test' });

      expect(result.actions).toHaveLength(2);
      expect(result.actions.map((a) => a.type)).toEqual(['click', 'navigate']);
    });

    it('should require locator for element actions', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: 'test',
                  actions: [
                    { type: 'click' },
                    { type: 'fill', value: 'text' },
                    { type: 'click', locator: { strategy: 'css', value: '#valid' } },
                  ],
                }),
              },
            },
          ],
        }),
      });

      const result = await client.callLLM({ command: 'test' });

      expect(result.actions).toHaveLength(1);
    });

    it('should require url for navigate action', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: 'test',
                  actions: [
                    { type: 'navigate' },
                    { type: 'navigate', url: 'https://example.com' },
                  ],
                }),
              },
            },
          ],
        }),
      });

      const result = await client.callLLM({ command: 'test' });

      expect(result.actions).toHaveLength(1);
      expect((result.actions[0] as any).url).toBe('https://example.com');
    });

    it('should require key for pressKey action', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: 'test',
                  actions: [
                    { type: 'pressKey' },
                    { type: 'pressKey', key: 'Enter' },
                  ],
                }),
              },
            },
          ],
        }),
      });

      const result = await client.callLLM({ command: 'test' });

      expect(result.actions).toHaveLength(1);
      expect((result.actions[0] as any).key).toBe('Enter');
    });
  });
});
