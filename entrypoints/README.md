# Entrypoints

Chrome extension entry points. Each runs in a different context.

| File | Context | Purpose |
|------|---------|---------|
| `background.ts` | Service worker | Orchestration, LLM, message routing |
| `content.ts` | Injected in tabs | DOM extraction, element resolution, actions |
| `sidepanel/` | Extension page | Chat UI, commands, tabs |
| `options/` | Extension page | Settings, API key |

## Message Flow

- **Side panel** sends `executeCommand`, `confirmResponse`, etc. to background.
- **Background** sends `getContext`, `executeActionOnPage` to content script.
- **Background** calls LLM and coordinates the ReAct loop.
