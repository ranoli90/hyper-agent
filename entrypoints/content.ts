/**
 * @fileoverview HyperAgent content script.
 * Injected into web pages. Handles DOM extraction, element resolution, and action execution.
 */

import { DEFAULTS } from '../shared/config';
import { saveActionOutcome } from '../shared/memory';
import { getSiteConfig } from '../shared/siteConfig';
import type {
  SemanticElement,
  PageContext,
  Action,
  Locator,
  ExtensionMessage,
  ActionResult,
  ErrorType,
  SiteConfig,
  ExtractAction,
  ErrorContext,
  RecoveryStrategy,
} from '../shared/types';
import { tiktokModerator } from '../shared/tiktok-moderator';
import { StealthEngine } from '../shared/stealth-engine';

// ─── Local security/perf helpers ───────────────────────────────────────
function isSafeRegex(pattern: string, maxLength = 256): boolean {
  if (typeof pattern !== 'string' || pattern.length === 0 || pattern.length > maxLength) return false;
  try { new RegExp(pattern); return true; } catch { return false; }
}

function safeKey(key: string, max = 32): string {
  const s = (key || '').slice(0, max);
  return /^[\w\-\s]+$/.test(s) ? s : 'Unidentified';
}

const allowedMessageTypes = new Set([
  'getContext', 'performAction', 'executeActionOnPage', 'captureScreenshot',
  'getSiteConfig', 'startModerator', 'stopModerator', 'updateModerationRules'
]);

function validateInboundMessage(msg: any): boolean {
  return !!msg && typeof msg === 'object' && typeof msg.type === 'string' && allowedMessageTypes.has(msg.type);
}

