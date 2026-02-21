# HyperAgent Entrypoints

Chrome extension entry points. Each runs in a different context.

---

## Entry Points

| File | Context | Purpose |
|------|---------|---------|
| `background.ts` | Service worker | Orchestration, LLM calls, message routing, ReAct loop |
| `content.ts` | Injected in tabs | DOM extraction, element resolution, action execution |
| `sidepanel/` | Extension page | Chat UI, slash commands, tab management |
| `options/` | Extension page | Settings, API key, billing, import/export |

---

## Context Details

### Background (Service Worker)

- **Lifecycle**: Can be terminated by Chrome at any time
- **Storage**: Must use `chrome.storage.local` (no localStorage)
- **DOM**: No access (no document, no window)
- **Timers**: Use `globalThis.setInterval` or `chrome.alarms`

Key responsibilities:
- ReAct loop orchestration
- LLM API calls
- Message routing
- Session management
- Scheduler execution

### Content Script

- **Lifecycle**: Runs on every page (document_idle)
- **DOM**: Full access to page DOM
- **Communication**: `chrome.runtime.sendMessage` to background

Key responsibilities:
- Page context extraction
- Element resolution (multiple strategies)
- Action execution (click, fill, navigate, etc.)
- Screenshot capture coordination

### Side Panel

- **Lifecycle**: Opens when user clicks extension icon
- **DOM**: Owns its own document
- **Communication**: `chrome.runtime.sendMessage` to background

Key responsibilities:
- Chat interface
- Slash commands
- Tab navigation
- Status display

### Options Page

- **Lifecycle**: Opens via right-click menu or settings
- **DOM**: Owns its own document
- **Communication**: `chrome.runtime.sendMessage` to background

Key responsibilities:
- API key configuration
- Model selection
- Billing/subscription
- Import/export settings

---

## Message Flow

```
+-------------+                     +-------------+                     +-------------+
| Side Panel  | --executeCommand--> | Background  | --getContext-->     | Content     |
|             | <--agentStatus----- |             | <--contextResp---- |             |
|             | <--addMessage------ |             | --performAction-> |             |
|             | <--agentDone------- |             | <--actionResult-- |             |
+-------------+                     +-------------+                     +-------------+
                                          |
                                          | LLM API
                                          v
                                    +-------------+
                                    | OpenRouter  |
                                    +-------------+
```

### Key Messages

| From | To | Type | Purpose |
|------|-----|------|---------|
| Side Panel | Background | `executeCommand` | Start agent |
| Background | Side Panel | `agentStatus` | Running state |
| Background | Side Panel | `confirmActions` | Request approval |
| Background | Side Panel | `askUser` | Need clarification |
| Background | Side Panel | `agentDone` | Agent finished |
| Background | Content | `getContext` | Get page state |
| Background | Content | `performAction` | Execute action |

---

## Key Files

### background.ts (~2700 lines)

Main sections:
- Message handlers (switch statement)
- ReAct loop (`runAgentLoop`)
- LLM integration
- Session management
- Scheduler handlers

### content.ts (~1200 lines)

Main sections:
- `getPageContext()` - DOM extraction
- `performAction()` - Action execution
- Element resolution strategies
- Site-specific handling

### sidepanel/main.ts (~1800 lines)

Main sections:
- UI components
- Slash commands
- Tab management
- History persistence
- Export/import
