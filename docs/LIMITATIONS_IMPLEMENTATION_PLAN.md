# HyperAgent Limitations – Full Implementation Plan

End-to-end plan to address all identified limitations, with research, open-source projects, and phased rollout.

---

## Phase 1: Technical / Automation (High Impact)

### 1.1 Iframe Support

**Current:** Content script runs in main frame only; elements inside iframes not found.

**Research:**
- `all_frames: true` in manifest injects into same-origin iframes
- Cross-origin iframes remain inaccessible (browser security)
- Frame routing: `chrome.tabs.sendMessage(tabId, msg, { frameId })` for targeted messaging

**Implementation:**
1. Add `all_frames: true` to content script in `wxt.config.ts` / manifest
2. In content script: detect `window !== window.top` and set `frameId` in responses
3. In background: pass `frameId` when calling `chrome.scripting.executeScript` for actions
4. In `executeActionOnPage`: add `frameId` to `chrome.tabs.sendMessage` when targeting a specific frame
5. Document: "Same-origin iframes supported; cross-origin iframes not supported"

**Open Source:**
- Chrome docs: [Content Scripts - all_frames](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts)
- No library needed; native API

**Effort:** 2–3 days

---

### 1.2 Shadow DOM (Enhanced)

**Current:** Custom `queryAllWithShadow` exists; coverage may be incomplete for complex selectors.

