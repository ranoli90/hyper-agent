/**
 * @fileoverview HyperAgent LLM client.
 * OpenRouter API integration, response parsing, caching, and fallback logic.
 * 
 * Optimizations:
 * - Context caching with stable system prefix
 * - Model cascade (simple/standard/complex tasks)
 * - History compression for token efficiency
 * - Semantic caching with embeddings
 * - Progressive reasoning (CoT only when needed)
 * - Minimal context extraction
 * - Strategic reasoning enhancement
 */

import type {
  LLMResponse,
  PageContext,
  Action,
  LLMRequest,
  LLMClientInterface,
  CompletionRequest,
} from './types';
import { DEFAULTS, loadSettings } from './config';

import { autonomousIntelligence } from './autonomous-intelligence';
import { IntelligenceContext } from './ai-types';
import { apiCache } from './advanced-caching';
import { getContextManager, ContextItem } from './contextManager';
import { inputSanitizer } from './input-sanitization';
import { sanitizeMessages, redact } from './security';
import {
  OPENROUTER_DEFAULT_BASE_URL,
  OPENROUTER_MODELS,
  OPENROUTER_TIMEOUTS,
  buildOpenRouterRequest as buildOpenRouterBody,
  getOpenRouterHeaders as getOpenRouterHeadersWithEnv,
  normalizeOpenRouterBaseUrl,
} from './openrouterConfig';

/** Patterns that suggest prompt injection; strip or neutralize before sending to LLM */
const PROMPT_INJECTION_PATTERNS = [
  /\bignore\s+(all\s+)?(previous|prior|above|prior)\s+instructions?\b/gi,
  /\bdisregard\s+(all\s+)?(previous|prior|above)\s+instructions?\b/gi,
  /\byou\s+are\s+now\s+(a\s+)?(different|new)\s+(model|assistant|AI)\b/gi,
  /\b(new\s+)?(system\s+)?(prompt|instruction)\s*:\s*/gi,
  /\b\[system\]\s*:/gi,
  /\b<\|(system|im_start|im_end)\|>\s*/gi,
  /\boverride\s+(your\s+)?(instructions?|rules?)\b/gi,
  /\bpretend\s+(you\s+)?(are|to\s+be)\b/gi,
  /\bact\s+as\s+if\s+you\s+have\s+no\s+restrictions\b/gi,
  /\bforget\s+(everything|all)\s+(above|before)\b/gi,
  // Wrapper-style prompt formats
  /\[INST\][\s\S]*?\[\/INST\]/gi,
  /<<\s*SYS\s*>>[\s\S]*?<<\s*\/\s*SYS\s*>>/gi,
  /<\s*system\s*>[\s\S]*?<\s*\/\s*system\s*>/gi,
];

function sanitizeForPrompt(text: string): string {
  if (!text || typeof text !== 'string') return '';
  let out = text;
  for (const p of PROMPT_INJECTION_PATTERNS) {
    out = out.replace(p, '[filtered]');
  }
  return out.slice(0, 15000); // Cap length
}
import { retryManager, networkRetryPolicy } from './retry-circuit-breaker';
import { ollamaClient, checkOllamaStatus } from './ollamaClient';
import { trackRateLimitEvent } from './metrics';
import { DomainActionTracker } from './domainActionTracker';

const DEFAULT_MODEL = DEFAULTS.MODEL_NAME || 'openrouter/auto';

type TaskComplexity = 'simple' | 'standard' | 'complex';

interface AgentTask {
  type: string;
  description: string;
  requiresReasoning?: boolean;
  multiStep?: boolean;
  complexity: TaskComplexity;
  /** Whether this turn is primarily conversational or automation-focused. */
  mode: 'conversation' | 'automation';
}

// ─── Cached System Prefix (stable for provider caching) ────────────────────
const CACHED_SYSTEM_PREFIX = `[HYPERAGENT v4.0]
You are HyperAgent, a friendly AI assistant that can chat AND fully control the user's browser.

## YOUR PERSONALITY
- Be warm, casual, and helpful
- Like a smart colleague, not a robot
- Use natural language, emojis when appropriate
- Keep responses concise and engaging

## YOUR CAPABILITIES
- Chat naturally about anything
- Ask questions to understand needs
- Navigate websites, click, type, extract data
- Handle multi-step web automation
- Self-correct: when an action fails, try alternatives (different locator, scroll first, etc.)
- Continue without stopping: complete the full task even if one step fails

## HOW YOU WORK

1. CONVERSATION: Just chat normally when users greet or ask questions
2. GATHERING: If they mention a task but info is missing, ask ONE question at a time via "askUser"
3. CONFIRMING: Before big/destructive actions, use summary to confirm your plan
4. EXECUTING: When you have enough info, take browser actions
5. SELF-HEAL: If an action fails, adapt and try another approach—don't give up

## WHEN TO ASK (askUser)
- Missing critical info: URL, search term, form data, filters, quantity
- Ambiguous: "that button" (which?), "the form" (which site?)
- Destructive without context: "delete" (delete what?)
- One question at a time—don't overwhelm

## WHEN TO EXECUTE (actions)
- You have enough info to proceed
- User confirmed (e.g. "yes", "go ahead", "do it")
- No askUser needed—you know what to do

## CRITICAL RULES

NEVER put reasoning in "summary" - use "thinking" for that
- "thinking" = your thoughts (user sees collapsed)
- "summary" = what you SAY to user (user sees prominently)

Example:
User: "hey"
❌ WRONG: "summary": "The user said hey, I should greet them back"
✅ CORRECT: 
  "thinking": "Casual greeting, respond warmly"
  "summary": "Hey!  What's up?"

NEVER execute without enough info - ASK first via "askUser"
NEVER assume missing details - clarify instead
When actions fail: try alternatives, scroll, use different locators—keep going`;

/** Map API status codes to user-friendly messages (22.1). */
function userFriendlyApiError(status: number): string | null {
  switch (status) {
    case 400:
      return 'Invalid request. Please check your command and try again.';
    case 401:
      return 'API key invalid or expired. Check your key in Settings.';
    case 403:
      return 'Access denied. Check your API key and subscription.';
    case 404:
      return 'Model or provider not available for your API key. Try a different model in Settings.';
    case 500:
      return 'Server error. Please try again in a few minutes.';
    case 502:
    case 503:
      return 'Service temporarily unavailable. Please try again shortly.';
    case 504:
      return 'Request timed out. Try again or use a shorter command.';
    default:
      return null;
  }
}

export type LLMErrorType =
  | 'network_error'
  | 'timeout'
  | 'rate_limit'
  | 'auth_error'
  | 'invalid_request'
  | 'parse_error'
  | 'model_unavailable'
  | 'context_too_long'
  | 'max_steps_exceeded'
  | 'max_steps_approaching'
  | 'domain_action_limit_exceeded'
  | 'unknown';

export interface ClassifiedError {
  type: LLMErrorType;
  userMessage: string;
  retryable: boolean;
  retryAfter?: number;
  originalError?: unknown;
}

