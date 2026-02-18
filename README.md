# HyperAgent — AI-Powered Browser Agent

A Chrome extension (Manifest V3) that acts as an intelligent browser automation agent. Type natural language commands and let it interact with any webpage on your behalf using a ReAct-style agentic loop.

## Features

- **Works on any website** — semantic page understanding via DOM analysis, not site-specific selectors
- **ReAct agentic loop** — Observe → Plan → Act → Re-observe, up to configurable max steps
- **Vision support** — optional screenshot capture for vision-capable LLMs (GPT-4o, Claude 3.5, Gemini 1.5)
- **Safety-first** — destructive actions (buy, submit, post, delete) require explicit user confirmation
- **Hybrid locators** — CSS → text → ARIA → role fallback chain for robust element targeting
- **Side panel chat UI** — persistent sidebar with live progress, confirmation modals, chat history
- **Configurable** — API key, base URL, model name, max steps, dry-run mode, confirmation toggle

## Quick Start

### 1. Install dependencies

```bash
cd hyper-agent
npm install
```

### 2. Development (hot reload)

```bash
npm run dev
```

This starts WXT dev server. Load the extension:
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `.output/chrome-mv3` folder

### 3. Production build

```bash
npm run build
```

The built extension is in `.output/chrome-mv3/`. You can also run `npm run zip` to create a distributable `.zip`.

### 4. Configure

1. Click the HyperAgent icon in the toolbar (or right-click → Options)
2. Enter your **API Key** for an OpenAI-compatible endpoint
3. Set the **Base URL** (default: `https://api.openai.com/v1`)
4. Choose a **Model** (default: `gpt-4o` — vision-capable models recommended)
5. Adjust max steps, confirmation toggle, and dry-run mode as needed

### 5. Use it

1. Click the HyperAgent toolbar icon to open the side panel
2. Navigate to any webpage
3. Type a command like:
   - `"Summarize this page"`
   - `"Find the search box and search for 'wireless headphones'"`
   - `"Click the first product and add it to cart"`
   - `"Go to Reddit and check my latest messages"`
4. Watch the agent work step-by-step with live progress updates
5. Confirm or cancel any destructive actions when prompted

## Architecture

```
┌─────────────────┐     messages      ┌────────────────────┐
│   Side Panel UI  │ ◄──────────────► │  Background Worker  │
│  (chat + confirm)│                  │  (ReAct loop + LLM) │
└─────────────────┘                  └─────────┬──────────┘
                                               │ messages
                                     ┌─────────▼──────────┐
                                     │   Content Script     │
                                     │ (DOM read + actions) │
                                     └─────────────────────┘
```

- **Background service worker** — orchestrates the ReAct loop, calls the LLM API, manages confirmation flow
- **Content script** — injected into every page; extracts semantic elements, resolves hybrid locators, executes DOM actions
- **Side panel** — chat interface with live status updates and confirmation modals
- **Options page** — API key, model config, safety toggles

## Project Structure

```
hyper-agent/
├── entrypoints/
│   ├── background.ts          # Service worker (ReAct loop)
│   ├── content.ts             # Content script (DOM access)
│   ├── sidepanel/
│   │   ├── index.html         # Side panel HTML
│   │   ├── main.ts            # Side panel logic
│   │   └── style.css          # Side panel styles
│   └── options/
│       ├── index.html         # Options page HTML
│       ├── main.ts            # Options page logic
│       └── style.css          # Options page styles
├── shared/
│   ├── types.ts               # All TypeScript types & message definitions
│   ├── config.ts              # Storage keys, defaults, helpers
│   └── llmClient.ts           # LLM API client with vision support
├── public/icon/               # Extension icons
├── wxt.config.ts              # WXT + manifest configuration
├── package.json
└── tsconfig.json
```

## Debugging

- **Background worker**: `chrome://extensions` → HyperAgent → "Inspect views: service worker"
- **Content script**: Open DevTools on any page → Console (filter by `[HyperAgent]`)
- **Side panel**: Right-click the side panel → Inspect

## Extending

- **Multi-tab support**: Modify `runAgentLoop` to track and switch between tab IDs
- **Memory/persistence**: Store conversation history in `chrome.storage.local` for cross-session memory
- **Tool use**: Add custom tools (e.g., calculator, web search) as additional action types
- **Site-specific overrides**: Add per-domain configuration for element selectors or step limits
