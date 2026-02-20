# HyperAgent — Autonomous AI Browser Agent

**The world's most intelligent browser automation system.** HyperAgent is a Chrome extension that acts as a genuinely autonomous AI agent, capable of understanding and executing ANY task without preprogrammed workflows.

[![Build Status](https://img.shields.io/badge/build-passing-green.svg)](https://github.com/ranoli90/hyper-agent)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Chrome Extension](https://img.shields.io/badge/Chrome-MV3-orange.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)

**Current Version:** 3.0.0 | **Last Updated:** 2026-02-20

---

## Quick Start

```bash
# Clone & Install
git clone https://github.com/ranoli90/hyper-agent.git
cd hyper-agent
npm install

# Development (hot reload)
npm run dev

# Production build
npm run build

# Run integration tests (Playwright)
npm test

# Run unit tests (Vitest)
npm run test:unit

# Run all tests
npm run test:all
```

### Configure

1. Load extension in Chrome: `chrome://extensions` → "Load unpacked" → `.output/chrome-mv3/`
2. Click HyperAgent icon → Options
3. Enter OpenRouter API key
4. Start automating!

---

## What HyperAgent Can Do

### Universal Web Automation

```
"Find me wireless earbuds under $50 with good reviews"
"Compare prices for this product across Amazon, Best Buy, and Walmart"
"Summarize the latest developments in quantum computing"
"Extract all email addresses from this webpage"
```

### Intelligent Features

- **Context-Aware Understanding**: Recognizes implicit requirements
- **Multi-Step Complex Tasks**: Breaks down and executes complex workflows
- **Error Recovery**: Self-healing locators, scroll-to-reveal, fuzzy matching
- **Mission Persistence**: Auto-saves snapshots to resume after crashes
- **Stealth Mode**: Human-like interaction modeling to avoid bot detection

---

## Tech Stack

| Category  | Technology                           |
| --------- | ------------------------------------ |
| Framework | WXT (Chrome Extension)               |
| Language  | TypeScript (strict mode)             |
| Build     | Vite 6.4.1                           |
| Runtime   | Chrome MV3 Service Worker            |
| LLM       | OpenRouter (Google Gemini 2.0 Flash) |
| Testing   | Playwright                           |
| Storage   | chrome.storage.local                 |

---

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

### Core Components

| Component         | File                        | Purpose                                    |
| ----------------- | --------------------------- | ------------------------------------------ |
| Background Worker | `entrypoints/background.ts` | ReAct loop orchestration, state management |
| Content Script    | `entrypoints/content.ts`    | DOM manipulation, element resolution       |
| LLM Client        | `shared/llmClient.ts`       | API calls, response caching                |
| Types             | `shared/types.ts`           | All TypeScript interfaces                  |

### Advanced Systems

| System                | File                              | Lines | Purpose                                  |
| --------------------- | --------------------------------- | ----- | ---------------------------------------- |
| Persistent Autonomous | `shared/persistent-autonomous.ts` | 730   | Never-stop autonomy, session persistence |
| Swarm Intelligence    | `shared/swarm-intelligence.ts`    | 477   | Multi-agent coordination                 |
| Advanced Caching      | `shared/advanced-caching.ts`      | 834   | Response caching, invalidation           |
| Memory Management     | `shared/memory-management.ts`     | 749   | Leak detection, cleanup                  |
| Input Sanitization    | `shared/input-sanitization.ts`    | 560   | XSS protection                           |
| Failure Recovery      | `shared/failure-recovery.ts`      | 400   | Intelligent retry strategies             |
| Stealth Engine        | `shared/stealth-engine.ts`        | 400   | Bot detection evasion                    |

---

## Project Structure

```
hyper-agent/
├── entrypoints/
│   ├── background.ts          # Service worker (orchestration)
│   ├── content.ts             # Content script (DOM access)
│   ├── sidepanel/             # UI (vanilla JS)
│   └── options/               # Settings page
├── shared/                    # Core business logic (29 connected modules)
│   ├── types.ts               # All TypeScript interfaces
│   ├── llmClient.ts           # LLM API client
│   ├── config.ts              # Settings & configuration
│   ├── autonomous-intelligence.ts
│   ├── swarm-intelligence.ts
│   ├── persistent-autonomous.ts
│   └── ... (25+ more)
├── tests/                     # Playwright tests
├── .output/                   # Build output
├── STATUS.md                  # Developer handoff documentation
└── AGENTS.md                  # Development journal
```

---

## Build Status

| Metric         | Value         |
| -------------- | ------------- |
| Build Size     | 317.39 kB     |
| Tests          | 19/19 passing |
| Background JS  | 146.57 kB     |
| Content Script | 49.57 kB      |

---

## Key Features

### Self-Healing Locators

When element not found:

1. Fuzzy text matching
2. ARIA label matching
3. Role + text combination
4. Scroll-to-reveal lazy content
5. Vision-based fallback

### Multi-Level Caching

- LLM response caching (15 min TTL)
- API response caching
- Tag-based invalidation

### Security

- Input sanitization for all commands
- XSS protection
- API key stored in chrome.storage.local

---

## Debugging

- **Background worker**: `chrome://extensions` → HyperAgent → "service worker"
- **Content script**: DevTools → Console (filter: `[HyperAgent]`)
- **Side panel**: Right-click side panel → Inspect

---

## Documentation

- **STATUS.md** - Complete developer handoff documentation
- **AGENTS.md** - Development journal with all iterations

---

## License

MIT License - See LICENSE file for details.

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Run tests: `npm test`
4. Build: `npm run build`
5. Submit a pull request

---

**Repository:** https://github.com/ranoli90/hyper-agent
