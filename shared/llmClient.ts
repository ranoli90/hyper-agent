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
import { retryManager, networkRetryPolicy } from './retry-circuit-breaker';
import { ollamaClient, checkOllamaStatus } from './ollamaClient';

const DEFAULT_MODEL = 'google/gemini-2.0-flash-001';

// ─── Model Cascade Configuration ───────────────────────────────────────────
const MODEL_CASCADE = {
  simple: 'google/gemini-2.0-flash-lite-001',
  standard: 'google/gemini-2.0-flash-001',
  complex: 'anthropic/claude-3.5-sonnet',
} as const;

type TaskComplexity = 'simple' | 'standard' | 'complex';

interface AgentTask {
  type: string;
  description: string;
  requiresReasoning?: boolean;
  multiStep?: boolean;
  complexity: TaskComplexity;
}

// ─── Cached System Prefix (stable for provider caching) ────────────────────
const CACHED_SYSTEM_PREFIX = `[HYPERAGENT v3.0]
You are an autonomous browser agent with enhanced reasoning capabilities.

CORE CAPABILITIES:
- Observe DOM and understand page context
- Plan multi-step actions strategically  
- Execute precise element interactions
- Verify outcomes and adapt

REASONING FRAMEWORK:
1. ASSESS: What is the current state?
2. ANALYZE: What needs to happen?
3. STRATEGIZE: What's the optimal approach?
4. EXECUTE: Take precise action
5. VERIFY: Did it work? Adjust if needed.`;

import { sanitizeMessages } from './security';