**Research:**
- [query-selector-shadow-dom](https://github.com/webdriverio/query-selector-shadow-dom) (260★) – `querySelectorDeep`, `querySelectorAllDeep` pierce nested shadow roots
- Note: README says "production use not advised" for test tools; core logic is reusable
- Can pass `iframe.contentDocument` as 2nd param for iframe + shadow DOM

**Implementation:**
1. Add dependency: `npm install query-selector-shadow-dom`
2. Replace or augment `queryAllWithShadow` with `querySelectorAllDeep` for complex selectors
3. Use for: `findByIndex`, `findByCss`, `findByAria`, `findByRole`, `findByText`
4. Fallback: keep custom impl for simple cases; use library for nested/complex

**GitHub:** https://github.com/webdriverio/query-selector-shadow-dom

**Effort:** 1–2 days

---

### 1.3 Tab Switch During Automation

**Current:** Agent may target wrong tab if user switches.

**Implementation:**
1. Before each action step: `chrome.tabs.get(agentState.currentAgentTabId)` – if error, abort
2. Optional: `chrome.tabs.onActivated` – if user switches away, pause and show "Paused – switched tab. Resume?"
3. Store `currentAgentTabId` in `chrome.storage.local` each step for recovery after SW restart

**Effort:** 1 day

---

## Phase 2: User Experience

### 2.1 LLM Streaming (Real-Time Display)

**Current:** Full response shown at once; no streaming.

**Research:**
- OpenRouter supports `stream: true` – SSE format, `data: ` lines, `[DONE]` terminator
- Content: `parsed.choices[0].delta.content`
- Chrome docs: Use `append()` not `textContent` for efficient DOM updates

**Implementation:**
1. In `llmClient.ts`: add `streamChatCompletion()` using `fetch` + `ReadableStream`
2. Parse SSE: buffer lines, extract `data: {...}`, handle `[DONE]` and mid-stream errors
3. Emit chunks via callback or async generator
4. In background: call streaming API; send `agentProgress` with `streamChunk` for each chunk
5. In sidepanel: append chunks to current message bubble; render markdown incrementally (or on complete)

**Open Source:**
- [eventsource-parser](https://github.com/rexxars/eventsource-parser) – SSE parsing
- [Vercel AI SDK](https://www.npmjs.com/package/ai) – streaming helpers (heavier)

**Effort:** 3–4 days

---

### 2.2 Message Search

**Current:** No search in chat history.

**Implementation:**
1. Add search input above chat history
2. Filter `chatHistory.querySelectorAll('.chat-msg')` by text content
3. Highlight matches; scroll to first
4. Optional: store plain-text index in `chrome.storage.local` for large histories

**Effort:** 1 day

---

### 2.3 Internationalization (i18n)

**Current:** English-only UI.

**Research:**
- Chrome `chrome.i18n` API – `/_locales/{locale}/messages.json`, `__MSG_key__` in manifest/HTML
- `chrome.i18n.getMessage("key")` in JS

**Implementation:**
1. Create `_locales/en/messages.json` (and `es`, `de`, etc.)
2. Extract all user-facing strings to message keys
3. Replace hardcoded strings with `chrome.i18n.getMessage()`
4. Add `default_locale` to manifest

**Open Source:**
- [chrome-extension-localization](https://github.com/schmich/chrome-extension-localization) – MIT, organize locales

**Effort:** 2–3 days

---

### 2.4 Offline & Scheduled Tasks

**Current:** Limited offline handling; scheduled tasks unclear when offline.

**Research:**
- Workbox `workbox-background-sync` – queues failed requests, retries when online
- Chrome Background Sync API – for PWAs; extensions can use `chrome.alarms` + IndexedDB
- `chrome.alarms` – persists across SW restarts

**Implementation:**
1. Scheduled tasks: store in `chrome.storage.local`; use `chrome.alarms` for next run
2. When offline: skip execution; set `nextRun` to retry when online
3. `navigator.onLine` + `online` event: re-check alarms, run missed tasks
4. Toast: "X scheduled tasks will run when you're back online"

**Effort:** 2 days

---

## Phase 3: Reliability & Lifecycle

### 3.1 Extension Update Mid-Session

**Current:** SW restart loses in-memory state; task interrupted.

**Research:**
- No `onSuspend` in MV3; persist state to `chrome.storage.local` incrementally
- Save: `currentCommand`, `currentStep`, `currentTabId`, `history` each step
- On panel reopen: check `hyperagent_agent_interrupted_by_update`; show message (already done)
- Optional: resume from snapshot – complex; Phase 2

**Implementation:**
1. Each agent step: `chrome.storage.local.set({ hyperagent_agent_checkpoint: {...} })`
2. On `onInstalled` (update): if checkpoint exists, set `hyperagent_agent_interrupted_by_update`
3. Panel: "Task was interrupted by update. Run again?" with last command pre-filled

**Effort:** 1 day

---

### 3.2 Panel Closed Mid-Task

**Current:** Last result persisted; shown on reopen (done).

**Enhancement:**
- Badge on extension icon: "1" when task completes while panel closed
- `chrome.action.setBadgeText({ text: '1' })` on agentDone when no listener
- Clear badge when panel opens

**Effort:** 0.5 day

---

## Phase 4: Platform & Accessibility

### 4.1 Accessibility (a11y)

**Current:** Screen reader support partial; focus trapping may have gaps.

**Implementation:**
1. Thinking toggle: `aria-expanded`, `aria-controls`, `role="button"`
2. Modals: `aria-modal="true"`, `aria-labelledby`, focus trap on all close paths
3. Suggestions: `aria-activedescendant` when navigating with keyboard
4. Progress: `aria-live="polite"` for status updates

**Open Source:**
- [focus-trap](https://github.com/focus-trap/focus-trap) – robust focus trapping
- [aria-hidden](https://www.w3.org/WAI/ARIA/apg/) – WAI-ARIA patterns

**Effort:** 2 days

---

### 4.2 Mobile / Small Screen

**Current:** Side panel fixed width; cramped on small screens.

**Implementation:**
1. CSS: `min-width`, `max-width`, responsive breakpoints
2. Example buttons: flex-wrap, scroll if needed
3. Tab bar: horizontal scroll on narrow panels

**Effort:** 1 day

---

## Phase 5: Security & Billing

### 5.1 Stripe Backend Verification (Optional)

**Current:** Client-only; no server-side verification.

**Implementation:**
1. Backend endpoint: `POST /verify-subscription` with `subscriptionId`, `customerId`
2. Server uses Stripe secret key to verify
3. Extension calls endpoint after payment redirect; stores verified state

**Effort:** 2–3 days (requires backend)

---

### 5.2 API Key Encryption at Rest

**Current:** Stored in `chrome.storage.local` unencrypted.

**Research:**
- Web Crypto API: `crypto.subtle.encrypt` with user-derived key (e.g. from password)
- Trade-off: password prompt on each use vs. convenience

**Implementation:**
- Phase 2: document as limitation; optional "lock with password" feature later

**Effort:** 2 days (if implemented)

---

## Open Source Projects Summary

| Project | Purpose | License | Use Case |
|---------|---------|---------|----------|
| [query-selector-shadow-dom](https://github.com/webdriverio/query-selector-shadow-dom) | Shadow DOM piercing | MIT | Element location in web components |
| [eventsource-parser](https://github.com/rexxars/eventsource-parser) | SSE parsing | MIT | OpenRouter streaming |
| [focus-trap](https://github.com/focus-trap/focus-trap) | Modal focus management | MIT | Accessibility |
| [chrome-extension-localization](https://github.com/schmich/chrome-extension-localization) | i18n structure | MIT | Multi-language UI |
| Chrome Workbox (Background Sync) | Offline queue | Apache 2.0 | Scheduled tasks offline |

---

## Recommended Rollout Order

| Phase | Items | Est. Total |
|-------|-------|------------|
| **1** | Iframes, Shadow DOM (library), Tab switch | ~5 days |
| **2** | Streaming, Message search, i18n (en + 1 locale), Offline tasks | ~9 days |
| **3** | Extension update checkpoint, Panel closed badge | ~1.5 days |
| **4** | Accessibility, Mobile CSS | ~3 days |
| **5** | Stripe backend (if needed), API key encryption (optional) | ~4 days |

**Total:** ~22 days for Phases 1–4 (core UX + reliability). Phase 5 is optional.

---

## Quick Wins (< 1 day each)

1. **Tab validation** – Re-check `currentAgentTabId` before each step
2. **Panel closed badge** – `chrome.action.setBadgeText` on completion
3. **Message search** – Simple DOM filter
4. **Character count warning** – Show at 90% of 2000 (already have counter)
5. **Offline input disable** – Disable command input when `!navigator.onLine`

---

## Dependencies to Add

```json
{
  "query-selector-shadow-dom": "^1.0.1",
  "eventsource-parser": "^4.0.0",
  "focus-trap": "^7.0.0"
}
```

---

## References

- [Chrome Content Scripts - all_frames](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts)
- [OpenRouter Streaming API](https://openrouter.ai/docs/api/reference/streaming)
- [Chrome i18n](https://developer.chrome.com/docs/extensions/reference/api/i18n)
- [Chrome MV3 Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- [Workbox Background Sync](https://developer.chrome.com/docs/workbox/modules/workbox-background-sync)