const messageRate = new Map<string, { count: number; reset: number }>();
function canAccept(kind: string, maxPerMinute = 240): boolean {
  const now = Date.now();
  const entry = messageRate.get(kind);
  if (!entry || now > entry.reset) {
    messageRate.set(kind, { count: 1, reset: now + 60000 });
    return true;
  }
  if (entry.count >= maxPerMinute) return false;
  entry.count++;
  return true;
}

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    // Apply stealth masks immediately
    StealthEngine.applyPropertyMasks();

    // ─── Element index registry (survives across getContext calls) ──
    const indexedElements = new Map<number, WeakRef<HTMLElement>>();
    let nextIndex = 0;

    // ─── Site-specific configuration ─────────────────────────────────
    let currentSiteConfig: SiteConfig | null = null;
    let siteConfigLoaded = false;

    // Load site config on page load
    async function loadSiteConfig() {
      if (siteConfigLoaded) return;
      try {
        const hostname = window.location.hostname;
        currentSiteConfig = await getSiteConfig(hostname);
        siteConfigLoaded = true;
        if (currentSiteConfig) {
          console.log('[HyperAgent] Site config loaded:', currentSiteConfig.domain);
        }
      } catch (err) {
        console.error('[HyperAgent] Failed to load site config:', err);
      }
    }

    // Load config immediately
    loadSiteConfig();

    // ─── Visibility check ─────────────────────────────────────────
    function isVisible(el: HTMLElement): boolean {
      if (!el.offsetParent && el.tagName !== 'HTML' && el.tagName !== 'BODY') {
        // Fixed/sticky elements have null offsetParent but are visible
        const style = window.getComputedStyle(el);
        if (style.position !== 'fixed' && style.position !== 'sticky') return false;
      }
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return false;
      return true;
    }

    // ─── Page context collection ──────────────────────────────────
    function getPageContext(): PageContext {
      const bodyText = (document.body?.innerText ?? '').slice(0, DEFAULTS.BODY_TEXT_LIMIT);

      // Meta description
      const metaDesc = document.querySelector('meta[name="description"]');
      const metaDescription = metaDesc?.getAttribute('content')?.slice(0, 300) || '';

      // Form count
      const formCount = document.querySelectorAll('form').length;

      let semanticElements: SemanticElement[] = [];

      try {
        const selectors = [
          'a[href]', 'button', 'input', 'textarea', 'select', 'label',
          '[role="button"]', '[role="link"]', '[role="tab"]', '[role="menuitem"]',
          '[role="checkbox"]', '[role="radio"]', '[role="switch"]', '[role="slider"]',
          '[role="combobox"]', '[role="listbox"]', '[role="option"]', '[role="searchbox"]',
          '[role="textbox"]', '[role="dialog"]', '[role="alert"]', '[role="navigation"]',
          '[aria-label]', '[data-testid]', '[onclick]', '[contenteditable="true"]',
          'summary', 'details', '[tabindex]:not([tabindex="-1"])',
          'h1', 'h2', 'h3',
          'img[alt]', 'video', 'audio',
        ];

        // Add site-specific custom selectors if available
        if (currentSiteConfig?.customSelectors && currentSiteConfig.customSelectors.length > 0) {
          selectors.push(...currentSiteConfig.customSelectors);
        }

        const seen = new Set<HTMLElement>();
        const allElements: HTMLElement[] = [];

        try {
          document.querySelectorAll(selectors.join(',')).forEach((el) => {
            const htmlEl = el as HTMLElement;
            if (!seen.has(htmlEl)) {
              seen.add(htmlEl);
              allElements.push(htmlEl);
            }
          });
        } catch (selectorErr) {
          console.warn('[HyperAgent] Selector error, falling back to basic selectors:', selectorErr);
          // Fallback: just get buttons and inputs
          document.querySelectorAll('button, input, a[href]').forEach((el) => {
            const htmlEl = el as HTMLElement;
            if (!seen.has(htmlEl)) {
              seen.add(htmlEl);
              allElements.push(htmlEl);
            }
          });
        }

        const limit = DEFAULTS.MAX_SEMANTIC_ELEMENTS;

        // Reset index registry for fresh context
        indexedElements.clear();
        nextIndex = 0;

        for (const htmlEl of allElements) {
          if (nextIndex >= limit) break;
          if (!isVisible(htmlEl)) continue;

          const idx = nextIndex++;
          htmlEl.setAttribute('data-ha-index', String(idx));
          indexedElements.set(idx, new WeakRef(htmlEl));

          const rect = htmlEl.getBoundingClientRect();
          const visibleText = getDirectText(htmlEl).slice(0, 150);
          const inputEl = htmlEl as HTMLInputElement;

          semanticElements.push({
            tag: htmlEl.tagName.toLowerCase(),
            id: htmlEl.id || '',
            classes: typeof htmlEl.className === 'string' ? htmlEl.className.slice(0, 120) : '',
            role: htmlEl.getAttribute('role') || '',
            ariaLabel: htmlEl.getAttribute('aria-label') || '',
            ariaDescribedBy: htmlEl.getAttribute('aria-describedby') || '',
            placeholder: htmlEl.getAttribute('placeholder') || '',
            name: htmlEl.getAttribute('name') || '',
            visibleText,
            value: (inputEl.value ?? '').slice(0, 100),
            type: inputEl.type || '',
            href: (htmlEl as HTMLAnchorElement).href || '',
            isDisabled: inputEl.disabled === true || htmlEl.getAttribute('aria-disabled') === 'true',
            isChecked: inputEl.checked === true || htmlEl.getAttribute('aria-checked') === 'true',
            isRequired: inputEl.required === true || htmlEl.getAttribute('aria-required') === 'true',
            isEditable: htmlEl.isContentEditable || ['input', 'textarea', 'select'].includes(htmlEl.tagName.toLowerCase()),
            boundingBox: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            },
            index: idx,
            parentTag: htmlEl.parentElement?.tagName.toLowerCase() || '',
            childCount: htmlEl.children.length,
          });
        }
      } catch (err) {
        console.warn('[HyperAgent] Error extracting semantic elements:', err);
        // Return empty semantic elements on error, will trigger vision fallback
        semanticElements = [];
      }

      return {
        url: window.location.href,
        title: document.title,
        bodyText,
        metaDescription,
        formCount,
        semanticElements,
        timestamp: Date.now(),
        scrollPosition: { x: window.scrollX, y: window.scrollY },
        viewportSize: { width: window.innerWidth, height: window.innerHeight },
        pageHeight: document.documentElement.scrollHeight,
        // Vision-first fallback: if too few semantic elements, flag for screenshot
        needsScreenshot: semanticElements.length < DEFAULTS.VISION_FALLBACK_THRESHOLD,
      };
    }

    // ─── Get direct text (not deeply nested children) ─────────────
    function getDirectText(el: HTMLElement): string {
      // For inputs, return placeholder or value
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        return (el as HTMLInputElement).placeholder || (el as HTMLInputElement).value || '';
      }
      // For short elements, return innerText
      const text = (el.innerText || el.textContent || '').trim();
      if (text.length <= 150) return text;
      // For long elements, get only direct text nodes
      let direct = '';
      for (const child of el.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          direct += child.textContent || '';
        }
      }
      return direct.trim() || text.slice(0, 150);
    }

    // ─── Locator resolution with fallback chain ───────────────────
    function resolveLocator(locator: Locator): HTMLElement | null {
      const el = resolveLocatorSingle(locator);
      if (el) return el;

      // Try fallback if present
      if (typeof locator === 'object' && locator.fallback) {
        return resolveLocator(locator.fallback);
      }

      return null;
    }

    function resolveLocatorSingle(locator: Locator): HTMLElement | null {
      // String locator — try CSS, then text
      if (typeof locator === 'string') {
        try {
          const el = document.querySelector(locator);
          if (el && isVisible(el as HTMLElement)) return el as HTMLElement;
        } catch { /* not valid CSS */ }
        return findByText(locator);
      }

      const { strategy, value, index } = locator;

      switch (strategy) {
        case 'index': {
          // Resolve by our stable index
          const idx = parseInt(value, 10);
          // First try the WeakRef registry
          const ref = indexedElements.get(idx);
          if (ref) {
            const el = ref.deref();
            if (el && el.isConnected) return el;
          }
          // Fallback to data attribute
          const el = document.querySelector(`[data-ha-index="${idx}"]`);
          return el as HTMLElement | null;
        }
        case 'css': {
          try {
            if (index !== undefined) {
              const all = document.querySelectorAll(value);
              if (all[index] && isVisible(all[index] as HTMLElement)) return all[index] as HTMLElement;
            }
            const el = document.querySelector(value);
            if (el && isVisible(el as HTMLElement)) return el as HTMLElement;
            return el as HTMLElement | null;
          } catch {
            return null;
          }
        }
        case 'text': {
          return findByText(value, index);
        }
        case 'aria': {
          // Try exact match first, then partial
          const exact = document.querySelectorAll(`[aria-label="${CSS.escape(value)}"]`);
          if (exact.length > 0) return (exact[index ?? 0] as HTMLElement) || null;
          // Partial match
          const all = document.querySelectorAll('[aria-label]');
          const lower = value.toLowerCase();
          const matches: HTMLElement[] = [];
          all.forEach((el) => {
            const label = el.getAttribute('aria-label')?.toLowerCase() || '';
            if (label.includes(lower)) matches.push(el as HTMLElement);
          });
          return matches[index ?? 0] || null;
        }
        case 'role': {
          const all = document.querySelectorAll(`[role="${CSS.escape(value)}"]`);
          const visible = Array.from(all).filter((el) => isVisible(el as HTMLElement));
          return (visible[index ?? 0] as HTMLElement) || null;
        }
        case 'xpath': {
          try {
            const result = document.evaluate(value, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            return result.singleNodeValue as HTMLElement | null;
          } catch {
            return null;
          }
        }
        case 'ariaLabel':
          // Alias for "aria" — LLM prompt may use ariaLabel
          return resolveLocatorSingle({ strategy: 'aria', value, index });
        case 'id': {
          const el = document.getElementById(value);
          return el && isVisible(el) ? el : null;
        }
        default:
          return null;
      }
    }

    function findByText(text: string, index?: number): HTMLElement | null {
      const lower = text.toLowerCase().trim();
      if (!lower) return null;

      const candidates: { el: HTMLElement; score: number }[] = [];
      const interactiveSelectors = 'a, button, input, textarea, select, label, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [tabindex], summary, h1, h2, h3, [contenteditable]';

      document.querySelectorAll(interactiveSelectors).forEach((el) => {
        const htmlEl = el as HTMLElement;
        if (!isVisible(htmlEl)) return;
        const elText = (htmlEl.innerText || htmlEl.textContent || '').trim().toLowerCase();
        if (!elText) return;

        // Exact match
        if (elText === lower) {
          candidates.push({ el: htmlEl, score: 100 });
        }
        // Element text contains search text
        else if (elText.includes(lower)) {
          candidates.push({ el: htmlEl, score: 80 - Math.abs(elText.length - lower.length) });
        }
        // Search text contains element text (for short button labels)
        else if (lower.includes(elText) && elText.length > 2) {
          candidates.push({ el: htmlEl, score: 60 });
        }
      });

      // Sort by score descending
      candidates.sort((a, b) => b.score - a.score);

      if (candidates.length === 0) {
        // Broader tree walk for non-interactive elements
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
        let node: Node | null;
        while ((node = walker.nextNode())) {
          const htmlEl = node as HTMLElement;
          if (!isVisible(htmlEl)) continue;
          const elText = (htmlEl.innerText || htmlEl.textContent || '').trim().toLowerCase();
          if (elText === lower) {
            candidates.push({ el: htmlEl, score: 50 });
            if (candidates.length > 10) break;
          }
        }
      }

      return candidates[index ?? 0]?.el || null;
    }

    // ─── Smart Element Re-location (Self-Healing) ───────────────────────-
    function smartRelocate(originalLocator: Locator, action: Action): HTMLElement | null {
      let searchText = '';
      let targetRole = '';

      if (typeof originalLocator === 'object') {
        searchText = originalLocator.value || '';
        if (originalLocator.strategy === 'role') targetRole = searchText;
      } else if (typeof originalLocator === 'string') {
        searchText = originalLocator;
      }

      const desc = ((action as any).description || '').toLowerCase();
      const actionKeywords = extractKeywords(desc);

      // Try fuzzy text match
      if (searchText.length >= 2) {
        const fuzzyMatch = findByFuzzyText(searchText);
        if (fuzzyMatch) return fuzzyMatch;
      }

      // Try ARIA label match
      if (searchText.length >= 2) {
        const ariaMatch = findByAriaLabel(searchText);
        if (ariaMatch) return ariaMatch;
      }

      // Try role + text
      if (targetRole || actionKeywords.role) {
        const roleMatch = findByRoleAndText(targetRole || actionKeywords.role || 'button', searchText || actionKeywords.text || '');
        if (roleMatch) return roleMatch;
      }

      return null;
    }

    function extractKeywords(desc: string): { text?: string; role?: string; action?: string } {
      const result: { text?: string; role?: string; action?: string } = {};
      const lower = desc.toLowerCase();
      const actionWords = ['click', 'press', 'submit', 'fill', 'select', 'search', 'go', 'open', 'delete', 'add'];
      const roleWords = ['button', 'link', 'input', 'checkbox', 'radio', 'menu', 'tab', 'search', 'dialog'];

      for (const aw of actionWords) { if (lower.includes(aw)) { result.action = aw; break; } }
      for (const rw of roleWords) { if (lower.includes(rw)) { result.role = rw; break; } }

      const words = lower.split(/\s+/);
      const actionIdx = words.findIndex(w => actionWords.includes(w));
      if (actionIdx >= 0 && actionIdx < words.length - 1) {
        result.text = words.slice(actionIdx + 1, actionIdx + 4).join(' ').replace(/[^\w\s]/g, '').trim();
      }
      return result;
    }

    function findByFuzzyText(searchText: string): HTMLElement | null {
      const lower = searchText.toLowerCase().trim();
      if (!lower || lower.length < 2) return null;

      const candidates: { el: HTMLElement; score: number }[] = [];
      const interactiveSelectors = 'a[href], button, input, textarea, select, label, [role="button"], [role="link"], [tabindex], summary';

      document.querySelectorAll(interactiveSelectors).forEach((el) => {
        const htmlEl = el as HTMLElement;
        if (!isVisible(htmlEl)) return;
        const elText = (htmlEl.innerText || htmlEl.textContent || '').trim().toLowerCase();
        if (!elText || elText.length < 2) return;

        let score = 0;
        if (elText === lower) score = 100;
        else if (elText.includes(lower)) score = 90 - Math.abs(elText.length - lower.length);
        else if (lower.includes(elText) && elText.length > 2) score = 70;
        else if (Math.abs(elText.length - lower.length) <= 3) {
          const common = [...elText].filter(c => lower.includes(c)).length;
          const sim = common / Math.max(elText.length, lower.length);
          if (sim > 0.5) score = 50 * sim;
        }
        if (score > 30) candidates.push({ el: htmlEl, score });
      });

      candidates.sort((a, b) => b.score - a.score);
      return candidates[0]?.el || null;
    }

    function findByAriaLabel(searchText: string): HTMLElement | null {
      const lower = searchText.toLowerCase().trim();
      if (!lower) return null;

      const all = document.querySelectorAll('[aria-label]');
      const matches: { el: HTMLElement; score: number }[] = [];

      all.forEach((el) => {
        const htmlEl = el as HTMLElement;
        if (!isVisible(htmlEl)) return;
        const label = htmlEl.getAttribute('aria-label')?.toLowerCase() || '';
        if (!label) return;

        let score = 0;
        if (label === lower) score = 100;
        else if (label.includes(lower)) score = 80;
        else if (lower.includes(label) && label.length > 2) score = 60;
        if (score > 0) matches.push({ el: htmlEl, score });
      });

      matches.sort((a, b) => b.score - a.score);
      return matches[0]?.el || null;
    }

    function findByRoleAndText(role: string, text: string): HTMLElement | null {
      if (!role) return null;
      const all = document.querySelectorAll(`[role="${CSS.escape(role)}"], ${role}`);
      const lower = text.toLowerCase().trim();
      const matches: { el: HTMLElement; score: number }[] = [];

      all.forEach((el) => {
        const htmlEl = el as HTMLElement;
        if (!isVisible(htmlEl)) return;
        const elText = (htmlEl.innerText || htmlEl.textContent || '').trim().toLowerCase();
        let score = 0;
        if (!lower) score = 50;
        else if (elText === lower) score = 100;
        else if (elText.includes(lower)) score = 80;
        else if (lower.includes(elText) && elText.length > 2) score = 60;
        if (score > 0) matches.push({ el: htmlEl, score });
      });

      matches.sort((a, b) => b.score - a.score);
      return matches[0]?.el || null;
    }

    // ─── Scroll-Before-Locate Strategy ─────────────────────────────────
    async function scrollBeforeLocate(locator: Locator, action: Action): Promise<HTMLElement | null> {
      const maxRetries = 3;
      const scrollAmount = 400;

      let el = resolveLocator(locator);
      if (el) return el;

      for (let i = 0; i < maxRetries; i++) {
        window.scrollBy({ top: scrollAmount, behavior: 'smooth' });
        await delay(600);
        refreshElementIndices();
        el = resolveLocator(locator);
        if (el) return el;
      }

      for (let i = 0; i < maxRetries; i++) {
        window.scrollBy({ top: -scrollAmount, behavior: 'smooth' });
        await delay(600);
        refreshElementIndices();
        el = resolveLocator(locator);
        if (el) return el;
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
      await delay(1500);
      refreshElementIndices();
      return resolveLocator(locator);
    }

    function refreshElementIndices() {
      const selectors = ['a[href]', 'button', 'input', 'textarea', 'select', 'label', '[role]', '[aria-label]', '[data-testid]', '[onclick]', '[contenteditable]', 'summary', 'details', '[tabindex]', 'h1', 'h2', 'h3', 'img[alt]'];
      indexedElements.clear();
      nextIndex = 0;
      document.querySelectorAll(selectors.join(',')).forEach((el) => {
        const htmlEl = el as HTMLElement;
        if (nextIndex >= 250) return;
        if (!isVisible(htmlEl)) return;
        const idx = nextIndex++;
        htmlEl.setAttribute('data-ha-index', String(idx));
        indexedElements.set(idx, new WeakRef(htmlEl));
      });
    }

    // ─── DOM Stability Wait ────────────────────────────────────────────
    async function waitForDomStable(): Promise<boolean> {
      for (let i = 0; i < 3; i++) {
        await delay(200);
      }
      return true;
    }

    async function waitForEnabled(el: HTMLElement, timeout = 5000): Promise<boolean> {
      const inputEl = el as HTMLInputElement;
      const start = Date.now();
      while (Date.now() - start < timeout) {
        if (!inputEl.disabled && el.getAttribute('aria-disabled') !== 'true') return true;
        await delay(200);
      }
      return false;
    }

    // ─── Advanced Error Recovery Functions ─────────────────────────────

    // Define default recovery strategies
    const DEFAULT_RECOVERY_STRATEGIES: RecoveryStrategy[] = [
      {
        name: 'element-not-found-retry',
        errorTypes: ['ELEMENT_NOT_FOUND'],
        maxRetries: 3,
        strategy: 'retry',
      },
      {
        name: 'element-not-visible-scroll',
        errorTypes: ['ELEMENT_NOT_VISIBLE'],
        maxRetries: 2,
        strategy: 'retry',
      },
      {
        name: 'element-disabled-wait',
        errorTypes: ['ELEMENT_DISABLED'],
        maxRetries: 2,
        strategy: 'retry',
      },
      {
        name: 'action-failed-reconstruct',
        errorTypes: ['ACTION_FAILED', 'TIMEOUT'],
        maxRetries: 2,
        strategy: 'reconstruct',
      },
      {
        name: 'navigation-error-skip',
        errorTypes: ['NAVIGATION_ERROR'],
        maxRetries: 1,
        strategy: 'skip',
      },
    ];

    // Track active recovery strategies per action
    const activeRecoveryAttempts = new Map<string, number>();

    /**
     * Attempt to recover from an error using configured strategies
     */
    async function recoverFromError(context: ErrorContext): Promise<Action | null> {
      const { error, action, attempt, pageUrl } = context;

      // Find applicable strategy
      const strategy = DEFAULT_RECOVERY_STRATEGIES.find(s =>
        s.errorTypes.includes(error)
      );

      if (!strategy) {
        console.log(`[HyperAgent] No recovery strategy for error type: ${error}`);
        return null;
      }

      // Check if we've exceeded max retries
      const actionKey = `${action.type}-${JSON.stringify(action).slice(0, 50)}`;
      const currentAttempts = activeRecoveryAttempts.get(actionKey) || 0;

      if (currentAttempts >= strategy.maxRetries) {
        console.log(`[HyperAgent] Max retries exceeded for strategy: ${strategy.name}`);
        activeRecoveryAttempts.delete(actionKey);
        return null;
      }

      console.log(`[HyperAgent] Applying recovery strategy: ${strategy.name}, attempt ${currentAttempts + 1}`);

      switch (strategy.strategy) {
        case 'retry':
          // Simple retry - will re-attempt the action
          activeRecoveryAttempts.set(actionKey, currentAttempts + 1);
          return action;

        case 'reconstruct':
          // Try to reconstruct the action with alternative locator
          const reconstructed = reconstructAction(action, error);
          if (reconstructed) {
            activeRecoveryAttempts.set(actionKey, currentAttempts + 1);
            return reconstructed;
          }
          return null;

        case 'fallback':
          // Use predefined fallback action
          if (strategy.fallback) {
            activeRecoveryAttempts.set(actionKey, currentAttempts + 1);
            return strategy.fallback;
          }
          return null;

        case 'skip':
          // Skip this action entirely
          console.log(`[HyperAgent] Skipping action due to: ${error}`);
          activeRecoveryAttempts.delete(actionKey);
          return null;

        default:
          return null;
      }
    }

    /**
     * Reconstruct an action with alternative locator strategies
     */
    function reconstructAction(action: Action, error: ErrorType): Action | null {
      // Only reconstruct actions that have locators
      if (!('locator' in action)) {
        return null;
      }

      const locator = (action as any).locator;

      // Try to find element using smart relocation
      const newElement = smartRelocate(locator, action);

      if (newElement) {
        // Get the new element's index
        const newIndex = newElement.getAttribute('data-ha-index');

        if (newIndex) {
          // Reconstruct with new index-based locator
          const newAction = { ...action } as Action;
          (newAction as any).locator = { strategy: 'index', value: newIndex };
          (newAction as any).description = `(recovered) ${(action as any).description || ''}`;
          return newAction;
        }
      }

      // If smart relocation failed, try scroll-based approach
      if (error === 'ELEMENT_NOT_FOUND' || error === 'ELEMENT_NOT_VISIBLE') {
        // Return a scroll action to try finding the element
        const scrollAction: Action = {
          type: 'scroll',
          direction: 'down',
          amount: 400,
          description: 'Scroll to find element after recovery',
        };
        return scrollAction;
      }

      return null;
    }

    /**
     * Apply recovery strategies - called to initialize/reset recovery tracking
     */
    function applyRecoveryStrategies(): void {
      // Clear old recovery attempts
      activeRecoveryAttempts.clear();
      console.log('[HyperAgent] Recovery strategies initialized');
    }

    function delay(ms: number): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    // ─── Simulate realistic mouse events ──────────────────────────
    async function simulateClick(el: HTMLElement, doubleClick = false): Promise<void> {
      await StealthEngine.clickStealthily(el);

      if (doubleClick) {
        await delay(100 + Math.random() * 100);
        await StealthEngine.clickStealthily(el);
      }
    }

    // ─── Simulate realistic typing ────────────────────────────────
    async function simulateTyping(el: HTMLElement, value: string, clearFirst = true): Promise<void> {
      const inputEl = el as HTMLInputElement | HTMLTextAreaElement;

      if (clearFirst) {
        inputEl.value = '';
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        await delay(Math.random() * 200 + 100);
      }

      await StealthEngine.typeStealthily(inputEl, value);
    }

    // ─── Action execution with Self-Healing ─────────────────────────
    async function performAction(action: Action): Promise<ActionResult> {
      try {
        switch (action.type) {
          case 'click': {
            // Try primary locator first
            let el = resolveLocator(action.locator);

            // Self-healing: try scroll-before-locate for lazy content
            if (!el) {
              el = await scrollBeforeLocate(action.locator, action);
            }

            // Self-healing: try smart re-location
            if (!el) {
              el = smartRelocate(action.locator, action);
            }

            if (!el) {
              return { success: false, error: `Element not found: ${JSON.stringify(action.locator)}`, errorType: 'ELEMENT_NOT_FOUND' };
            }

            // Check if element is visible
            if (!isVisible(el)) {
              return { success: false, error: 'Element found but not visible', errorType: 'ELEMENT_NOT_VISIBLE' };
            }

            // Check if disabled
            const inputEl = el as HTMLInputElement;
            if (inputEl.disabled || el.getAttribute('aria-disabled') === 'true') {
              // Wait for enabled
              const enabled = await waitForEnabled(el, 3000);
              if (!enabled) {
                return { success: false, error: 'Element is disabled', errorType: 'ELEMENT_DISABLED' };
              }
            }

            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await delay(300 + Math.random() * 300);
            await simulateClick(el, action.doubleClick);

            // Wait for DOM to stabilize after click (SPA transitions)
            await waitForDomStable();

            return { success: true, recovered: !!el };
          }

          case 'fill': {
            let el = resolveLocator(action.locator);

            if (!el) {
              el = await scrollBeforeLocate(action.locator, action);
            }

            if (!el) {
              el = smartRelocate(action.locator, action);
            }

            if (!el) {
              return { success: false, error: `Element not found: ${JSON.stringify(action.locator)}`, errorType: 'ELEMENT_NOT_FOUND' };
            }

            if (!isVisible(el)) {
              return { success: false, error: 'Element not visible', errorType: 'ELEMENT_NOT_VISIBLE' };
            }

            el.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // Handle contenteditable elements
            if (el.isContentEditable) {
              el.focus();
              if (action.clearFirst !== false) el.textContent = '';
              el.textContent = action.value;
              el.dispatchEvent(new Event('input', { bubbles: true }));
              return { success: true };
            }

            await simulateTyping(el, action.value, action.clearFirst !== false);
            return { success: true };
          }

          case 'select': {
            let el = resolveLocator(action.locator) as HTMLSelectElement | null;

            if (!el) {
              const relocEl = await scrollBeforeLocate(action.locator, action);
              el = relocEl as HTMLSelectElement | null;
            }

            if (!el) {
              const relocEl = smartRelocate(action.locator, action);
              el = relocEl as HTMLSelectElement | null;
            }

            if (!el) return { success: false, error: `Select element not found`, errorType: 'ELEMENT_NOT_FOUND' };
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // Try by value first, then by text
            let found = false;
            for (const opt of Array.from(el.options)) {
              if (opt.value === action.value || opt.textContent?.trim() === action.value) {
                el.value = opt.value;
                found = true;
                break;
              }
            }
            if (!found) {
              for (const opt of Array.from(el.options)) {
                if (opt.textContent?.toLowerCase().includes(action.value.toLowerCase())) {
                  el.value = opt.value;
                  found = true;
                  break;
                }
              }
            }
            if (!found) return { success: false, error: `Option "${action.value}" not found in select`, errorType: 'ACTION_FAILED' };

            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('input', { bubbles: true }));
            return { success: true };
          }

          case 'scroll': {
            const amount = action.amount ?? 500;
            if (action.locator) {
              const el = resolveLocator(action.locator);
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return { success: true };
              }
            }
            const scrollOpts: ScrollToOptions = { behavior: 'smooth' };
            if (action.direction === 'down') scrollOpts.top = amount;
            else if (action.direction === 'up') scrollOpts.top = -amount;
            else if (action.direction === 'right') scrollOpts.left = amount;
            else if (action.direction === 'left') scrollOpts.left = -amount;
            window.scrollBy(scrollOpts);
            return { success: true };
          }

          case 'navigate': {
            window.location.href = action.url;
            return { success: true };
          }

          case 'goBack': {
            window.history.back();
            return { success: true };
          }

          case 'wait': {
            return { success: true };
          }

          case 'pressKey': {
            const activeEl = document.activeElement || document.body;
            const mods = action.modifiers || [];
            const keyInit: KeyboardEventInit = {
              key: safeKey(action.key),
              bubbles: true,
              cancelable: true,
              ctrlKey: mods.includes('ctrl'),
              shiftKey: mods.includes('shift'),
              altKey: mods.includes('alt'),
              metaKey: mods.includes('meta'),
            };
            activeEl.dispatchEvent(new KeyboardEvent('keydown', keyInit));
            activeEl.dispatchEvent(new KeyboardEvent('keypress', keyInit));
            activeEl.dispatchEvent(new KeyboardEvent('keyup', keyInit));

            if (action.key === 'Enter') {
              const form = (activeEl as HTMLElement).closest?.('form');
              if (form) {
                form.requestSubmit?.();
                form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
              }
            }
            return { success: true };
          }

          case 'hover': {
            let el = resolveLocator(action.locator);
            if (!el) {
              el = await scrollBeforeLocate(action.locator, action);
            }
            if (!el) {
              el = smartRelocate(action.locator, action);
            }
            if (!el) return { success: false, error: `Element not found for hover`, errorType: 'ELEMENT_NOT_FOUND' };
            if (!isVisible(el)) return { success: false, error: 'Element not visible', errorType: 'ELEMENT_NOT_VISIBLE' };
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const rect = el.getBoundingClientRect();
            const eventInit: MouseEventInit = {
              bubbles: true, cancelable: true, view: window,
              clientX: rect.left + rect.width / 2,
              clientY: rect.top + rect.height / 2,
            };
            el.dispatchEvent(new MouseEvent('pointerover', eventInit));
            el.dispatchEvent(new MouseEvent('mouseover', eventInit));
            el.dispatchEvent(new MouseEvent('pointerenter', eventInit));
            el.dispatchEvent(new MouseEvent('mouseenter', eventInit));
            el.dispatchEvent(new MouseEvent('pointermove', eventInit));
            el.dispatchEvent(new MouseEvent('mousemove', eventInit));
            return { success: true };
          }

          case 'focus': {
            let el = resolveLocator(action.locator);
            if (!el) {
              el = await scrollBeforeLocate(action.locator, action);
            }
            if (!el) {
              el = smartRelocate(action.locator, action);
            }
            if (!el) return { success: false, error: `Element not found for focus`, errorType: 'ELEMENT_NOT_FOUND' };
            if (!isVisible(el)) return { success: false, error: 'Element not visible', errorType: 'ELEMENT_NOT_VISIBLE' };
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.focus();
            el.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
            el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
            return { success: true };
          }

          case 'extract': {
            // Enhanced extract: supports multiple, filtering, and formatting
            const extractAction = action as ExtractAction;
            const { multiple, filter, format, attribute } = extractAction;

            // Helper to apply filter regex to extracted data
            const applyFilter = (data: string): string => {
              if (!filter) return data;
              if (!isSafeRegex(filter)) return data; // Unsafe/invalid pattern ignored
              try {
                const regex = new RegExp(filter, 'gi');
                const matches = data.match(regex);
                return matches ? matches.join('\n') : '';
              } catch {
                return data; // Invalid regex, return raw data
              }
            };

            // Helper to extract from a single element
            const extractFromElement = (el: HTMLElement): string => {
              let data: string;
              if (attribute) {
                data = el.getAttribute(attribute) || '';
              } else {
                data = (el.innerText || el.textContent || '').trim();
              }
              return applyFilter(data);
            };

            // Helper to find sibling elements for structured extraction (tables, lists)
            const findSiblingElements = (el: Element): Element[] => {
              const siblings: Element[] = [];
              const parent = el.parentElement;
              if (!parent) return siblings;

              // Check if it's a table row
              if (el.tagName === 'TR') {
                const cells = parent.querySelectorAll('tr');
                cells.forEach(row => siblings.push(row));
              } else {
                // For lists and other containers
                const children = parent.children;
                for (let i = 0; i < children.length; i++) {
                  siblings.push(children[i]);
                }
              }
              return siblings;
            };

            let el = resolveLocator(action.locator);
            if (!el) {
              el = await scrollBeforeLocate(action.locator, action);
            }
            if (!el) {
              el = smartRelocate(action.locator, action);
            }
            if (!el) return { success: false, error: `Element not found for extract`, errorType: 'ELEMENT_NOT_FOUND' };

            let extractedData: string;

            if (multiple) {
              // Multiple extraction: find similar elements or children
              const elements: Element[] = [];

              // Try to find children of the same type
              const childSelector = el.tagName.toLowerCase();
              const children = el.querySelectorAll(childSelector);

              if (children.length > 1) {
                // Has multiple children of same type (list items, table rows)
                children.forEach(child => elements.push(child));
              } else {
                // Look for siblings with similar structure
                const siblings = findSiblingElements(el);
                if (siblings.length > 1) {
                  siblings.forEach(sib => elements.push(sib));
                } else {
                  // Fallback: just use the single element
                  elements.push(el);
                }
              }

              const extracted = elements.map(el => extractFromElement(el as HTMLElement)).filter(d => d.length > 0);

              // Format the output
              const outputFormat = format || 'text';
              if (outputFormat === 'json') {
                extractedData = JSON.stringify(extracted, null, 2);
              } else if (outputFormat === 'csv') {
                extractedData = extracted.join(',');
              } else {
                extractedData = extracted.join('\n');
              }
            } else {
              // Single extraction (default behavior)
              extractedData = extractFromElement(el);
            }

            return { success: true, extractedData: extractedData.slice(0, 10000) };
          }

          default:
            return { success: false, error: `Unknown action type: ${(action as any).type}`, errorType: 'UNKNOWN' };
        }
      } catch (err: any) {
        return { success: false, error: err.message || String(err), errorType: 'ACTION_FAILED' };
      }
    }

    // ─── Message listener ─────────────────────────────────────────
    // IMPORTANT: Chrome requires returning true synchronously to keep the
    // message port open for async sendResponse. An async callback won't work.
    chrome.runtime.onMessage.addListener(
      (message: any, _sender: any, sendResponse: (response?: any) => void): boolean => {
        // Basic validation and simple rate limiting per type
        if (!validateInboundMessage(message)) {
          sendResponse({ success: false, error: 'Invalid message format' });
          return false;
        }
        if (!canAccept(message.type)) {
          sendResponse({ success: false, error: 'Rate limit exceeded' });
          return false;
        }

        // Synchronous cases
        switch (message.type) {
          case 'getContext': {
            const context = getPageContext();
            sendResponse({ type: 'getContextResponse', context });
            return true;
          }
          case 'stopModerator': {
            tiktokModerator.stop();
            sendResponse({ success: true });
            return true;
          }
          case 'updateModerationRules': {
            tiktokModerator.setRules(message.rules);
            sendResponse({ success: true });
            return true;
          }
        }

        // Async cases — handle via .then() to keep port open
        const handleAsync = async (): Promise<any> => {
          switch (message.type) {
            case 'performAction':
            case 'executeActionOnPage': {
              const result = await performAction(message.action);
              // Log action outcome to memory (non-blocking)
              saveActionOutcome(
                window.location.href,
                message.action,
                result.success,
                result.errorType
              ).catch(() => { }); // Ignore errors
              return { type: 'performActionResponse', ...result };
            }
            case 'captureScreenshot': {
              try {
                const resp = await chrome.runtime.sendMessage({ type: 'captureScreenshot' } as any);
                const dataUrl = resp?.dataUrl || '';
                return { type: 'captureScreenshotResponse', dataUrl };
              } catch (_err: any) {
                return { type: 'captureScreenshotResponse', dataUrl: '' };
              }
            }
            case 'getSiteConfig': {
              await loadSiteConfig();
              return {
                type: 'getSiteConfigResponse',
                config: currentSiteConfig,
                hostname: window.location.hostname
              };
            }
            case 'startModerator': {
              if (window.location.hostname.includes('tiktok.com')) {
                const started = await tiktokModerator.start();
                return { success: started };
              } else {
                return { success: false, error: 'Not on TikTok' };
              }
            }
            default:
              return { success: false, error: 'Unknown message type' };
          }
        };

        handleAsync()
          .then(result => {
            sendResponse(result ?? { success: false, error: 'Unknown error' });
          })
          .catch(err => {
            console.error('[HyperAgent] Message handler error:', err);
            sendResponse({ success: false, error: err?.message || 'Unknown error' });
          });

        return true; // Keep message port open for async response
      }
    );

    console.log('[HyperAgent] Content script loaded on', window.location.href);
  },
});