/** Map API status codes to user-friendly messages (22.1). */
function userFriendlyApiError(status: number): string | null {
  switch (status) {
    case 400:
      return 'Invalid request. Please check your command and try again.';
    case 401:
      return 'API key invalid or expired. Check your key in Settings.';
    case 403:
      return 'Access denied. Check your API key and subscription.';
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

// ─── Utility Classes ──────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
class RateLimiter {
  recordRequest(_model: string): void {
    // Simple rate limiting - could be enhanced later
    console.log(`[RateLimiter] Recorded request for ${_model}`);
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
class CostTracker {
  private sessionTokens = 0;
  private sessionCost = 0;
  private readonly warningThreshold = DEFAULTS.COST_WARNING_THRESHOLD ?? 1.00;

  trackCost(_model: string, usage: any): void {
    if (usage?.total_tokens) {
      this.sessionTokens += usage.total_tokens;
    }
    // Rough cost estimate (varies by model)
    const costPer1kTokens = 0.001; // $0.001 per 1k tokens (approximate)
    if (usage?.total_tokens) {
      this.sessionCost += (usage.total_tokens / 1000) * costPer1kTokens;
    }
    if (this.sessionCost >= this.warningThreshold) {
      console.warn(`[CostTracker] Session cost warning: $${this.sessionCost.toFixed(4)} (threshold: $${this.warningThreshold})`);
    }
    console.log(`[CostTracker] Session: ${this.sessionTokens} tokens, $${this.sessionCost.toFixed(4)}`);
  }

  getSessionStats() {
    return { tokens: this.sessionTokens, cost: this.sessionCost };
  }

  resetSession() {
    this.sessionTokens = 0;
    this.sessionCost = 0;
  }

  isOverLimit(): boolean {
    return this.sessionTokens >= (DEFAULTS.MAX_TOKENS_PER_SESSION ?? 100000);
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
class CostTrackerLegacy {
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
class TokenCounter {
  // Simple token counter - could be enhanced later
  countTokens(text: string): number {
    return Math.ceil(text.length / 4); // Rough estimate
  }
}

// ─── Dynamic System Prompt Builder (cached prefix + dynamic suffix) ────────
const DYNAMIC_ACTIONS_SUFFIX = `
## Available Actions
Each action must include "type" and "description". Actions that target elements need a "locator".

### Element Actions (require "locator")
- **click**: Click an element. Locator: { "strategy": "css"|"xpath"|"text"|"role"|"ariaLabel"|"id", "value": "..." }
- **fill**: Type into an input. Also needs "value" (text to type) and optionally "clearFirst" (default true).
- **select**: Select a dropdown option. Needs "value" (option text or value).
- **hover**: Hover over an element.
- **focus**: Focus an element.
- **extract**: Extract text from element. Optional: "multiple" (bool), "filter" (regex), "format" ("text"|"json"|"csv"), "attribute" (attr name).

### Navigation Actions
- **navigate**: Go to URL. Needs "url".
- **goBack**: Go back in browser history.
- **scroll**: Scroll the page. Optional: "direction" ("up"|"down"|"left"|"right"), "amount" (pixels, default 500), or "locator" to scroll to element.
- **wait**: Wait for page to settle.
- **pressKey**: Press a key. Needs "key" (e.g. "Enter", "Tab"). Optional: "modifiers" (["ctrl", "shift", "alt", "meta"]).

## Locator Strategy
Use the most reliable strategy. Preference order:
1. "id" — most stable
2. "ariaLabel" — accessibility labels
3. "role" — ARIA roles (button, link, textbox, etc.)
4. "text" — visible text content
5. "css" — CSS selector
6. "xpath" — last resort

## Response Format
Always respond with valid JSON:
{
  "thinking": "Your internal reasoning (optional)",
  "summary": "Brief user-facing explanation of what you're doing",
  "actions": [{ "type": "...", "description": "...", ... }],
  "needsScreenshot": false,
  "done": false,
  "askUser": "Question for user if you need input (optional)"
}

Set "done": true when the task is complete. Include a final "summary" explaining what was accomplished.
Set "askUser" to ask the user a clarifying question instead of executing actions.

### Tab Management
- **openTab**: Open a new tab. Needs "url". Optional: "active" (default true).
- **closeTab**: Close a tab. Optional: "tabId" (closes current if omitted).
- **switchTab**: Switch to another tab. Needs "tabId" or "urlPattern" (regex to find tab).
- **getTabs**: Get list of all open tabs.

### Macro/Workflow Actions
- **runMacro**: Execute a saved macro. Needs "macroId".
- **runWorkflow**: Execute a saved workflow. Needs "workflowId".

## Rules
1. Always examine the page context (URL, elements, body text) before acting.
2. Use at most 3 actions per response.
3. If an element is not found, try alternative locator strategies.
4. Never fill sensitive fields (passwords, SSNs) without user confirmation.
5. For search tasks, navigate to a search engine first.
6. Prefer "index" strategy for locators when an element index is available in the page context.
7. Use "text" strategy for buttons and links when their visible text is clear and unique.
8. Include "description" on every action explaining what it does in plain language.`;

function buildDynamicSystemPrompt(task: AgentTask): string {
  const basePrompt = `${CACHED_SYSTEM_PREFIX}${DYNAMIC_ACTIONS_SUFFIX}`;
  
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
function selectModelForTask(task: AgentTask): string {
  if (task.type === 'click' || task.type === 'type' || task.type === 'fill') {
    return MODEL_CASCADE.simple;
  }
  if (task.requiresReasoning || task.multiStep || task.complexity === 'complex') {
    return MODEL_CASCADE.complex;
  }
  return MODEL_CASCADE.standard;
}

function analyzeTaskComplexity(command: string, history: HistoryEntry[]): AgentTask {
  const commandLower = command.toLowerCase();
  const stepCount = history.filter(h => h?.role === 'assistant').length;
  
  const isSimple = /^(click|press|type|fill|scroll|select)\s/i.test(commandLower);
  const isComplex = /\b(analyze|compare|research|find all|extract|summarize|navigate|search|multi|complex)\b/i.test(commandLower);
  const multiStep = stepCount > 3 || /\b(and|then|after|next|also)\b/i.test(commandLower);
  
  let complexity: TaskComplexity = 'standard';
  if (isSimple && !multiStep) complexity = 'simple';
  if (isComplex || multiStep || stepCount > 5) complexity = 'complex';
  
  const actionMatch = /^(click|type|fill|scroll|navigate|extract|press|select|hover|focus)/.exec(commandLower);
  const actionType = actionMatch ? actionMatch[1] : 'unknown';
  
  return {
    type: actionType,
    description: command,
    requiresReasoning: isComplex,
    multiStep,
    complexity,
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

// ─── History Compression ───────────────────────────────────────────────────
function compressHistory(history: HistoryEntry[]): HistoryEntry[] {
  if (history.length <= 10) return history;
  
  const recent = history.slice(-5);
  const older = history.slice(0, -5);
  
  const actions = older
    .filter(m => m.role === 'assistant' && m.response?.actions)
    .flatMap(m => m.response?.actions?.map(a => a.type) || [])
    .filter(Boolean);
  
  const summaryEntry: HistoryEntry = {
    role: 'user',
    context: {
      url: 'summary',
      title: 'Compressed History',
      bodyText: `[Previous ${older.length} turns: ${actions.length} actions - ${actions.slice(0, 5).join(', ')}${actions.length > 5 ? '...' : ''}]`,
      metaDescription: '',
      formCount: 0,
      semanticElements: [],
      timestamp: Date.now(),
      scrollPosition: { x: 0, y: 0 },
      viewportSize: { width: 0, height: 0 },
      pageHeight: 0,
    },
  };
  
  return [summaryEntry, ...recent];
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

// ─── Build messages for the API ─────────────────────────────────────
function buildMessages(command: string, history: HistoryEntry[], context: PageContext): Message[] {
  const task = analyzeTaskComplexity(command, history);
  const systemPrompt = buildDynamicSystemPrompt(task);
  const messages: Message[] = [{ role: 'system', content: systemPrompt }];
  
  const contextManager = getContextManager();
  
  const compressedHistory = compressHistory(history);
  
  for (let i = 0; i < compressedHistory.length; i++) {
    const entry = compressedHistory[i];
    if (entry.role === 'user') {
      if (entry.userReply) {
        messages.push({
          role: 'user',
          content: `User replied: ${entry.userReply}`,
        });
        contextManager.addContextItem({
          type: 'result',
          content: `User replied: ${entry.userReply}`,
          timestamp: Date.now(),
          importance: 8,
        });
      } else if (entry.context) {
        const isOld = i < compressedHistory.length - 4;
        const ctx = isOld
          ? compactContext(entry.context)
          : (() => {
              const c = { ...entry.context };
              delete c.screenshotBase64;
              return c;
            })();
        const content = `Command: ${entry.command}\n\nPage context:\n${JSON.stringify(ctx, null, isOld ? 0 : 2)}`;
        messages.push({
          role: 'user',
          content,
        });
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
      contextManager.addContextItem({
        type: 'thought',
        content: resp.thinking || resp.summary,
        timestamp: Date.now(),
        importance: 6,
      });
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
        contextManager.addContextItem({
          type: hasErrors ? 'error' : 'result',
          content: resultsContent,
          timestamp: Date.now(),
          importance: hasErrors ? 9 : 5,
        });
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

    const model = settings.backupModel || DEFAULT_MODEL;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const resp = await fetch(`${settings.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${settings.apiKey}`,
            'HTTP-Referer': 'https://hyperagent.ai',
            'X-Title': 'HyperAgent',
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: reasoningPrompt }],
            temperature: 0.1,
            max_tokens: 1000,
          }),
          signal: AbortSignal.timeout(30000), // 30 second timeout for fallback
        });

        if (!resp?.ok) continue;

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

  constructor() {
    // Inject self into autonomous intelligence engine to break circular dependency
    autonomousIntelligence.setLLMClient(this);
  }

  async callLLM(request: LLMRequest, signal?: AbortSignal): Promise<LLMResponse> {
    // The standard agent loop uses the traditional API call directly.
    // This sends the command + page context to the LLM and gets back
    // structured actions. No extra planning round-trip needed.
    return await this.makeTraditionalCall(request, signal);
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
        return await this.makeTraditionalCall(request, signal);
      }

      return this.convertPlanToResponse(autonomousPlan);
    } catch (error) {
      if ((error as Error).name === 'AbortError') throw error;
      console.error('[HyperAgent] Autonomous planning failed, using direct call:', error);
      return await this.makeTraditionalCall(request, signal);
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

  async callCompletion(request: CompletionRequest, signal?: AbortSignal): Promise<string> {
    const settings = await loadSettings();
    if (!settings.apiKey) throw new Error('API Key not set');

    try {
      const safeMessages = sanitizeMessages(request.messages || []);

      const completionModel = settings.modelName || DEFAULT_MODEL;

      console.log(`[HyperAgent] Using completion model: ${completionModel}`);

      const response = await fetch(`${settings.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.apiKey}`,
          'HTTP-Referer': 'https://hyperagent.ai',
          'X-Title': 'HyperAgent',
        },
        body: JSON.stringify({
          model: completionModel,
          messages: safeMessages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? 1000,
        }),
        signal: signal || AbortSignal.timeout(60000),
      });

      if (!response?.ok) {
        const errorText = response ? await response.text() : '';
        console.error(`[HyperAgent] Completion error ${response?.status ?? 'unknown'}:`, errorText);
        if (response?.status === 429) {
          const retryAfter = response?.headers?.get('Retry-After');
          const waitSec = retryAfter ? Number.parseInt(retryAfter, 10) : 60;
          throw new Error(`Rate limit exceeded. Try again in ${waitSec} seconds.`);
        }
        const friendly = response ? userFriendlyApiError(response.status) : 'Request failed';
        throw new Error(friendly || `Completion request failed: ${response?.status ?? 'unknown'}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (error) {
      console.error('[HyperAgent] Completion failed:', error);
      throw error;
    }
  }

  private async makeTraditionalCall(
    request: LLMRequest,
    signal?: AbortSignal
  ): Promise<LLMResponse> {
    const settings = await loadSettings();
    return await this.makeAPICall(request, settings, signal);
  }

  private async makeAPICall(
    request: LLMRequest,
    settings: any,
    signal?: AbortSignal
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
        console.log('[HyperAgent] Ollama not available, falling back to OpenRouter:', ollamaError);
        // Fall through to OpenRouter
      }
    }

    // Proceed with OpenRouter API call
    const sanitizedCommand = inputSanitizer.sanitize(request.command || '', {
      maxLength: 10000,
      preserveWhitespace: true,
    });

    if (!sanitizedCommand.isValid) {
      console.warn('[HyperAgent] Input sanitization warnings:', sanitizedCommand.warnings);
    }

    const task = analyzeTaskComplexity(sanitizedCommand.sanitizedValue, request.history || []);
    const selectedModel = settings.modelName || selectModelForTask(task);
    
    const semanticCached = await semanticCache.get(sanitizedCommand.sanitizedValue, (text) => this.getEmbedding(text));
    if (semanticCached) {
      console.log('[HyperAgent] Using semantically cached response');
      return semanticCached.response;
    }

    const rawMessages = buildMessages(
      sanitizedCommand.sanitizedValue,
      request.history || [],
      request.context || this.createEmptyContext()
    );
    const messages = sanitizeMessages(rawMessages);

    const cacheKey = `llm_${selectedModel}_${this.hashMessages(messages)}`;
    const cachedResponse = await apiCache.get(cacheKey);
    if (cachedResponse) {
      console.log('[HyperAgent] Using cached LLM response');
      return cachedResponse;
    }

    console.log(`[HyperAgent] Using model: ${selectedModel} (complexity: ${task.complexity})`);

    const requestBody = {
      model: selectedModel,
      messages,
      temperature: task.complexity === 'complex' ? 0.5 : 0.7,
      max_tokens: task.complexity === 'complex' ? 4096 : 2048,
    };

    const retryResult = await retryManager.retry(
      async () => {
        const response = await fetch(`${settings.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${settings.apiKey}`,
            'HTTP-Referer': 'https://hyperagent.ai',
            'X-Title': 'HyperAgent',
          },
          body: JSON.stringify(requestBody),
          signal: signal || AbortSignal.timeout(DEFAULTS.LLM_TIMEOUT_MS ?? 45000),
        });

        if (!response?.ok) {
          const errorText = response ? await response.text() : '';
          console.error(`[HyperAgent] API error ${response?.status ?? 'unknown'}:`, errorText);
          if (response?.status === 429) {
            const retryAfter = response?.headers?.get('Retry-After');
            const waitSec = retryAfter ? Number.parseInt(retryAfter, 10) : 60;
            throw new Error(`Rate limit exceeded. Please try again in ${waitSec} seconds.`);
          }
          const friendly = response ? userFriendlyApiError(response.status) : 'Request failed';
          throw new Error(friendly || `API request failed: ${response?.status ?? 'unknown'}`);
        }

        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;

        if (!content) {
          throw new Error('No content in response');
        }

        const parsed = extractJSON(content);
        if (!parsed) {
          console.warn('[HyperAgent] Failed to parse JSON from response:', content.slice(0, 500));
          throw new Error('Failed to parse LLM response');
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
      'llm-api'
    );

    if (retryResult.success && retryResult.result) {
      await apiCache.set(cacheKey, retryResult.result, { ttl: 15 * 60 * 1000 });
      await semanticCache.set(sanitizedCommand.sanitizedValue, retryResult.result, (text) => this.getEmbedding(text));
      return retryResult.result;
    }

    const fallback = await buildIntelligentFallback(
      request.command || '',
      request.context || this.createEmptyContext(),
      {
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey,
      }
    );
    return (
      fallback || {
        thinking: 'Failed to get response after retries.',
        summary: 'I encountered an error after multiple attempts.',
        actions: [],
        done: true,
      }
    );
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
    return `You are HyperAgent, an autonomous browser agent with enhanced reasoning capabilities.

CORE CAPABILITIES:
- Observe DOM and understand page context
- Plan multi-step actions strategically  
- Execute precise element interactions
- Verify outcomes and adapt

AVAILABLE ACTIONS:
- click, fill, select, hover, focus, extract
- navigate, goBack, scroll, wait, pressKey
- openTab, closeTab, switchTab, getTabs
- runMacro, runWorkflow

RESPONSE FORMAT (JSON):
{
  "summary": "Brief explanation",
  "actions": [{"type": "...", "description": "...", ...}],
  "needsScreenshot": false,
  "done": false
}

USER COMMAND: ${request.command || 'No command'}
`;
  }

  async getEmbedding(text: string): Promise<number[]> {
    const settings = await loadSettings();
    if (!settings.apiKey) throw new Error('API Key not set');

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

      if (!response?.ok) {
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

  updateSettings(_newSettings: Partial<any>): void {
    // Update settings if needed
  }
}

export const llmClient = new EnhancedLLMClient();
