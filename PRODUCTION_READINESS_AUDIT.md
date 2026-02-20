# HyperAgent Production-Readiness Audit

**Date:** 2026-02-20  
**Version:** 3.0.0  
**Scope:** Code audit only (no build, no testing)  
**Auditor:** Deep Research Mode

---

## Executive Summary

HyperAgent is a Chrome MV3 extension implementing an AI-powered browser automation agent. The codebase demonstrates solid architectural patterns (ReAct loop, self-healing locators, session mutex, XSS/ReDoS mitigations) and has addressed many production concerns documented in AUDIT.md. However, several critical gaps remain that could cause crashes, security issues, or poor user experience at scale.

---

## PRIORITIZED FIX ORDER (Correct Implementation Sequence)

Fix in this exact order to minimize rework and address blocking issues first:

### Phase 1 — Blocking (Extension Won't Work)
1. **1.2** Add icon assets (extension may fail to load)
2. **1.1** Message handler sendResponse on error (callers hang on any error)

### Phase 2 — Critical Crashes & Data Loss
3. **2.2** Import settings validation (malicious import corrupts state)
4. **1.3** Fix "built-in key" misleading UX (users think configured when not)
5. **4.9** Snapshot Resume/Delete buttons — no click handlers (completely broken)
6. **4.10** Snapshot Resume — no backend support (need resumeSnapshot message)

### Phase 3 — Security Critical
7. **2.1** API key storage (document or encrypt)
8. **1.6** ReDoS in findTabByUrl + workflow urlMatches
9. **2.5** validateExtensionMessage default: return true

### Phase 4 — User-Facing Broken Features
10. **1.11** LLM locator strategy mismatch (ariaLabel/id vs aria)
11. **1.4** verifyActionWithVision fail-open
12. **1.5** Screenshot format consistency
13. **4.12** visionUpdate screenshot format
14. **4.3** Tasks "New" button — no handler
15. **4.5** Vision "Analyze Page" — no handler
16. **4.2** Stripe checkout return flow
17. **4.1** Marketplace workflows (implement or label)
18. **4.11** Scheduler "once" task validation

### Phase 5 — UX Inconsistencies
19. **3.1** Duplicate visibilitychange handler
20. **3.2** Ask modal backdrop — doesn't resolve
21. **3.4** require-confirm default mismatch
22. **3.6** Dark mode — no system preference
23. **3.5** Add /think to help
24. **3.7** Duplicate font loading
25. **3.9** Remove dead import getUserSiteConfigs

### Phase 6 — Missing Industry Standard
26. **5.1** Error reporting (Sentry)
27. **7.3** Privacy policy
28. **5.3** Onboarding
29. **5.4** Offline handling
30. **5.5** Rate limit feedback in UI
31. **5.9** Export settings warning
32. **5.10** Changelog on update

### Phase 7 — Accessibility
33. **8.1** Chat aria-live
34. **8.2** Modal focus trap
35. **8.3** Status aria-live
36. **8.4** Tab aria-selected
37. **8.9** visionSnapshot null check

### Phase 8 — Performance & Polish
38. **6.1** Content script overhead
39. **6.2** getPageContext cost
40. **6.9** Storage quota monitoring
41. **10.7** Replace deprecated substr
42. **10.8** Console.log in production

### Phase 9 — Technical Debt
43. **1.8** Duplicate getMemoryStats handler
44. **1.7** Dead content-script navigate/goBack
45. **1.9** buildFallbackPlan stub
46. **10.1** Reduce any types
47. **10.3** Storage key sprawl
48. **10.9** Scheduler scheduled flag
49. **4.13** TikTok Moderator selectors

---

## Severity Legend

| Level | Description |
|-------|-------------|
| **Critical** | Must fix before launch; causes crashes, data loss, or severe security issues |
| **High** | Should fix before launch; significant UX degradation or moderate security risk |
| **Medium** | Fix soon; edge cases, inconsistencies, or technical debt |
| **Low** | Nice to have; polish, minor gaps |
| **Polish** | Premium feel, differentiation |
| **Strategic** | Long-term improvements |

---

## 1. BUGS & CRASHES

### Critical

| # | Issue | Why It Matters | Fix | Effort |
|---|-------|----------------|-----|--------|
| 1.1 | **Message handler never calls `sendResponse` on error** — `chrome.runtime.onMessage` listener uses `withErrorBoundary` which re-throws; the async IIFE has no catch, so when any handler throws, `sendResponse` is never invoked. Chrome keeps the port open until timeout; callers may hang or receive no feedback. | Callers (side panel, content script) expect a response. Unhandled errors leave them in limbo; retries can compound. | Wrap the async handler in try/catch and call `sendResponse({ ok: false, error: err?.message })` in the catch block. | Quick |
| 1.2 | **Missing icon assets** — `wxt.config.ts` references `icon/16.png`, `icon/32.png`, `icon/48.png`, `icon/128.png` but no icon files exist in the repo. Extension will fail to load or show broken icons. | Chrome Web Store and extension UX require valid icons. | Add icon assets (16, 32, 48, 128 px) or configure WXT to generate placeholders. | Quick |

