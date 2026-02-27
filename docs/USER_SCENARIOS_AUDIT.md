# 50 User Scenarios Audit – Chat & Automation Issues

Analysis of 50 different user personas/use cases when using the chat function and browser automation. Issues found are tagged by severity and area.

---

## 1. **Power user – rapid-fire commands**
- **Scenario:** Sends 5 commands in 2 seconds.
- **Issues:** Rate limit (1s) blocks; no queue; second command lost. `COMMAND_RATE_LIMIT_MS` may feel arbitrary.
- **Area:** Chat, UX
- **Severity:** Medium

## 2. **Non-English speaker – commands in Spanish**
- **Scenario:** "Busca auriculares inalámbricos en Amazon"
- **Issues:** LLM handles it, but example commands and suggestions are English-only. No i18n.
- **Area:** Chat, UX
- **Severity:** Low

## 3. **Accessibility user – screen reader**
- **Scenario:** Uses NVDA/JAWS; relies on ARIA and focus.
- **Issues:** Thinking toggle may not announce expand/collapse; modals may not trap focus correctly on all paths; suggestions list role="option" but no aria-activedescendant.
- **Area:** Sidepanel, a11y
- **Severity:** Medium

## 4. **Mobile user – side panel on small screen**
- **Scenario:** Uses extension on tablet or small window.
- **Issues:** Side panel width fixed; chat history may be cramped; example command buttons could overflow.
- **Area:** Sidepanel, CSS
- **Severity:** Low

## 5. **Copy-paste from external source**
- **Scenario:** Pastes "Go to example.com" from a doc that includes zero-width chars or RTL markers.
- **Issues:** `sanitizeInput` strips control chars but not Unicode bidi/ZWJ; could affect display or LLM.
- **Area:** Input sanitization
- **Severity:** Low

## 6. **User pastes very long command (5000 chars)**
- **Scenario:** Pastes a huge block of text as a command.
- **Issues:** `MAX_COMMAND_LENGTH` is 2000; input is truncated; no warning before truncation.
- **Area:** Chat, UX
- **Severity:** Medium

## 7. **User closes side panel mid-task**
- **Scenario:** Closes panel while agent is running.
- **Issues:** Agent continues; user may not see progress or completion; `sendToSidePanel` fails silently if no listener.
- **Area:** Background, messaging
- **Severity:** High

## 8. **User switches tabs during automation**
- **Scenario:** Clicks another tab while agent is acting on page A.
- **Issues:** Agent may still target original tab; `currentTabId` could become stale; tab check added but context may be wrong.
- **Area:** Background, tab management
- **Severity:** High

## 9. **User on a slow connection**
- **Scenario:** High latency; LLM calls take 30+ seconds.
- **Issues:** Loading overlay may feel stuck; no progress indication; timeout may fire without clear message.
- **Area:** Chat, LLM
- **Severity:** Medium

## 10. **User with API key near limit**
- **Scenario:** OpenRouter rate limit or quota almost exhausted.
- **Issues:** 429 errors; `classifyError` handles it but message may be generic; no proactive warning.
- **Area:** LLM, billing
- **Severity:** Low

## 11. **User asks "what can you do?"**
- **Scenario:** Conversational query, no automation.
- **Issues:** Agent should respond with `done: true`, `actions: []`; may work but not explicitly tested.
- **Area:** LLM, chat
- **Severity:** Low

## 12. **User says "hey" or "hello"**
- **Scenario:** Greeting only.
- **Issues:** Should get friendly reply; system prompt supports it; `summary` vs `thinking` fix should prevent duplicate.
- **Area:** Chat
- **Severity:** Fixed

## 13. **User requests destructive action – "delete all emails"**
- **Scenario:** High-risk action.
- **Issues:** `isDestructive` triggers confirmation; but "delete all" might not be in the list; confirmation text could be clearer.
- **Area:** Background, safety
- **Severity:** Medium

## 14. **User on a page with iframes**
- **Scenario:** Page has multiple iframes; agent tries to click inside one.
- **Issues:** Content script may not run in all iframes; `executeActionOnPage` targets main frame; cross-origin iframes not supported.
- **Area:** Content script, automation
- **Severity:** High

## 15. **User on a SPA with dynamic DOM**
- **Scenario:** React/Vue app; elements change after load.
- **Issues:** Locators may become stale; retry/scroll helps but no explicit wait for stability.
- **Area:** Content script
- **Severity:** Medium

## 16. **User with many tabs open (50+)**
- **Scenario:** Heavy tab user.
- **Issues:** `getPageContext` and tab ops may slow; no tab limit; `chrome.tabs` API can be slow with many tabs.
- **Area:** Background
- **Severity:** Low

## 17. **User runs /clear then immediately sends command**
- **Scenario:** Clears chat, sends new command in &lt;500ms.
- **Issues:** `saveHistory` debounced; clear may not persist before new message; possible race.
- **Area:** Chat persistence
- **Severity:** Low

