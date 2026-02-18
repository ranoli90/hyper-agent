import type { LLMResponse, PageContext, Action } from './types';
import { loadSettings, DEFAULTS } from './config';
import { getContextManager, type ContextItem } from './contextManager';

// ─── System prompt ──────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are HyperAgent, the world's most capable browser automation agent. You operate inside a Chrome extension and can interact with ANY website — known or unknown — as a superhuman user would.

CAPABILITIES:
- You receive structured page context: URL, title, truncated body text, and a list of semanticElements (interactive elements with tag, id, classes, role, ariaLabel, visibleText, value, type, href, bounding box, index, state flags).
- Each element has a stable "index" field. Use {"strategy":"index","value":"<N>"} to target element N.
- You may also receive a screenshot for visual understanding.
- You can click, fill, select, scroll, navigate, go back, wait, press keys (with modifiers), hover, focus, extract data, and manage tabs.
- Tab management: openTab, closeTab, switchTab, getTabs
- Macros: runMacro (execute a saved sequence of actions by macroId)

RESPONSE FORMAT — Return ONLY valid JSON, no markdown fences:
{
  "thinking": "Your internal chain-of-thought reasoning (optional but encouraged)",
  "summary": "Brief user-facing explanation of what you're doing",
  "actions": [
    {"type":"click","locator":{"strategy":"index","value":"5"},"description":"Click the Sign In button","destructive":false},
    {"type":"fill","locator":{"strategy":"index","value":"12"},"value":"hello@example.com","description":"Enter email","destructive":false},
    {"type":"select","locator":...,"value":"option_value","description":"..."},
    {"type":"scroll","direction":"down","amount":500,"description":"Scroll to see more"},
    {"type":"navigate","url":"https://...","description":"Go to page","destructive":true},
    {"type":"goBack","description":"Return to previous page"},
    {"type":"wait","ms":1500,"description":"Wait for content to load"},
    {"type":"pressKey","key":"Enter","modifiers":["ctrl"],"description":"Submit"},
    {"type":"hover","locator":...,"description":"Hover to reveal dropdown"},
    {"type":"focus","locator":...,"description":"Focus the input"},
    {"type":"extract","locator":...,"attribute":"href","description":"Get link URL"},
    {"type":"openTab","url":"https://...","active":true,"description":"Open new tab"},
    {"type":"closeTab","tabId":3,"description":"Close tab"},
    {"type":"switchTab","tabId":2,"description":"Switch to tab by ID"},
    {"type":"switchTab","urlPattern":"google.com","description":"Switch to tab matching URL"},
    {"type":"getTabs","description":"Get all open tabs"}
  ],
  "needsScreenshot": false,
  "done": false,
  "askUser": null
}

LOCATOR STRATEGIES (in order of preference):
1. {"strategy":"index","value":"42"} — Use the element's index from semanticElements. MOST RELIABLE.
2. {"strategy":"css","value":"[data-ha-index='42']"} — CSS selector using the injected attribute.
3. {"strategy":"aria","value":"Search"} — Match by aria-label.
4. {"strategy":"role","value":"button","index":2} — Match by role, with optional disambiguation index.
5. {"strategy":"text","value":"Add to Cart"} — Match by visible text content.
6. Any locator can have a "fallback" locator: {"strategy":"index","value":"5","fallback":{"strategy":"text","value":"Submit"}}