### High

| # | Issue | Why It Matters | Fix | Effort |
|---|-------|----------------|-----|--------|
| 1.3 | **Options page "built-in key" UX is misleading** — When `apiKey === ''` (DEFAULT_API_KEY), UI shows "API: ✅ Using built-in key" and "Using built-in OpenRouter key (auto-managed)". There is no built-in key; `DEFAULTS.DEFAULT_API_KEY` is `''`. Users may believe they're configured when they are not. | Users will attempt commands and get "API key not set" errors, causing confusion and negative reviews. | When `apiKey` is empty, show "API: ❌ Not configured" (missing state), not "builtin". Remove "built-in key" language unless a real fallback key exists. | Quick |
| 1.4 | **`verifyActionWithVision` fail-open on parse error** — If `JSON.parse(response)` throws, the function returns `{ success: true }`, assuming the action succeeded. Malformed LLM output could hide real failures. | False positives in verification; user may believe an action succeeded when it did not. | Return `{ success: false, reason: 'Verification parse error' }` or at least log and fail closed for critical actions. | Quick |
| 1.5 | **`captureScreenshot` returns base64 without `data:image/` prefix in some paths** — Background returns `dataUrl.replace(/^data:image\/\w+;base64,/, '')` (stripped). Side panel sets `components.visionSnapshot.src = \`data:image/jpeg;base64,${response.dataUrl}\``. If `response.dataUrl` is already a full data URL from another code path, this could double-prefix or break. | Inconsistent handling of screenshot format; possible broken vision display. | Standardize: either always return full data URL or always return raw base64 and document the contract. | Quick |

### Medium

| # | Issue | Why It Matters | Fix | Effort |
|---|-------|----------------|-----|--------|
| 1.6 | **`findTabByUrl` and workflow `urlMatches` use user-controlled regex** — `pattern` comes from `action.urlPattern` or `condition.value`. `isSafeRegex` checks length and syntax but NOT ReDoS. A crafted pattern like `(a+)+$` could cause catastrophic backtracking. Both code paths affected. | ReDoS can freeze the extension or browser tab. | Use `safe-regex` npm package or implement ReDoS detection (e.g., `regexp-tree` or timeout-wrapped `RegExp.test`). | Medium |
| 1.7 | **Content script `performAction` for `navigate`/`goBack`** — Content script handles `navigate` and `goBack` by setting `window.location.href` and `window.history.back()`. Background also handles these for `executeAction`. The content script path is dead code for `executeActionOnPage` because background routes `navigate`/`goBack` before sending to content. Inconsistent routing could cause confusion. | Dead code and potential future bugs if someone adds content-script-only flows. | Document or remove content-script handling for navigate/goBack; ensure single source of truth. | Quick |
| 1.11 | **LLM system prompt locator strategy mismatch** — Prompt says `"ariaLabel"|"id"` but `LocatorStrategy` type and content script only support `css|text|aria|role|xpath|index`. LLM may return `ariaLabel` or `id`; content script will hit `default: return null` and fail to find element. | Elements not found when LLM uses "ariaLabel" or "id". | Align prompt: use "aria" or add "ariaLabel"/"id" handling in content script. | Quick |
| 1.8 | **`handleExtendedMessage` duplicate `getMemoryStats`** — Both `handleExtensionMessage` and `handleExtendedMessage` have `getMemoryStats` cases. Extended handler returns `memoryManager.getMemoryStats()`; main handler returns `getMemoryStatsUtil()` + strategies. Different semantics; extended runs first and returns, so main handler's `getMemoryStats` is never reached for that message type. | Confusing behavior; one code path may be dead. | Consolidate into one handler with clear semantics. | Quick |

### Low

| # | Issue | Why It Matters | Fix | Effort |
|---|-------|----------------|-----|--------|
| 1.9 | **`buildFallbackPlan` is a stub** — Returns `null` always. No fallback when LLM fails. | Minor; intelligent fallback exists in `buildIntelligentFallback`. | Either implement or remove to avoid confusion. | Quick |
| 1.10 | **`Condition.value` in workflows** — `textContains` and `elementExists` use `condition.value` directly in `includes()`; no sanitization. If value comes from untrusted workflow definitions, could be used for injection in edge cases. | Low risk in extension context; workflows are user-created. | Add length limits and basic sanitization if workflows can be imported. | Quick |

---

## 2. SECURITY & PRIVACY

### Critical