## 18. **User imports malicious settings file**
- **Scenario:** Imports JSON with XSS in `chat_history_backup`.
- **Issues:** Import sanitizes with `inputSanitizer`; `allowedTags` limit; but `alreadySafeHtml` could be bypassed if validation is wrong.
- **Area:** Import, security
- **Severity:** Medium (mitigated)

## 19. **User with corrupted storage**
- **Scenario:** `chat_history_backup` has invalid HTML from old build.
- **Issues:** `loadHistory` has corruption detection; clears and shows examples; may miss some corruption patterns.
- **Area:** Chat load
- **Severity:** Low

## 20. **User sends command with emoji**
- **Scenario:** "Click the 🔍 search button"
- **Issues:** Emoji in locator text; content script uses `visibleText`; may or may not match depending on DOM.
- **Area:** Content script, locators
- **Severity:** Low

## 21. **User on a page with shadow DOM**
- **Scenario:** Custom elements with shadow roots.
- **Issues:** `semanticElements` extraction may not pierce shadow DOM; clicks may fail.
- **Area:** Content script
- **Severity:** High

## 22. **User asks for clarification then cancels**
- **Scenario:** Agent asks "What city?"; user closes ask modal without replying.
- **Issues:** `askResolve('')` sends empty reply; agent gets empty string; may loop or give generic error.
- **Area:** Ask modal, clarification
- **Severity:** Medium

## 23. **User confirms destructive action then regrets it**
- **Scenario:** Clicks Confirm, then realizes mistake.
- **Issues:** No undo; action executes immediately.
- **Area:** Confirmation flow
- **Severity:** Low (by design)

## 24. **User uses /think with vague task**
- **Scenario:** "/think do something useful"
- **Issues:** Autonomous mode may return empty plan; falls back to traditional; user may get "I understood. What would you like me to do next?"
- **Area:** Autonomous, chat
- **Severity:** Low

## 25. **User on a paywalled page**
- **Scenario:** Page shows login wall or paywall.
- **Issues:** Agent may try to interact with limited DOM; no explicit handling for auth-required pages.
- **Area:** Automation
- **Severity:** Low

## 26. **User with browser in incognito**
- **Scenario:** Extension in incognito (if allowed).
- **Issues:** Storage may differ; sessions not shared; no special handling.
- **Area:** Storage, session
- **Severity:** Low

## 27. **User with strict privacy settings**
- **Scenario:** `allowedDomains` limits where agent can act.
- **Issues:** Domain check happens; user gets "Domain not allowed"; message could be clearer.
- **Area:** Privacy, UX
- **Severity:** Low

## 28. **User runs scheduled task while offline**
- **Scenario:** Scheduler fires; no network.
- **Issues:** LLM call fails; error handling exists; user may not see toast if panel closed.
- **Area:** Scheduler, network
- **Severity:** Medium

## 29. **User exports chat with sensitive data**
- **Scenario:** Exports chat containing passwords, SSNs, etc.
- **Issues:** Export warns about sensitive data; no automatic redaction.
- **Area:** Export, privacy
- **Severity:** Low

## 30. **User with multiple monitors**
- **Scenario:** Side panel on secondary monitor; different DPI.
- **Issues:** Screenshot coordinates may be off; vision capture might capture wrong screen.
- **Area:** Screenshot, vision
- **Severity:** Low

## 31. **User sends empty command (spaces only)**
- **Scenario:** Types "   " and presses Enter.
- **Issues:** `handleCommand` checks `text.trim()`; empty is rejected; no feedback.
- **Area:** Chat
- **Severity:** Low

## 32. **User uses Arrow Up with no history**
- **Scenario:** New session; presses Up.
- **Issues:** `navigateHistory('up')` returns null; input unchanged; OK.
- **Area:** Command history
- **Severity:** None

## 33. **User on a page that blocks automation**
- **Scenario:** Site has `navigator.webdriver` checks or bot detection.
- **Issues:** Stealth engine may help; not all sites covered.
- **Area:** Content script, stealth
- **Severity:** Medium

## 34. **User requests "extract all links" on 10k-link page**
- **Scenario:** Huge page.
- **Issues:** `semanticElements` capped at 250; `bodyText` at 15k; extraction may be partial; performance risk.
- **Area:** Context extraction
- **Severity:** Medium

## 35. **User with vision disabled**
- **Scenario:** `enableVision: false`.
- **Issues:** No screenshot fallback; sparse pages may fail; agent doesn't know vision is off.
- **Area:** Vision, config
- **Severity:** Low

## 36. **User sends command with newlines**
- **Scenario:** Multi-line command.
- **Issues:** Textarea supports Shift+Enter; command sent as-is; LLM receives it; should work.
- **Area:** Chat
- **Severity:** None

## 37. **User clicks suggestion then edits**
- **Scenario:** Selects /memory, adds " for passwords".
- **Issues:** Suggestion inserts "/memory "; user can edit; command becomes "/memory for passwords" which may not match slash command.
- **Area:** Suggestions
- **Severity:** Low

