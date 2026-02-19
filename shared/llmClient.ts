import type { LLMResponse, PageContext, Action, LLMRequest, LLMClientInterface, CompletionRequest } from './types';
import { DEFAULTS, loadSettings } from './config';

import { SwarmCoordinator } from './swarm-intelligence';
import { autonomousIntelligence } from './autonomous-intelligence';
import { IntelligenceContext } from './ai-types';
import { CacheEntry } from './advanced-caching';
import { getContextManager, ContextItem } from './contextManager';

const SINGLE_MODEL = 'google/gemini-2.5-flash';

// ─── Redaction helpers (prevent sensitive leakage to LLM/logs) ──────────
function redact(value: any): string {
  const s = typeof value === 'string' ? value : JSON.stringify(value ?? '', (_k, v) => v, 2);
  const REDACTION_TOKEN = '***REDACTED***';
  const patterns: RegExp[] = [
    /([a-zA-Z0-9_.+-]+)@([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)/g,
    /\b(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g,
    /\b(?:\d[ -]*?){13,19}\b/g,
    /\b(?:sk|pk|eyJ|ya29)\w{16,}\b/gi,
    /\b[A-Fa-f0-9]{32,}\b/g,
    /\b(?:session|auth|token|secret|password|apikey|api_key)\s*[:=]\s*['"][^'"\n]+['"]/gi,
  ];
  return patterns.reduce((acc, re) => acc.replace(re, REDACTION_TOKEN), s).slice(0, 20000);
}

function sanitizeMessages(messages: any[]): any[] {
  return (messages || []).map((m) => {
    if (Array.isArray(m.content)) {
      return {
        ...m,
        content: m.content.map((c: any) => {
          if (c?.type === 'text' && typeof c.text === 'string') {
            return { ...c, text: redact(c.text) };
          }
          // Do not mutate image URLs (may be data URLs for screenshots)
          return c;
        })
      };
    }
    if (typeof m.content === 'string') {
      return { ...m, content: redact(m.content) };
    }
    return m;
  });
}

// ─── Utility Classes ──────────────────────────────────────────────────────
class RateLimiter {
  recordRequest(model: string): void {
    // Simple rate limiting - could be enhanced later
    console.log(`[RateLimiter] Recorded request for ${model}`);
  }
}

class CostTracker {
  trackCost(model: string, usage: any): void {
    // Simple cost tracking - could be enhanced later
    console.log(`[CostTracker] Tracked cost for ${model}`, usage);
  }
}

class TokenCounter {
  // Simple token counter - could be enhanced later
  countTokens(text: string): number {
    return Math.ceil(text.length / 4); // Rough estimate
  }
}

// ─── Dynamic Intelligence System Prompt ───────────────────────────────
// Instead of hardcoded workflows, use autonomous reasoning that adapts to any task

const DYNAMIC_SYSTEM_PROMPT = `You are HyperAgent, an autonomous AI assistant that helps users with web automation tasks.

You can:
- Navigate to websites
- Click buttons and fill forms
- Extract information from pages
- Take screenshots for visual analysis

Always respond with valid JSON containing:
{
  "summary": "Brief explanation of what you're doing",
  "actions": [{"type": "action_type", "description": "what to do"}],
  "needsScreenshot": false,
  "done": false
}`;

// ─── History entry ──────────────────────────────────────────────────
export interface HistoryEntry {
  role: 'user' | 'assistant';
  context?: PageContext;
  command?: string;
  userReply?: string;
  response?: LLMResponse;
  actionsExecuted?: { action: Action; success: boolean; error?: string; extractedData?: string }[];
}

// ─── Compact context for history (avoid token bloat) ─────────────────
function compactContext(ctx: PageContext): Record<string, any> {
  return {
    url: ctx.url,
    title: ctx.title,
    bodyText: ctx.bodyText.slice(0, 3000),
    formCount: ctx.formCount,
    scrollY: ctx.scrollPosition.y,
    pageHeight: ctx.pageHeight,
    elementCount: ctx.semanticElements.length,
  };
}

// ─── Message types for LLM API ──────────────────────────────────────────
interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string | MessageContent[];
}

interface MessageContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'low' | 'high' | 'auto';
  };
}

