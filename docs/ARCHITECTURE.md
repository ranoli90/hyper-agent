# HyperAgent Architecture

> How the extension is structured and how data flows between components.

---

## Overview

HyperAgent is a Chrome MV3 extension with three main execution contexts:

```
+------------------+     chrome.runtime.sendMessage     +--------------------+
|   Side Panel     | <--------------------------------> |  Background Worker |
|   (UI layer)     |                                    |  (Service Worker)  |
+------------------+                                    +---------+----------+
                                                                  | chrome.tabs.sendMessage
                                                                  v
                                                        +---------------------+
                                                        |   Content Script    |
                                                        |   (injected in tab) |
                                                        +---------------------+
```

| Context | Role | Lifecycle |
|---------|------|-----------|
| Side Panel | User interface (chat, commands, settings) | Opens when user clicks extension icon |
| Background Worker | Orchestration, LLM calls, state management | Service worker (can be terminated) |
| Content Script | DOM access, element resolution, actions | Runs on every page |

---

## ReAct Loop

The agent follows Observe -> Plan -> Act -> Re-observe:

```
+----------+     +----------+     +----------+     +----------+
| Observe  | --> |   Plan   | --> |   Act    | --> | Re-obs   |
+----------+     +----------+     +----------+     +----------+
     ^                                                |
     +------------------------------------------------+
```

1. **Observe**: Content script extracts page context (elements, URL, text, scroll position)
2. **Plan**: Background sends context + command to LLM; LLM returns JSON actions
3. **Act**: Background sends actions to content script; content script executes
4. **Re-observe**: Loop until `done: true` or max steps reached

### Step Execution

```
User Command
     |
     v
+-------------+     +-------------+     +-------------+
| getContext  | --> |   callLLM   | --> | performAction|
+-------------+     +-------------+     +-------------+
                          |                    |
                          v                    v
                    +----------+         +----------+
                    | Thinking |         | Result   |
                    +----------+         +----------+
```

---

## Message Types

### Side Panel -> Background

| Type | Purpose |
|------|---------|
| `executeCommand` | Start agent with natural language command |
| `stopAgent` | Abort running agent |
| `userConfirm` | User approved/rejected action preview |
| `userReply` | User answered agent question |
| `getMemoryStats` | Get learning engine stats |
| `installWorkflow` | Install marketplace workflow |

### Background -> Side Panel

| Type | Purpose |
|------|---------|
| `agentStatus` | Agent running state |
| `confirmActions` | Request approval for actions |
| `askUser` | Agent needs clarification |
| `agentDone` | Agent completed (success/failure) |
| `addMessage` | Add message to chat |

### Background -> Content Script

| Type | Purpose |
|------|---------|
| `getContext` | Extract page context |
| `performAction` | Execute DOM action |
| `captureScreenshot` | Take visible tab screenshot |

---

## Storage

All data stored in `chrome.storage.local` (async, persists across service worker restarts).

### Storage Keys

All keys prefixed with `hyperagent_`:

| Key | Type | Purpose |
|-----|------|---------|
| `hyperagent_api_key` | string | User's OpenRouter API key |
| `hyperagent_model_name` | string | LLM model identifier |
| `hyperagent_max_steps` | number | Max agent loop iterations |
| `hyperagent_site_strategies` | object | Per-domain learning |
| `hyperagent_sessions` | array | Saved sessions |
| `hyperagent_scheduled_tasks` | array | Scheduler tasks |
| `hyperagent_chat_history` | string | Chat backup (HTML) |
| `hyperagent_command_history` | array | Recent commands |

### Storage Quota

- Extension has `unlimitedStorage` permission
- Storage quota monitoring at 80%/95% thresholds
- See `shared/storage-monitor.ts`

---

## Security

### Domain Policy

```typescript
// In security.ts
interface SecurityPolicy {
  maxActionsPerMinute: number;
  requireConfirmationFor: ('fill' | 'click' | 'navigate')[];
  allowExternalUrls: boolean;
}
```

### Data Redaction

Sensitive data automatically redacted in logs:
- API keys (sk-*, AIza*, AKIA*, etc.)
- Email addresses
- Phone numbers
- Credit card patterns
- Passwords/tokens

See `shared/security.ts` for patterns.

### Rate Limiting

- Per-sender message rate limit: 240/minute
- Command rate limit: 1 second between commands
- LLM 429 handling with Retry-After

---

## Caching

Three cache layers in `shared/advanced-caching.ts`:

| Cache | TTL | Max Size | Eviction |
|-------|-----|----------|----------|
| apiCache | 15 min | 500 | LRU |
| generalCache | 30 min | 1000 | LRU |
| assetCache | 60 min | 200 | LRU |

---

## Key Files

| File | Purpose |
|------|---------|
| `entrypoints/background.ts` | ReAct loop, message routing, orchestration |
| `entrypoints/content.ts` | DOM extraction, element resolution, actions |
| `entrypoints/sidepanel/main.ts` | Chat UI, commands, tabs |
| `entrypoints/options/main.ts` | Settings, billing integration |
| `shared/types.ts` | TypeScript interfaces |
| `shared/llmClient.ts` | OpenRouter API, caching |
| `shared/config.ts` | Settings, defaults, storage keys |
| `shared/security.ts` | Domain policy, redaction |

---

## Error Handling

### Error Reporter

`shared/error-reporter.ts` provides:
- Error capture with context
- Sensitive data redaction
- Configurable sampling
- Future Sentry integration

### Error Boundary

`shared/error-boundary.ts` provides:
- `withErrorBoundary()` - Log and re-throw
- `withGracefulDegradation()` - Log and return fallback

---

## Service Worker Constraints

Service workers can be terminated at any time. Critical considerations:

1. **No synchronous storage** - Always `await chrome.storage.local.get()`
2. **No DOM access** - Guard `document` and `window`
3. **No localStorage** - Use `chrome.storage.local`
4. **Timer persistence** - Use `chrome.alarms` for scheduled tasks
5. **State persistence** - Store state in `chrome.storage.local`

---

## See Also

- [shared/README.md](../shared/README.md) - Module index
- [docs/DEVELOPER.md](./DEVELOPER.md) - Developer guide
- [public/PRIVACY_POLICY.md](../public/PRIVACY_POLICY.md) - Privacy policy