| # | Issue | Why It Matters | Fix | Effort |
|---|-------|----------------|-----|--------|
| 2.1 | **API key stored in plain text** — `chrome.storage.local` holds API key unencrypted. Malicious extension or compromised machine can read it. | API keys are sensitive; exposure enables abuse and cost. | Encrypt at rest using Web Crypto API with a key derived from a user secret or use Chrome's `identity` API if applicable. Document that keys are stored in extension storage. | Significant |
| 2.2 | **Import settings overwrites storage without validation** — `importSettings` does `chrome.storage.local.set(data.settings)`. A crafted JSON could inject arbitrary keys (e.g., `hyperagent_api_key` with a malicious value, or keys that break the extension). | Malicious import could hijack API key or corrupt state. | Validate schema of imported data; allowlist keys that can be imported; reject unknown keys. | Medium |
| 2.2b | **Reset settings clears ALL storage** — Options "Reset All Settings" calls `storageClear()`. Wipes API key, sessions, chat history, everything. Confirm dialog says "API key and preferences" but doesn't mention sessions/history. | User may not realize full wipe. | Expand confirm text: "This will clear API key, chat history, sessions, and all preferences." | Quick |

### High

| # | Issue | Why It Matters | Fix | Effort |
|---|-------|----------------|-----|--------|
| 2.3 | **`<all_urls>` host permission** — Extension requests access to all URLs. Required for automation but increases attack surface. | Overly broad permission can concern users and reviewers. | Document why it's needed; consider optional permission flow for sensitive sites. | Strategic |
| 2.4 | **InputSanitizer `allowedDomains`** — Global instance has `allowedDomains: ['*.craigslist.org', ...]`. These are used for `sanitizeUrl`; unclear if they restrict which URLs the agent can navigate to. May be vestigial. | Confusion; possible unintended restrictions. | Audit usage; remove or document. | Quick |
| 2.5 | **`validateExtensionMessage` default: return true** — For unknown `message.type`, validation returns `true`. New message types are implicitly allowed. | Could allow unexpected message types if types are extended without full validation. | Explicitly list allowed types; return false for unknown. | Quick |

### Medium

| # | Issue | Why It Matters | Fix | Effort |
|---|-------|----------------|-----|--------|
| 2.6 | **`redact` patterns** — Redaction is best-effort; patterns may miss tokens (e.g., new API key formats). | Logs could leak credentials. | Expand patterns; add tests; consider a dedicated secrets filter. | Medium |
| 2.7 | **CSP for extension pages** — `script-src 'self'; object-src 'self'` is strict. Ensure no inline scripts; WXT should handle this. | Good; verify no regressions. | Audit built output for CSP compliance. | Quick |
| 2.8 | **Site config custom selectors** — User-defined selectors are passed to `document.querySelectorAll`. Malformed selectors can throw. | Already wrapped in try/catch in content script; low risk. | Ensure all selector usage is wrapped. | Quick |

### Low

| # | Issue | Why It Matters | Fix | Effort |
|---|-------|----------------|-----|--------|
| 2.9 | **Billing license key verification** — `verifyLicenseKey` only checks format (`HA-TIER-XXXX-XXXX`); no server-side validation. | License keys can be forged for offline use. | Implement server-side validation or document as offline-only. | Significant |
| 2.10 | **Stripe payment links hardcoded** — URLs in `billing.ts` point to Stripe. Ensure they're correct for production. | Wrong environment could cause payment issues. | Use env vars or build-time config for production vs test. | Quick |

---

## 3. INCONSISTENCIES (UI, UX, BRANDING)

### High

| # | Issue | Why It Matters | Fix | Effort |
|---|-------|----------------|-----|--------|
| 3.1 | **Duplicate `visibilitychange` handler for saveHistory** — `document.addEventListener('visibilitychange', ...)` is registered twice in sidepanel/main.ts: once for `saveHistory()` (debounced) and once for direct `chrome.storage.local.set`. Redundant. | Minor performance; potential race. | Consolidate into one handler. | Quick |
| 3.2 | **Ask modal backdrop closes with empty reply** — Clicking backdrop sends `userReply` with `''` but doesn't call `state.askResolve`. The background's `askUserForInfo` will timeout. | User may expect cancel behavior; resolver not called. | Call `state.askResolve?.('')` when backdrop is clicked, or ensure background handles empty reply. | Quick |
| 3.3 | **Confirm modal Promise never rejects** — `new Promise<boolean>(resolve => {...})` has no reject path. Timeout calls `resolve(false)` via `state.confirmResolve`. Fine, but the `.catch` in the chain will never run for rejection. | Minor; current behavior is acceptable. | Document or add explicit reject for consistency. | Quick |

### Medium

| # | Issue | Why It Matters | Fix | Effort |
|---|-------|----------------|-----|--------|
| 3.4 | **`require-confirm` default mismatch** — Config default is `REQUIRE_CONFIRM: false`; options HTML has `checked` on the toggle. Options load from storage, so first-time users get `false` from config. If options HTML is the source of truth for "first load", they'd get `true`. | Inconsistent first-run experience. | Align defaults: config, options UI, and docs. | Quick |
| 3.5 | **Slash command `/think` not in help** — `/help` lists `/memory`, `/schedule`, `/tools`, etc. but not `/think` (autonomous mode). Users may not discover it. | Discoverability. | Add `/think` to help: "Advanced autonomous reasoning". | Quick |
| 3.6 | **Dark mode** — Toggle exists; `initDarkMode` loads from storage. No system preference detection (`prefers-color-scheme`). | Users expect dark mode to follow system. | Add `matchMedia('(prefers-color-scheme: dark)')` for default. | Quick |

