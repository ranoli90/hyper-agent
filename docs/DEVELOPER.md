# HyperAgent Developer Guide

Complete handoff documentation for developers working on HyperAgent.

---

## Quick Start

```bash
npm install && npm run dev
# Load .output/chrome-mv3 in chrome://extensions
# Set API key in Options
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
| `entrypoints/background.ts` | ReAct loop, message routing, orchestration |
| `entrypoints/content.ts` | DOM extraction, element resolution, actions |
| `entrypoints/sidepanel/main.ts` | Chat UI, commands, tabs |
| `shared/types.ts` | All TypeScript interfaces |
| `shared/llmClient.ts` | LLM API, caching |
| `shared/config.ts` | Settings, defaults, storage keys |
| `shared/security.ts` | Domain policy, redaction |
| `shared/error-reporter.ts` | Error tracking |
| `shared/storage-monitor.ts` | Storage quota |
| `shared/billing.ts` | Subscription management, Stripe integration |
| `shared/crypto-payments.ts` | Cryptocurrency payment verification |

---

## Security & Storage

**API key storage** - Stored in chrome.storage.local (extension storage), unencrypted. Only the extension can access. Do not share exported settings files.

**Service worker constraints:**
- Use `chrome.storage.local` instead of localStorage
- Use `globalThis.setInterval` instead of window.setInterval
- Guard `document` and `window` access

---

## LLM

| Setting | Value |
|---------|-------|
| Model | google/gemini-2.0-flash-001 |
| Endpoint | https://openrouter.ai/api/v1 |
| Timeout | 45s (configurable) |
| Max Tokens | 4096 per request |
| Session Limit | 100,000 tokens |

---

## Message Flow

```
Side Panel <-> Background <-> Content Script
                |
            LLM API
```

---

## Billing Architecture

### Subscription Model
- **$5 Beta Plan**: Flat monthly fee, unlimited actions
- Stored in `chrome.storage.local` with key `subscription`
- Status checked on extension load and periodically

### Stripe Integration
- Checkout sessions created via Stripe API
- Webhook handles subscription events (created, updated, canceled)
- Return URL handled in sidepanel for post-payment flow
- Card details never touch extension - Stripe handles all PCI compliance

### Cryptocurrency Payments
- Supported: ETH, USDC on Ethereum, Base, and Polygon
- Payment verification via blockchain transaction monitoring
- Wallet address generated per transaction
- No KYC required - pure on-chain verification

### Key Types
```typescript
interface Subscription {
  tier: 'beta' | 'none';
  status: 'active' | 'canceled' | 'expired';
  startDate: string;
  endDate?: string;
  paymentMethod: 'stripe' | 'crypto';
}
```

---

## Testing

```bash
npm run test:unit   # 253 tests (Vitest)
npm run test:e2e    # Playwright
```

---

## Production Fixes Applied (2026-02)

### Security
- ReDoS protection for workflow regex
- XSS protection for chat history load
- Import schema validation
- API key redaction in logs
- Condition value sanitization

### Reliability
- SnapshotManager full shape
- saveHistory on visibilitychange
- Session mutex for race conditions
- Service worker compatibility

### Performance
- Lazy site config loading
- Context caching for getPageContext
- requestIdleCallback for history load

### Infrastructure
- Error reporting module
- Storage quota monitoring
- Token/cost tracking

---

## Known Limitations

### LLM Retry
Main LLM API calls in llmClient.ts use retryManager.retry (shared/retry-circuit-breaker.ts) with networkRetryPolicy and circuit breaker key `llm-api`. Completion and getEmbedding use direct fetch with optional fallback paths.

### Workflow Condition Execution
Workflow conditions are now evaluated during runWorkflow. Background passes `getContextFn` to fetch page context from the content script; conditions use `checkCondition` with that context.

### Marketplace Workflows
No actual workflow definitions - only display metadata. Labeled "Coming Soon".

---

## Cache TTL Settings

| Cache | TTL | Purpose |
|-------|-----|---------|
| apiCache | 15 min | LLM responses |
| generalCache | 30 min | General data |
| assetCache | 60 min | Static assets |

---

## Resources

- [WXT](https://wxt.dev/)
- [Chrome Extensions](https://developer.chrome.com/docs/extensions/)
- [OpenRouter](https://openrouter.ai/docs)
