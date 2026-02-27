import { DEFAULTS } from './config';

/**
 * Centralized OpenRouter configuration.
 * All OpenRouter URLs, models, headers, and timeouts are defined here so that
 * sidepanel, options, background, and LLM client stay consistent.
 */

export const OPENROUTER_DEFAULT_BASE_URL = DEFAULTS.BASE_URL || 'https://openrouter.ai/api/v1';

export const OPENROUTER_MODELS = {
  chat: {
    name: DEFAULTS.MODEL_NAME || 'openrouter/auto',
    costPer1kTokens: 0.001, // Placeholder: Example cost for chat model
  },
  vision: {
    name: DEFAULTS.VISION_MODEL || DEFAULTS.MODEL_NAME || 'openrouter/auto',
    costPer1kTokens: 0.002, // Placeholder: Example cost for vision model
  },
  embedding: {
    name: 'text-embedding-3-small',
    costPer1kTokens: 0.00005, // Placeholder: Example cost for embedding model
  },
} as const;

export const OPENROUTER_TIMEOUTS = {
  // Strict, centralized timeouts for OpenRouter-facing calls
  validateApiKeyMs: 10_000,
  testConnectionMs: 10_000,
  chatMs: DEFAULTS.LLM_TIMEOUT_MS ?? 45_000,
  completionMs: 60_000,
  embeddingsMs: DEFAULTS.LLM_TIMEOUT_MS ?? 45_000,
} as const;

export type OpenRouterEnvironment = 'production' | 'custom';

export function normalizeOpenRouterBaseUrl(raw?: string | null): string {
  const candidate = (raw || '').trim() || OPENROUTER_DEFAULT_BASE_URL;
  try {
    const url = new URL(candidate);
    const normalizedPath = url.pathname.replace(/\/+$/, '') || '/api/v1';
    return `${url.origin}${normalizedPath}`;
  } catch {
    return OPENROUTER_DEFAULT_BASE_URL;
  }
}

export function getOpenRouterEnvironment(baseUrl?: string | null): OpenRouterEnvironment {
  const normalized = normalizeOpenRouterBaseUrl(baseUrl);
  return normalized.startsWith('https://openrouter.ai/') ? 'production' : 'custom';
}

export function getOpenRouterHeaders(
  apiKey: string,
  baseUrl?: string | null,
  extra?: Record<string, string>,
  correlationId?: string,
): Record<string, string> {
  const env = getOpenRouterEnvironment(baseUrl);
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    'HTTP-Referer': 'https://hyperagent.ai',
    'X-Title': 'HyperAgent',
    'X-Environment': env,
    ...(correlationId && { 'X-Correlation-ID': correlationId }),
    ...(extra || {}),
  };
}

export function buildOpenRouterRequest(
  model: string,
  messages: any[],
  maxTokens: number,
  temperature: number,
): Record<string, unknown> {
  // All routing is delegated to OpenRouter; never override provider.order here.
  return {
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
  };
}
