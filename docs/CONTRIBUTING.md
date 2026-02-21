# Contributing to HyperAgent

Thank you for your interest in contributing to HyperAgent!

---

## Setup

```bash
# Clone the repository
git clone https://github.com/ranoli90/hyper-agent.git
cd hyper-agent

# Install dependencies
npm install

# Start development server
npm run dev

# Load in Chrome
# 1. Open chrome://extensions
# 2. Enable Developer mode
# 3. Click "Load unpacked"
# 4. Select .output/chrome-mv3/ directory
```

---

## Development Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development with hot reload |
| `npm run build` | Production build |
| `npm run test:unit` | Unit tests (Vitest) - 80 tests |
| `npm run test:e2e` | E2E tests (Playwright) |
| `npm run type-check` | TypeScript validation |
| `npm run lint` | ESLint |

---

## Branching

1. Create a feature branch from `main`
2. Make focused, descriptive commits
3. Run tests before submitting
4. Open a pull request with a clear description

---

## Code Style

### TypeScript

- **Strict mode** is enabled
- Prefer explicit types over `any`
- Use JSDoc for public APIs
- Follow existing naming conventions

### Service Worker Compatibility

When working in `background.ts` or shared modules:

```typescript
// GOOD: Service worker safe
globalThis.setInterval(callback, 1000);
await chrome.storage.local.get('key');

// BAD: Will fail in service worker
window.setInterval(callback, 1000);
localStorage.getItem('key');
document.querySelector('.class');
```

### Storage Keys

Always use `STORAGE_KEYS` from config:

```typescript
import { STORAGE_KEYS } from '../shared/config';

// GOOD
await chrome.storage.local.get(STORAGE_KEYS.API_KEY);

// BAD
await chrome.storage.local.get('api_key');
```

### Error Handling

Use the error boundary utilities:

```typescript
import { withErrorBoundary } from '../shared/error-boundary';

await withErrorBoundary('operation_name', async () => {
  // risky operation
});
```

---

## Testing

### Unit Tests

Located in `tests/unit/`. Run with:

```bash
npm run test:unit
```

When adding new functionality:
1. Add tests to existing test file if related
2. Create new test file for new modules
3. Mock Chrome APIs appropriately

### E2E Tests

Located in `tests/e2e/`. Run with:

```bash
npm run build
npm run test:e2e
```

---

## Key Files for New Contributors

| File | Purpose |
|------|---------|
| `entrypoints/background.ts` | Main orchestration, ReAct loop |
| `entrypoints/content.ts` | DOM interaction, actions |
| `entrypoints/sidepanel/main.ts` | Chat UI, commands |
| `shared/types.ts` | Type definitions |
| `shared/llmClient.ts` | LLM integration |
| `shared/config.ts` | Settings, defaults |
| `shared/security.ts` | Security utilities |

---

## Pull Request Checklist

Before submitting a PR:

- [ ] Code compiles without errors (`npm run type-check`)
- [ ] Unit tests pass (`npm run test:unit`)
- [ ] Code follows existing style conventions
- [ ] New functionality has tests
- [ ] Commit messages are descriptive

---

## Questions?

- Open an issue for bugs or feature requests
- Check [docs/DEVELOPER.md](./DEVELOPER.md) for detailed documentation
- Check [docs/ARCHITECTURE.md](./ARCHITECTURE.md) for system design
