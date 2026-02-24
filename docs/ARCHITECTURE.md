# HyperAgent Architecture

System design and data flow for the Chrome extension.

---

## Overview

HyperAgent is a Chrome MV3 extension with three execution contexts:

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

1. **Observe**: Content script extracts page context (elements, URL, text)
2. **Plan**: Background sends context + command to LLM; LLM returns JSON actions
3. **Act**: Background sends actions to content script; content script executes
4. **Re-observe**: Loop until `done: true` or max steps reached

---

## Message Types

### Side Panel -> Background

| Type | Purpose |
|------|---------|
| `executeCommand` | Start agent with natural language command |
| `stopAgent` | Abort running agent |
| `userConfirm` | User approved/rejected action preview |
| `userReply` | User answered agent question |

### Background -> Side Panel

| Type | Purpose |
|------|---------|
| `agentStatus` | Agent running state |
| `confirmActions` | Request approval for actions |
| `askUser` | Agent needs clarification |
| `agentDone` | Agent completed |

### Background -> Content Script

| Type | Purpose |
|------|---------|
| `getContext` | Extract page context |
| `performAction` | Execute DOM action |
| `captureScreenshot` | Take visible tab screenshot |

---

## Storage

All data stored in `chrome.storage.local` with `hyperagent_` prefix:

| Key | Type | Purpose |
|-----|------|---------|
| `hyperagent_api_key` | string | OpenRouter API key |
| `hyperagent_model_name` | string | LLM model identifier |
| `hyperagent_max_steps` | number | Max agent loop iterations |
| `hyperagent_site_strategies` | object | Per-domain learning |
| `hyperagent_sessions` | array | Saved sessions |
| `hyperagent_scheduled_tasks` | array | Scheduler tasks |

Extension has `unlimitedStorage` permission.

---

## Key Files

| File | Purpose |
|------|---------|
| `entrypoints/background.ts` | ReAct loop, message routing |
| `entrypoints/content.ts` | DOM extraction, actions |
| `entrypoints/sidepanel/main.ts` | Chat UI, tabs |
| `entrypoints/options/main.ts` | Settings, billing |
| `shared/types.ts` | TypeScript interfaces |
| `shared/llmClient.ts` | OpenRouter/Ollama API |
| `shared/config.ts` | Settings, storage keys |
| `shared/security.ts` | Domain policy, redaction |

---

## Security

### Domain Policy
- Allowlist/blocklist for site access
- Rate limiting (240 messages/minute)
- Action confirmation for sensitive operations

### Data Redaction
Sensitive data automatically redacted in logs:
- API keys (sk-*, AIza*, AKIA*, etc.)
- Email addresses
- Phone numbers
- Credit card patterns

---

## Service Worker Constraints

Service workers can be terminated at any time:

1. Use `chrome.storage.local` instead of localStorage
2. Use `chrome.alarms` for scheduled tasks
3. Guard `document` and `window` access
4. Store state in `chrome.storage.local`

---

## See Also

- [DEVELOPER.md](./DEVELOPER.md) - Developer guide
- [SETUP.md](./SETUP.md) - Setup instructions
