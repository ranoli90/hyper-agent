# Environment Setup

## Prerequisites

- **Node.js** 18+ (20 LTS recommended)
- **npm** 9+

## Install

From the project root:

```bash
npm install
```

This installs all dependencies and runs `npx wxt prepare` (generates `.wxt/` for TypeScript).

If `.wxt/` is missing after install, run:

```bash
npx wxt prepare
```

## Optional: Playwright (integration tests)

To run integration tests (`npm test`), install Playwright browsers once:

```bash
npx playwright install
```

## Verify

```bash
npm run type-check   # TypeScript check
npm run dev          # Dev server (then load .output/chrome-mv3 in chrome://extensions)
```

## Troubleshooting

- **`wxt` not found** — Use `npx wxt prepare` or ensure `node_modules/.bin` is on your PATH.
- **Long paths on Windows** — If `npm install` fails with path errors, try installing from a shorter path (e.g. `C:\ha`) or enable long paths.