### Low

| # | Issue | Why It Matters | Fix | Effort |
|---|-------|----------------|-----|--------|
| 3.7 | **Duplicate font loading** — `index.html` loads Inter from Google Fonts; `style.css` loads Inter, Space Grotesk, JetBrains Mono. Inter loaded twice from different URLs. | Redundant network requests; potential FOUT. | Use single font import; remove duplicate. | Quick |
| 3.8 | **Emoji for dark mode toggle** — Uses 🌙/☀️. Works but may not render consistently across OS/browsers. | Minor. | Consider SVG icons for consistency. | Quick |
| 3.9 | **Options page dead import** — `getUserSiteConfigs` is imported but never used. `renderSiteConfigs` uses `getAllSiteConfigs` and filters with `isDefaultConfig`. | Dead code; lint noise. | Remove unused import. | Quick |
| 3.10 | **Subscription tab `btn-plan-free`** — `updateUsageDisplay` references `btn-plan-free` but HTML has it. Free plan card exists. Ensure all plan buttons (free, premium, unlimited) are in HTML. | Verify DOM matches. | Audit HTML vs JS references. | Quick |

---

## 4. INCOMPLETE / HALF-FINISHED FEATURES

### High

| # | Issue | Why It Matters | Fix | Effort |
|---|-------|----------------|-----|--------|
| 4.1 | **Marketplace workflows are static** — `MARKETPLACE_WORKFLOWS` is a hardcoded array. "Install" adds to `hyperagent_installed_workflows` but doesn't fetch or load actual workflow definitions. Installed workflows don't appear to do anything beyond being marked installed. | Users expect workflows to run; current behavior is misleading. | Implement workflow fetch/load, or clearly label as "Coming soon". | Significant |
| 4.2 | **Stripe checkout return flow** — `checkForPaymentSuccess` reads `stripe_payment_success` from storage. No code sets this; Stripe redirect would need to land on a page that injects it (e.g., web page + content script). Unclear if return URL is configured. | Payments may not complete correctly. | Implement Stripe success redirect handler (e.g., options page with hash params). | Significant |
| 4.3 | **Tasks tab "New" button** — `btn-add-task-ui` exists but no handler attached. Tasks are created via natural language ("schedule daily search"); no UI to add. | Incomplete feature. | Add handler or remove button. | Quick |
| 4.9 | **Snapshot Resume and Delete buttons have no click handlers** — Swarm tab creates snapshot items with Resume/Delete buttons via innerHTML, but never attaches event listeners. Both buttons are completely non-functional. Tasks tab attaches handlers with `querySelectorAll('.btn-small')`; swarm tab does not. | Critical broken feature; users cannot resume or delete saved missions. | Add `snapshotsList.querySelectorAll('.btn-small').forEach(btn => {...})` with handlers for Resume (need new backend) and Delete (clearSnapshot with taskId). | Quick |
| 4.10 | **Snapshot Resume has no backend support** — Background has `getSnapshot`, `listSnapshots`, `clearSnapshot` but no `resumeSnapshot` or equivalent. Resume would need to restore command, history, and continue agent loop. | Resume button cannot work without backend. | Add `resumeSnapshot` message type; load snapshot, restore state, continue runAgentLoop from saved step. | Significant |

### Medium

| # | Issue | Why It Matters | Fix | Effort |
|---|-------|----------------|-----|--------|
| 4.4 | **Swarm tab** — Shows "8" agents, all "Ready". Data comes from `getSwarmStatus` and `getGlobalLearningStats`. Swarm coordinator is initialized but `getSwarmStatus` returns `{ initialized: true, agents: [] }`. UI shows static list. | Misleading; suggests more than is implemented. | Sync UI with actual swarm state or add "Preview" label. | Medium |
| 4.5 | **Vision tab "Analyze Page"** — Button `btn-analyze-vision` is created in `loadVisionTab` but only `btn-capture-vision` has a click handler. "Analyze" does nothing. | Dead UI. | Implement or remove. | Quick |
| 4.6 | **Workflow `checkCondition` in `runWorkflow`** — Condition is never evaluated; step condition is skipped. Workflow execution doesn't use conditional branching. | Workflows with conditions won't behave as expected. | Implement condition check before executing step. | Medium |
| 4.11 | **Scheduler "once" task with undefined time** — When `schedule.type === 'once'` and `task.schedule.time` is undefined or in the past, no alarm is created. Task stays enabled forever, never runs, never disables. | Orphaned one-time tasks. | Validate schedule; if time invalid, disable task and log. | Quick |
| 4.12 | **visionUpdate message screenshot format** — Side panel sets `components.visionSnapshot.src = message.screenshot`. Background sends `screenshot` as base64 (stripped of data URL prefix). Agent progress sends `visionUpdate` with `screenshot` from `captureScreenshot()` which returns raw base64. So `src` gets raw base64 without `data:image/jpeg;base64,` prefix — invalid. | Vision snapshot may not display. | Ensure visionUpdate sends full data URL or side panel prefixes before setting src. | Quick |
| 4.13 | **TikTok Moderator placeholder selectors** — Uses `.tiktok-chat-messages`, `.tiktok-chat-item`, `.unique-id`. Real TikTok DOM may differ; feature may not work. | Niche feature may be broken. | Verify selectors against live TikTok; update or document. | Medium |

