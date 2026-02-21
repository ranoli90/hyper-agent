# Shared Modules

Core business logic used by background, content script, and side panel.

---

## Core

| Module | Purpose |
|--------|---------|
| `types.ts` | All TypeScript interfaces (Action, PageContext, ExtensionMessage, etc.) |
| `config.ts` | Settings, defaults, storage keys registry (STORAGE_KEYS) |
| `llmClient.ts` | OpenRouter API, caching, response parsing, token/cost tracking |

---

## Intelligence & Planning

| Module | Purpose |
|--------|---------|
| `autonomous-intelligence.ts` | Planning engine for autonomous tasks |
| `reasoning-engine.ts` | LLM reasoning orchestration |
| `intent.ts` | Command parsing, suggestions |
| `swarm-intelligence.ts` | Multi-agent coordination |

---

## Persistence & State

| Module | Purpose |
|--------|---------|
| `session.ts` | Session management, action history |
| `memory.ts` | Site strategy learning, locator success/failure |
| `snapshot-manager.ts` | Task state persistence for resume |
| `persistent-autonomous.ts` | Never-stop autonomy, proactive suggestions |

---

## Security & Reliability

| Module | Purpose |
|--------|---------|
| `security.ts` | Data redaction (API keys, emails), rate limiting, domain policy |
| `input-sanitization.ts` | XSS protection, input validation, URL sanitization |
| `safe-regex.ts` | ReDoS protection for user regex patterns |
| `failure-recovery.ts` | Retry strategies, error classification |
| `error-boundary.ts` | Graceful degradation wrappers |
| `error-reporter.ts` | Error tracking, sensitive data redaction, future Sentry integration |

---

## Infrastructure

| Module | Purpose |
|--------|---------|
| `advanced-caching.ts` | LLM/API response caching with TTL and eviction |
| `storage-monitor.ts` | Storage quota monitoring (80%/95% warnings) |
| `memory-management.ts` | Leak detection, cleanup |
| `metrics.ts` | Performance tracking, action metrics |
| `scheduler-engine.ts` | Background task scheduling via chrome.alarms |
| `retry-circuit-breaker.ts` | Retry policies, circuit breakers for resilience |
| `contextManager.ts` | Context window management for LLM |
| `debug.ts` | Production-safe debug logging (strips in prod) |

---

## Utilities

| Module | Purpose |
|--------|---------|
| `url-utils.ts` | extractDomain and URL helpers |
| `workflows.ts` | Workflow execution, condition checking |
| `macros.ts` | Macro recording/playback |
| `billing.ts` | Stripe subscription, usage limits, tier management |
| `siteConfig.ts` | Per-domain configuration (LinkedIn, Amazon, etc.) |

---

## Feature-Specific

| Module | Purpose |
|--------|---------|
| `voice-interface.ts` | Speech-to-text input |
| `stealth-engine.ts` | Bot detection evasion |
| `tiktok-moderator.ts` | TikTok automation |
| `tool-system.ts` | Tool registry for agent actions |

---

## New Modules (2026-02)

| Module | Purpose |
|--------|---------|
| `error-reporter.ts` | Centralized error capture and reporting |
| `storage-monitor.ts` | Quota monitoring with stats and cleanup helpers |
| `debug.ts` | Environment-aware logging (dev only) |

---

## Usage Examples

### Error Reporting

```typescript
import { captureError } from './error-reporter';

try {
  await riskyOperation();
} catch (err) {
  captureError('operation_name', err, { context: 'additional info' });
}
```

### Storage Monitoring

```typescript
import { getStorageStats, checkStorageQuota } from './storage-monitor';

const stats = await getStorageStats();
console.log(`${stats.percentUsed * 100}% storage used`);

const check = await checkStorageQuota();
if (!check.ok) {
  console.warn(check.message);
}
```

### Debug Logging

```typescript
import { debug, devOnly } from './debug';

debug.log('This only appears in dev');
debug.error('Errors always log');

devOnly(() => {
  // Runs only in development
});
```