export type RateLimitSource = 'OpenRouter' | 'Hyperagent';

export class RateLimitError extends Error {
  readonly retryAfter: number;
  readonly source: RateLimitSource;
  constructor(message: string, retryAfter: number, source: RateLimitSource = 'OpenRouter') {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
    this.source = source;
  }
}

export function classifyError(error: unknown): ClassifiedError {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const name = error.name?.toLowerCase() || '';

    if (name === 'aborterror' || message.includes('abort')) {
      return {
        type: 'timeout',
        userMessage: 'Request was cancelled.',
        retryable: true,
        originalError: error,
      };
    }

    if (message.includes('rate limit') || message.includes('429')) {
      const retryMatch = message.match(/(\d+)\s*(second|minute)/i);
      const retryAfter = retryMatch ? Number.parseInt(retryMatch[1], 10) : 60;
      return {
        type: 'rate_limit',
        userMessage: `Rate limit reached. Please wait ${retryAfter} seconds before trying again.`,
        retryable: true,
        retryAfter,
        originalError: error,
      };
    }

    if (message.includes('api key') || message.includes('401') || message.includes('unauthorized')) {
      return {
        type: 'auth_error',
        userMessage: 'Your API key appears invalid or missing. Reconfigure your API key in Settings.',
        retryable: false,
        originalError: error,
      };
    }

    if (message.includes('403') || message.includes('forbidden')) {
      return {
        type: 'auth_error',
        userMessage: 'Your API key appears invalid or lacks permission. Reconfigure your API key in Settings.',
        retryable: false,
        originalError: error,
      };
    }

    if (message.includes('network') || message.includes('fetch') || message.includes('connection') || message.includes('enotfound')) {
      return {
        type: 'network_error',
        userMessage: 'Network error. Please check your internet connection.',
        retryable: true,
        originalError: error,
      };
    }

    if (message.includes('timeout') || message.includes('timed out')) {
      return {
        type: 'timeout',
        userMessage: 'Request timed out. The server may be busy. Try again with a simpler command.',
        retryable: true,
        originalError: error,
      };
    }

    if (message.includes('context') || message.includes('token') || message.includes('too long') || message.includes('maximum')) {
      return {
        type: 'context_too_long',
        userMessage: 'Your request is too long. Try a simpler command or clear chat history.',
        retryable: false,
        originalError: error,
      };
    }

    if (message.includes('model') && (message.includes('not found') || message.includes('unavailable'))) {
      return {
        type: 'model_unavailable',
        userMessage: 'The selected AI model is currently unavailable. Try a different model in Settings.',
        retryable: true,
        originalError: error,
      };
    }

    if (message.includes('parse') || message.includes('json') || message.includes('invalid response')) {
      return {
        type: 'parse_error',
        userMessage: 'Received an unexpected response. Please try again.',
        retryable: true,
        originalError: error,
      };
    }

    if (message.includes('400') || message.includes('bad request') || message.includes('invalid request')) {
      return {
        type: 'invalid_request',
        userMessage: 'Invalid request format. Please simplify your command.',
        retryable: false,
        originalError: error,
      };
    }

    if (message.includes('500') || message.includes('502') || message.includes('503') || message.includes('server error')) {
      return {
        type: 'model_unavailable',
        userMessage: 'Server error. The service may be experiencing issues. Please try again in a moment.',
        retryable: true,
        originalError: error,
      };
    }
  }

  return {
    type: 'unknown',
    userMessage: 'An unexpected error occurred. Please try again.',
    retryable: true,
    originalError: error,
  };
}

export function formatErrorForUser(error: unknown): string {
  const classified = classifyError(error);
  return classified.userMessage;
}

async function parseOpenRouterError(response: Response): Promise<never> {
  const status = response.status;
  let rawText = '';
  try {
    rawText = await response.text();
  } catch {
    // ignore
  }
  const safeText = rawText ? redact(rawText) : '';
  if (safeText) {
    console.error('[HyperAgent] OpenRouter error payload:', safeText.slice(0, 500));
  }

  if (status === 429) {
      const retryAfterHeader = response.headers.get('Retry-After');
      let retryAfter = 60; // Default to 60 seconds

      if (retryAfterHeader) {
        const parsedInt = Number.parseInt(retryAfterHeader, 10);
        if (!Number.isNaN(parsedInt)) {
          retryAfter = parsedInt;
        } else {
          // Attempt to parse as a date
          const date = new Date(retryAfterHeader);
          if (!Number.isNaN(date.getTime())) {
            retryAfter = Math.max(0, Math.ceil((date.getTime() - Date.now()) / 1000));
          }
        }
      }
      await trackRateLimitEvent({
        timestamp: Date.now(),
        model: 'unknown', // Model is not directly available here
        source: 'OpenRouter',
        retryAfter: retryAfter,
      });
      throw new RateLimitError(`Rate limit exceeded. Please try again in ${retryAfter} seconds.`, retryAfter, 'OpenRouter');
    }

  const friendly = userFriendlyApiError(status) || `Request failed with status ${status}`;
  throw new Error(friendly);
}

// ─── Utility Classes ──────────────────────────────────────────────────────
// Helper to save data to chrome.storage.local
export async function saveToStorage(key: string, data: unknown): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: data }, () => resolve());
  });
}

// Helper to load data from chrome.storage.local
export async function loadFromStorage<T>(key: string): Promise<T | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => {
      resolve((result[key] as T) ?? null);
    });
  });
}

interface RateLimitEntry {
  count: number;
  startTime: number;
}

interface SoftLockEntry {
  unlockTime: number;
  reason: string;
}

interface RateLimiterOptions {
  maxRequestsPerMinute?: number;
  maxRequestsPerHour?: number;
}

class RateLimiter {
  private readonly MAX_REQUESTS_PER_MINUTE: number;
  private readonly MAX_REQUESTS_PER_HOUR: number;
  private readonly SOFT_LOCK_KEY = 'hyperagent_llm_soft_lock';

  private modelLimits = new Map<string, { minute: RateLimitEntry; hour: RateLimitEntry }>();

  constructor(options?: RateLimiterOptions) {
    this.MAX_REQUESTS_PER_MINUTE = options?.maxRequestsPerMinute ?? 60;
    this.MAX_REQUESTS_PER_HOUR = options?.maxRequestsPerHour ?? 3600;
  }

  async getSoftLock(): Promise<{ locked: boolean; unlockTime?: number; reason?: string }> {
    const softLock = await loadFromStorage<SoftLockEntry>(this.SOFT_LOCK_KEY);
    if (softLock && softLock.unlockTime > Date.now()) {
      return { locked: true, unlockTime: softLock.unlockTime, reason: softLock.reason };
    }
    await this.clearSoftLock(); // Clear if expired
    return { locked: false };
  }

  async setSoftLock(unlockTime: number, reason: string): Promise<void> {
    await saveToStorage(this.SOFT_LOCK_KEY, { unlockTime, reason });
  }