### Low

| # | Issue | Why It Matters | Fix | Effort |
|---|-------|----------------|-----|--------|
| 4.7 | **`ariaLabel` in Condition** — `SemanticElement` has `ariaLabel`; Condition uses `el.ariaLabel?.includes`. Type uses `ariaLabel` (camelCase); content script sets `ariaLabel: htmlEl.getAttribute('aria-label')`. Consistent. | OK. | — | — |
| 4.8 | **TikTok Moderator** — Exists for tiktok.com; start/stop/update rules. Niche feature. | Document or highlight for target users. | Add to docs. | Quick |

---

## 5. MISSING FEATURES (INDUSTRY STANDARD)

### High

| # | Issue | Why It Matters | Fix | Effort |
|---|-------|----------------|-----|--------|
| 5.1 | **No crash/error reporting** — No Sentry, LogRocket, or similar. Production issues will be hard to diagnose. | Cannot fix what you can't measure. | Integrate error reporting (Sentry, Bugsnag) with PII redaction. | Medium |
| 5.2 | **No analytics** — No usage analytics (commands run, success rate, tab usage). | Cannot optimize or prioritize features. | Add privacy-respecting analytics (opt-in, anonymized). | Medium |
| 5.3 | **No onboarding** — First-time users land on chat with "Dashboard Initialized". No tour, no "Add your API key" prompt beyond opening options. | High drop-off for new users. | Add first-run checklist or modal. | Medium |

### Medium

| # | Issue | Why It Matters | Fix | Effort |
|---|-------|----------------|-----|--------|
| 5.4 | **No offline handling** — LLM calls fail when offline; error message is generic. No offline indicator. | Poor UX when network is flaky. | Add offline detection; show clear message; consider retry. | Medium |
| 5.5 | **No rate limit feedback** — When `rateLimiter.canAcceptMessage` returns false, user gets "Rate limit exceeded" in response. No UI indication of when they can retry. | Frustrating UX. | Surface `timeUntilReset` in UI. | Quick |
| 5.6 | **No keyboard shortcut to focus command input** — Global shortcuts exist for clear and settings; no shortcut to focus the input. | Power users expect it. | Add e.g. Ctrl/Cmd+K to focus input. | Quick |

### Low

| # | Issue | Why It Matters | Fix | Effort |
|---|-------|----------------|-----|--------|
| 5.7 | **No export of chat history** — Chat can be cleared; history is in storage. No export to file. | Users may want to save conversations. | Add export chat to JSON/MD. | Medium |
| 5.8 | **No A/B testing** — No framework for experiments. | Hard to optimize conversion. | Consider feature flags or simple A/B. | Strategic |
| 5.9 | **Export settings includes chat history** — `exportSettings` exports `chat_history_backup` which may contain sensitive user data. No warning. | Privacy when sharing export file. | Add warning or option to exclude sensitive data. | Quick |
| 5.10 | **No "What's New" or changelog** — Users updating see no release notes. | Missed engagement opportunity. | Add changelog modal on update (chrome.runtime.onInstalled reason=update). | Medium |

---

## 6. PERFORMANCE

### High

| # | Issue | Why It Matters | Fix | Effort |
|---|-------|----------------|-----|--------|
| 6.1 | **Content script runs on `<all_urls>`** — Injected on every page. Stealth masks and message listener add overhead. | Battery and memory on low-end devices. | Consider `document_idle` and lazy init of heavy logic. | Medium |
| 6.2 | **`getPageContext` re-indexes all elements** — Every observe step calls `getContext`, which runs `querySelectorAll` over many selectors and builds `semanticElements`. On large pages (1000+ elements), this can be slow. | Lag in agent loop. | Throttle or sample; use `requestIdleCallback` for non-critical work. | Medium |
| 6.3 | **Screenshot capture** — `captureVisibleTab` with JPEG quality 60. Large viewports produce big base64 strings. Sent to LLM; adds latency. | Slow round-trips. | Consider resolution cap, or compress further. | Medium |

### Medium

