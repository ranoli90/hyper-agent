## HyperAgent LLM Coding Guide

This document is written for future AI/LLM coders working on HyperAgent. It captures the patterns, constraints, and expectations that make this codebase safe, robust, and maintainable.

If you are an LLM assisting with changes, **treat this as your system prompt for this repo.**

---

### 1. High‑level priorities

- **Safety first**: Never compromise browser or user security for convenience.
- **Determinism**: Prefer predictable control flow over cleverness. Avoid flaky behavior.
- **Minimal, aligned changes**: Touch only what you must. Keep changes consistent with existing patterns.
- **Tests + build must pass**: Always keep Playwright + Vitest green and `npm run build` passing.

---

### 2. Architecture you must respect

- **Background (`entrypoints/background.ts`)**
  - Orchestrator: handles sessions, LLM calls, action loops, security, billing.
  - Calls into `llmClient`, `session`, `memory`, `security`, `workflows`, `macros`.
  - All browser actions flow through here.

- **Sidepanel (`entrypoints/sidepanel/main.ts` + `index.html` + `style.css`)**
  - UI for chat, Memory tab, Subscription, settings modal.
  - Talks to background via `chrome.runtime.sendMessage`.
  - DOM IDs and data attributes used by tests must remain stable (`#command-input`, `#chat-history`, tab buttons, Memory tab elements, etc.).

- **Shared modules (`shared/`)**
  - `llmClient.ts`: builds prompts, calls OpenRouter/Ollama, handles history, complexity, context.
  - `session.ts`: defines `Session` and helpers for per‑session context and history.
  - `memory.ts`: per‑domain site strategies and action history (long‑term memory).
  - `config.ts`: storage keys, defaults, settings load/save, storage integrity.
  - `contextManager.ts`: in‑memory sliding context window for LLM prompts (NOT user‑visible memory).
  - `intent.ts`: parses natural‑language commands into `CommandIntent[]`.

- **Tests (`tests/`)**
  - `tests/*.spec.ts`: Playwright E2E exercising UI + basic behavior.
  - `tests/unit/*.test.ts`: Vitest unit tests for shared modules.

Before making non‑trivial changes, skim `docs/ARCHITECTURE.md` and `docs/MODULES.md` to stay aligned.

---

### 3. Memory, sessions, and learning – critical rules

**Session model (`shared/types.ts` / `shared/session.ts`):**

- `Session`:
  - `context: ContextSnapshot` with:
    - `extractedData: Record<string, unknown>`
    - `lastIntent: CommandIntent | null`
    - `lastAction: Action | null`
    - `pendingActions: Action[]`
    - `goal?: string` – inferred from first command for that tab.
    - `userReplies?: { reply: string; timestamp: number }[]`
    - `clarificationQuestions?: { question: string; timestamp: number }[]`
  - `actionHistory: Action[]` and `results: ActionResult[]` are truncated to last 100.

- Use `createSession`, `getActiveSession`, `setActiveSession`, `updateSessionContext`, `addActionToSession`, `addResultToSession`, `updateExtractedData`, `updateLastIntent`, `addUserReply`, `addClarificationQuestion` instead of writing storage directly.

**Long‑term memory (`shared/memory.ts`):**

- `SiteStrategy` per domain:
  - `successfulLocators` / `failedLocators` with counts.
  - `lastUsed`, `memoryVersion?: number`, `summary?: string`.
- `ActionLogEntry[]` for action history, with per‑domain TTL via `getDomainTTL(domain)`.
- APIs:
  - `saveActionOutcome(url, action, success, errorType?)`
  - `getStrategiesForDomain(url)`
  - `getTopLocator(url, actionType)`
  - `getRecommendedLocators(url, actionType)` (biases away from repeatedly failing locators).
  - `clearMemory()`, `clearDomainMemory(url)`
  - `getMemoryStats()` (now returns domains, totalActions, oldestEntry, `strategiesPerDomain`, `largestDomains`, `totalSessions`).

**Global learning flag (`learningEnabled` in `shared/config.ts`):**

- **All writes to durable memory/session must respect this flag.**
  - `saveActionOutcome` already exits early when `!learningEnabled`.
  - `session.ts` helpers that mutate context/history are guarded with `isLearningEnabled()`.
  - `llmClient.buildMessages` uses `learningEnabled` to decide whether to push into `ContextManager` (while still sending full messages for the current run).
- When adding new stateful helpers:
  - If they write to persistent storage (sessions, strategies, histories), **check `learningEnabled`**.
  - If they only touch transient, per‑run variables (e.g. local arrays in `background.ts`), gating is optional.

**Memory / sessions in prompts:**

- `LLMRequest` includes:
  - `sessionMeta?: { goal?: string; lastActions?: string[]; lastUserReplies?: string[]; intents?: { action: string }[] }`
  - `intents?: CommandIntent[]`
- `buildMessages(...)`:
  - Calls `analyzeTaskComplexity(command, history, intents)`.
  - Sets `mode: 'conversation' | 'automation'` and includes it in the system prompt.
  - Adds a `Session context` system block when `sessionMeta` is present.
  - Adds a `Page context status: no_page_context` system message when there is no or blank page context.
  - Enforces a soft cap on `semanticElements` based on task complexity.

**When you touch any of this:**

- Keep the **shape** of `Session`, `ContextSnapshot`, `SiteStrategy`, and `LLMRequest` consistent across:
  - `shared/types.ts`
  - `shared/session.ts`
  - `shared/memory.ts`
  - `shared/llmClient.ts`
  - `entrypoints/background.ts`
  - UI bindings in `entrypoints/sidepanel/main.ts`
