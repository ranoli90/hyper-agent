# HyperAgent — The Ultimate Personal AI Infrastructure

<p align="center">
  <img src="https://img.shields.io/badge/version-4.0.0-blue.svg" alt="Version">
  <img src="https://img.shields.io/badge/build-passing-green.svg" alt="Build">
  <img src="https://img.shields.io/badge/tests-253%20passing-brightgreen.svg" alt="Tests">
  <img src="https://img.shields.io/badge/TypeScript-5.0+-blue.svg" alt="TypeScript">
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License">
</p>

> **HyperAgent** is the only AI agent that combines the simplicity of a browser extension with the power of a desktop companion. Run free with Ollama or scale with cloud AI. Automate your web life, control your system, and connect everywhere you already chat.

---

## Why HyperAgent?

| Feature | HyperAgent | Clawbot | Browser-Only Agents |
|---------|------------|---------|---------------------|
| **Setup Time** | <5 min | 30+ min | <5 min |
| **System Control** | ✅ (Companion) | ✅ | ❌ |
| **Offline AI** | ✅ (Ollama) | ✅ | ❌ |
| **Messaging Apps** | ✅ (WhatsApp, etc.) | ✅ (15+) | ❌ |
| **Skills Marketplace** | Coming Soon | ✅ (565+) | ❌ |
| **Vision AI** | ✅ (Gemini) | ❌ | ⚠️ |
| **Privacy** | ✅ Local-first | ✅ Local-first | ⚠️ |

---

## Quick Start

### Browser Extension (Minutes)

```bash
git clone https://github.com/ranoli90/hyper-agent.git
cd hyper-agent
npm install
npm run build
```

1. Open `chrome://extensions` → Enable Developer Mode → Load unpacked → `.output/chrome-mv3/`
2. Click HyperAgent icon → Settings → Enter OpenRouter API key (or skip for Ollama)
3. Start automating: "Find wireless earbuds under $50"

### Local AI (Ollama) — Free Forever

HyperAgent v4.0+ supports **free offline AI** via Ollama:

```bash
# Install Ollama (one-time)
curl -fsSL https://ollama.ai/install.sh | bash

# Start the server
ollama serve

# Pull a model (optional - defaults to llama3.2:3b)
ollama pull llama3.2:3b
```

Then in HyperAgent Settings:
1. Enable "Use Local AI" 
2. Or just start automating — it auto-detects Ollama!

---

## Features

### Core Automation
- **ReAct Loop** — Observe → Plan → Act → Re-observe for intelligent automation
- **Self-Healing Locators** — 8 strategies (CSS, text, ARIA, role, XPath, index)
- **Vision Capabilities** — Screenshot analysis when DOM is sparse
- **Session Persistence** — Resume interrupted missions after crashes
- **Workflows** — Multi-step automation with conditions

### Local AI (v4.0+)
- **Ollama Integration** — Free offline inference (llama3.2, mistral, codellama)
- **Auto-Fallback** — Seamless switch between local and cloud AI
- **Zero API Costs** — Run entirely free with local models

### Messaging Gateway (v4.1+)
- **WhatsApp** — Native web-based automation
- **Telegram** — Bot API integration
- **Discord** — Bot integration
- **Unified Inbox** — Single history across platforms

### Desktop Control (v4.2+)
- **Shell Commands** — Execute system commands
- **File Operations** — Read/write files
- **System Tray** — Background operation
- **Home Assistant** — IoT control

### Security & Privacy
- **Local-Only** — Your data never leaves your infrastructure
- **Domain Control** — Allowlist/blocklist any site
- **Rate Limiting** — Prevent runaway automation
- **Data Redaction** — Automatic API key masking
- **Sandboxed** — Chrome extension sandbox + optional companion

---

## Pricing

| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0 | Ollama (local), browser automation, 1 companion |
| **Pro** | $9.99/mo | Unlimited cloud AI, all messaging, priority support |
| **Team** | $29.99/mo | 5 seats, shared workflows, enterprise SSO |
| **Enterprise** | Custom | Self-hosted, custom integrations, SLA |

*Students and educators: Free Pro tier with .edu email*

---

## Documentation

| Guide | Description |
|-------|-------------|
| [docs/README.md](docs/README.md) | Full documentation index |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design and data flow |
| [docs/COMPARISON.md](docs/COMPARISON.md) | vs Clawbot, vs alternatives |
| [docs/SKILLS.md](docs/SKILLS.md) | Building and sharing skills |
| [docs/COMPANION_APP.md](docs/COMPANION_APP.md) | Desktop companion setup |
| [docs/SETUP.md](docs/SETUP.md) | Installation walkthrough |
| [docs/DEVELOPER.md](docs/DEVELOPER.md) | Contributing guide |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Extension | WXT, Chrome MV3, TypeScript |
| Desktop | Tauri 2.0, Rust |
| AI | OpenRouter, Ollama, Gemini 2.0 |
| Messaging | WhatsApp Web, Telegram Bot API, Discord.js |
| Storage | chrome.storage.local, SQLite (companion) |

---

## Community

- **Discord**: [Join the conversation](https://discord.gg/hyperagent)
- **GitHub**: [Star us](https://github.com/ranoli90/hyper-agent)
- **Twitter**: [@hyperagentai](https://twitter.com/hyperagentai)
- **Reddit**: r/hyperagent

---

## Comparison with Clawbot

See [docs/COMPARISON.md](docs/COMPARISON.md) for detailed analysis.

| Dimension | HyperAgent | Clawbot | Winner |
|-----------|------------|---------|--------|
| Setup Time | <5 min | 30+ min | HyperAgent |
| Browser Automation | Extension-native | Desktop-only | HyperAgent |
| Vision AI | ✅ Gemini | ❌ | HyperAgent |
| Offline | ✅ Ollama | ✅ Ollama | Tie |
| Messaging | 3 (growing) | 15+ | Clawbot |
| Skills | Coming Soon | 565+ | Clawbot |
| System Control | Coming Soon | ✅ | Clawbot |
| Stars | Growing | 84K | Clawbot |

*HyperAgent wins on ease-of-use and browser integration. Clawbot wins on ecosystem maturity.*

---

## License

MIT — See [LICENSE](LICENSE) for details.

Built with ❤️ by [jobhuntin.com](https://jobhuntin.com)
