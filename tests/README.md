# HyperAgent Tests

---

## Test Commands

| Command | Framework | Purpose |
|---------|-----------|---------|
| `npm run test:unit` | Vitest | Unit tests (80 tests) |
| `npm run test:e2e` | Playwright | E2E tests with real browser |

---

## Unit Tests

Located in `tests/unit/`. Uses Vitest with mocked Chrome APIs.

| File | Tests | Coverage |
|------|-------|----------|
| `billing.test.ts` | 34 | Billing tiers, subscription logic, Stripe integration |
| `intent.test.ts` | 18 | Command intent classification |
| `config.test.ts` | 16 | Settings validation, storage keys |
| `security.test.ts` | 10 | Input sanitization, URL validation, redaction |
| `workflows.test.ts` | 2 | Workflow save/load |

**Total: 80 tests passing**

### Running Unit Tests

```bash
npm run test:unit
```

### Writing Unit Tests

```typescript
import { describe, it, expect, vi } from 'vitest';

// Mock chrome.storage
vi.stubGlobal('chrome', {
  storage: {
    local: {
      get: vi.fn(() => Promise.resolve({})),
      set: vi.fn(() => Promise.resolve()),
    },
  },
});

describe('MyModule', () => {
  it('should work', async () => {
    const { myFunction } = await import('../shared/my-module');
    expect(myFunction()).toBe(true);
  });
});
```

---

## E2E Tests

Located in `tests/e2e/`. Uses Playwright with a real Chrome instance.

### Prerequisites

```bash
npx playwright install
npm run build
```

### Running E2E Tests

```bash
npm run test:e2e
```

---

## Test Coverage

Current coverage focuses on:
- Security (input sanitization, redaction)
- Configuration (validation, storage)
- Billing (tier management)
- Intent classification
- Workflows (basic operations)

Future coverage needed for:
- LLM client
- Content script DOM operations
- Background message handling
