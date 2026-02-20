# HyperAgent Development Journal

Condensed development history. Full iteration details archived.

## Current Version: 3.0.0

### Key Architectural Patterns

**ReAct Loop** — Observe → Plan → Act → Re-observe. Background orchestrates; content script executes.

**Self-Healing Locators** — Fuzzy text, ARIA, role+text, scroll-to-reveal when primary locators fail.

**Service Worker Constraints** — Use `chrome.storage.local`, not localStorage. All storage is async.

**Message Flow** — Side panel ↔ Background ↔ Content script. Background is the hub.

### Production Fixes (2026-02)

- ReDoS protection for workflow regex
- XSS protection for chat history load
- SnapshotManager full shape
- saveHistory on close/hide
- Voice final-only execution
- Session mutex, UsageTracker debounce
- TypeScript message types, LLM timeout config

### Key Code Locations

| Pattern | Location |
|---------|----------|
| ReAct loop | `entrypoints/background.ts` |
| Element resolution | `entrypoints/content.ts` |
| LLM integration | `shared/llmClient.ts` |
| Types | `shared/types.ts` |

See [docs/DEVELOPER.md](docs/DEVELOPER.md) for handoff details.
