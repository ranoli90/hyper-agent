# HyperAgent - Kilo Memory File

This file contains critical information for Kilo (AI assistant) to remember when working on this project.

---

## ⚠️ CRITICAL BUILD INSTRUCTIONS

**After EVERY build, you MUST run:**

```bash
npm run fix:utf8
```

The build process has a postbuild hook that should run automatically, but it often times out. When the bash command times out, the UTF-8 encoding fix doesn't run, and Chrome will refuse to load the extension with:

> "Could not load file 'content-scripts/content.js' for content script. It isn't UTF-8 encoded."

**Solution:** Always run `npm run fix:utf8` manually after `npm run build`.

---

## Project Overview

HyperAgent is a Chrome extension for AI-powered browser automation using OpenRouter API.

### Key Files

| File | Purpose |
|------|---------|
| `entrypoints/sidepanel/index.html` | Main UI HTML |
| `entrypoints/sidepanel/main.ts` | Sidepanel logic |
| `entrypoints/background.ts` | Service worker |
| `entrypoints/options/main.ts` | Settings page logic |
| `shared/llmClient.ts` | LLM API client |
| `shared/config.ts` | Configuration and defaults |
| `scripts/ensure-utf8.js` | UTF-8 encoding fix (CRITICAL) |

---

## Model Configuration

**ONLY `openrouter/auto` is used.** Do not add other models.

```typescript
MODEL_NAME: 'openrouter/auto'
BACKUP_MODEL: 'openrouter/auto'
VISION_MODEL: 'openrouter/auto'
```

The OpenRouter Auto smart router automatically selects the best model for each task.

---

## Encoding Issues

### Why They Happen

1. Windows editors save files as UTF-16 ("Unicode" in Notepad)
2. LLM agents write files with wrong encoding
3. Build times out before postbuild hook runs

### Fix Scripts

- `npm run fix:sources` - Fixes source files before build
- `npm run fix:utf8` - Fixes output files after build (MANDATORY)

---

## HTML Structure Rules

When editing `entrypoints/sidepanel/index.html`:

- ALL content must be INSIDE its parent `<section>` tag
- Do NOT place content after a closing `</section>` tag
- Each tab section must contain ALL its related content

```html
<!-- ✅ CORRECT -->
<section id="tab-swarm">
  <div>Content</div>
  <div>More content</div>
</section>

<!-- ❌ WRONG -->
<section id="tab-swarm">
  <div>Content</div>
</section>
<div>This is OUTSIDE - breaks layout</div>
```

---

## Common Errors

### "It isn't UTF-8 encoded"
```bash
npm run fix:utf8
```

### API Key validation fails
- Key must start with `sk-or-` for OpenRouter
- Provider must be set to "openrouter"

### Side panel shows corrupted text
- Clear `chat_history_backup` from Chrome storage
- This is from a previous broken build

---

## Build Commands

```bash
npm run build      # Build extension
npm run fix:utf8   # FIX ENCODING (MANDATORY)
npm run rebuild    # Fix sources + build
npm run dev        # Development mode
```

---

## Remember

1. **ALWAYS** run `npm run fix:utf8` after build
2. **ONLY** use `openrouter/auto` model
3. **DO NOT** put content outside `<section>` tags
4. **CHECK** encoding if Chrome refuses to load extension
