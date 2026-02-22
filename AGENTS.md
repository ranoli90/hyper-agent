# HyperAgent Development Journal

Condensed development history. Full iteration details archived.

---

## Current Version: 3.1.0

**Status:** Production Ready

**Last Updated:** 2026-02-22

---

## Project Status

| Metric | Status |
|--------|--------|
| Build | Passing |
| Unit Tests | 253/253 passing |
| E2E Tests | 19/19 passing |
| Type Check | Passing |
| Lint | 0 errors |
| Chrome Web Store | Ready for submission |

---

## Key Architectural Patterns

**ReAct Loop** — Observe -> Plan -> Act -> Re-observe. Background orchestrates; content script executes.

**Self-Healing Locators** — Fuzzy text, ARIA, role+text, scroll-to-reveal when primary locators fail.

**Service Worker Constraints** — Use `chrome.storage.local`, not localStorage. All storage is async. Use `globalThis.setInterval`, not `window.setInterval`.

**Message Flow** — Side panel <-> Background <-> Content script. Background is the hub.

---

## Production Fixes (2026-02)

### Security
- ReDoS protection for workflow regex
- XSS protection for chat history load
- API key redaction in logs (expanded patterns)
- Condition.value sanitization
- Import schema validation
- Navigation URL validation

### Reliability
- Agent loop lock (prevent concurrent execution)
- Tab title restoration per-tab
- UsageTracker initialization with loadPromise
- Background interval tracking for cleanup
- Tab closure check for correct agent tab
- Confirmation/reply timeout cleanup
- WeakRef cleanup for indexed elements
- beforeunload cleanup for visual elements
- Stale messageRate entry cleanup

### Workflow System
- Self-reference detection
- Orphaned steps detection
- Whitespace-only name validation
- Safe regex warning

### Scheduler
- Context check before messages
- Initialization lock
- Notification button click handler
- Interval clamping (min 1 minute)

### Billing
- Crypto verification error handling
- Real-time ETH price fetching (CoinGecko)

### TikTok Moderator
- Element selector (not DOM reference) - memory leak fix
- Log size limits (MAX_LOG_ENTRIES)
- Semantic rate limiting

### Code Quality
- All lint errors fixed
- Service worker compatibility (globalThis, guards)
- Memory leak prevention patterns
- Unused variable cleanup

---

## Key Code Locations

| Pattern | Location |
|---------|----------|
| ReAct loop | `entrypoints/background.ts` |
| Element resolution | `entrypoints/content.ts` |
| LLM integration | `shared/llmClient.ts` |
| Types | `shared/types.ts` |
| Security | `shared/security.ts` |
| Storage keys | `shared/config.ts` (STORAGE_KEYS) |
| Error reporting | `shared/error-reporter.ts` |
| Storage monitor | `shared/storage-monitor.ts` |
| Billing | `shared/billing.ts` |
| Workflows | `shared/workflows.ts` |
| Scheduler | `shared/scheduler-engine.ts` |
| TikTok Moderator | `shared/tiktok-moderator.ts` |

---

## Modules

| Module | Purpose |
|--------|---------|
| `shared/error-reporter.ts` | Error capture with redaction |
| `shared/storage-monitor.ts` | Quota monitoring (80%/95%) |
| `shared/debug.ts` | Production-safe logging |
| `shared/memory-management.ts` | Memory leak prevention |
| `shared/input-sanitization.ts` | XSS protection |
| `shared/safe-regex.ts` | ReDoS protection |

---

## Tests

| File | Tests |
|------|-------|
| `background-handlers.test.ts` | 120 |
| `billing.test.ts` | 39 |
| `config.test.ts` | 16 |
| `intent.test.ts` | 18 |
| `llmClient.test.ts` | 34 |
| `security.test.ts` | 10 |
| `storage.test.ts` | 13 |
| `workflows.test.ts` | 3 |
| **Total** | **253** |

---

## Known Limitations

1. **Marketplace** — Display only, no workflow definitions

---

## Documentation

- [README.md](../README.md) — User guide and quick start
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — System architecture
- [docs/DEVELOPER.md](docs/DEVELOPER.md) — Developer handoff
- [docs/STORE_READINESS.md](docs/STORE_READINESS.md) — Chrome Web Store checklist
- [docs/FIRST_USER_READINESS.md](docs/FIRST_USER_READINESS.md) — First user checklist
- [docs/LORE.md](docs/LORE.md) — Project story and conventions