| # | Issue | Why It Matters | Fix | Effort |
|---|-------|----------------|-----|--------|
| 6.4 | **`StructuredLogger` in-memory** — Keeps 1000 entries. Service worker can be evicted; logs lost. | Acceptable for dev; not for production debugging. | Consider periodic export to storage or remote. | Medium |
| 6.5 | **`apiCache` and `generalCache`** — Caching exists; TTL and invalidation need review. | Stale responses could confuse users. | Audit cache keys and TTLs. | Quick |
| 6.6 | **`loadHistory` on every side panel open** — Chat history loaded from storage. Could be large. | Slight delay on open. | Lazy load or paginate. | Quick |

### Low

| # | Issue | Why It Matters | Fix | Effort |
|---|-------|----------------|-----|--------|
| 6.7 | **`debounce` for saveHistory** — 500ms. Good. `visibilitychange` triggers immediate save. Good. | — | — | — |
| 6.8 | **`UsageTracker` debounce** — 500ms. Prevents write storm. Good. | — | — | — |
| 6.9 | **Storage quota** — `chrome.storage.local` has 5MB default; 10MB with `unlimitedStorage`. Chat history, snapshots, metrics, sessions can grow. No eviction policy for old snapshots. | Could hit quota; extension may fail to save. | Add storage usage monitoring; evict old snapshots; cap chat history size. | Medium |
| 6.10 | **ContextManager compressOldItems mutates in place** — Modifies `item.content` and `item.tokens` on existing items. If items are shared elsewhere, could cause bugs. | Low risk; items are internal. | Document; ensure no external references. | Quick |

---

## 7. APP STORE / CHROME WEB STORE COMPLIANCE

### High

| # | Issue | Why It Matters | Fix | Effort |
|---|-------|----------------|-----|--------|
| 7.1 | **Single purpose** — Chrome requires a clear single purpose. "Hyper-intelligent browser agent" is broad. | Rejection risk. | Narrow description; emphasize "browser automation assistant". | Quick |
| 7.2 | **Permission justification** — `<all_urls>`, `scripting`, `tabs` need clear justification in store listing. | Reviewers may question. | Document each permission in description or privacy policy. | Quick |
| 7.3 | **Privacy policy** — Required for extensions that handle user data. API key, chat history, usage data. | Required for store. | Publish privacy policy; link in manifest/listing. | Medium |

### Medium

| # | Issue | Why It Matters | Fix | Effort |
|---|-------|----------------|-----|--------|
| 7.4 | **Screenshots and promo** — Store listing needs screenshots and optional video. | Conversion. | Prepare 1280x800 or 640x400 screenshots. | Medium |
| 7.5 | **Data usage disclosure** — If usage data is sent anywhere, must be disclosed. | Compliance. | Audit all external requests; document. | Quick |

---

## 8. ACCESSIBILITY

### High

| # | Issue | Why It Matters | Fix | Effort |
|---|-------|----------------|-----|--------|
| 8.1 | **Chat history not announced** — New messages appended to `#chat-history` without `aria-live`. Screen reader users may miss updates. | Inaccessible for blind users. | Add `aria-live="polite"` to chat container; or announce on add. | Quick |
| 8.2 | **Modal focus trap** — Confirm and Ask modals don't trap focus. User can tab out. | Accessibility failure. | Implement focus trap (focus first focusable, loop on Tab). | Medium |
| 8.3 | **Status bar** — `#status-text` updates but no `aria-live`. | Screen reader won't announce status changes. | Add `aria-live="polite"` to status element. | Quick |

### Medium

| # | Issue | Why It Matters | Fix | Effort |
|---|-------|----------------|-----|--------|
| 8.4 | **Tab buttons** — Have `data-tab` but no `aria-selected`. | Incomplete ARIA. | Add `aria-selected="true/false"` on tab switch. | Quick |
| 8.5 | **Command input** — Has `aria-live` on char counter. Good. Placeholder "Type a command..." is clear. | OK. | — | — |
| 8.6 | **Dynamic Type** — No explicit support for user font size preferences. | Some users need larger text. | Use `rem`; test with browser zoom. | Quick |

### Low

| # | Issue | Why It Matters | Fix | Effort |
|---|-------|----------------|-----|--------|
| 8.7 | **Color contrast** — Not audited. Dark mode and light mode need WCAG AA. | Compliance. | Run contrast checker. | Quick |
| 8.8 | **Keyboard navigation** — Tabs, modals, marketplace need full keyboard support. | Power users and a11y. | Audit tab order and Enter/Space. | Medium |
| 8.9 | **visionSnapshot optional but used without null check** — `safeGetElement('vision-snapshot', true)` returns optional. When setting `components.visionSnapshot.src`, could throw if element missing. | Edge case when vision disabled. | Add null check before setting src. | Quick |
| 8.10 | **Loading overlay progress** — `updateProgress` and `progressFill`/`progressPercent` — if elements missing, no-op. Fine. | OK. | — | — |

---

## 9. LOCALIZATION & RTL

### Medium