interface APIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage?: {
    total_tokens: number;
  };
}

// ─── Build messages for the API ─────────────────────────────────────
function buildMessages(
  command: string,
  history: HistoryEntry[],
  context: PageContext
): Message[] {
  const messages: Message[] = [{ role: 'system', content: DYNAMIC_SYSTEM_PROMPT }];

  // Get context manager for smart context window
  const contextManager = getContextManager();

  // Add history (compact older entries to save tokens)
  for (let i = 0; i < history.length; i++) {
    const entry = history[i];
    if (entry.role === 'user') {
      if (entry.userReply) {
        messages.push({
          role: 'user',
          content: `User replied: ${entry.userReply}`,
        });
        // Add to context manager
        contextManager.addContextItem({
          type: 'result',
          content: `User replied: ${entry.userReply}`,
          timestamp: Date.now(),
          importance: 8,
        });
      } else if (entry.context) {
        const isOld = i < history.length - 4;
        const ctx = isOld ? compactContext(entry.context) : (() => {
          const c = { ...entry.context };
          delete c.screenshotBase64;
          return c;
        })();
        const content = `Command: ${entry.command}\n\nPage context:\n${JSON.stringify(ctx, null, isOld ? 0 : 2)}`;
        messages.push({
          role: 'user',
          content,
        });
        // Add to context manager
        contextManager.addContextItem({
          type: 'action',
          content,
          timestamp: entry.context.timestamp || Date.now(),
          importance: isOld ? 3 : 7,
        });
      }
    }
    if (entry.role === 'assistant' && entry.response) {
      const resp = { ...entry.response };
      delete resp.thinking;
      const respContent = JSON.stringify(resp);
      messages.push({
        role: 'assistant',
        content: respContent,
      });
      // Add to context manager
      contextManager.addContextItem({
        type: 'thought',
        content: resp.thinking || resp.summary,
        timestamp: Date.now(),
        importance: 6,
      });
      if (entry.actionsExecuted) {
        const results = entry.actionsExecuted.map((r) => ({
          type: r.action.type,
          desc: (r.action as any).description || '',
          ok: r.success,
          err: r.error || undefined,
          data: r.extractedData || undefined,
        }));
        const resultsContent = `Action results:\n${JSON.stringify(results, null, 2)}`;
        messages.push({
          role: 'user',
          content: resultsContent,
        });
        // Add to context manager with importance based on success
        const hasErrors = results.some(r => !r.ok);
        contextManager.addContextItem({
          type: hasErrors ? 'error' : 'result',
          content: resultsContent,
          timestamp: Date.now(),
          importance: hasErrors ? 9 : 5,
        });
      }
    }
  }

  // Get optimized context from context manager (prioritize recent + important)
  const optimizedContext = contextManager.getContextForLLM(20000);
  if (optimizedContext.length > 0) {
    const contextSummary = optimizedContext
      .map((item: ContextItem) => `[${item.type}] ${item.content.slice(0, 150)}`)
      .join('\n');
    messages.push({
      role: 'system',
      content: `Recent context summary:\n${contextSummary}`,
    });
  }

  // Current turn — full context with all semantic elements
  if (!context) {
    // Create minimal fallback context if none provided
    context = {
      url: 'unknown',
      title: 'Unknown page',
      bodyText: '',
      metaDescription: '',
      formCount: 0,
      semanticElements: [],
      timestamp: Date.now(),
      scrollPosition: { x: 0, y: 0 },
      viewportSize: { width: 1280, height: 720 },
      pageHeight: 0,
    };
  }
  
  const currentContext = { ...context };
  const screenshot = currentContext?.screenshotBase64;
  if (screenshot) delete currentContext.screenshotBase64;

  const safeHistory = history || [];
  const textContent = `Command: ${command || 'No command'}\n\nCurrent page context (step ${safeHistory.filter(h => h?.role === 'assistant').length + 1}):\n${JSON.stringify(currentContext, null, 2)}`;

  if (screenshot) {
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: textContent },
        {
          type: 'image_url',
          image_url: { url: `data:image/png;base64,${screenshot}`, detail: 'auto' },
        },
      ],
    });
  } else {
    messages.push({ role: 'user', content: textContent });
  }

  return messages;
}

