# HyperAgent Architecture

> How the extension is structured and how data flows between components.

## Overview

HyperAgent is a Chrome MV3 extension with three main execution contexts:

```
┌─────────────────┐     chrome.runtime.sendMessage     ┌────────────────────┐
│   Side Panel    │ ◄────────────────────────────────► │  Background Worker  │
│   (UI layer)    │                                    │  (Service Worker)   │
└─────────────────┘                                    └─────────┬──────────┘
                                                                 │ chrome.tabs.sendMessage
                                                                 ▼
                                                       ┌─────────────────────┐
                                                       │   Content Script     │
                                                       │   (injected in tab)  │
                                                       └─────────────────────┘
```

- **Side Panel**: User interface (chat, commands, tabs). Runs in extension context.
- **Background Worker**: Orchestration, LLM calls, state. Runs as service worker.
- **Content Script**: DOM access, element resolution, actions. Runs in page context.

## ReAct Loop

The agent follows Observe → Plan → Act → Re-observe:

1. **Observe**: Content script extracts page context (elements, URL, text).
2. **Plan**: Background sends context + command to LLM; LLM returns JSON actions.
3. **Act**: Background sends actions to content script; content script executes.
4. **Re-observe**: Loop until `done: true` or max steps.

## Key Paths

| Purpose | Entry Point |
|---------|-------------|
| User types command | `sidepanel/main.ts` → `handleCommand()` → `executeCommand` message |
| Agent loop | `background.ts` → `runAgentLoop()` |
| DOM extraction | `content.ts` → `getContext` handler |
| LLM calls | `shared/llmClient.ts` → `callLLM()` |

## Storage

- **chrome.storage.local**: Settings, chat history, snapshots, workflows, metrics.
- **No localStorage** in background (service worker).

## Shared Modules

See [shared/README.md](../shared/README.md) for the module index.