  async clearSoftLock(): Promise<void> {
    await chrome.storage.local.remove(this.SOFT_LOCK_KEY);
  }

  async isAllowed(model: string): Promise<{ allowed: boolean; retryAfter?: number; reason?: string }> {
    const softLock = await this.getSoftLock();
    if (softLock.locked) {
      return { allowed: false, retryAfter: Math.ceil((softLock.unlockTime! - Date.now()) / 1000), reason: softLock.reason };
    }

    const now = Date.now();
    let modelLimit = this.modelLimits.get(model);

    if (!modelLimit) {
      modelLimit = {
        minute: { count: 0, startTime: now },
        hour: { count: 0, startTime: now },
      };
      this.modelLimits.set(model, modelLimit);
    }

    // Check minute limit
    if (now - modelLimit.minute.startTime > 60 * 1000) {
      modelLimit.minute = { count: 0, startTime: now };
    }
    if (modelLimit.minute.count >= this.MAX_REQUESTS_PER_MINUTE) {
      const retryAfter = (modelLimit.minute.startTime + 60 * 1000 - now) / 1000;
      return { allowed: false, retryAfter: Math.ceil(retryAfter) };
    }

    // Check hour limit
    if (now - modelLimit.hour.startTime > 60 * 60 * 1000) {
      modelLimit.hour = { count: 0, startTime: now };
    }
    if (modelLimit.hour.count >= this.MAX_REQUESTS_PER_HOUR) {
      const retryAfter = (modelLimit.hour.startTime + 60 * 60 * 1000 - now) / 1000;
      return { allowed: false, retryAfter: Math.ceil(retryAfter) };
    }

    return { allowed: true };
  }

