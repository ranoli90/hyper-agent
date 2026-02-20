# HyperAgent Pre-Production Audit Report

**Date:** 2026-02-20
**Audited by:** Automated deep code review (line-by-line, 23,127 LOC across 45+ files)
**Build:** v3.0.0, 349 KB, 87 tests passing

---

## TIER 1 — CRASH / DATA-LOSS / SECURITY (fix before any user touches it)

### 1. [CRASH] VoiceInterface method name mismatch — mic button throws TypeError
- **File:** `entrypoints/sidepanel/main.ts:1259`
- **Problem:** Calls `voiceInterface.start()` and `voiceInterface.stop()`, but `VoiceInterface` class exposes `startListening()` and `stopListening()`.
- **Impact:** Clicking the mic button throws `TypeError: voiceInterface.start is not a function`, crashing the handler.
- **Fix:** Rename calls to `startListening()` / `stopListening()`.

### 2. [SECURITY] renderMarkdown does not escape inline code content
- **File:** `entrypoints/sidepanel/main.ts:380`
- **Problem:** `` html.replace(/`([^`]+)`/g, '<code>$1</code>') `` — the captured `$1` is NOT escaped. An LLM response containing `` `<img onerror=alert(1)>` `` gets injected as live HTML.
- **Impact:** Stored XSS via LLM responses in the chat.
- **Fix:** Use `escapeHtml($1)` inside the replacement.

### 3. [SECURITY] renderMarkdown bold/italic replacements not escaped
- **File:** `entrypoints/sidepanel/main.ts:381-382`
- **Problem:** Same as above for `**bold**` → `<strong>` and `*italic*` → `<em>` — inner content is unescaped.
- **Impact:** XSS via crafted LLM output.
- **Fix:** Escape the inner capture group.

### 4. [SECURITY] renderMarkdown link `href` not validated
- **File:** `entrypoints/sidepanel/main.ts:383-386`
- **Problem:** `[text](javascript:alert(1))` becomes a clickable link with a `javascript:` protocol.
- **Impact:** XSS via malicious links in LLM output.
- **Fix:** Validate that `href` starts with `http://` or `https://`.

### 5. [SECURITY] loadHistory sets innerHTML from storage — stored XSS
- **File:** `entrypoints/sidepanel/main.ts:494-498`
- **Problem:** `components.chatHistory.innerHTML = data.chat_history_backup` — if storage is ever contaminated (by another extension, shared storage bug, or previous XSS), it executes arbitrary HTML.
- **Impact:** Persistent XSS that survives extension restarts.
- **Fix:** Sanitize the loaded HTML or serialize chat as JSON data rather than raw HTML.

### 6. [CRASH] SnapshotManager.save called with wrong shape in background.ts
- **File:** `entrypoints/background.ts` (agent loop snapshot calls)
- **Problem:** `SnapshotManager.save()` expects `AgentSnapshot` which requires `sessionId`, `plan`, `results` fields. The background.ts calls pass `{ taskId, command, currentStep, totalSteps, history, timestamp, status, url }` — missing `sessionId`, `plan`, `results`.
- **Impact:** TypeScript would catch this at strict compile, but since the interface uses `any` for `plan` and `history`, it silently saves incomplete snapshots. `listAll()` returns objects missing expected fields, causing UI crashes.
- **Fix:** Pass complete `AgentSnapshot` objects matching the interface.

### 7. [DATA-LOSS] saveHistory debounced means last message can be lost
- **File:** `entrypoints/sidepanel/main.ts`
- **Problem:** `saveHistory` is debounced at 500ms. If the user closes the sidepanel within 500ms of the last message, that message is lost.
- **Impact:** Minor data loss on rapid close.
- **Fix:** Also save on `beforeunload` / `visibilitychange` events.

### 8. [SECURITY] Condition checker uses unsanitized regex from workflow data
- **File:** `shared/workflows.ts:117`
- **Problem:** `new RegExp(condition.value, 'i')` — if a workflow stores a malicious regex, this can cause ReDoS (catastrophic backtracking).
- **Impact:** DoS via crafted workflow condition.
- **Fix:** Wrap in try/catch with a timeout or use a safe-regex check before construction.