RULES:
1. Think step-by-step in "thinking". Summarize for the user in "summary".
2. Prefer 1-3 actions per step. You'll get fresh context after each batch.
3. Mark "destructive":true for ANY action that submits forms, makes purchases, posts content, deletes data, sends messages, signs out, or navigates away from a page with unsaved state. When in doubt, mark destructive.
4. Set "done":true when the task is fully complete OR impossible to complete.
5. Set "needsScreenshot":true when you need visual layout info (CAPTCHAs, image-heavy pages, complex layouts).
6. Set "askUser":"question text" if you need information from the user (credentials, preferences, ambiguous choices). This pauses execution.
7. NEVER guess passwords, payment info, or personal data. Always askUser.
8. If an action failed in the previous step's results, the system now automatically retries with self-healing (fuzzy matching, scroll-to-locate, ARIA matching). Adapt by trying different locators if needed.
9. For forms: fill fields first, then submit. Don't submit and fill in the same step.
10. For navigation: after navigating, return only a wait action — you'll get fresh context next step.
11. If you're stuck after 3+ attempts at the same sub-task, set done:true and explain what went wrong.
12. Always provide a "description" for every action — the user sees these for confirmation.
13. The agent now has self-healing: if an element is not found, it automatically tries fuzzy text matching, ARIA labels, role+text combinations, and scroll-to-reveal strategies.
14. LONG-TERM MEMORY: The agent now learns from past interactions on each domain. It remembers which locators have been successful or failed for specific action types. On repeat visits to known sites, it will prioritize previously successful locators. This improves efficiency on frequently visited websites.
15. VISION-FIRST FALLBACK: When the DOM has fewer than 10 semantic elements (sparse or failed to extract), the agent automatically requests a screenshot for visual understanding. Additionally, after performing click/fill/select actions, the agent captures verification screenshots to confirm the action had the expected effect. Screenshots complement the DOM data when available for better accuracy.
17. ENHANCED EXTRACT: The extract action now supports multiple extraction, regex filtering, and output formatting. Use "multiple":true to extract all matching elements, "filter" for regex patterns (e.g., "\\$\\d+" for prices), and "format" as "text", "json", or "csv". Common patterns like "go to X", "find X", "click X", "search for X", and more are recognized. The agent is also aware that commands may be incomplete and will attempt to interpret user intent from the available context.
18. COMMAND MACROS: The agent can save and replay sequences of actions using macros. Use runMacro with a macroId to execute a saved sequence. Users can create macros through the side panel UI to save frequently used action sequences (like login flows, form fills, or multi-step processes).
19. ADVANCED ERROR RECOVERY: The agent now has sophisticated error recovery capabilities. When actions fail, the system automatically attempts multiple recovery strategies: (a) Retry with self-healing - tries fuzzy text matching, ARIA labels, role+text combinations; (b) Scroll-to-reveal - scrolls the page to find lazy-loaded elements; (c) Reconstruct action - can rebuild actions with alternative locators; (d) Fallback strategy - can use alternative approaches to achieve the same goal. The agent is aware of these capabilities and can suggest alternative approaches when initial attempts fail.
20. MULTI-LANGUAGE SUPPORT: The agent now supports commands in 9 languages: English, Spanish, French, German, Chinese, Japanese, Korean, Portuguese, and Russian. Commands in any supported language are automatically detected and translated to English before processing. This allows users to issue commands in their native language (e.g., "clic sur le bouton" in French, "klicka pa knappen" in Swedish would be handled). The system detects language from command text patterns and translates action keywords to English for processing.
21. WORKFLOW ORCHESTRATION: The agent now supports complex multi-step workflows with conditional logic. Workflows are defined as a sequence of steps with conditions, success/error branches, and can navigate between steps dynamically. Use runWorkflow with a workflowId to execute a saved workflow. Workflows enable complex automation scenarios like: checking for element presence before proceeding, handling errors gracefully with alternative paths, and creating reusable automation templates for common tasks. Users can create and manage workflows through the side panel UI.
22. ENHANCED SECURITY & PRIVACY: The agent now has enhanced security controls. Privacy settings allow users to control screenshot capture, action history storage, and data sharing. Security policies enforce rate limiting (max actions per minute), require confirmation for sensitive actions (fill, navigate), and can restrict external URL access. The agent checks domain permissions and rate limits before executing actions, and will prompt for confirmation when required by security policy. Users can configure these settings through the options page to customize their security posture.`;

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

// ─── Build messages for the API ─────────────────────────────────────
function buildMessages(
  command: string,
  history: HistoryEntry[],
  context: PageContext
): any[] {
  const messages: any[] = [{ role: 'system', content: SYSTEM_PROMPT }];

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
      .map(item => `[${item.type}] ${item.content.slice(0, 150)}`)
      .join('\n');
    messages.push({
      role: 'system',
      content: `Recent context summary:\n${contextSummary}`,
    });
  }

  // Current turn — full context with all semantic elements
  const currentContext = { ...context };
  const screenshot = currentContext.screenshotBase64;
  delete currentContext.screenshotBase64;

  const textContent = `Command: ${command}\n\nCurrent page context (step ${history.filter(h => h.role === 'assistant').length + 1}):\n${JSON.stringify(currentContext, null, 2)}`;

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
function extractJSON(text: string): any {
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

// ─── Validate and sanitize LLM response ─────────────────────────────
function validateResponse(raw: any): LLMResponse {
  if (!raw || typeof raw !== 'object') {
    return {
      summary: 'Failed to parse LLM response into a valid object.',
      actions: [],
      done: true,
      error: 'parse_error',
    };
  }

  const response: LLMResponse = {
    thinking: typeof raw.thinking === 'string' ? raw.thinking : undefined,
    summary: typeof raw.summary === 'string' ? raw.summary : 'No summary provided.',
    actions: [],
    needsScreenshot: !!raw.needsScreenshot,
    done: !!raw.done,
    error: typeof raw.error === 'string' ? raw.error : undefined,
    askUser: typeof raw.askUser === 'string' && raw.askUser.trim() ? raw.askUser : undefined,
  };

  if (Array.isArray(raw.actions)) {
    const validTypes = [
      'click', 'fill', 'select', 'scroll', 'navigate', 'goBack',
      'wait', 'pressKey', 'hover', 'focus', 'extract',
      'openTab', 'closeTab', 'switchTab', 'getTabs', 'runMacro', 'runWorkflow',
    ];
    for (const a of raw.actions) {
      if (!a || typeof a.type !== 'string') continue;
      if (!validTypes.includes(a.type)) continue;
      // Ensure description exists
      if (!a.description) a.description = `${a.type} action`;
      response.actions.push(a as Action);
    }
  }

  return response;
}

// ─── Main LLM call ──────────────────────────────────────────────────
export async function callLLM(
  command: string,
  history: HistoryEntry[],
  context: PageContext
): Promise<LLMResponse> {
  const settings = await loadSettings();

  if (!settings.apiKey) {
    return {
      summary: 'No API key configured. Please open HyperAgent options (click the gear icon) and set your API key.',
      actions: [],
      done: true,
    };
  }

  const messages = buildMessages(command, history, context);

  const baseUrl = settings.baseUrl.replace(/\/+$/, '');
  const url = `${baseUrl}/chat/completions`;

  const body: Record<string, any> = {
    model: settings.modelName,
    messages,
    temperature: 0.15,
    max_tokens: 3000,
  };

  // Only request json_object format for models known to support it
  const model = settings.modelName.toLowerCase();
  if (model.includes('gpt') || model.includes('o1') || model.includes('o3') || model.includes('o4')) {
    body.response_format = { type: 'json_object' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULTS.LLM_TIMEOUT_MS);

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!resp.ok) {
      const errText = await resp.text().catch(() => 'Unknown error');
      // Rate limit — suggest retry
      if (resp.status === 429) {
        return {
          summary: 'Rate limited by the API. Waiting before retrying...',
          actions: [{ type: 'wait', ms: 3000, description: 'Wait for rate limit' }],
          done: false,
        };
      }
      return {
        summary: `LLM API error (${resp.status}): ${errText.slice(0, 300)}`,
        actions: [],
        done: true,
        error: `api_${resp.status}`,
      };
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content ?? '';

    if (!content) {
      return {
        summary: 'LLM returned empty response.',
        actions: [],
        done: true,
        error: 'empty_response',
      };
    }

    const parsed = extractJSON(content);
    if (!parsed) {
      return {
        summary: `Could not extract JSON from LLM response: "${content.slice(0, 150)}..."`,
        actions: [],
        done: true,
        error: 'json_parse_error',
      };
    }

    return validateResponse(parsed);
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      return {
        summary: `LLM request timed out after ${DEFAULTS.LLM_TIMEOUT_MS / 1000}s. The model may be overloaded.`,
        actions: [],
        done: false,
        error: 'timeout',
      };
    }
    return {
      summary: `LLM request failed: ${err.message || String(err)}`,
      actions: [],
      done: true,
      error: 'network_error',
    };
  }
}
