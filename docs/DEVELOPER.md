# HyperAgent Developer Guide

Developer documentation for contributing to HyperAgent.

---

## Quick Start

```bash
npm install
npm run dev
# Load .output/chrome-mv3 in chrome://extensions
```

---

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md).

**Core Pattern: ReAct Loop**
Observe -> Plan -> Act -> Re-observe

---

## Key Files

| File | Purpose |
|------|---------|
| `entrypoints/background.ts` | ReAct loop, message routing |
| `entrypoints/content.ts` | DOM extraction, actions |
| `entrypoints/sidepanel/main.ts` | Chat UI, tabs |
| `shared/types.ts` | TypeScript interfaces |
| `shared/llmClient.ts` | OpenRouter/Ollama API |
| `shared/config.ts` | Settings, storage keys |
| `shared/security.ts` | Domain policy, redaction |
| `shared/billing.ts` | Subscription management |

---

## Development Commands

```bash
npm run dev          # Development server with hot reload
npm run build        # Production build
npm run test:unit    # Unit tests (Vitest)
npm run test:e2e     # E2E tests (Playwright)
npm run type-check   # TypeScript check
npm run lint         # ESLint
```

---

## LLM Configuration

| Setting | Value |
|---------|-------|
| Default Model | google/gemini-2.0-flash-001 |
| Endpoint | https://openrouter.ai/api/v1 |
| Timeout | 45s |
| Max Tokens | 4096 |

---

## Message Flow

```
Side Panel <-> Background <-> Content Script
                |
            LLM API
```

---

## Billing

### Subscription Model
- **$5 Beta Plan**: Flat monthly fee, unlimited actions
- Stored in `chrome.storage.local`

### Stripe Integration
- Checkout sessions via Stripe API
- Card details handled by Stripe (PCI compliant)
- Subscription verification via Stripe API

### Cryptocurrency Payments
- Supported: ETH, USDC on Ethereum, Base, Polygon
- Blockchain transaction verification
- **Note**: Wallet address must be configured in Settings before accepting crypto payments

---

## Testing

```bash
npm run test:unit   # 253 unit tests (Vitest)
npm run test:e2e    # E2E tests (Playwright)
```

---

## Service Worker Notes

- Use `chrome.storage.local` instead of localStorage
- Use `globalThis.setInterval` instead of window.setInterval
- Guard `document` and `window` access

---

## Resources

- [WXT](https://wxt.dev/) - Chrome extension framework
- [Chrome Extensions](https://developer.chrome.com/docs/extensions/)
- [OpenRouter](https://openrouter.ai/docs)