| # | Issue | Why It Matters | Fix | Effort |
|---|-------|----------------|-----|--------|
| 9.1 | **No localization** — All strings hardcoded in English. | Limits international adoption. | Extract strings; add i18n (e.g. chrome.i18n). | Significant |
| 9.2 | **`Language` type exists** — `types.ts` has `Language` enum. Intent system may use it. | Partial support. | Complete or remove. | Quick |
| 9.3 | **RTL** — No `dir="rtl"` or RTL-aware layout. | Arabic/Hebrew users. | Add RTL support if targeting those markets. | Significant |

---

## 10. TECHNICAL DEBT & SCALABILITY

### High

| # | Issue | Why It Matters | Fix | Effort |
|---|-------|----------------|-----|--------|
| 10.1 | **`any` types** — Many `any` in message handlers, `recoveryStats`, `strategy`, etc. | Type safety; refactor risk. | Replace with proper types. | Medium |
| 10.2 | **Circular dependency risk** — `llmClient` imports `autonomousIntelligence`; autonomous imports llmClient. Comment says "inject self to break circular dependency". | Build or runtime issues. | Restructure to avoid cycles. | Significant |
| 10.3 | **Storage key sprawl** — Keys in config, security, billing, session, etc. No central registry. | Risk of collisions; hard to audit. | Create `STORAGE_KEYS` master list. | Medium |

### Medium

| # | Issue | Why It Matters | Fix | Effort |
|---|-------|----------------|-----|--------|
| 10.4 | **`ExtensionMessage` union** — Large union type. Adding a message requires updating many places. | Maintenance burden. | Consider discriminated union helpers. | Quick |
| 10.5 | **Background script size** — ~1800 lines. Many responsibilities. | Hard to test and maintain. | Split into modules (message router, agent loop, tab mgmt). | Significant |
| 10.6 | **Side panel main.ts** — ~1200 lines. Monolithic. | Same as above. | Split by tab/feature. | Medium |

### Low

| # | Issue | Why It Matters | Fix | Effort |
|---|-------|----------------|-----|--------|
| 10.7 | **Deprecated `substr`** — `billing.ts` uses `Math.random().toString(36).substr(2, 9)`. `substr` is deprecated. | Linter may warn. | Use `substring` or `slice`. | Quick |
| 10.8 | **Console.log in production** — Many `console.log`/`console.warn` calls across 30+ files. | Log noise; possible info leak. | Use logger with level; strip in production build. | Medium |
| 10.9 | **Scheduler sends `scheduled: true`** — `executeCommand` message includes `scheduled: true` but handler doesn't use it. No differentiation for scheduled vs manual. | Minor; could be useful for analytics. | Use or remove. | Quick |
| 10.10 | **Metrics storage uses callback style** — `saveToStorage` and `loadFromStorage` wrap chrome.storage callbacks in Promises. Works but inconsistent with rest of codebase (async/await). | Style inconsistency. | Consider migrating to async chrome.storage API. | Quick |
| 10.11 | **Macro runMacro stops on first failure** — Returns immediately when any action fails. No option to continue. | By design; document. | Document behavior in macro docs. | Quick |
| 10.12 | **Site config wildcard `*.shopify.com`** — `domain.endsWith('.shopify.com')` — `shopify.com` doesn't match (no subdomain). Defaults include both. Good. | OK. | — | — |

---

## 11. INTELLIGENT ADVANCEMENTS & PREMIUM POLISH

### Strategic

| # | Idea | Why It Matters | Effort |
|---|------|----------------|--------|
| 11.1 | **Proactive suggestions** — Persistent autonomous engine has `getProactiveSuggestions`. Surface in UI. | Differentiation; "AI that anticipates". | Medium |
| 11.2 | **Voice feedback** — TTS for agent responses. VoiceInterface has `speak()`. | Hands-free use. | Medium |
| 11.3 | **Session resume UX** — SnapshotManager saves state. Add "Resume" prompt when returning after close. | Reduces frustration. | Medium |
| 11.4 | **Confidence indicators** — Show agent confidence per action. | Trust; user can intervene. | Significant |
| 11.5 | **Multi-tab orchestration** — Agent could coordinate across tabs. | Power user feature. | Significant |
| 11.6 | **Templates library** — Pre-built commands for common tasks. | Onboarding; stickiness. | Medium |

---

## 12. COMPREHENSIVE CHECKLIST (All Items in Fix Order)

### Phase 1 — Blocking
- [ ] 1.2 Add icon assets
- [ ] 1.1 Message handler sendResponse on error

### Phase 2 — Critical Crashes & Data Loss
- [ ] 2.2 Validate import settings schema
- [ ] 2.2b Reset settings confirm text
- [ ] 1.3 Fix "built-in key" misleading UX
- [ ] 4.9 Snapshot Resume/Delete — add click handlers
- [ ] 4.10 Snapshot Resume — add backend support

