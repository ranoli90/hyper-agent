# HyperAgent Developer Guide

Complete handoff documentation for developers working on HyperAgent.

---

## Quick Start

```bash
npm install && npm run dev
# Load .output/chrome-mv3 in chrome://extensions
# Set API key in Options
```

---

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md).

**Core Pattern: ReAct Loop**
Observe -> Plan -> Act -> Re-observe

---

## Key Files

| File | Purpose |
|------|---------|
| `entrypoints/background.ts` | ReAct loop, message routing, orchestration |
| `entrypoints/content.ts` | DOM extraction, element resolution, actions |
| `entrypoints/sidepanel/main.ts` | Chat UI, commands, tabs |
| `shared/types.ts` | All TypeScript interfaces |
| `shared/llmClient.ts` | LLM API, caching |
| `shared/config.ts` | Settings, defaults, storage keys |
| `shared/security.ts` | Domain policy, redaction |
| `shared/error-reporter.ts` | Error tracking |
| `shared/storage-monitor.ts` | Storage quota |

---

## Security & Storage

**API key storage** - Stored in chrome.storage.local (extension storage), unencrypted. Only the extension can access. Do not share exported settings files.

**Service worker constraints:**
- Use `chrome.storage.local` instead of localStorage
- Use `globalThis.setInterval` instead of window.setInterval
- Guard `document` and `window` access

---

## LLM

| Setting | Value |
|---------|-------|
| Model | google/gemini-2.0-flash-001 |
| Endpoint | https://openrouter.ai/api/v1 |
| Timeout | 45s (configurable) |
| Max Tokens | 4096 per request |
| Session Limit | 100,000 tokens |

---

## Message Flow

```
Side Panel <-> Background <-> Content Script
                |
            LLM API
```

---

## Testing

```bash
npm run test:unit   # 80 tests (Vitest)
npm run test:e2e    # Playwright
```

---

## Production Fixes Applied (2026-02)

### Security
- ReDoS protection for workflow regex
- XSS protection for chat history load
- Import schema validation
- API key redaction in logs
- Condition value sanitization

### Reliability
- SnapshotManager full shape
- saveHistory on visibilitychange
- Session mutex for race conditions
- Service worker compatibility

### Performance
- Lazy site config loading
- Context caching for getPageContext
- requestIdleCallback for history load

### Infrastructure
- Error reporting module
- Storage quota monitoring
- Token/cost tracking

---

## Known Limitations

### LLM Retry Integration
The retry infrastructure exists in shared/retry-circuit-breaker.ts but is not yet integrated into llmClient.ts. Requires wrapping fetch calls with retry logic.

### Workflow Condition Execution
Workflow conditions are not evaluated during runWorkflow - checkCondition exists but lacks page context.

### Marketplace Workflows
No actual workflow definitions - only display metadata. Labeled "Coming Soon".

---

## Cache TTL Settings

| Cache | TTL | Purpose |
|-------|-----|---------|
| apiCache | 15 min | LLM responses |
| generalCache | 30 min | General data |
| assetCache | 60 min | Static assets |

---

## Resources

- [WXT](https://wxt.dev/)
- [Chrome Extensions](https://developer.chrome.com/docs/extensions/)
- [OpenRouter](https://openrouter.ai/docs)
