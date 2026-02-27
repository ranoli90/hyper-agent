# HyperAgent Build Guide

## ⚠️ CRITICAL: READ THIS FIRST

**After EVERY build, you MUST run:**

```bash
npm run fix:utf8
```

If you see this error:
> "Could not load file 'content-scripts/content.js' for content script. It isn't UTF-8 encoded."

Run this command IMMEDIATELY:
```bash
npm run fix:utf8
```

This is NOT optional. Chrome REQUIRES UTF-8 encoding. The build process sometimes times out before the postbuild hook runs.

---

## Quick Start

```bash
npm run build
npm run fix:utf8    # <-- ALWAYS RUN THIS AFTER BUILD
```

This command will:
1. Run `prebuild` automatically (fixes source encoding)
2. Build the extension with WXT
3. Run `postbuild` automatically (fixes output encoding) - **but may time out**

**If the build command times out or hangs, run:**
```bash
npm run fix:utf8
```

## Build Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Build for Chrome |
| `npm run fix:utf8` | **MUST RUN AFTER BUILD** - Fixes UTF-8 encoding |
| `npm run rebuild` | Fix sources + build |
| `npm run build:firefox` | Build for Firefox |
| `npm run dev` | Development mode with hot reload |

## Fix Commands

If you see encoding errors like "It isn't UTF-8 encoded":

```bash
npm run fix:sources   # Fix source files
npm run build         # Rebuild
npm run fix:utf8      # Fix output files (MANDATORY)
```

## Why Encoding Issues Happen

Chrome requires ALL extension files to be UTF-8 encoded without BOM. This breaks when:

1. **Windows editors** save files as UTF-16 ("Unicode" in Notepad)
2. **LLM agents** write files with wrong encoding
3. **Git checkout** on different platforms
4. **Build times out** before postbuild hook runs

Our scripts automatically fix this:
- `scripts/fix-source-encoding.js` - Fixes SOURCE files before build
- `scripts/ensure-utf8.js` - Fixes OUTPUT files after build (runs via `npm run fix:utf8`)

## Build Process Flow

```
npm run build
      │
      ▼
┌─────────────────────────────────┐
│  prebuild (automatic)           │
│  - Fixes source encoding        │
│  - Validates HTML structure     │
└─────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────┐
│  wxt build                      │
│  - Compiles TypeScript          │
│  - Bundles with Vite            │
│  - Outputs to .output/          │
└─────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────┐
│  postbuild (automatic)          │
│  - Fixes output encoding        │
│  - Escapes non-characters       │
│  - MAY TIME OUT - run manually  │
└─────────────────────────────────┘
      │
      ▼
   npm run fix:utf8   <-- RUN THIS IF BUILD TIMES OUT
      │
      ▼
  .output/chrome-mv3/
  Ready to load in Chrome!
```

## Loading in Chrome

1. Open `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `.output/chrome-mv3` folder

## Troubleshooting

### "Could not load file 'content-scripts/content.js' - It isn't UTF-8 encoded"

**SOLUTION:**
```bash
npm run fix:utf8
```

Then reload the extension in Chrome.

### Build hangs or times out

The build can take 10-15 seconds. If it times out:
```bash
npm run build
npm run fix:utf8    # <-- Run this manually
```

### Side panel shows corrupted text

This is corrupted chat history from a previous broken build. Clear it:
1. Open Chrome DevTools on the extension
2. Go to Application > Storage > Local
3. Delete `chat_history_backup`
4. Reload the extension

### API Key validation fails

1. Make sure your OpenRouter key starts with `sk-or-`
2. Check that you've selected "OpenRouter" as the provider
3. The extension uses `openrouter/auto` model (smart router)

## For Developers

### DO NOT
- Save files in UTF-16 encoding
- Edit files in `.output/` directory (it gets rebuilt)
- Skip the `npm run fix:utf8` command
- Forget to run `npm run fix:utf8` after build

### DO
- Run `npm run build` after any changes
- Run `npm run fix:utf8` after every build
- Use UTF-8 encoding in your editor
- Check `.editorconfig` for project settings

### HTML Structure Rules

When editing `entrypoints/sidepanel/index.html`:

```html
<!-- ✅ CORRECT: All content inside section -->
<section id="tab-swarm">
  <div>Content here</div>
  <div>More content</div>
</section>

<!-- ❌ WRONG: Content after closing tag -->
<section id="tab-swarm">
  <div>Content here</div>
</section>
<div>This is OUTSIDE and will break layout</div>
```

Run `npm run validate` to check HTML structure before building.

## Files

| File | Purpose |
|------|---------|
| `package.json` | Build scripts configuration |
| `wxt.config.ts` | WXT extension configuration |
| `scripts/fix-source-encoding.js` | Pre-build encoding fix |
| `scripts/ensure-utf8.js` | Post-build encoding fix (CRITICAL) |
| `scripts/prebuild-validation.js` | HTML structure validation |
| `.editorconfig` | Editor encoding settings |

## Summary

```
ALWAYS RUN:
npm run build
npm run fix:utf8    <-- MANDATORY
```
