# HyperAgent Development Journal

Condensed development history. Full iteration details archived.

---

## Current Version: 3.1.0

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

### Reliability
- SnapshotManager full shape
- saveHistory on close/hide
- Session mutex, UsageTracker debounce
- Service worker compatibility (globalThis, guards)

### User Experience
- First-run onboarding
- Offline detection
- Rate limit feedback with wait times
- Modal focus trap (accessibility)
- Dynamic Type support (rem units)

### Performance
- Lazy site config loading
- Context caching for getPageContext
- requestIdleCallback for history load

### Infrastructure
- Error reporting module
- Storage quota monitoring
- Token/cost tracking

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

---

## New Modules (2026-02)

| Module | Purpose |
|--------|---------|
| `shared/error-reporter.ts` | Error capture with redaction |
| `shared/storage-monitor.ts` | Quota monitoring (80%/95%) |
| `shared/debug.ts` | Production-safe logging |

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

See [docs/DEVELOPER.md](docs/DEVELOPER.md) for comprehensive handoff details.