- If you add fields, **flow them end‑to‑end** (type, storage, usage, tests, and docs).

---

### 4. Prompting & LLM behavior – do’s and don’ts

- **Do**:
  - Use `sanitizeForPrompt` for any user‑derived text passed into system/user messages.
  - Use `analyzeTaskComplexity` + `buildDynamicSystemPrompt` to choose model behavior; don’t bypass this.
  - Respect the JSON response contract enforced by `validateResponse`.
  - Keep the distinction between `"thinking"` and `"summary"` exactly as documented in `DYNAMIC_ACTIONS_SUFFIX`.

- **Don’t**:
  - Write new inline prompts inside random modules; keep system‑level instructions in `llmClient.ts`.
  - Return raw HTML or arbitrary markdown from the model unless the UI expects it.
  - Change response shape for `LLMResponse` without updating validation and all consumers.

When adding new behavior that needs LLM awareness (e.g., new modes, tags), extend the **system prompt once** and thread the data via `LLMRequest` / `buildMessages`.

---

### 5. Testing expectations (Playwright + Vitest)

**Unit tests (Vitest):**

- Always add or update tests in `tests/unit/*.test.ts` when:
  - You add a new exported function.
  - You change logic in `shared` modules (especially `config`, `session`, `memory`, `llmClient`, `intent`).
  - You touch observability/debug helpers (`shared/debug.ts`) or new background helper functions used by slash commands.
- Run:
  - `npm run test:unit`
  - `npm run test:coverage` for broader verification when making large changes.

**End‑to‑end tests (Playwright):**

- Files:
  - `tests/extension-basic.spec.ts`: barebones HTML/DOM sanity of the sidepanel.
  - `tests/extension.spec.ts`: sidepanel behavior with minimal Chrome mocks.
  - `tests/extension-mock.spec.ts`: **full Chrome API mock** with realistic flows (commands, modals, Memory tab, slash commands like `/clear`, `/help`, `/reset`, `/debug`).
- Use the existing mocks instead of introducing ad‑hoc stubs.
- When changing:
  - DOM IDs, data attributes, or structure in the sidepanel – **update the tests**.
  - Background messages (e.g. new message types, new required fields) – extend the mocks and add tests.
- Commands:
  - `npm run test` – full Playwright.
  - `npm run test:headed` – watch behavior visually.

New features should always come with at least:

- One **unit test** for logic.
- One **Playwright test** when user‑visible behavior or sidepanel UX changes.

---

### 6. Coding standards and pitfalls to avoid

- **TypeScript & imports**
  - Prefer explicit imports from `shared/*` modules.
  - Avoid circular dependencies; if you need cross‑module behavior, introduce slim helpers instead of large new imports.
  - Keep types in `shared/types.ts` as the single source of truth.

- **Storage & migrations**
  - Use `STORAGE_KEYS` and `loadSettings` / `saveSettings`.
  - For new storage keys:
    - Add them to `STORAGE_KEYS`.
    - Consider whether `validateStorageIntegrity` needs to know about them.
  - Keep `runMigrations` simple and additive; don’t delete user data unless explicitly requested (e.g., “Forget this site”).

- **Security**
  - Do not bypass `checkDomainAllowed`, `checkActionAllowed`, or `isSiteBlacklisted`.
  - Don’t introduce new outbound network calls besides:
    - LLM providers via `llmClient`.
    - Billing providers already supported.
  - Never log secrets, API keys, or PII.

- **Performance**
  - Avoid expensive operations in tight loops in `background.ts` (especially the action loop).
  - Use caching where appropriate (e.g. `apiCache`, `semanticCache`) instead of adding new in‑memory caches.

---

### 7. Typical change workflow for an LLM

For any non‑trivial task:

1. **Understand scope**
   - Read the relevant `shared/*` file(s).
   - Find any corresponding UI or background logic.
   - Check for existing tests referencing the behavior.

2. **Design**
   - Decide what minimal interface changes are needed (types, exports).
   - Decide where data should flow (background → shared → UI, or vice versa).
   - Check how `learningEnabled`, sessions, and memory should interact.

3. **Implement**
   - Update types first.
   - Then update core logic.
   - Then wire the UI or background.

4. **Test**
   - Run `npm run test:unit`.
   - Rebuild (`npm run build`) to catch ESBuild/Tailwind issues.
   - Run Playwright (`npm run test`).

5. **Document**
   - If behavior is user‑visible or cross‑cutting (like items 26–50), update:
     - `README.md` (high‑level mention).
     - `docs/ARCHITECTURE.md` or `docs/MODULES.md` if architecture or module semantics changed.

---

### 8. Things you must NOT do

- Do **not**:
  - Introduce new global variables on `window` or `globalThis` beyond existing patterns.
  - Bypass `llmClient.callLLM` with ad‑hoc fetches to LLM providers.
  - Store entire DOMs, screenshots, or large blobs in `chrome.storage.local` outside of existing patterns.
  - Add flaky time‑based logic (`setTimeout`‑only “fixes”).
  - Add new dependencies without updating `package.json` and justifying their use.

- When in doubt:
  - Prefer reusing existing helpers.
  - Prefer defensive programming with clear error logging.
  - Prefer explicit, small incremental changes over sweeping rewrites.

---

If you follow this guide, a future LLM (or human) should be able to pick up any new task in HyperAgent and implement it **safely, consistently, and in line with the system’s architecture**.