// ─── Extract JSON from potentially wrapped response ─────────────────
function extractJSON(text: string): unknown {
  const trimmed = text.trim();

  // Try direct parse
  try {
    return JSON.parse(trimmed);
  } catch { /* continue */ }

  // Try stripping markdown code fences
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch { /* continue */ }
  }

  // Try extracting outermost { ... }
  let depth = 0;
  let start = -1;
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (trimmed[i] === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        try {
          return JSON.parse(trimmed.slice(start, i + 1));
        } catch { /* continue scanning */ }
      }
    }
  }

  return null;
}

// ─── Intelligent Fallback Reasoning ───────────────────────────────
// When LLM fails to provide valid JSON, use LLM itself to reason about next steps
interface FallbackSettings {
  baseUrl: string;
  apiKey: string;
  backupModel?: string;
}

async function buildIntelligentFallback(
  command: string,
  context: PageContext,
  settings: FallbackSettings
): Promise<LLMResponse | null> {
  try {
    // Create a simplified reasoning prompt for the LLM
    const reasoningPrompt = `You are an intelligent web automation agent. The user said: "${command}"

Current page: ${context.title || 'Unknown page'} (${context.url || 'unknown URL'})
Page has ${context.semanticElements?.length || 0} interactive elements.

The previous AI model failed to provide a valid action plan. Based on the user's request, what should be the next logical step?

Think step-by-step:
1. What does the user want to accomplish?
2. What information do they need?
3. What web actions would help achieve this?
4. What websites or searches would be most relevant?

Provide a simple plan with 1-2 actions. Focus on navigation, search, or data extraction.

Respond with valid JSON:
{
  "summary": "Brief explanation of what you're doing",
  "actions": [
    {"type": "navigate", "url": "https://example.com", "description": "Navigate to relevant site"}
  ],
  "needsScreenshot": false,
  "done": false
}`;

    const model = SINGLE_MODEL;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const resp = await fetch(`${settings.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.apiKey}`,
            'HTTP-Referer': 'https://hyperagent.ai',
            'X-Title': 'HyperAgent',
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: reasoningPrompt }],
            temperature: 0.1,
            max_tokens: 1000,
            provider: 'google-ai-studio', // Force Google provider for OpenRouter
          }),
          signal: AbortSignal.timeout(30000), // 30 second timeout for fallback
        });

        if (!resp.ok) continue;

        const data = await resp.json();
        const content = data?.choices?.[0]?.message?.content;

        if (!content) continue;

        const parsed = extractJSON(content);
        if (parsed && validateResponse(parsed)) {
          console.log(`[HyperAgent] Intelligent fallback succeeded`);
          return parsed as LLMResponse;
        }
      } catch (err) {
        console.log(`[HyperAgent] Fallback attempt ${attempt + 1} failed:`, err);
        continue;
      }
    }

    console.log('[HyperAgent] All intelligent fallback attempts failed');
    return null;
  } catch (err) {
    console.log('[HyperAgent] Intelligent fallback system error:', err);
    return null;
  }
}

