# HyperAgent — Autonomous AI Browser Agent

A Chrome extension that acts as an autonomous AI agent for web automation. Uses a ReAct loop with LLM-powered intelligence to navigate, interact, and extract data from any website.

[![Build](https://img.shields.io/badge/build-passing-green.svg)](https://github.com/ranoli90/hyper-agent)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Chrome MV3](https://img.shields.io/badge/Chrome-MV3-orange.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)

**Version:** 3.0.0

---

## Quick Start

```bash
git clone https://github.com/ranoli90/hyper-agent.git
cd hyper-agent
npm install
npm run dev
```

1. Open `chrome://extensions` → Load unpacked → `.output/chrome-mv3/`
2. Click HyperAgent icon → Options → Enter OpenRouter API key
3. Start automating

---

## What It Does

```
"Find wireless earbuds under $50 with good reviews"
"Compare prices across Amazon, Best Buy, and Walmart"
"Extract all email addresses from this page"
```

- **Context-aware** — Understands implicit requirements
- **Multi-step** — Breaks down complex workflows
- **Self-healing** — Fuzzy matching, scroll-to-reveal, retry strategies
- **Mission persistence** — Resumes after crashes

---

## Project Structure

```
hyper-agent/
├── entrypoints/       # Extension entry points
│   ├── background.ts  # Service worker (orchestration)
│   ├── content.ts     # Content script (DOM)
│   ├── sidepanel/     # Chat UI
│   └── options/       # Settings
├── shared/            # Core logic (see shared/README.md)
├── tests/             # Playwright + Vitest
└── docs/              # Architecture, contributing
```

---

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Development with hot reload |
| `npm run build` | Production build |
| `npm run test:unit` | Unit tests (Vitest) |
| `npm test` | Integration tests (Playwright) |
| `npm run type-check` | TypeScript check |

---

## Documentation

| Doc | Purpose |
|-----|---------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Architecture and data flow |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | How to contribute |
| [docs/DEVELOPER.md](docs/DEVELOPER.md) | Developer handoff |
| [shared/README.md](shared/README.md) | Shared module index |

---

## Tech Stack

- **Framework:** WXT (Chrome Extension)
- **Language:** TypeScript (strict)
- **Build:** Vite
- **LLM:** OpenRouter (Gemini 2.0 Flash)
- **Storage:** chrome.storage.local

---

## License

MIT — [Repository](https://github.com/ranoli90/hyper-agent)
