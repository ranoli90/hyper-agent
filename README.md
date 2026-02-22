# HyperAgent — Autonomous AI Browser Agent

A Chrome extension that acts as an autonomous AI agent for web automation. Uses a ReAct loop with LLM-powered intelligence to navigate, interact, and extract data from any website.

[![Build](https://img.shields.io/badge/build-passing-green.svg)](https://github.com/ranoli90/hyper-agent)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Chrome MV3](https://img.shields.io/badge/Chrome-MV3-orange.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Tests](https://img.shields.io/badge/tests-253%20passing-brightgreen.svg)](./tests)

**Version:** 3.1.0

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
- **Model Selection** — Choose from multiple AI models in settings
- **Enhanced AI Brain** — Optimized token usage for smarter automation

### Security & Privacy
- **Domain Allowlist/Blocklist** — Control which sites can be automated
- **Action Rate Limiting** — Prevent runaway automation
- **Confirmation Prompts** — Optional approval before sensitive actions
- **Data Redaction** — Automatic redaction of API keys, emails, phone numbers in logs
- **Local Storage Only** — Your data stays in your browser

### User Experience
- **Dark Mode** — System preference detection + manual toggle
- **First-run Onboarding** — Guided setup with example commands and privacy summary
- **Offline Detection** — Graceful handling of network issues
- **Export/Import** — Backup and restore settings and chat history
- **Accessibility** — ARIA live regions, keyboard navigation, focus traps, reduced motion, color blind support
- **Task Notifications** — Get alerts when background tasks complete or fail

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
| `npm run test:unit` | Unit tests (Vitest) - 253 tests |
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
| [docs/FIRST_USER_READINESS.md](docs/FIRST_USER_READINESS.md) | First user acceptance checklist |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | How to contribute |
| [docs/STORE_READINESS.md](docs/STORE_READINESS.md) | Chrome Web Store submission checklist |
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

## Pricing

**$5 Beta Plan** — One simple price, unlimited automation.

| Feature | Included |
|---------|----------|
| Unlimited actions | ✅ |
| All AI models | ✅ |
| Vision capabilities | ✅ |
| Background scheduling | ✅ |
| Priority support | ✅ |

**Payment Methods:**
- Credit/Debit Card (via Stripe)
- Cryptocurrency: ETH, USDC on Ethereum, Base, and Polygon networks

*Note: You can also use your own OpenRouter API key for free with usage limits.*

---

## Configuration

### Required (if not subscribed)
- **API Key** — Get from [OpenRouter](https://openrouter.ai/keys)

### Optional
- **Base URL** — Default: `https://openrouter.ai/api/v1`
- **Model** — Default: `google/gemini-2.0-flash-001`
- **Max Steps** — Default: 12 (max: 50)
- **Require Confirmation** — Ask before actions

---

## User Guide

### Getting Started
1. **Install** the extension from Chrome Web Store (or load unpacked from `.output/chrome-mv3/`)
2. **Configure API Key** — Open Settings (gear icon) → Enter your OpenRouter API key
3. **Start Chatting** — Type natural language commands in the side panel

### Basic Commands
- **Navigate**: "Go to amazon.com and search for headphones"
- **Extract**: "Get all product names and prices from this page"
- **Fill Forms**: "Fill out this form with my info"
- **Research**: "Compare this product across 3 different stores"

### Advanced Features
- **Autonomous Mode**: Use `/think` for complex multi-step tasks
- **Scheduling**: "Schedule daily search for news every morning at 8am"
- **Memory**: The agent learns from your interactions to improve over time

### Troubleshooting

#### Installation Issues

| Issue | Solution |
|-------|----------|
| Extension not appearing in toolbar | 1. Go to `chrome://extensions` → Find HyperAgent → Click "Details" → Enable "Pin to toolbar". If missing, click the puzzle icon in toolbar → Find HyperAgent → Click pin. Restart Chrome if needed. |
| "Manifest invalid" error on load | 1. Ensure you loaded `.output/chrome-mv3/` (not the project root). 2. Run `npm run build` to regenerate. 3. Remove and re-load the extension. 4. Check Chrome version ≥114 (required for side panel). |
| Content script not injecting | 1. Refresh the target page (Ctrl+R / Cmd+R). 2. Check `chrome://extensions` → HyperAgent → "Allow access to file URLs" if testing locally. 3. Some pages (chrome://, chrome-extension://, Web Store) cannot be scripted — this is a Chrome security restriction. |

#### API & Connection

| Issue | Solution |
|-------|----------|
| "API key not set" error | 1. Open side panel → Click gear icon (Settings). 2. Enter your OpenRouter API key. 3. Click "Save". 4. Key appears as `sk-or-...` — get yours at [openrouter.ai/keys](https://openrouter.ai/keys). |
| "Invalid API key" error | 1. Verify key at [openrouter.ai/keys](https://openrouter.ai/keys). 2. Ensure no trailing spaces when pasting. 3. Regenerate key if compromised. 4. Check account has credits (free tier: $1 credit for new accounts). |
| "Rate limit exceeded" | OpenRouter limits: **20 requests/min** (free), **200 requests/min** (paid). Wait times shown in error message. Solutions: 1. Wait the specified seconds. 2. Upgrade at openrouter.ai/credits. 3. Reduce automation speed in Settings → Advanced → Action Delay. |
| "Network error" / offline | 1. Check internet connection. 2. Try a different page. 3. Check if behind corporate proxy/VPN — may need to allowlist `openrouter.ai`. 4. Extension shows offline banner when disconnected. |
| "Model not found" error | 1. Open Settings → Model dropdown. 2. Select a valid model (default: `google/gemini-2.0-flash-001`). 3. If using custom model, verify name at [openrouter.ai/models](https://openrouter.ai/models). |

#### Automation Issues

| Issue | Solution |
|-------|----------|
| "Element not found" | Multiple solutions to try: 1. **Wait** — Page may still be loading. 2. **Scroll** — Element may be below viewport (agent auto-scrolls, but try manual scroll first). 3. **Be specific** — Use exact text: "Click the 'Add to Cart' button next to the price". 4. **Check for iframes** — Agent cannot cross iframe boundaries. 5. **Try different selector** — Describe by role: "Click the submit button" vs "Click the blue button". |
| "Action timeout" | 1. Increase Max Steps in Settings (default: 12, max: 50). 2. Complex pages may need more time — try simpler commands first. 3. Check for infinite loading spinners. 4. Use `/think` for verbose reasoning to debug. |
| "Permission denied" | 1. Check `chrome://extensions` → HyperAgent → "Site access" setting. 2. Set to "On all sites" or add specific domains. 3. Some sites block automation — check browser console (F12) for CSP errors. |
| Page not loading / navigation failed | 1. Verify URL is correct and accessible. 2. Check if site requires login — log in first. 3. Some sites block automated access — try manual navigation first. 4. Check browser console (F12) for errors. |

#### Performance

| Issue | Solution |
|-------|----------|
| Extension running slowly | 1. Close unused tabs (each tab runs content script). 2. Clear chat history: `/clear` command. 3. Restart Chrome. 4. Check Chrome DevTools → Memory tab for memory pressure. |
| Memory usage high | 1. Long chat histories consume memory — use `/clear` periodically. 2. Export and clear: Settings → Export All Data → Clear History. 3. Large pages with many elements slow down DOM scanning — try simpler pages first. |
| Chat history too large | 1. Use `/clear` to reset. 2. Export before clearing: `/export-chat` saves history as JSON. 3. Auto-trim in Settings → Advanced → Max History Items (default: 100). |

### Privacy & Data
- All data stored locally in your browser
- No data sent to external servers except LLM API calls
- Export your data anytime: Settings → Export All Data
- Delete all data: Settings → Delete All My Data

---

## Frequently Asked Questions

### Q: How do I get an API key?
A: Visit [OpenRouter](https://openrouter.ai/keys) to create an account and generate an API key. OpenRouter provides access to multiple LLM providers with a single key. Once you have your key, open HyperAgent Settings (gear icon) and paste it in the API Key field.

### Q: Which LLM providers are supported?
A: HyperAgent uses OpenRouter as its LLM gateway, giving you access to 100+ models including:
- Google Gemini (default: gemini-2.0-flash)
- OpenAI GPT-4, GPT-3.5
- Anthropic Claude
- Meta Llama
- Mistral

Change models in Settings → Model dropdown. See [OpenRouter models](https://openrouter.ai/models) for the full list.

### Q: Is this free to use?
A: The extension itself is free and open source. However, LLM API calls have costs based on your OpenRouter usage. Many models offer free tiers or pay-per-use pricing. Gemini 2.0 Flash (the default) has generous free limits.

### Q: What can I automate with HyperAgent?
A: HyperAgent can automate most browser interactions:
- **Navigation**: Go to URLs, click links, handle redirects
- **Form filling**: Input text, select dropdowns, check boxes
- **Data extraction**: Scrape text, prices, emails, product info
- **Research**: Compare products, gather information across sites
- **Workflows**: Multi-step processes like checkout, booking, sign-ups

### Q: Why isn't the agent finding elements?
A: Common causes and solutions:
- **Page not loaded**: Wait for the page to fully load, or ask the agent to "wait for the page to load"
- **Element in iframe**: The agent will automatically detect and switch to iframes
- **Dynamic content**: Try asking the agent to "scroll down" or "wait a moment"
- **Shadow DOM**: Complex web components may require the Vision feature

### Q: How do I stop a running automation?
A: Click the **Stop** button in the side panel, or press `Escape`. The agent will halt after completing its current step. You can also close the side panel to interrupt execution.

### Q: Can I use this on any website?
A: HyperAgent works on most websites, but some limitations exist:
- **Restricted sites**: Chrome extension pages (`chrome://`), Web Store, and some internal pages are blocked by Chrome
- **Domain allowlist/blocklist**: Configure in Settings to restrict which sites the agent can access
- **CAPTCHAs**: The agent cannot solve CAPTCHAs automatically
- **Heavy authentication**: Sites requiring 2FA may need manual intervention

### Q: Where is my data stored?
A: All data stays in your browser using Chrome's extension storage (`chrome.storage.local`). Nothing is sent to external servers except:
- LLM API calls to OpenRouter (for processing your commands)
- Optional error reporting (anonymized, can be disabled)

You can export or delete all data anytime in Settings.

### Q: Can I use this without an internet connection?
A: No. HyperAgent requires an internet connection to communicate with the LLM API. The agent detects offline status and will alert you. No automation can run while offline.

### Q: Is my API key safe?
A: Your API key is stored in Chrome's extension storage, which is isolated to HyperAgent only. Other extensions and websites cannot access it. The key is:
- Never transmitted except to OpenRouter API
- Redacted from all logs automatically
- Protected by Chrome's extension sandbox

### Q: Why is the extension not loading?
A: Check these common issues:
1. **Build not found**: Run `npm run build` first, then load from `.output/chrome-mv3/`
2. **Manifest errors**: Check `chrome://extensions` for error messages
3. **Developer mode**: Ensure Developer Mode is enabled in `chrome://extensions`
4. **Conflicting extensions**: Try disabling other automation extensions

See [docs/SETUP.md](docs/SETUP.md) for detailed installation steps.

### Q: How do I update to a new version?
A: If installed from Chrome Web Store, updates are automatic. For development builds:
1. `git pull` to get the latest code
2. `npm install` to update dependencies
3. `npm run build` to rebuild
4. Go to `chrome://extensions` → Click refresh icon on HyperAgent

Your settings and chat history are preserved across updates.

### Q: What if I find a bug?
A: Please report issues at [GitHub Issues](https://github.com/ranoli90/hyper-agent/issues). Include:
- Steps to reproduce
- Expected vs actual behavior
- Browser version and OS
- Console errors (F12 → Console tab)

For feature requests, use the same issue tracker with the "enhancement" label.

---

## Security

- API keys stored in Chrome extension storage (accessible only by HyperAgent)
- No data sent to external servers except LLM API calls
- Payment processing via Stripe (card details never touch our servers)
- Cryptocurrency payments via secure blockchain transactions
- See [public/PRIVACY_POLICY.md](public/PRIVACY_POLICY.md) for details

---

## Brand

HyperAgent is developed by [jobhuntin.com](https://jobhuntin.com) — AI-powered career tools.

---

## License

MIT — [Repository](https://github.com/ranoli90/hyper-agent)

---

## Contributing

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines.