### 9. [SECURITY] metrics.ts loadFromStorage uses callback-style API
- **File:** `shared/metrics.ts:54-59`
- **Problem:** `chrome.storage.local.get(key, (result) => { resolve(result[key] as T | null || null); })` — operator precedence issue. `result[key] as T | null || null` parses as `(result[key] as T) | (null || null)` in TS, but at runtime the `||` eagerly evaluates: any falsy value (0, empty string, false) gets replaced with `null`.
- **Impact:** Metrics entries with value `0` or `false` are silently discarded.
- **Fix:** Use `result[key] ?? null` instead of `|| null`.

---

## TIER 2 — FUNCTIONAL BUGS (features broken or not working as intended)

### 10. [BUG] Voice mic button — `.start()` / `.stop()` don't exist
- **File:** `entrypoints/sidepanel/main.ts:1259-1263`
- **Problem:** (Duplicate of #1 — confirmed.) `VoiceInterface` exposes `startListening()`/`stopListening()`, not `start()`/`stop()`.

### 11. [BUG] onResult callback receives `(text, isFinal)` but sidepanel expects `(text)`
- **File:** `entrypoints/sidepanel/main.ts:1251` vs `shared/voice-interface.ts:9`
- **Problem:** The `VoiceInterface` constructor `onResult` signature is `(text: string, isFinal: boolean) => void` but sidepanel passes `onResult: text => { ... }` — the `isFinal` arg is ignored. Interim results update the input, and then the `onEnd` handler fires `handleCommand` with partial text.
- **Impact:** Voice commands execute with incomplete transcriptions.
- **Fix:** Only update input on interim; only set final text on `isFinal === true`.

### 12. [BUG] billingManager.openCheckout builds invalid URL
- **File:** `shared/billing.ts:224`
- **Problem:** `chrome.tabs.create({ url: \`${url}?client_reference_id=${clientReferenceId}\` })` — if `url` already contains query params (`?foo=bar`), this produces `?foo=bar?client_reference_id=...` (double `?`).
- **Impact:** Stripe checkout page may not load or loses client reference ID.
- **Fix:** Use `new URL(url)` and `.searchParams.set()`.

### 13. [BUG] switchToTab passes tabId to chrome.windows.update
- **File:** `entrypoints/background.ts:2256`
- **Problem:** `chrome.windows.update(tabId as unknown as number, { focused: true })` — tabId is not a windowId. This always fails silently.
- **Impact:** Tab switching doesn't focus the window.
- **Fix:** Get the tab's `windowId` from `chrome.tabs.get(tabId)` first.

### 14. [BUG] Scheduler alarm listener registered twice
- **File:** `entrypoints/background.ts:2402-2410`
- **Problem:** `schedulerEngine.initialize()` internally calls `setupAlarmListener()` which does `chrome.alarms.onAlarm.addListener(...)`. Then background.ts ALSO calls `chrome.alarms.onAlarm.addListener(alarm => { schedulerEngine.handleAlarm(alarm) })`. Every alarm fires twice.
- **Impact:** Scheduled tasks execute twice.
- **Fix:** Remove the duplicate listener in background.ts.

### 15. [BUG] `confirmActions` handler creates a new Promise each time but doesn't clean up
- **File:** `entrypoints/sidepanel/main.ts:1185-1206`
- **Problem:** If the background sends two rapid `confirmActions` messages, the first Promise is orphaned (its resolver is overwritten by the second). The first modal disappears but the background is still waiting for a response.
- **Impact:** Agent hangs waiting for confirmation that was lost.
- **Fix:** Resolve the previous Promise before creating a new one.

### 16. [BUG] Marketplace re-renders buttons every call but doesn't update install state
- **File:** `entrypoints/sidepanel/main.ts:700-726`
- **Problem:** After `installWorkflow()` succeeds, the button still says "Install" because `renderMarketplaceWorkflows()` isn't called again, and there's no tracking of installed workflows.
- **Impact:** Users don't know which workflows are already installed.
- **Fix:** Track installed workflow IDs and show "Installed" badge.

### 17. [BUG] Tab actions (openTab, closeTab, switchTab, getTabs) not in content.ts allowed list
- **File:** `entrypoints/content.ts:31-34`
- **Problem:** Content script's `allowedMessageTypes` only contains: getContext, performAction, executeActionOnPage, captureScreenshot, getSiteConfig, startModerator, stopModerator, updateModerationRules. Tab actions are handled in background.ts, so this is only a minor concern, but any `performAction` message with type `openTab` sent to content script returns false.
- **Impact:** No crash, but wasteful round-trip.

### 18. [BUG] handleCommand doesn't check `/think` with space properly after prefix fix
- **File:** `entrypoints/sidepanel/main.ts:426-432`
- **Problem:** The prefix-matching finds `/think` for input `/think analyze this`. Then `SLASH_COMMANDS['/think']()` is called. Inside `/think`, it reads `components.commandInput.value` — but `handleCommand` hasn't cleared it yet (it clears on next line). However, the `/think` handler reads the FULL input including `/think ` prefix and strips it. This works correctly.
- **Impact:** None — this is correctly implemented after the previous fix.

### 19. [BUG] clearSnapshot message handler requires taskId but clearBtn doesn't pass one
- **File:** `entrypoints/background.ts` (clearSnapshot handler) + `sidepanel/main.ts:987`
- **Problem:** Side panel sends `{ type: 'clearSnapshot' }` without `taskId`. Handler returns `{ ok: false, error: 'No taskId provided' }`. The "Clear All" feature doesn't work.
- **Impact:** Clear All Snapshots button never succeeds.
- **Fix:** Add a `clearAllSnapshots` handler or pass `taskId` for each.

---

## TIER 3 — ROBUSTNESS / EDGE CASES

### 20. [EDGE] Rate limiter in content.ts doesn't reset across page navigations
- **File:** `entrypoints/content.ts:40-51`
- **Problem:** `messageRate` Map persists in the content script context. On SPA navigations (same-page), the rate limit may falsely reject messages if many were sent to the previous "page."
- **Impact:** Rare — only affects rapid-fire messaging on SPAs.

### 21. [EDGE] SnapshotManager.clear deletes `last_active_task_id` even if other snapshots exist
- **File:** `shared/snapshot-manager.ts:52-54`
- **Problem:** When clearing one snapshot, it removes `last_active_task_id` unconditionally. If user had multiple snapshots, the "last active" pointer is lost for unrelated snapshots.
- **Impact:** Resume on startup breaks.
- **Fix:** Only clear `last_active_task_id` if it matches the cleared `taskId`.

### 22. [EDGE] Session `addActionToSession` and `addResultToSession` each do load→mutate→save
- **File:** `shared/session.ts:131-165`
- **Problem:** Each call loads all sessions, mutates one, saves all. If two calls happen concurrently (e.g., parallel action results), the second write overwrites the first's changes.
- **Impact:** Action history may lose entries under concurrency.
- **Fix:** Use a mutex or queue.

### 23. [EDGE] UsageTracker.saveMetrics called on every action without debouncing
- **File:** `entrypoints/background.ts:150-155`
- **Problem:** `trackAction` calls `saveMetrics()` synchronously (no await, but fires a chrome.storage.local.set). During rapid action execution, this hammers storage.
- **Impact:** Performance degradation during multi-step tasks.

### 24. [EDGE] Memory tab domain display shows raw XSS-safe but unstyled data
- **File:** `entrypoints/sidepanel/main.ts:777`
- **Problem:** Domain names can be very long (e.g., `subdomain.something.example.co.uk`) with no truncation or overflow handling.
- **Impact:** Layout break on long domain names.

### 25. [EDGE] `getPageContext` minimal fallback returns empty `semanticElements` array
- **File:** `entrypoints/background.ts:1596-1607`
- **Problem:** For chrome:// URLs, returns hardcoded viewport `{ width: 0, height: 0 }`. LLM may interpret this as the page didn't load.
- **Impact:** Confusing LLM responses for settings pages.

### 26. [EDGE] Swarm tab shows `recoveredTasks.textContent = snapshotsResponse.snapshots.length`
- **File:** `entrypoints/sidepanel/main.ts:964-966`
- **Problem:** Sets textContent to a number (array length), which TypeScript allows but the DOM expects a string.
- **Impact:** None functional, but technically a type mismatch.

### 27. [EDGE] `runWorkflow` has potential infinite loop
- **File:** `shared/workflows.ts:183-230`
- **Problem:** `while (currentStepId)` loop — if a workflow has circular `onSuccess`/`onError` references (e.g., step A → step B → step A), this loops forever.
- **Impact:** Background script hangs on malformed workflows.
- **Fix:** Add a max iteration guard.

### 28. [EDGE] LLM timeout hardcoded at 45 seconds
- **File:** `entrypoints/background.ts:2093`
- **Problem:** `setTimeout(() => reject(new Error('LLM call timed out after 45 seconds')), 45000)` — for complex multi-step planning on slower models, 45s may be too short.
- **Impact:** Timeout errors on complex tasks.

### 29. [EDGE] `extractDomain` function duplicated in memory.ts and metrics.ts
- **File:** `shared/memory.ts:9` and `shared/metrics.ts:37`
- **Problem:** Two identical implementations. If one is fixed/changed, the other diverges.
- **Impact:** Maintenance burden.

---

## TIER 4 — UI / UX POLISH

### 30. [UX] No empty state for Subscription tab on first load
- **File:** `entrypoints/sidepanel/index.html`
- **Problem:** Before `updateUsageDisplay()` completes, usage bars show "0 / 100" and "0 / 3" with 0% progress. There's a brief flash of unstyled data.
- **Impact:** Minor visual flicker.

### 31. [UX] Tab overflow on narrow sidepanels
- **File:** `entrypoints/sidepanel/index.html:19-27`
- **Problem:** 7 tabs (Chat, Swarm, Vision, Tasks, Memory, Marketplace, Subscription) in a horizontal row. On narrow sidepanels (< 400px), tabs overflow or get compressed to unreadable sizes.
- **Impact:** Users can't click all tabs.
- **Fix:** Add horizontal scroll or reduce tab label sizes.

### 32. [UX] Settings button emoji (⚙️) may not render on all platforms
- **File:** `entrypoints/sidepanel/index.html:30`
- **Problem:** Emoji rendering depends on OS. Some Linux builds show a blank or box.
- **Impact:** Settings button invisible on some systems.
- **Fix:** Use an SVG icon instead.

### 33. [UX] Dark mode toggle uses emoji icon that may not render
- **File:** `entrypoints/sidepanel/index.html`
- **Problem:** 🌙 and ☀️ depend on emoji support. Same issue as #32.

### 34. [UX] Mic button (🎤) has same emoji rendering issue
- **File:** `entrypoints/sidepanel/index.html:260`

### 35. [UX] No visual feedback when API key validation is in progress in options
- **File:** `entrypoints/options/main.ts:293-295`
- **Problem:** Shows "🔄 Validating..." but the input border turns orange, which may look like an error state.
- **Impact:** Users think their key is invalid before validation completes.

### 36. [UX] Subscription badge always visible (even "Free" badge)
- **File:** `entrypoints/sidepanel/main.ts:1370-1375`
- **Problem:** The badge shows "Free" in gray even for free users. This is just noise.
- **Impact:** Minor visual clutter.

### 37. [UX] Loading overlay progress bar starts at 0% and never advances
- **File:** `entrypoints/sidepanel/main.ts:1429-1435`
- **Problem:** `showLoading` sets progress to 0%. `updateProgress` is only called when `agentProgress` message has a `progress` field, which is never sent by the background script.
- **Impact:** Progress bar is stuck at 0% for the entire operation. Users see a meaningless progress indicator.
- **Fix:** Either compute synthetic progress from step/maxSteps, or hide the progress bar entirely.

### 38. [UX] No ARIA labels on interactive elements
- **File:** `entrypoints/sidepanel/index.html` (various buttons)
- **Problem:** Buttons like mic, stop, dark mode toggle have no `aria-label`.
- **Impact:** Screen reader users can't use the extension.

### 39. [UX] Confirmation modal title always says "Confirm"
- **File:** `entrypoints/sidepanel/index.html:269`
- **Problem:** Hardcoded `<h3 id="confirm-title">Confirm</h3>` — not contextual. Doesn't say what's being confirmed.
- **Impact:** Users don't know what they're confirming.

### 40. [UX] Chat history has no message timestamps
- **File:** `entrypoints/sidepanel/main.ts:358-373`
- **Problem:** Messages are added without any time indicator. In a long session, users can't tell when actions happened.
- **Impact:** Difficult to debug or trace agent behavior.

---

## TIER 5 — CODE QUALITY / MAINTAINABILITY

### 41. [CODE] `WorkflowAction` interface defined twice in types.ts
- **File:** `shared/types.ts:284-288` and `shared/types.ts:616-620`
- **Problem:** Two identical `WorkflowAction` interface declarations. TypeScript merges them, but it's confusing.
- **Fix:** Remove the duplicate.

### 42. [CODE] Many `as any` type assertions throughout background.ts
- **File:** `entrypoints/background.ts` (17+ instances)
- **Problem:** Defeats TypeScript's type safety.
- **Impact:** Maintenance risk — type errors hidden at compile time.

### 43. [CODE] Console.log statements in production code
- **File:** Every shared module
- **Problem:** Dozens of `console.log` calls that leak information in production.
- **Impact:** Performance overhead and information disclosure in console.

### 44. [CODE] `wxt.config.ts` hardcodes background.service_worker and content_scripts
- **File:** `wxt.config.ts:28-38`
- **Problem:** WXT auto-generates these from entrypoints. Hardcoding them in the manifest may cause conflicts.
- **Impact:** Potential build issues if WXT changes its output format.

### 45. [CODE] options/index.html missing closing `</div>` for `#app`
- **File:** `entrypoints/options/index.html:235`
- **Problem:** The `<div id="app">` opened at line 12 is closed at line 205, but the danger zone and tips are outside it. Not technically broken but semantically incorrect.

### 46. [CODE] No TypeScript strict null checks enforced on DOM lookups
- **File:** `entrypoints/sidepanel/main.ts:30-74`
- **Problem:** Every `safeGetElement` call uses `!` assertion. If any element is missing, it's a runtime crash rather than a compile-time error.

### 47. [CODE] `Condition` type in types.ts doesn't include `PageContext` import
- **File:** `shared/types.ts:603-606`
- **Problem:** The `Condition` interface is standalone but `checkCondition` in workflows.ts expects a `PageContext` parameter. Not a bug per se, but the coupling is implicit.

### 48. [CODE] Model name hardcoded in 3 different files
- **File:** `shared/llmClient.ts:18`, `entrypoints/options/main.ts:157,158`, `entrypoints/options/index.html:71`
- **Problem:** `'google/gemini-2.0-flash-001'` in llmClient, `'google/gemini-2.5-flash'` in options. These are DIFFERENT MODEL NAMES.
- **Impact:** Options page shows "gemini-2.5-flash" but the actual requests use "gemini-2.0-flash-001". User sees the wrong model name.
- **Fix:** Use a single constant from config.ts.

---

## Priority Fix Order

1. **#1** VoiceInterface crash (immediate)
2. **#2-4** renderMarkdown XSS (immediate)
3. **#5** loadHistory stored XSS (immediate)
4. **#48** Model name mismatch (high — user confusion)
5. **#12** Stripe checkout URL (high — revenue-blocking)
6. **#14** Double alarm listener (high — task duplication)
7. **#19** clearSnapshot never works (high — feature broken)
8. **#6** SnapshotManager wrong shape (high — data corruption)
9. **#9** Metrics falsy value loss (medium)
10. **#13** switchToTab window focus (medium)
11. **#8** Workflow regex ReDoS (medium)
12. **#27** Workflow infinite loop (medium)
13. **#7** Save on close (medium)
14. **#37** Progress bar always 0% (medium — UX credibility)
15. **#11** Voice interim results (medium)
16. **#15** Confirm modal orphan (medium)
17. **#21** SnapshotManager.clear (low)
18. **#22** Session race condition (low)
19. **#31** Tab overflow (low — UX)
20. **#38** ARIA labels (low — accessibility)
21. **#41** Duplicate interface (low — cleanup)
22. **#29** Duplicate extractDomain (low — cleanup)
23. Remaining items by tier order