  recordRequest(model: string): void {
    const now = Date.now();
    let modelLimit = this.modelLimits.get(model);

    if (!modelLimit) {
      modelLimit = {
        minute: { count: 0, startTime: now },
        hour: { count: 0, startTime: now },
      };
      this.modelLimits.set(model, modelLimit);
    }

    // Update minute limit
    if (now - modelLimit.minute.startTime > 60 * 1000) {
      modelLimit.minute = { count: 1, startTime: now };
    } else {
      modelLimit.minute.count++;
    }

    // Update hour limit
    if (now - modelLimit.hour.startTime > 60 * 60 * 1000) {
      modelLimit.hour = { count: 1, startTime: now };
    } else {
      modelLimit.hour.count++;
    }

    console.log(`[RateLimiter] Recorded request for ${model}. Minute: ${modelLimit.minute.count}/${this.MAX_REQUESTS_PER_MINUTE}, Hour: ${modelLimit.hour.count}/${this.MAX_REQUESTS_PER_HOUR}`);
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { OPENROUTER_MODELS } from './openrouterConfig';

class CostTracker {
  private sessionTokens = 0;
  private sessionCost = 0;
  private sessionSteps = 0;
  private readonly warningThreshold = DEFAULTS.COST_WARNING_THRESHOLD ?? 1.00;

  private getModelCostPer1kTokens(modelName: string): number {
    for (const key in OPENROUTER_MODELS) {
      if (OPENROUTER_MODELS[key as keyof typeof OPENROUTER_MODELS].name === modelName) {
        return OPENROUTER_MODELS[key as keyof typeof OPENROUTER_MODELS].costPer1kTokens;
      }
    }
    console.warn(`[CostTracker] Unknown model ${modelName}, using default cost.`);
    return 0.001; // Default cost if model not found
  }

  trackCost(modelName: string, usage: any): void {
    if (usage?.total_tokens) {
      this.sessionTokens += usage.total_tokens;
    }

    if (usage?.total_cost) {
      // If OpenRouter provides total_cost directly, use it.
      this.sessionCost += usage.total_cost;
    } else if (usage?.total_tokens) {
      // Otherwise, calculate using our model costs.
      const modelCostPer1kTokens = this.getModelCostPer1kTokens(modelName);
      this.sessionCost += (usage.total_tokens / 1000) * modelCostPer1kTokens;
    }

    if (this.sessionCost >= this.warningThreshold) {
      console.warn(`[CostTracker] Session cost warning: $${this.sessionCost.toFixed(4)} (threshold: $${this.warningThreshold})`);
    }
  }

  getSessionStats() {
    return { tokens: this.sessionTokens, cost: this.sessionCost };
  }

  resetSession() {
    this.sessionTokens = 0;
    this.sessionCost = 0;
    this.sessionSteps = 0;
  }

  isOverLimit(): boolean {
    return this.sessionTokens >= (DEFAULTS.MAX_TOKENS_PER_SESSION ?? 100000);
  }

  incrementSteps(): void {
    this.sessionSteps++;
  }

  isOverStepLimit(): boolean {
    return this.sessionSteps >= (DEFAULTS.MAX_STEPS ?? 12);
  }
}

// ─── Dynamic System Prompt Builder (cached prefix + dynamic suffix) ────────
const DYNAMIC_ACTIONS_SUFFIX = `
## Response Format (ALWAYS use valid JSON)
{
  "thinking": "Your PRIVATE reasoning - NOT shown to user directly",
  "summary": "What you say TO the user - this is your actual response",
  "actions": [],
  "askUser": "Optional: ask a clarifying question",
  "done": true|false
}

## CRITICAL: thinking vs summary

"thinking" = Your internal monologue (shown in a collapsed box)
- What are you analyzing?
- What's missing?
- Should you ask or act?
- Example: "User said 'hey'. This is a greeting. I should respond warmly and ask what they need."

"summary" = Your actual words TO the user (shown prominently)
- This is what the user reads
- Be natural, helpful, conversational
- Example: "Hey!  Great to hear from you. What can I help you with today?"

## EXAMPLE RESPONSES

### Greeting:
User: "hey"
{
  "thinking": "User is greeting me. I should respond in a friendly, casual way and offer help.",
  "summary": "Hey!  What's up? I'm here to help - want to chat or need me to do something on the web?",
  "actions": [],
  "done": true
}

### Question:
User: "what's the weather"
{
  "thinking": "User is asking about weather. I don't have direct weather access, but I could navigate to a weather site. Or I should ask their location first.",
  "summary": "I can check the weather for you! What city are you in?",
  "actions": [],
  "askUser": "What's your city?",
  "done": false
}

### Task with missing info:
User: "find me leads"
{
  "thinking": "User wants leads but I need to know: what industry, location, how many, what format. Let me ask one question at a time.",
  "summary": "I can help find leads! What industry are you targeting?",
  "actions": [],
  "askUser": "What industry?",
  "done": false
}

### Ready to execute:
User: "yes go ahead"
{
  "thinking": "User confirmed. I have all the info. Now I'll navigate to the site and start extracting.",
  "summary": "On it! Starting now...",
  "actions": [{"type": "navigate", "url": "https://linkedin.com", "description": "Go to LinkedIn"}],
  "done": false
}

### After action failed (self-heal):
Action results: [{"type": "click", "desc": "Click Search", "ok": false, "err": "Element not found"}]
{
  "thinking": "Click failed - element not found. I'll try scrolling first to reveal it, or use a different locator like aria-label or index.",
  "summary": "Search button wasn't visible. Scrolling to find it...",
  "actions": [{"type": "scroll", "direction": "down", "description": "Scroll to reveal search"}, {"type": "click", "locator": {"strategy": "aria-label", "value": "Search"}, "description": "Click search"}],
  "done": false
}

## Available Actions (only when EXECUTING)
- navigate: {"type": "navigate", "url": "https://...", "description": "..."}
- click: {"type": "click", "locator": {"strategy": "text", "value": "Button"}, "description": "..."}
- fill: {"type": "fill", "locator": {...}, "value": "text", "description": "..."}
- pressKey: {"type": "pressKey", "key": "Enter", "description": "..."}
- scroll: {"type": "scroll", "direction": "down", "description": "..."}
- extract: {"type": "extract", "locator": {...}, "description": "..."}

## Self-Healing (when actions fail)
- You receive action results in history. If something failed, adapt:
  - Try a different locator (text, aria-label, role, index)
  - Scroll before locating (elements may be off-screen)
  - Break into smaller steps
- NEVER stop with "I couldn't find it" unless you've tried alternatives
- Keep the task going—partial success is better than quitting

## Rules
1. "thinking" is for YOUR reasoning - the user sees this collapsed
2. "summary" is what you SAY to the user - make it natural and helpful
3. Never put reasoning in "summary" - that goes in "thinking"
4. Ask ONE question at a time via "askUser"
5. Only use "actions" when ready to execute
6. When actions fail, adapt and retry—don't give up`;

function buildDynamicSystemPrompt(task: AgentTask): string {
  let basePrompt = `${CACHED_SYSTEM_PREFIX}${DYNAMIC_ACTIONS_SUFFIX}`;

  // Explicitly surface the current interaction mode so the model can
  // gracefully stay in conversation when no automation is required.
  const modeLine = task.mode === 'conversation'
    ? `
MODE: conversation (chat-focused; only use actions when the user explicitly asks for browser control)`
    : '';

  basePrompt += modeLine;

  if (task.complexity === 'complex') {
    return `${basePrompt}

ENHANCED REASONING MODE:
For this complex task, think through step by step:
1. What am I trying to achieve?
2. What obstacles might I face?
3. What's the best approach?
4. How will I verify success?`;
  }

  return basePrompt;
}

// ─── Model Selection ──────────────────────────────────────────────────────
function selectModelForTask(_task: AgentTask): { name: string; costPer1kTokens: number } {
  // For now, always return the chat model. This can be expanded later for dynamic model selection.
  return OPENROUTER_MODELS.chat;
}

// All calls go through OpenRouter — this is kept for backward compat but always returns 'openrouter'
function detectProviderFromKey(_apiKey: string): string {
  return 'openrouter';
}

function getOpenRouterBaseUrl(raw?: string): string {
  return normalizeOpenRouterBaseUrl(raw || OPENROUTER_DEFAULT_BASE_URL);
}

function getOpenRouterHeaders(apiKey: string, baseUrl?: string): Record<string, string> {
  return getOpenRouterHeadersWithEnv(apiKey, baseUrl);
}

// Build request body (OpenAI-compatible format, used by OpenRouter)
function buildOpenRouterRequest(model: string, messages: any[], maxTokens: number, temperature: number): Record<string, unknown> {
  // Delegate to centralized helper that never overrides provider.order.
  return buildOpenRouterBody(model, messages, maxTokens, temperature);
}

function analyzeTaskComplexity(
  command: string,
  history: HistoryEntry[],
  intents: { action: string }[] = []
): AgentTask {
  const commandLower = command.toLowerCase();
  const stepCount = history.filter(h => h?.role === 'assistant').length;

  const isSimple = /^(click|press|type|fill|scroll|select)\s/i.test(commandLower);
  const isComplex = /\b(analyze|compare|research|find all|extract|summarize|navigate|search|multi|complex)\b/i.test(
    commandLower
  );
  const multiStep = stepCount > 3 || /\b(and|then|after|next|also)\b/i.test(commandLower);

  // Detect clearly conversational turns (greetings, short Q&A, chit-chat).
  const looksConversational =
    !/\b(click|press|type|fill|scroll|select|navigate|open tab|extract|form|button|link)\b/i.test(commandLower) &&
    (commandLower.length < 120 || /^(hi|hey|hello|how are you|what is|who is)\b/i.test(commandLower));

  // Intents can also hint at automation vs chat; if we see explicit web actions,
  // prefer automation mode.
  const hasAutomationIntent = intents.some(i =>
    /click|fill|select|scroll|navigate|openTab|extract|pressKey|submit|runWorkflow|runMacro/i.test(i.action)
  );

  let complexity: TaskComplexity = 'standard';
  if (isSimple && !multiStep) complexity = 'simple';
  if (isComplex || multiStep || stepCount > 5) complexity = 'complex';

  const actionMatch = /^(click|type|fill|scroll|navigate|extract|press|select|hover|focus)/.exec(commandLower);
  const actionType = actionMatch ? actionMatch[1] : 'unknown';

  const mode: 'conversation' | 'automation' =
    looksConversational && !hasAutomationIntent ? 'conversation' : 'automation';

  return {
    type: actionType,
    description: command,
    requiresReasoning: isComplex,
    multiStep,
    complexity,
    mode,
  };
}

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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

// ─── History Compression (importance-aware) ──────────────────────────────────
function importanceScore(entry: HistoryEntry): number {
  if (entry.role === 'user') {
    if (entry.userReply) return 9; // User replies are high value
    return 5;
  }
  if (entry.role === 'assistant' && entry.response) {
    if (entry.response.askUser) return 10; // Clarification questions - keep
    if (entry.response.done && entry.response.actions?.length === 0) return 8; // Conversation turns
    const hasErrors = entry.actionsExecuted?.some(r => !r.success);
    if (hasErrors) return 9; // Failed actions - keep for context
    return 6;
  }
  return 4;
}

function compressHistory(history: HistoryEntry[]): HistoryEntry[] {
  if (history.length <= 10) return history;

  const recent = history.slice(-4); // Always keep last 4
  const older = history.slice(0, -4);

  // Keep high-importance older entries (askUser, errors, user replies)
  const scored = older.map(e => ({ entry: e, score: importanceScore(e) }));
  const keep = scored.filter(s => s.score >= 8).map(s => s.entry);
  const dropEntries = scored.filter(s => s.score < 8).map(s => s.entry);

  const actions = dropEntries
    .filter(m => m.role === 'assistant' && m.response?.actions)
    .flatMap(m => m.response?.actions?.map((a: any) => a.type) || [])
    .filter(Boolean);

  const summaryEntry: HistoryEntry = {
    role: 'user',
    context: {
      url: 'summary',
      title: 'Compressed History',
      bodyText: `[Previous ${dropEntries.length} turns: ${actions.length} actions - ${actions.slice(0, 5).join(', ')}${actions.length > 5 ? '...' : ''}]`,
      metaDescription: '',
      formCount: 0,
      semanticElements: [],
      timestamp: Date.now(),
      scrollPosition: { x: 0, y: 0 },
      viewportSize: { width: 0, height: 0 },
      pageHeight: 0,
    },
  };

  return [...keep, summaryEntry, ...recent];
}

// ─── Semantic Cache ────────────────────────────────────────────────────────
interface CachedResponse {
  response: LLMResponse;
  embedding: number[];
  timestamp: number;
  query: string;
}

class SemanticCache {
  private readonly cache = new Map<string, CachedResponse>();
  private readonly maxSize = 50;
  private readonly similarityThreshold = 0.95;

  async get(query: string, getEmbedding: (text: string) => Promise<number[]>): Promise<CachedResponse | null> {
    if (this.cache.size === 0) return null;

    try {
      const queryEmbedding = await getEmbedding(query);
      if (!queryEmbedding.length) return null;

      for (const [key, cached] of this.cache) {
        if (Date.now() - cached.timestamp > 30 * 60 * 1000) {
          this.cache.delete(key);
          continue;
        }

        const similarity = this.cosineSimilarity(queryEmbedding, cached.embedding);
        if (similarity > this.similarityThreshold) {
          console.log(`[SemanticCache] Hit with similarity ${similarity.toFixed(3)}`);
          return cached;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  async set(query: string, response: LLMResponse, getEmbedding: (text: string) => Promise<number[]>): Promise<void> {
    if (this.cache.size >= this.maxSize) {
      const oldest = [...this.cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      if (oldest) this.cache.delete(oldest[0]);
    }

    try {
      const embedding = await getEmbedding(query);
      if (embedding.length) {
        const key = `sem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        this.cache.set(key, { response, embedding, timestamp: Date.now(), query });
      }
    } catch {
      // Silently fail on embedding errors
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  clear(): void {
    this.cache.clear();
  }
}

const semanticCache = new SemanticCache();

// ─── Minimal Context Extraction ─────────────────────────────────────────────
interface MinimalContext {
  interactive: Array<{ tag: string; text: string; role: string; index: number }>;
  headings: Array<{ level: number; text: string }>;
  forms: Array<{ action: string; fields: string[] }>;
  currentFocus: string | null;
  url: string;
  title: string;
}

function _extractMinimalContext(context: PageContext): MinimalContext {
  const interactive = context.semanticElements
    .filter(el => ['button', 'a', 'input', 'select', 'textarea'].includes(el.tag.toLowerCase()))
    .slice(0, 50)
    .map((el, idx) => ({
      tag: el.tag,
      text: (el.visibleText || el.ariaLabel || el.placeholder || '').slice(0, 50),
      role: el.role || '',
      index: el.index ?? idx,
    }));

  const headings = context.semanticElements
    .filter(el => /^h[1-6]$/i.test(el.tag))
    .slice(0, 10)
    .map(el => ({
      level: Number.parseInt(el.tag.slice(1)),
      text: (el.visibleText || '').slice(0, 80),
    }));

  const forms = context.semanticElements
    .filter(el => el.tag.toLowerCase() === 'form')
    .slice(0, 5)
    .map(el => ({
      action: '',
      fields: context.semanticElements
        .filter(f => f.tag.toLowerCase() === 'input' && f.parentTag === el.tag)
        .slice(0, 10)
        .map(f => f.name || f.placeholder || f.id || 'field'),
    }));

  return {
    interactive,
    headings,
    forms,
    currentFocus: null,
    url: context.url,
    title: context.title,
  };
}

// ─── Strategic Context Enhancement ───────────────────────────────────────────
interface StrategicContext {
  goal: string;
  currentPage: string;
  previousActions: string[];
  obstacles: string[];
  stepCount: number;
}

function _enhanceWithStrategicReasoning(context: StrategicContext): string {
  const patterns = analyzePatterns(context);
  const alternatives = identifyAlternatives(context);

  return `
STRATEGIC ANALYSIS:
Goal: ${context.goal}
Current Position: ${context.currentPage}
Progress: ${context.stepCount} steps taken

INTELLIGENCE ENHANCEMENT:
- Pattern Recognition: ${patterns}
- Alternative Paths: ${alternatives}
- Risk Level: ${context.obstacles.length > 2 ? 'HIGH' : context.obstacles.length > 0 ? 'MEDIUM' : 'LOW'}

RECOMMENDED APPROACH:
${context.obstacles.length > 0 ? `Address obstacles: ${context.obstacles.join(', ')}` : 'Continue with current approach'}
`;
}

function analyzePatterns(context: StrategicContext): string {
  const actionTypes = context.previousActions.map(a => a.split(':')[0] || a);
  const clickCount = actionTypes.filter(a => a === 'click').length;
  const navCount = actionTypes.filter(a => a === 'navigate').length;

  if (clickCount > 5) return 'Multiple click attempts - consider alternative locators';
  if (navCount > 2) return 'Multiple navigations - verify target page';
  return 'Normal execution pattern';
}

function identifyAlternatives(context: StrategicContext): string {
  if (context.obstacles.some(o => o.includes('not found'))) {
    return 'Try: scroll to reveal, wait for dynamic content, use different locator strategy';
  }
  if (context.obstacles.some(o => o.includes('timeout'))) {
    return 'Try: increase wait time, check for loading indicators';
  }
  return 'Current approach viable';
}

interface BuildMessagesOptions {
  sessionMeta?: {
    goal?: string;
    lastActions?: string[];
    lastUserReplies?: string[];
    intents?: { action: string }[];
  };
  learningEnabled?: boolean;
}

// ─── Build messages for the API ─────────────────────────────────────
function buildMessages(
  command: string,
  history: HistoryEntry[],
  context: PageContext,
  options: BuildMessagesOptions = {}
): Message[] {
  const safeCommand = sanitizeForPrompt(command || '');
  const task = analyzeTaskComplexity(safeCommand, history, options.sessionMeta?.intents ?? []);
  const systemPrompt = buildDynamicSystemPrompt(task);
  const messages: Message[] = [{ role: 'system', content: systemPrompt }];

  const contextManager = getContextManager();

  const compressedHistory = compressHistory(history);

  for (let i = 0; i < compressedHistory.length; i++) {
    const entry = compressedHistory[i];
    if (entry.role === 'user') {
      if (entry.userReply) {
        const safeReply = sanitizeForPrompt(entry.userReply);
        messages.push({
          role: 'user',
          content: `User replied: ${safeReply}`,
        });
        if (options.learningEnabled !== false) {
          contextManager.addContextItem({
            type: 'result',
            content: `User replied: ${entry.userReply}`,
            timestamp: Date.now(),
            importance: 8,
          });
        }
      } else if (entry.context) {
        const isOld = i < compressedHistory.length - 4;
        const ctx = isOld
          ? compactContext(entry.context)
          : (() => {
            const c = { ...entry.context };
            delete c.screenshotBase64;
            return c;
          })();
        const safeCmd = sanitizeForPrompt(entry.command || '');
        const content = `Command: ${safeCmd}\n\nPage context:\n${JSON.stringify(ctx, null, isOld ? 0 : 2)}`;
        messages.push({
          role: 'user',
          content,
        });
        if (options.learningEnabled !== false) {
          contextManager.addContextItem({
            type: 'action',
            content,
            timestamp: entry.context.timestamp || Date.now(),
            importance: isOld ? 3 : 7,
          });
        }
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
      if (options.learningEnabled !== false) {
        contextManager.addContextItem({
          type: 'thought',
          content: resp.thinking || resp.summary,
          timestamp: Date.now(),
          importance: 6,
        });
      }
      if (entry.actionsExecuted) {
        const results = entry.actionsExecuted.map(r => ({
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
        const hasErrors = results.some(r => !r.ok);
        if (options.learningEnabled !== false) {
          contextManager.addContextItem({
            type: hasErrors ? 'error' : 'result',
            content: resultsContent,
            timestamp: Date.now(),
            importance: hasErrors ? 9 : 5,
          });
        }
      }
    }
  }

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
  let noPageContext = false;
  if (!context) {
    // Create minimal fallback context if none provided
    context = {
      url: 'no_page_context',
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
    noPageContext = true;
  } else if (
    !context.url &&
    !context.title &&
    (!context.bodyText || !context.bodyText.trim()) &&
    (!context.semanticElements || context.semanticElements.length === 0)
  ) {
    noPageContext = true;
  }

  const currentContext = { ...context };
  const screenshot = currentContext?.screenshotBase64;
  if (screenshot) delete currentContext.screenshotBase64;

  // Apply a soft limit on semantic elements based on task complexity to keep
  // prompts efficient while preserving enough structure for the LLM.
  if (Array.isArray(currentContext.semanticElements)) {
    let maxElements: number = DEFAULTS.MAX_SEMANTIC_ELEMENTS ?? 250;
    if (task.complexity === 'simple') {
      maxElements = Math.min(maxElements, 80);
    } else if (task.complexity === 'standard') {
      maxElements = Math.min(maxElements, 160);
    }
    if (currentContext.semanticElements.length > maxElements) {
      currentContext.semanticElements = currentContext.semanticElements.slice(0, maxElements);
    }
  }

  // Include a small structured block with session goal and recent session-level
  // information so the model has a stable sense of purpose across turns.
  if (options.sessionMeta && (options.sessionMeta.goal || options.sessionMeta.lastActions || options.sessionMeta.lastUserReplies)) {
    const lines: string[] = ['Session context:'];
    if (options.sessionMeta.goal) {
      lines.push(`- Goal: ${sanitizeForPrompt(options.sessionMeta.goal)}`);
    }
    if (options.sessionMeta.lastActions?.length) {
      lines.push(`- Last actions: ${options.sessionMeta.lastActions.slice(-5).join(' | ')}`);
    }
    if (options.sessionMeta.lastUserReplies?.length) {
      lines.push(`- Recent user replies: ${options.sessionMeta.lastUserReplies.slice(-5).join(' | ')}`);
    }
    messages.push({
      role: 'system',
      content: lines.join('\n'),
    });
  }

  if (noPageContext) {
    messages.push({
      role: 'system',
      content: 'Page context status: no_page_context',
    });
  }

  const safeHistory = history || [];
  const textContent = `Command: ${safeCommand || 'No command'}\n\nCurrent page context (step ${safeHistory.filter(h => h?.role === 'assistant').length + 1}):\n${JSON.stringify(currentContext, null, 2)}`;

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
  } catch {
    /* continue */
  }

  // Try stripping markdown code fences
  const fenceMatch = /```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/.exec(trimmed);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      /* continue */
    }
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
        } catch {
          /* continue scanning */
        }
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
  settings: FallbackSettings,
  correlationId?: string // Added correlationId
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

    // All calls go through OpenRouter
    const model = OPENROUTER_MODELS.chat;
    const baseUrl = `${getOpenRouterBaseUrl(settings.baseUrl)}/chat/completions`;
    const headers = getOpenRouterHeaders(settings.apiKey, settings.baseUrl, undefined, correlationId); // Pass correlationId

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const requestBody = buildOpenRouterRequest(model, [{ role: 'user', content: reasoningPrompt }], 1000, 0.1);

        const resp = await fetch(baseUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(30000),
        });

        if (!resp?.ok) continue;

        const data = await resp.json();
        const content = data?.choices?.[0]?.message?.content || '';

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
      'click',
      'fill',
      'select',
      'scroll',
      'navigate',
      'goBack',
      'wait',
      'pressKey',
      'hover',
      'focus',
      'extract',
      'openTab',
      'closeTab',
      'switchTab',
      'getTabs',
      'runMacro',
      'runWorkflow',
    ] as const;

    const actionsRequiringLocator = new Set([
      'click',
      'fill',
      'select',
      'hover',
      'focus',
      'extract',
    ]);
    const actionsRequiringUrl = new Set(['navigate', 'openTab', 'switchTab']);
    const actionsRequiringKey = new Set(['pressKey']);

    for (const a of raw.actions) {
      if (!a || typeof a !== 'object') continue;
      const action = a as Record<string, unknown>;
      if (!isString(action.type)) continue;
      if (!validTypes.includes(action.type as (typeof validTypes)[number])) continue;

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
  private readonly cache = new Map<string, any>();
  private readonly rateLimiter = new RateLimiter({
    maxRequestsPerMinute: 60,
    maxRequestsPerHour: 3600,
  });
  private readonly costTracker = new CostTracker();
  private readonly domainActionTracker = new DomainActionTracker();

  constructor() {
    // Inject self into autonomous intelligence engine to break circular dependency
    autonomousIntelligence.setLLMClient(this);
  }

  async callLLM(request: LLMRequest, signal?: AbortSignal, correlationId?: string): Promise<LLMResponse> {
    // The standard agent loop uses the traditional API call directly.
    // This sends the command + page context to the LLM and gets back
    // structured actions. No extra planning round-trip needed.
    return await this.makeTraditionalCall(request, signal, correlationId);
  }

  async callLLMAutonomous(request: LLMRequest, signal?: AbortSignal): Promise<LLMResponse> {
    // Autonomous mode: uses an extra LLM planning call to decompose
    // complex tasks into multi-step plans before execution.
    const intelligenceContext: IntelligenceContext = {
      taskDescription: request.command || 'No Command Provided',
      availableTools: ['web_browsing', 'data_extraction', 'multi_tab', 'research'],
      previousAttempts: [],
      environmentalData: {
        url: request.context?.url,
        html: request.context?.bodyText?.slice(0, 5000),
      },
      userPreferences: {},
      domainKnowledge: {},
      successPatterns: [],
    };

    try {
      const autonomousPlan = await autonomousIntelligence.understandAndPlan(
        request.command || '',
        intelligenceContext
      );

      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      if (
        !autonomousPlan ||
        !Array.isArray((autonomousPlan as any).actions) ||
        ((autonomousPlan as any).actions?.length ?? 0) === 0
      ) {
        return await this.makeTraditionalCall(request, signal, request.correlationId); // Pass correlationId
      }

      return this.convertPlanToResponse(autonomousPlan);
    } catch (error) {
      if ((error as Error).name === 'AbortError') throw error;
      console.error('[HyperAgent] Autonomous planning failed, using direct call:', error);
      return await this.makeTraditionalCall(request, signal, request.correlationId); // Pass correlationId
    }
  }

  private convertPlanToResponse(plan: any): LLMResponse {
    // The autonomous planner returns { steps: [{ action, ... }] }
    // We need to extract the action from each step into a flat actions array.
    let actions: Action[] = [];

    if (Array.isArray(plan.actions) && plan.actions.length > 0) {
      actions = plan.actions;
    } else if (Array.isArray(plan.steps) && plan.steps.length > 0) {
      actions = plan.steps
        .filter((s: any) => s?.action && typeof s.action === 'object' && s.action.type)
        .map((s: any) => ({
          ...s.action,
          description: s.action.description || s.description || `Step: ${s.id || 'unknown'}`,
        }));
    }

    return {
      thinking: plan.reasoning,
      summary: plan.summary || plan.reasoning || 'Autonomous plan generated.',
      actions,
      needsScreenshot: plan.needsScreenshot || false,
      done: actions.length === 0 ? true : (plan.done || false),
      askUser: plan.askUser,
    };
}

  async callCompletion(request: CompletionRequest, signal?: AbortSignal, correlationId?: string): Promise<string> {
    const settings = await loadSettings();
    if (!settings.apiKey) throw new Error('API Key not set');

    try {
      const safeMessages = sanitizeMessages(request.messages || []);
      const model = settings.modelName || OPENROUTER_MODELS.chat;

      console.log(`[HyperAgent] Using completion model: ${model} (via OpenRouter)`);

      const baseUrl = `${getOpenRouterBaseUrl(settings.baseUrl)}/chat/completions`;
      const headers = getOpenRouterHeaders(settings.apiKey, settings.baseUrl, undefined, correlationId); // Pass correlationId
      const requestBody = buildOpenRouterRequest(
        model,
        safeMessages,
        request.maxTokens ?? 1000,
        request.temperature ?? 0.7
      );

      const response = await fetch(baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: signal || AbortSignal.timeout(OPENROUTER_TIMEOUTS.completionMs),
      });

      if (!response?.ok) {
        await parseOpenRouterError(response);
      }

      const data = await response.json();
      return data?.choices?.[0]?.message?.content || '';
    } catch (error) {
      console.error('[HyperAgent] Completion failed:', error);
      throw error;
    }
  }

  private async makeTraditionalCall(
    request: LLMRequest,
    signal?: AbortSignal,
    correlationId?: string
  ): Promise<LLMResponse> {
    const settings = await loadSettings();
    return await this.makeAPICall(request, settings, signal, correlationId);
  }

  private async makeAPICall(
    request: LLMRequest,
    settings: any,
    signal?: AbortSignal,
    correlationId?: string
  ): Promise<LLMResponse> {
    // Check if we should use local Ollama
    if (settings.useLocalAI || settings.ollamaEnabled) {
      try {
        const ollamaStatus = await checkOllamaStatus();
        if (ollamaStatus.available) {
          console.log('[HyperAgent] Using Ollama for inference');
          const model = settings.ollamaModel || 'llama3.2:3b';
          const systemPrompt = this.buildSystemPrompt(request);
          const response = await ollamaClient.generate(
            request.command || '',
            {
              model,
              temperature: 0.7,
              systemPrompt,
            }
          );
          return response;
        }
      } catch (ollamaError) {
        console.log('[HyperAgent] Ollama not available, falling back to cloud API:', ollamaError);
      }
    }

    // Sanitize input
    const sanitizedCommand = inputSanitizer.sanitize(request.command || '', {
      maxLength: 10000,
      preserveWhitespace: true,
    });

    if (!sanitizedCommand.isValid) {
      console.warn('[HyperAgent] Input sanitization warnings:', sanitizedCommand.warnings);
    }

    const task = analyzeTaskComplexity(
      sanitizedCommand.sanitizedValue,
      request.history || [],
      request.intents || []
    );
    const selectedModelInfo = selectModelForTask(task);
    const selectedModel = selectedModelInfo.name;

    // Check semantic cache
    const semanticCached = await semanticCache.get(sanitizedCommand.sanitizedValue, (text) => this.getEmbedding(text));
    if (semanticCached) {
      console.log('[HyperAgent] Using semantically cached response');
      return semanticCached.response;
    }

    // Build messages
    const rawMessages = buildMessages(
      sanitizedCommand.sanitizedValue,
      request.history || [],
      request.context || this.createEmptyContext(),
      {
        sessionMeta: request.sessionMeta,
        learningEnabled: settings.learningEnabled,
      }
    );
    const messages = sanitizeMessages(rawMessages);

    // Check cache
    const cacheKey = `llm_${selectedModel}_${this.hashMessages(messages)}`;
    const cachedResponse = await apiCache.get(cacheKey);
    if (cachedResponse) {
      console.log('[HyperAgent] Using cached LLM response');
      return cachedResponse;
    }

    // Check session token limit
    if (this.costTracker.isOverLimit()) {
      const retryAfter = 60; // Default to 60 seconds for session limit
      return {
        thinking: 'Session token limit exceeded.',
        summary: 'You have exceeded the maximum token limit for this session. Please reset the session to continue.',
        actions: [],
        done: true,
        error: 'rate_limit',
        retryAfter: retryAfter,
      };
    }

    // Check session step limit
    const maxSteps = DEFAULTS.MAX_STEPS ?? 12;
    const currentSteps = this.costTracker.sessionSteps;
    const approachingThreshold = Math.floor(maxSteps * 0.8);

    if (currentSteps >= maxSteps) {
      return {
        thinking: 'Session step limit exceeded.',
        summary: `You have exceeded the maximum of ${maxSteps} steps for this session. Please reset the session to continue.`,
        actions: [],
        done: true,
        error: 'max_steps_exceeded',
      };
    } else if (currentSteps >= approachingThreshold) {
      return {
        thinking: 'Session step limit approaching.',
        summary: `You are approaching the maximum of ${maxSteps} steps for this session (${currentSteps} taken). Do you want to allow an extended run?`,
        actions: [],
        done: false,
        error: 'max_steps_approaching',
        askUser: `You are approaching the maximum of ${maxSteps} steps for this session (${currentSteps} taken). Do you want to allow an extended run?`,
      };
    }

    // Check per-domain action limit
    const currentDomain = request.context?.url ? new URL(request.context.url).hostname : 'unknown';
    if (await this.domainActionTracker.isOverLimit(currentDomain)) {
      const domainLimit = DEFAULTS.MAX_ACTIONS_PER_DOMAIN ?? 50;
      return {
        thinking: `Domain action limit exceeded for ${currentDomain}.`,
        summary: `You have exceeded the maximum of ${domainLimit} actions for ${currentDomain} in this session. Please reset the session to continue.`,
        actions: [],
        done: true,
        error: 'domain_action_limit_exceeded',
      };
    }

    // All calls go through OpenRouter
    const rateLimitCheck = await this.rateLimiter.isAllowed(selectedModel);
    if (!rateLimitCheck.allowed) {
      const errorMessage = `Rate limit exceeded for model ${selectedModel}. Please try again in ${rateLimitCheck.retryAfter} seconds.`;
      await trackRateLimitEvent({
        timestamp: Date.now(),
        model: selectedModel,
        source: 'OpenRouter',
        retryAfter: rateLimitCheck.retryAfter!,
      });
      throw new RateLimitError(errorMessage, rateLimitCheck.retryAfter!, 'Hyperagent');
    }
    this.rateLimiter.recordRequest(selectedModel);
    console.log(`[HyperAgent] Using model: ${selectedModel} (via OpenRouter)`);

    const baseUrl = `${getOpenRouterBaseUrl(settings.baseUrl)}/chat/completions`;
    const headers = getOpenRouterHeaders(settings.apiKey, settings.baseUrl, undefined, correlationId);
    const maxTokens = task.complexity === 'complex' ? 4096 : 2048;
    const temperature = task.complexity === 'complex' ? 0.5 : 0.7;
    const requestBody = buildOpenRouterRequest(selectedModel, messages, maxTokens, temperature);

    // Make API call
    const retryResult = await retryManager.retry(
      async () => {
        const response = await fetch(baseUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
          signal: signal || AbortSignal.timeout(OPENROUTER_TIMEOUTS.chatMs),
        });

        if (!response?.ok) {
          await parseOpenRouterError(response);
        }

        // Parse response (OpenRouter uses OpenAI-compatible format)
        const data = await response.json();
        // Track cost for the successful API call
        this.costTracker.trackCost(selectedModelInfo.name, data.usage);
        const content = data?.choices?.[0]?.message?.content || '';

        if (!content) {
          throw new Error('No content in response');
        }

        // Try to parse JSON, fallback to plain text
        const parsed = extractJSON(content);
        if (!parsed) {
          console.warn('[HyperAgent] Failed to parse JSON from response, using plain text:', content.slice(0, 500));
          return {
            summary: content.slice(0, 200),
            thinking: 'Simple text response',
            actions: [],
            done: true,
            needsScreenshot: false,
          };
        }

        return validateResponse(parsed);
      },
      {
        ...networkRetryPolicy,
        maxAttempts: 3,
        onRetry: (attempt, error) => {
          console.log(`[HyperAgent] LLM call attempt ${attempt} failed, retrying:`, error);
        },
      },
      undefined
    );

    if (retryResult.success && retryResult.result) {
      await apiCache.set(cacheKey, retryResult.result, { ttl: 15 * 60 * 1000 });
      await semanticCache.set(sanitizedCommand.sanitizedValue, retryResult.result, (text) => this.getEmbedding(text));
      if (retryResult.result.actions && retryResult.result.actions.length > 0) {
        this.costTracker.incrementSteps();
        await this.domainActionTracker.incrementActionCount(currentDomain);
      }
      return retryResult.result;
    }

    const errorMessage =
      retryResult.error instanceof Error
        ? retryResult.error.message
        : String(retryResult.error ?? 'Request failed');

    if (retryResult.error instanceof RateLimitError) {
      const unlockTime = Date.now() + retryResult.error.retryAfter * 1000;
      await this.rateLimiter.setSoftLock(unlockTime, errorMessage);
      const sourceMessage = retryResult.error.source === 'Hyperagent' ? 'your local agent' : 'OpenRouter';
      return {
        thinking: `Failed to get response due to rate limit after retries. Soft locked until ${new Date(unlockTime).toLocaleTimeString()}`,
        summary: `I've encountered a rate limit from ${sourceMessage} and will be temporarily paused. ${errorMessage}`,
        actions: [],
        done: true,
        error: 'rate_limit',
        retryAfter: retryResult.error.retryAfter,
      };
    }

    return {
      thinking: 'Failed to get response after retries.',
      summary: errorMessage || 'I encountered an error after multiple attempts.',
      actions: [],
      done: true,
    };
  }

  private hashMessages(messages: any[]): string {
    const content = JSON.stringify(messages.map(m => m.content));
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return `hash_${Math.abs(hash).toString(36)}`;
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

  private buildSystemPrompt(request: LLMRequest): string {
    return `[HYPERAGENT v4.0]
You are an intelligent AI assistant with browser automation capabilities.

## THINK → ASK → CONFIRM → ACT

Before responding, always think:
1. What does the user want?
2. What information am I missing?
3. Should I ask, confirm, or act?

## MODES
- CONVERSATION: Chat naturally (actions: [], done: true)
- GATHERING: Ask clarifying questions (askUser: "...", done: false)
- CONFIRMING: Verify plan before acting (askUser: "Ready?")
- EXECUTING: Perform browser actions (actions: [...], done: false)

## Response Format (JSON)
{
  "thinking": "Your internal reasoning",
  "summary": "Your response to user",
  "actions": [],
  "askUser": "optional question",
  "done": true/false
}

## Rules
1. Never execute with missing info - ASK first
2. Ask ONE question at a time
3. Confirm before major actions
4. Be conversational and helpful

USER COMMAND: ${request.command || 'No command'}
`;
  }

  async getEmbedding(text: string, correlationId?: string): Promise<number[]> { // Added correlationId
    const settings = await loadSettings();
    if (!settings.apiKey) throw new Error('API Key not set');

    try {
      // Use OpenRouter's text-embedding adapter (works with the API key)
      const baseUrl = `${getOpenRouterBaseUrl(settings.baseUrl)}/embeddings`;
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: getOpenRouterHeaders(settings.apiKey, settings.baseUrl, undefined, correlationId), // Pass correlationId
        body: JSON.stringify({
          model: OPENROUTER_MODELS.embedding.name,
          input: text,
        }),
        signal: AbortSignal.timeout(OPENROUTER_TIMEOUTS.embeddingsMs),
      });

      if (!response?.ok) {
        if (response?.status === 429) {
          const retryAfter = response?.headers?.get('Retry-After');
          const waitSec = retryAfter ? Number.parseInt(retryAfter, 10) : 60;
          console.warn(`[HyperAgent] Embedding rate limited. Retry after ~${waitSec}s`);
          await trackRateLimitEvent({
            timestamp: Date.now(),
            model: OPENROUTER_MODELS.embedding.name,
            source: 'OpenRouter',
            retryAfter: waitSec,
          });
        } else {
          await parseOpenRouterError(response);
        }
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

  updateSettings(_newSettings: Partial<any>): void {
    // Update settings if needed
  }
}

export const llmClient = new EnhancedLLMClient();
