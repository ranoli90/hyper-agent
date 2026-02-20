# Developer Guide

Handoff documentation for developers working on HyperAgent.

## Quick Start

```bash
npm install && npm run dev
# Load .output/chrome-mv3 in chrome://extensions
# Set API key in Options
```

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md).

## Key Files

| File | Purpose |
|------|---------|
| `entrypoints/background.ts` | ReAct loop, message routing, orchestration |
| `entrypoints/content.ts` | DOM extraction, element resolution, actions |
| `entrypoints/sidepanel/main.ts` | Chat UI, commands, tabs |
| `shared/types.ts` | All TypeScript interfaces |
| `shared/llmClient.ts` | LLM API, caching |
| `shared/config.ts` | Settings, defaults |

## Security & Storage

**API key storage** — API keys are stored in `chrome.storage.local` (extension storage), unencrypted. Only the extension can access them. Do not share exported settings files.

**localStorage in service worker** — Use `chrome.storage.local` instead.

**Synchronous storage** — All storage is async: `await chrome.storage.local.get(...)`.

**Private in subclasses** — Use `protected` for properties accessed by subclasses.

## LLM

- **Model:** `google/gemini-2.0-flash-001` (config in `shared/config.ts`)
- **Endpoint:** OpenRouter `https://openrouter.ai/api/v1`
- **Timeout:** `DEFAULTS.LLM_TIMEOUT_MS` (45s default)

## Message Flow

```
Side Panel ←→ Background ←→ Content Script
              ↓
           LLM API
```

## Build Output

```
.output/chrome-mv3/
├── manifest.json
├── background.js
├── content-scripts/content.js
├── chunks/options-*.js, sidepanel-*.js
└── assets/
```

## Production Fixes Applied (2026-02)

- ReDoS protection for workflow regex
- XSS protection for chat history load
- SnapshotManager full AgentSnapshot shape
- saveHistory on visibilitychange/beforeunload
- Voice: execute only on final transcription
- extractDomain consolidated in url-utils
- Session mutex for race conditions
- UsageTracker save debouncing
- TypeScript message type union complete
- LLM timeout from config

## Resources

- [WXT](https://wxt.dev/)
- [Chrome Extensions](https://developer.chrome.com/docs/extensions/)