## 38. **User on a page with CAPTCHA**
- **Scenario:** Agent needs to pass CAPTCHA.
- **Issues:** No CAPTCHA handling; will fail.
- **Area:** Automation
- **Severity:** Expected

## 39. **User with form autofill disabled**
- **Scenario:** Browser blocks autofill.
- **Issues:** Agent uses `fill` action; not browser autofill; should work.
- **Area:** Automation
- **Severity:** None

## 40. **User switches language mid-session**
- **Scenario:** Changes OS/browser language.
- **Issues:** Extension has no i18n; UI stays English.
- **Area:** i18n
- **Severity:** Low

## 41. **User with very long chat history (500+ messages)**
- **Scenario:** Never clears; history grows.
- **Issues:** `compressHistory` and `compactContext` help; but `chat_history_backup` stores HTML; could hit storage limit (5MB for local).
- **Area:** Storage, persistence
- **Severity:** High

## 42. **User sends same command twice in a row**
- **Scenario:** "Search for X" twice.
- **Issues:** Semantic cache may return cached response; could be stale if page changed.
- **Area:** LLM cache
- **Severity:** Low

## 43. **User on a page with mixed RTL/LTR**
- **Scenario:** Arabic + English page.
- **Issues:** Text extraction and locators may have ordering issues.
- **Area:** Content script
- **Severity:** Low

## 44. **User with JavaScript disabled on page**
- **Scenario:** No-JS page.
- **Issues:** Content script won't run if page blocks scripts; extension may not inject.
- **Area:** Content script
- **Severity:** Edge case

## 45. **User requests "fill form with my data"**
- **Scenario:** Expects stored profile.
- **Issues:** No built-in profile storage; agent would need to ask or fail.
- **Area:** Automation, data
- **Severity:** Medium

## 46. **User uses /export then /delete-data**
- **Scenario:** Exports, then deletes.
- **Issues:** Delete requires typing "DELETE"; export is separate; OK.
- **Area:** Data management
- **Severity:** None

## 47. **User on a page that opens popups**
- **Scenario:** Click triggers `window.open`.
- **Issues:** New tab/popup; agent may not track it; `currentTabId` could be wrong.
- **Area:** Tab management
- **Severity:** Medium

## 48. **User with hardware keyboard shortcuts**
- **Scenario:** Ctrl+L to clear; Ctrl+S for settings.
- **Issues:** Documented in /shortcuts; may conflict with browser.
- **Area:** Shortcuts
- **Severity:** Low

## 49. **User sends command during onboarding**
- **Scenario:** Onboarding modal open; types and presses Enter.
- **Issues:** Command input may still receive focus; command could execute; modal might block view.
- **Area:** Onboarding, chat
- **Severity:** Low

## 50. **User with extension updated mid-session**
- **Scenario:** Chrome updates extension while agent is running.
- **Issues:** Service worker may restart; agent state lost; `agentLoopRunning` reset; user sees incomplete result.
- **Area:** Background, lifecycle
- **Severity:** High

---

## Summary of New Issues to Address

| # | Issue | Severity | Area |
|---|-------|----------|------|
| 7 | Side panel closed mid-task – agent continues, user unaware | High | Messaging |
| 8 | Tab switch during automation – stale tabId/context | High | Tab mgmt |
| 21 | Shadow DOM – elements not found | High | Content |
| 41 | Very long history – storage limit | High | Storage |
| 50 | Extension update mid-session – state lost | High | Lifecycle |
| 14 | Iframes – content script runs in main frame only; elements inside iframes not found. Use `allFrames: true` + frameId routing for full support. | High | Content |
| 6 | Long command truncated without warning | Medium | UX |
| 22 | Cancel ask modal – empty reply handling | Medium | Clarification |
| 34 | Huge page extraction – performance/limits | Medium | Context |
| 28 | Scheduled task offline – no user feedback | Medium | Scheduler |

---

## Recommendations

1. **Panel closed:** Persist "last result" and show toast or badge when panel reopens.
2. **Tab switch:** Re-validate `currentTabId` each step; optionally pause when active tab changes.
3. **Shadow DOM:** Add `{ mode: 'open' }` piercing or `querySelector` with `::part()` where supported.
4. **Storage:** Cap `chat_history_backup` size; trim oldest when exceeding ~1MB.
5. **Extension update:** Use `chrome.runtime.onSuspend` or similar to signal user; consider resume from snapshot.
6. **Iframes:** Content script runs in main frame. Add `allFrames: true` to content script + frameId in sendMessage for iframe support. Cross-origin iframes remain inaccessible.
7. **Long command:** Show character count and warning before 2000.
8. **Cancel ask:** Treat empty reply as "user declined"; send `userReply: '[cancelled]'` and let agent handle.
9. **Huge page:** Add pagination or streaming for extraction; cap `semanticElements` with warning.
10. **Scheduled offline:** Queue task retry; show notification when back online.
