# Contributing to HyperAgent

## Setup

```bash
git clone https://github.com/ranoli90/hyper-agent.git
cd hyper-agent
npm install
```

## Development

```bash
npm run dev          # Hot reload; load .output/chrome-mv3 in chrome://extensions
npm run build        # Production build
npm run test:unit    # Unit tests (Vitest)
npm test             # Integration tests (Playwright; requires npx playwright install)
npm run type-check   # TypeScript check
npm run lint         # ESLint
```

## Branching

- Create a feature branch from `main`.
- Keep commits focused and descriptive.

## Before Submitting

1. Run `npm run type-check`
2. Run `npm run test:unit`
3. Run `npm run build` (optional but recommended)

## Code Style

- TypeScript strict mode.
- Prefer explicit types over `any`.
- Use JSDoc for public APIs.

## Key Files for New Contributors

- `entrypoints/background.ts` — Main orchestration
- `shared/types.ts` — Type definitions
- `shared/llmClient.ts` — LLM integration
- `entrypoints/content.ts` — DOM interaction