// ─── Type guards for runtime type checking ───────────────────────────
function isValidLLMResponse(raw: unknown): raw is Record<string, unknown> {
  return raw !== null && typeof raw === 'object';
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

// ─── Validate and sanitize LLM response ─────────────────────────────
function validateResponse(raw: unknown): LLMResponse {
  if (!isValidLLMResponse(raw)) {
    return {
      summary: 'Failed to parse LLM response into a valid object.',
      actions: [],
      done: true,
      error: 'parse_error',
    };
  }

  const response: LLMResponse = {
    thinking: isString(raw.thinking) ? raw.thinking : undefined,
    summary: isString(raw.summary) ? raw.summary : 'No summary provided.',
    actions: [],
    needsScreenshot: isBoolean(raw.needsScreenshot) ? raw.needsScreenshot : false,
    done: isBoolean(raw.done) ? raw.done : false,
    error: isString(raw.error) ? raw.error : undefined,
    askUser: isString(raw.askUser) && raw.askUser.trim() ? raw.askUser : undefined,
  };

  if (isArray(raw.actions)) {
    const validTypes = [
      'click', 'fill', 'select', 'scroll', 'navigate', 'goBack',
      'wait', 'pressKey', 'hover', 'focus', 'extract',
      'openTab', 'closeTab', 'switchTab', 'getTabs', 'runMacro', 'runWorkflow',
    ] as const;
    
    const actionsRequiringLocator = new Set(['click', 'fill', 'select', 'hover', 'focus', 'extract']);
    const actionsRequiringUrl = new Set(['navigate', 'openTab', 'switchTab']);
    const actionsRequiringKey = new Set(['pressKey']);

    for (const a of raw.actions) {
      if (!a || typeof a !== 'object') continue;
      const action = a as Record<string, unknown>;
      if (!isString(action.type)) continue;
      if (!validTypes.includes(action.type as typeof validTypes[number])) continue;

      // Validate required fields for action type
      const actionType = action.type as string;
      if (actionsRequiringLocator.has(actionType) && !action.locator) {
        console.warn(`[LLM] Action ${actionType} missing required 'locator' field`);
        continue;
      }
      if (actionsRequiringUrl.has(actionType) && !action.url) {
        console.warn(`[LLM] Action ${actionType} missing required 'url' field`);
        continue;
      }
      if (actionsRequiringKey.has(actionType) && !action.key) {
        console.warn(`[LLM] Action ${actionType} missing required 'key' field`);
        continue;
      }

      // Ensure description exists
      if (!isString(action.description)) {
        action.description = `${String(action.type)} action`;
      }

      response.actions.push(action as unknown as Action);
    }
  }

  return response;
}

// ─── Enhanced LLM Client with Autonomous Intelligence ─────────────────
export class EnhancedLLMClient implements LLMClientInterface {
  private cache = new Map<string, any>();
  private swarmCoordinator: SwarmCoordinator;

  constructor() {
    this.swarmCoordinator = new SwarmCoordinator();
    // Inject self into autonomous intelligence engine to break circular dependency
    autonomousIntelligence.setLLMClient(this);
  }

  async callLLM(request: LLMRequest, signal?: AbortSignal): Promise<LLMResponse> {
    const intelligenceContext: IntelligenceContext = {
      taskDescription: request.command || 'No Command Provided',
      availableTools: ['web_browsing', 'data_extraction', 'multi_tab', 'research'],
      previousAttempts: [],
      environmentalData: {},
      userPreferences: {},
      domainKnowledge: {},
      successPatterns: [],
    };

    try {
      // Use autonomous intelligence to understand and plan
      // We pass the signal if supported by autonomousIntelligence (assumed partially supported or ignored for now, but client methods will respect it)
      const autonomousPlan = await autonomousIntelligence.understandAndPlan(request.command || '', intelligenceContext);

      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      // If the autonomous plan has no executable actions, fall back to traditional LLM to avoid no-op plans
      if (!autonomousPlan || !Array.isArray((autonomousPlan as any).actions) || ((autonomousPlan as any).actions?.length ?? 0) === 0) {
        return await this.makeTraditionalCall(request, signal);
      }

      // Convert autonomous plan to LLMResponse format
      return this.convertPlanToResponse(autonomousPlan);
    } catch (error) {
      if ((error as Error).name === 'AbortError') throw error;
      console.error('[HyperAgent] Autonomous intelligence failed, using fallback:', error);
      return await this.makeTraditionalCall(request, signal);
    }
  }

  private convertPlanToResponse(plan: any): LLMResponse {
    // Convert autonomous intelligence plan to LLMResponse format
    return {
      thinking: plan.reasoning,
      summary: plan.summary || plan.reasoning || plan.taskDescription || 'Plan generated.',
      actions: plan.actions || [],
      needsScreenshot: plan.needsScreenshot || false,
      done: plan.done || false,
      askUser: plan.askUser,
    };
  }

  async callCompletion(request: CompletionRequest, signal?: AbortSignal): Promise<string> {
    const settings = await loadSettings();
    if (!settings.apiKey) throw new Error("API Key not set");

    try {
      const safeMessages = sanitizeMessages(request.messages || []);
      
      const completionModel = SINGLE_MODEL;
      
      console.log(`[HyperAgent] Using completion model: ${completionModel}`);

      const response = await fetch(`${settings.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`,
          'HTTP-Referer': 'https://hyperagent.ai',
          'X-Title': 'HyperAgent',
        },
        body: JSON.stringify({
          model: completionModel,
          messages: safeMessages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? 1000,
          provider: 'google-ai-studio', // Force Google provider for OpenRouter
        }),
        signal: signal || AbortSignal.timeout(60000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[HyperAgent] Completion error ${response.status}:`, errorText);
        throw new Error(`Completion request failed: ${response.status}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (error) {
      console.error('[HyperAgent] Completion failed:', error);
      throw error;
    }
  }

  private async makeTraditionalCall(request: LLMRequest, signal?: AbortSignal): Promise<LLMResponse> {
    const settings = await loadSettings();
    return await this.makeAPICall(request, settings, signal);
  }

  private async makeAPICall(
    request: LLMRequest,
    settings: any,
    signal?: AbortSignal
  ): Promise<LLMResponse> {
    try {
      const rawMessages = buildMessages(request.command || '', request.history || [], request.context || this.createEmptyContext());
      console.log('[HyperAgent] Raw messages:', JSON.stringify(rawMessages, null, 2));
      
      const messages = sanitizeMessages(rawMessages);
      console.log('[HyperAgent] Sanitized messages:', JSON.stringify(messages, null, 2));

      const model = SINGLE_MODEL;
      
      console.log(`[HyperAgent] Using model: ${model}`);

      // Debug: log the request body
      const requestBody = {
        model,
        messages,
        temperature: 0.7,
        max_tokens: 4096,
        provider: 'google-ai-studio', // Force Google provider for OpenRouter
      };
      console.log('[HyperAgent] Request body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(`${settings.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`,
          'HTTP-Referer': 'https://hyperagent.ai',
          'X-Title': 'HyperAgent',
        },
        body: JSON.stringify(requestBody),
        signal: signal || AbortSignal.timeout(45000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[HyperAgent] API error ${response.status}:`, errorText);
        throw new Error(`API request failed: ${response.status} - ${errorText.slice(0, 500)}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('No content in response');
      }

      const parsed = extractJSON(content);
      if (!parsed) {
        console.warn('[HyperAgent] Failed to parse JSON from response:', content.slice(0, 500));
        const fallback = await buildIntelligentFallback(request.command || '', request.context || this.createEmptyContext(), {
          baseUrl: settings.baseUrl,
          apiKey: settings.apiKey,
        });
        return fallback || {
          thinking: 'Failed to parse response.',
          summary: 'I encountered an error parsing the AI response.',
          actions: [],
          done: true
        };
      }

      return validateResponse(parsed);
    } catch (error: any) {
      if (error.name === 'AbortError') throw error;
      console.error('[HyperAgent] API call failed:', error);
      throw error;
    }
  }

  private createEmptyContext(): PageContext {
    return {
      url: '',
      title: '',
      bodyText: '',
      metaDescription: '',
      formCount: 0,
      semanticElements: [],
      timestamp: Date.now(),
      scrollPosition: { x: 0, y: 0 },
      viewportSize: { width: 1280, height: 720 },
      pageHeight: 0,
    };
  }

  async getEmbedding(text: string): Promise<number[]> {
    const settings = await loadSettings();
    if (!settings.apiKey) throw new Error("API Key not set");

    try {
      // Use OpenRouter's text-embedding adapter (works with the API key)
      const response = await fetch(`${settings.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.apiKey}`,
          'HTTP-Referer': 'https://hyperagent.ai', // Required by OpenRouter for some models
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text,
        }),
      });

      if (!response.ok) {
        console.warn('[HyperAgent] Embedding request failed, returning empty');
        return [];
      }

      const data = await response.json();
      return data.data?.[0]?.embedding || [];
    } catch (error) {
      console.error('[HyperAgent] Embedding failed:', error);
      return [];
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  updateSettings(newSettings: Partial<any>): void {
    // Update settings if needed
  }
}

export const llmClient = new EnhancedLLMClient();
