# Tests

| Command | Framework | Purpose |
|---------|-----------|---------|
| `npm run test:unit` | Vitest | Unit tests (config, intent, billing) |
| `npm test` | Playwright | Integration tests (requires `npx playwright install`) |

Unit tests mock Chrome APIs. Playwright tests run in a real browser with the built extension.
