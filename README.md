# HyperAgent — Autonomous AI Browser Agent

A Chrome extension that acts as an autonomous AI agent for web automation. Uses a ReAct loop with LLM-powered intelligence to navigate, interact, and extract data from any website.

[![Build](https://img.shields.io/badge/build-passing-green.svg)](https://github.com/ranoli90/hyper-agent)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Chrome MV3](https://img.shields.io/badge/Chrome-MV3-orange.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Tests](https://img.shields.io/badge/tests-80%20passing-brightgreen.svg)](./tests)

**Version:** 3.0.0

---

## Quick Start

```bash
git clone https://github.com/ranoli90/hyper-agent.git
cd hyper-agent
npm install
npm run build
```

1. Open `chrome://extensions` → Enable Developer Mode → Load unpacked → `.output/chrome-mv3/`
2. Click HyperAgent icon in toolbar → Open Settings → Enter your OpenRouter API key
3. Start automating with natural language commands

---

## Features

### Core Capabilities
- **ReAct Loop** — Observe → Plan → Act → Re-observe for intelligent automation
- **Self-healing Locators** — Multiple strategies (CSS, text, ARIA, role, XPath) with fuzzy matching
- **Vision Capabilities** — Screenshot analysis when DOM is sparse or complex
- **Session Persistence** — Resume interrupted missions after crashes
- **Multi-step Workflows** — Break down complex tasks automatically

### Security & Privacy
- **Domain Allowlist/Blocklist** — Control which sites can be automated
- **Action Rate Limiting** — Prevent runaway automation
- **Confirmation Prompts** — Optional approval before sensitive actions
- **Data Redaction** — Automatic redaction of API keys, emails, phone numbers in logs
- **Local Storage Only** — Your data stays in your browser

### User Experience
- **Dark Mode** — System preference detection + manual toggle
- **First-run Onboarding** — Guided setup for new users
- **Offline Detection** — Graceful handling of network issues
- **Export/Import** — Backup and restore settings and chat history
- **Accessibility** — ARIA live regions, keyboard navigation, focus traps

---

## What It Does

```
"Find wireless earbuds under $50 with good reviews"
"Compare prices across Amazon, Best Buy, and Walmart"
"Extract all email addresses from this page"
"Fill out this form with my contact information"
"Navigate to settings and enable dark mode"
```

---

## Project Structure

```
hyper-agent/
├── entrypoints/
│   ├── background.ts     # Service worker (orchestration, ReAct loop)
│   ├── content.ts        # Content script (DOM, actions)
│   ├── sidepanel/        # Chat UI
│   └── options/          # Settings page
├── shared/
│   ├── llmClient.ts      # OpenRouter integration
│   ├── security.ts       # Domain policy, redaction
│   ├── memory.ts         # Learning engine
│   ├── workflows.ts      # Workflow execution
│   ├── error-reporter.ts # Error tracking
│   └── storage-monitor.ts# Storage quota management
├── tests/
│   ├── unit/             # Vitest unit tests
│   └── e2e/              # Playwright E2E tests
├── public/
│   ├── icons/            # Extension icons
│   ├── PRIVACY_POLICY.md # Privacy policy
│   └── PERMISSIONS.md    # Permission justifications
└── docs/                 # Documentation
```

---

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Development with hot reload |
| `npm run build` | Production build |
| `npm run test:unit` | Unit tests (Vitest) - 80 tests |
| `npm run test:e2e` | E2E tests (Playwright) |
| `npm run type-check` | TypeScript check |

---

## Slash Commands

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/clear` | Clear chat history |
| `/export` | Export all settings |
| `/export-chat` | Export chat history only |
| `/import` | Import settings from file |
| `/memory` | Search stored knowledge |
| `/schedule` | Manage background tasks |
| `/tools` | List available agent tools |
| `/think` | Toggle verbose reasoning |

---

## Documentation

| Doc | Purpose |
|-----|---------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture and data flow |
| [docs/DEVELOPER.md](docs/DEVELOPER.md) | Developer handoff and key patterns |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | How to contribute |
| [docs/SETUP.md](docs/SETUP.md) | Detailed setup instructions |
| [shared/README.md](shared/README.md) | Shared module index |
| [public/PRIVACY_POLICY.md](public/PRIVACY_POLICY.md) | Privacy policy |
| [public/PERMISSIONS.md](public/PERMISSIONS.md) | Permission justifications |

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| WXT | Chrome Extension framework |
| TypeScript | Type-safe JavaScript (strict mode) |
| Vite | Build tooling |
| OpenRouter | LLM API gateway |
| Gemini 2.0 Flash | Primary LLM model |
| Vitest | Unit testing |
| Playwright | E2E testing |

---

## Configuration

### Required
- **API Key** — Get from [OpenRouter](https://openrouter.ai/keys)

### Optional
- **Base URL** — Default: `https://openrouter.ai/api/v1`
- **Model** — Default: `google/gemini-2.0-flash-001`
- **Max Steps** — Default: 12 (max: 50)
- **Require Confirmation** — Ask before actions

---

## Security

- API keys stored in Chrome extension storage (accessible only by HyperAgent)
- No data sent to external servers except LLM API calls
- Payment processing via Stripe (card details never touch our servers)
- See [public/PRIVACY_POLICY.md](public/PRIVACY_POLICY.md) for details

---

## License

MIT — [Repository](https://github.com/ranoli90/hyper-agent)

---

## Contributing

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines.
