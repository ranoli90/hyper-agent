# HyperAgent - AI-Powered Browser Automation

<p align="center">
  <img src="https://img.shields.io/badge/version-4.0.1-blue.svg" alt="Version">
  <img src="https://img.shields.io/badge/build-passing-green.svg" alt="Build">
  <img src="https://img.shields.io/badge/tests-253%20passing-brightgreen.svg" alt="Tests">
  <img src="https://img.shields.io/badge/TypeScript-5.0+-blue.svg" alt="TypeScript">
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License">
</p>

HyperAgent is a Chrome extension that uses AI to automate web browsing tasks. It supports both cloud AI (OpenRouter) and local AI (Ollama) for flexible, private automation.

---

## Features

### Core Automation
- **ReAct Loop** - Observe, Plan, Act, Re-observe for intelligent automation
- **Self-Healing Locators** - 8 strategies (CSS, text, ARIA, role, XPath, index, ariaLabel, id)
- **Vision Capabilities** - Screenshot analysis when DOM is sparse
- **Session Persistence** - Resume interrupted missions after crashes
- **Workflows** - Multi-step automation with conditions

### AI Options
- **Cloud AI** - OpenRouter API with Gemini 2.0, Claude, GPT-4o, Llama
- **Local AI** - Ollama integration for free, offline inference
- **Auto-Fallback** - Seamless switch between local and cloud AI

### Security
- **Domain Control** - Allowlist/blocklist any site
- **Rate Limiting** - Prevent runaway automation
- **Data Redaction** - Automatic API key masking
- **Sandboxed** - Chrome extension sandbox

---

## Quick Start

### Prerequisites
- Node.js 18+ (20 LTS recommended)
- npm 9+

### Installation

```bash
git clone https://github.com/ranoli90/hyper-agent.git
cd hyper-agent
npm install
npm run build
npm run fix:utf8    # MANDATORY - fixes UTF-8 encoding
```

> **⚠️ CRITICAL: Always run `npm run fix:utf8` after build.**
> See [BUILD.md](BUILD.md) for detailed build instructions and troubleshooting.

### Load Extension

1. Open Chrome and go to `chrome://extensions`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select the `.output/chrome-mv3` directory
5. Click the HyperAgent icon and enter your OpenRouter API key

### Optional: Local AI (Ollama)

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | bash

# Start the server
ollama serve

# Pull a model
ollama pull llama3.2:3b
```

Enable "Use Local AI" in Settings for free offline automation.

---

## Development

```bash
npm run dev          # Development server
npm run build        # Production build
npm run fix:utf8     # MANDATORY after build
npm run test:unit    # Run unit tests (253 tests)
npm run test:e2e     # Run E2E tests
npm run type-check   # TypeScript check
```

> **⚠️ Always run `npm run fix:utf8` after `npm run build` or the extension won't load.**

---

## Project Structure

```
hyper-agent/
├── entrypoints/
│   ├── background.ts      # Service worker, ReAct loop
│   ├── content.ts         # DOM interaction, actions
│   ├── sidepanel/         # Chat UI, tabs
│   └── options/           # Settings page
├── shared/
│   ├── llmClient.ts       # OpenRouter/Ollama API
│   ├── config.ts          # Settings, storage
│   ├── security.ts        # Domain policy, redaction
│   ├── billing.ts         # Subscription management
│   └── types.ts           # TypeScript interfaces
├── public/
│   └── icons/             # Extension icons
├── tests/
│   ├── unit/              # Vitest unit tests
│   └── *.spec.ts          # Playwright E2E tests
└── docs/
    ├── ARCHITECTURE.md    # System design
    ├── DEVELOPER.md       # Developer guide
    ├── ROADMAP.md         # Feature roadmap
    └── SETUP.md           # Setup instructions
```

---

## Configuration

### API Key
Get an API key from [OpenRouter](https://openrouter.ai/) and enter it in Settings. Supports:
- google/gemini-2.0-flash-001 (default)
- anthropic/claude-3.5-sonnet
- openai/gpt-4o
- meta-llama/llama-3.1-70b-instruct

### Settings

| Setting | Default | Description |
|---------|---------|-------------|
| maxSteps | 12 | Maximum agent loop iterations |
| enableVision | true | Use screenshot analysis |
| autoRetry | true | Auto-retry on failures |
| requireConfirm | false | Require confirmation before actions |
| dryRun | false | Simulation mode (no real actions) |

---

## Pricing

| Tier | Price | Features |
|------|-------|----------|
| **Community** | $0 | 500 actions/day, cloud AI |
| **Beta** | $5/mo | Unlimited actions, priority AI |

---

## Documentation

- [Architecture](docs/ARCHITECTURE.md) - System design and data flow
- [Developer Guide](docs/DEVELOPER.md) - Contributing guide
- [Roadmap](docs/ROADMAP.md) - Feature roadmap
- [Setup](docs/SETUP.md) - Installation walkthrough

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Extension | WXT, Chrome MV3, TypeScript |
| AI | OpenRouter, Ollama, Gemini 2.0 |
| Storage | chrome.storage.local |
| Testing | Vitest, Playwright |

---

## License

MIT - See [LICENSE](LICENSE) for details.

Built by [jobhuntin.com](https://jobhuntin.com)
