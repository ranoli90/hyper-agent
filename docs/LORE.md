# HyperAgent Lore

A single reference for the project’s story, architecture, and conventions — the “lore” of how HyperAgent works and how it got here.

---

## The Big Picture

**HyperAgent** is an autonomous AI browser agent: a Chrome MV3 extension that uses an LLM (via OpenRouter) to understand natural language and automate the web. You tell it what you want in plain English; it observes the page, plans steps, acts (click, fill, navigate), and re-observes until the task is done or it hits a limit.

**Brand:** By [jobhuntin.com](https://jobhuntin.com) — AI-powered career tools.

**Current version:** 3.1.0. ReAct loop, self-healing locators, vision fallback, sessions, billing, and production hardening are all in place.

---

## How It’s Built (Architecture)

### Three contexts

| Context        | Role                          | Where it runs              |
|----------------|-------------------------------|-----------------------------|
| **Side panel** | Chat UI, commands, settings  | Extension page (own document) |
| **Background** | Brain: ReAct loop, LLM, routing | Service worker (can be killed) |
| **Content**    | Eyes and hands: DOM, actions | Injected into each tab     |

**Message flow:** Side panel ↔ Background ↔ Content. **Background is the hub.** It never talks to the content script directly from the side panel; everything goes through the background.

### ReAct loop

```
Observe → Plan → Act → Re-observe → (loop until done or max steps)
```

1. **Observe** — Content script builds page context (elements, URL, text, scroll).
2. **Plan** — Background sends context + user command to the LLM; LLM returns JSON actions.
3. **Act** — Background sends actions to content script; content script runs them (click, fill, navigate, etc.).
4. **Re-observe** — Repeat until the LLM says `done: true` or max steps is reached.

So: background orchestrates and talks to the LLM; content script is the only place that touches the page.

### Service worker rules

The background is a **service worker**. That implies:

- **No `localStorage`** — use `chrome.storage.local` only.
- **No `window` / `document`** — use `globalThis` for globals, and guard any code that might run in the worker.
- **Timers** — prefer `globalThis.setInterval` / `setTimeout` or `chrome.alarms` for anything that must survive restarts.
- **Async storage** — all storage is async; no synchronous storage APIs.

Violating these is a common source of “works in dev, breaks in production” bugs.

---

## Key Code Locations

| What you need              | Where to look                |
|----------------------------|-----------------------------|
| ReAct loop & message routing | `entrypoints/background.ts` |
| DOM, elements, actions    | `entrypoints/content.ts`    |
| LLM (OpenRouter, caching) | `shared/llmClient.ts`       |
| Types (Action, PageContext, messages) | `shared/types.ts`   |
| Security (redaction, policy, rate limits) | `shared/security.ts` |
| Config & storage keys     | `shared/config.ts`          |
| Error capture & redaction | `shared/error-reporter.ts`  |
| Storage quota              | `shared/storage-monitor.ts` |

---

## Shared Layer (“The Brain”)

The `shared/` folder holds the core logic used by background, content, and side panel:

- **Intelligence:** `autonomous-intelligence.ts`, `reasoning-engine.ts`, `intent.ts`, `swarm-intelligence.ts`
- **Persistence:** `session.ts`, `memory.ts`, `snapshot-manager.ts`, `persistent-autonomous.ts`
- **Security & reliability:** `security.ts`, `input-sanitization.ts`, `safe-regex.ts`, `failure-recovery.ts`, `error-boundary.ts`, `error-reporter.ts`
- **Infrastructure:** `advanced-caching.ts`, `storage-monitor.ts`, `memory-management.ts`, `scheduler-engine.ts`, `retry-circuit-breaker.ts`, `debug.ts`
- **Product:** `billing.ts`, `workflows.ts`, `macros.ts`, `siteConfig.ts`, `tool-system.ts`, `voice-interface.ts`, `stealth-engine.ts`, `tiktok-moderator.ts`

Storage keys are centralized in `shared/config.ts` (`STORAGE_KEYS`). New features should add keys there and use them everywhere so the “lore” of what’s stored stays consistent.

---

## Production Fixes (2026-02)

These are the main fixes that make the extension reliable and safe in production:

- **Security:** ReDoS-safe workflow regex, XSS protection for chat history, API key redaction, condition/value sanitization, import schema validation.
- **Reliability:** SnapshotManager shape, saveHistory on close/hide, session mutex, UsageTracker debounce, service worker–safe APIs and guards.
- **UX:** First-run onboarding, offline detection, rate-limit feedback with wait times, modal focus trap, rem-based typography.
- **Performance:** Lazy site config, context caching for `getPageContext`, requestIdleCallback for history load.
- **Infrastructure:** Error reporting, storage quota monitoring, token/cost tracking.

---

## Known Limitations

1. **Marketplace** — UI exists; workflow definitions are “coming soon” (display only).

---

## Version History (Condensed)

- **1.0.0** — Initial.
- **2.0.0** — Chrome MV3, WXT, OpenRouter, basic automation.
- **3.0.0** — ReAct loop, self-healing locators, vision, snapshots, security module, onboarding, dark mode, error reporting, storage monitor, many production fixes.
- **3.1.0** — $5 Beta plan, Stripe + crypto payments, model selection, accessibility improvements, task notifications.

---

## Conventions (Unwritten Lore)

- **Storage:** Always go through `chrome.storage.local` and the keys in `shared/config.ts`.
- **Messaging:** Validate message types; reject unknown types; use a single place in background to route by `message.type`.
- **Errors:** Use `withErrorBoundary` / `withGracefulDegradation` where appropriate; use the error reporter for capture and redaction.
- **Logging:** Use the debug module in shared code so logs can be stripped or reduced in production.
- **Tests:** Unit tests (Vitest) live under `tests/unit/`; E2E (Playwright) under `tests/`. AGENTS.md and README list current counts (253 unit tests).

---

## Where to Go Next

- **Architecture & data flow:** [docs/ARCHITECTURE.md](ARCHITECTURE.md)
- **Developer handoff & patterns:** [docs/DEVELOPER.md](DEVELOPER.md)
- **Contributing & code style:** [docs/CONTRIBUTING.md](CONTRIBUTING.md)
- **Setup:** [docs/SETUP.md](SETUP.md)
- **Shared module index:** [shared/README.md](../shared/README.md)
- **Entrypoints & message flow:** [entrypoints/README.md](../entrypoints/README.md)
- **Condensed dev journal:** [AGENTS.md](../AGENTS.md)