### Phase 3 — Security
- [ ] 2.1 API key storage (document or encrypt)
- [ ] 1.6 ReDoS in findTabByUrl + workflow urlMatches
- [ ] 2.5 validateExtensionMessage — reject unknown types

### Phase 4 — Broken Features
- [ ] 1.11 LLM locator strategy mismatch
- [ ] 1.4 verifyActionWithVision fail-open
- [ ] 1.5 Screenshot format consistency
- [ ] 4.12 visionUpdate screenshot format
- [ ] 4.3 Tasks "New" button handler
- [ ] 4.5 Vision "Analyze Page" handler
- [ ] 4.2 Stripe checkout return flow
- [ ] 4.1 Marketplace workflows
- [ ] 4.11 Scheduler "once" task validation

### Phase 5 — UX Inconsistencies
- [ ] 3.1 Duplicate visibilitychange handler
- [ ] 3.2 Ask modal backdrop resolve
- [ ] 3.4 require-confirm default
- [ ] 3.6 Dark mode system preference
- [ ] 3.5 Add /think to help
- [ ] 3.7 Duplicate font loading
- [ ] 3.9 Remove dead import getUserSiteConfigs

### Phase 6 — Missing Features
- [ ] 5.1 Error reporting
- [ ] 7.3 Privacy policy
- [ ] 5.3 Onboarding
- [ ] 5.4 Offline handling
- [ ] 5.5 Rate limit feedback
- [ ] 5.6 Keyboard shortcut focus input
- [ ] 5.9 Export settings warning
- [ ] 5.10 Changelog on update

### Phase 7 — Accessibility
- [ ] 8.1 Chat aria-live
- [ ] 8.2 Modal focus trap
- [ ] 8.3 Status aria-live
- [ ] 8.4 Tab aria-selected
- [ ] 8.9 visionSnapshot null check

### Phase 8 — Performance & Polish
- [ ] 6.1 Content script overhead
- [ ] 6.2 getPageContext cost
- [ ] 6.9 Storage quota monitoring
- [ ] 10.7 Replace substr
- [ ] 10.8 Console.log in production

### Phase 9 — Technical Debt
- [ ] 1.8 Duplicate getMemoryStats
- [ ] 1.7 Dead content-script navigate/goBack
- [ ] 1.9 buildFallbackPlan stub
- [ ] 10.1 Reduce any types
- [ ] 10.3 Storage key sprawl
- [ ] 10.9 Scheduler scheduled flag
- [ ] 4.13 TikTok Moderator selectors

### Phase 10 — Low Priority
- [ ] 1.10 Condition.value sanitization
- [ ] 2.4 InputSanitizer allowedDomains
- [ ] 2.6 redact patterns
- [ ] 2.1 Stripe env config
- [ ] 3.3 Confirm modal reject
- [ ] 3.8 Emoji → SVG icons
- [ ] 3.10 btn-plan-free audit
- [ ] 4.4 Swarm tab sync
- [ ] 4.6 Workflow condition check
- [ ] 5.2 Analytics
- [ ] 5.7 Export chat
- [ ] 6.4 StructuredLogger persistence
- [ ] 6.5 Cache TTL audit
- [ ] 6.6 loadHistory lazy
- [ ] 7.1 Single purpose
- [ ] 7.2 Permission justification
- [ ] 7.4 Screenshots
- [ ] 7.5 Data usage disclosure
- [ ] 8.6 Dynamic Type
- [ ] 8.7 Color contrast
- [ ] 8.8 Keyboard nav
- [ ] 10.4 ExtensionMessage helpers
- [ ] 10.5 Background split
- [ ] 10.6 Side panel split
- [ ] 10.10 Metrics storage style
- [ ] 10.11 Macro behavior doc

---

## Appendix: Files Audited

| Area | Files |
|------|-------|
| Entry points | background.ts, content.ts, sidepanel/main.ts, options/main.ts |
| Shared | types.ts, config.ts, llmClient.ts, security.ts, input-sanitization.ts, safe-regex.ts, workflows.ts, snapshot-manager.ts, session.ts, billing.ts, voice-interface.ts, url-utils.ts, error-boundary.ts, stealth-engine.ts, metrics.ts, macros.ts, siteConfig.ts, contextManager.ts, memory.ts, memory-management.ts, persistent-autonomous.ts, scheduler-engine.ts, intelligent-clarification.ts, advanced-caching.ts, neuroplasticity-engine.ts, tiktok-moderator.ts, retry-circuit-breaker.ts, autonomous-intelligence.ts, tool-system.ts, swarm-intelligence.ts, global-learning.ts, failure-recovery.ts, reasoning-engine.ts |
| Config | wxt.config.ts, package.json |
| Docs | AGENTS.md, DEVELOPER.md, ARCHITECTURE.md, AUDIT.md |
| UI | sidepanel/index.html, sidepanel/style.css, options/index.html |

---

*End of audit. Total items: 100+ across 12 categories. Fix order ensures blocking issues are resolved first.*
