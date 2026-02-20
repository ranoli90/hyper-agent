# HyperAgent - AI Browser Agent Chrome Extension

## Project Overview

HyperAgent is an autonomous AI browser agent Chrome extension that executes web automation tasks. It uses a ReAct (Reasoning + Acting) loop with LLM-powered intelligence to navigate, interact, and extract data from websites.

**Repository:** https://github.com/ranoli90/hyper-agent  
**Current Version:** 3.2.0  
**Last Updated:** 2026-02-20

---

## Tech Stack

### Core Technologies

- **Framework:** [WXT](https://wxt.dev/) - Modern Chrome Extension framework
- **Language:** TypeScript (strict mode)
- **Build Tool:** Vite 6.4.1
- **Runtime:** Chrome MV3 Service Worker

### Key Dependencies

- **LLM API:** OpenRouter (Google Gemini 2.0 Flash)
- **Testing:** Playwright
- **Storage:** chrome.storage.local (no localStorage in service workers)

### Project Structure

```
hyper-agent/
├── entrypoints/
│   ├── background.ts      # Service worker - orchestration layer
│   ├── content.ts         # Content script - DOM manipulation
│   ├── sidepanel/         # React-less UI (vanilla JS)
│   └── options/           # Settings page
├── shared/                # Core business logic (61 files)
│   ├── types.ts           # All TypeScript interfaces
│   ├── llmClient.ts       # LLM API client
│   ├── config.ts          # Settings & configuration
│   ├── autonomous-intelligence.ts  # Planning engine
│   ├── swarm-intelligence.ts       # Multi-agent coordination
│   ├── persistent-autonomous.ts    # Never-stop autonomy
│   ├── advanced-caching.ts         # Response caching
│   ├── memory-management.ts        # Leak detection
│   ├── input-sanitization.ts       # XSS protection
│   └── ... (50+ more modules)
├── tests/                 # Playwright tests
└── .output/               # Build output
```

---

## Build & Development Commands

```bash
# Development (hot reload)
npm run dev

# Production build
npm run build

# Run tests
npm test

# Type check
npx tsc --noEmit

# Analyze bundle
npx wxt build --analyze
```

---

## Current Build Status

| Metric            | Value                    |
| ----------------- | ------------------------ |
| Build Size        | 317.39 kB                |
| Tests             | 19/19 passing            |
| TypeScript Errors | 0 (in connected modules) |
| Background JS     | 146.57 kB                |
| Content Script    | 49.57 kB                 |
| Sidepanel JS      | 29.36 kB                 |

---

## Module Connection Status

### ✅ Connected & Working (25 files)

| File                       | Lines | Purpose                         |
| -------------------------- | ----- | ------------------------------- |
| types.ts                   | 760   | All TypeScript interfaces       |
| llmClient.ts               | 722   | LLM API client with caching     |
| config.ts                  | ~200  | Settings & configuration        |
| billing.ts                 | 211   | Stripe subscription integration |
| siteConfig.ts              | ~300  | Per-domain configuration        |
| memory.ts                  | ~200  | Site strategy persistence       |
| session.ts                 | ~150  | Session management              |
| metrics.ts                 | ~200  | Performance tracking            |
| scheduler-engine.ts        | ~400  | Task scheduling                 |
| workflows.ts               | ~300  | Workflow execution              |
| macros.ts                  | ~200  | Macro recording/playback        |
| autonomous-intelligence.ts | 296   | Planning engine                 |
| stealth-engine.ts          | ~400  | Bot detection evasion           |
| tiktok-moderator.ts        | ~300  | TikTok automation               |
| security.ts                | ~150  | Data redaction                  |
| voice-interface.ts         | ~200  | Voice commands                  |
| error-boundary.ts          | ~100  | Error handling                  |
| tool-system.ts             | ~500  | Tool registry (15+ tools)       |
| global-learning.ts         | ~300  | Pattern learning                |
| failure-recovery.ts        | ~400  | Intelligent retry               |
| snapshot-manager.ts        | ~200  | State persistence               |
| swarm-intelligence.ts      | 477   | Multi-agent coordination        |
| reasoning-engine.ts        | 155   | LLM reasoning                   |
| intent.ts                  | 353   | Command parsing                 |
| persistent-autonomous.ts   | 730   | Never-stop autonomy             |
| advanced-caching.ts        | 834   | Response caching                |
| memory-management.ts       | 749   | Leak detection                  |
| input-sanitization.ts      | 560   | XSS protection                  |
| planning-engine.ts         | 66    | Plan generation                 |

### ⚠️ Disconnected but Complete (8 files)

| File                         | Lines | Issue                             | Priority |
| ---------------------------- | ----- | --------------------------------- | -------- |
| neuroplasticity-engine.ts    | 1508  | TypeScript errors (missing types) | Low      |
| intelligent-clarification.ts | 853   | TypeScript errors                 | Low      |
| comprehensive-workflows.ts   | 547   | TypeScript errors                 | Low      |
| platform-integrations.ts     | 502   | Missing CarListingInfo type       | Low      |
| advanced-logging.ts          | 539   | Private method access errors      | Low      |
| testing-framework.ts         | 791   | Jest types missing                | Low      |
| retry-circuit-breaker.ts     | 601   | Not imported anywhere             | Medium   |
| contextManager.ts            | 158   | Imported but not fully utilized   | Medium   |

### 📁 Stub Files (21 files)

Files with only `export {};` - need implementation or removal:

- tool-system.ts ✅ (now implemented)
- global-learning.ts ✅ (now implemented)
- 19 others remain as stubs

---

## Remaining Work

### High Priority

1. **API Key Security** - Currently stored in plain text in config.ts
   - Add encryption for stored API keys
   - Consider secure vault integration

2. **Testing Infrastructure** - Tests pass but coverage is minimal
   - Add unit tests for shared/ modules
   - Add integration tests for background worker
   - Mock chrome API properly

3. **Error Monitoring** - No centralized error tracking
   - Add Sentry or similar
   - Implement error reporting to user

### Medium Priority

4. **UI Polish** - Sidepanel is functional but basic
   - Add loading states for all async operations
   - Improve error message display
   - Add keyboard shortcuts documentation

5. **Performance Optimization**
   - Bundle size is 317KB, could be reduced
   - Consider code splitting for rarely-used modules

6. **Documentation**
   - Add JSDoc comments to public APIs
   - Create user documentation

### Low Priority

7. **Fix Disconnected Modules** - TypeScript errors in:
   - neuroplasticity-engine.ts (missing type definitions)
   - intelligent-clarification.ts (method signature mismatches)
   - comprehensive-workflows.ts (type errors)

8. **Clean Up Stub Files** - 19 stub files with only `export {};`

---

## Architecture Decisions

### 1. Service Worker Architecture

- Background runs as Chrome MV3 Service Worker
- **Critical:** Cannot use `localStorage` - must use `chrome.storage.local`
- All modules must handle async storage operations

### 2. ReAct Loop Pattern

The agent follows this pattern:

```
1. Observe → Get page context (DOM, URL, elements)
2. Plan → LLM generates action plan
3. Act → Execute actions via content script
4. Re-observe → Check results, loop or done
```

### 3. Self-Healing Locators

When element not found:

1. Try fuzzy text matching
2. Try ARIA label matching
3. Try role + text combination
4. Scroll to find lazy-loaded content
5. Generate intelligent fallback

### 4. Multi-Level Caching

```
Request → Check Cache → If miss → API Call → Cache Response
         (15 min TTL)              (hash-based key)
```

### 5. Message Flow

```
Sidepanel ←→ Background ←→ Content Script ←→ DOM
              ↓
           LLM API
```

---

## Key Type Definitions

### Action Types

```typescript
type ActionType =
  | 'click'
  | 'fill'
  | 'select'
  | 'scroll'
  | 'navigate'
  | 'goBack'
  | 'wait'
  | 'pressKey'
  | 'hover'
  | 'focus'
  | 'extract'
  | 'openTab'
  | 'closeTab'
  | 'switchTab'
  | 'getTabs'
  | 'runMacro'
  | 'runWorkflow';
```

### Locator Strategies

```typescript
type LocatorStrategy = 'css' | 'xpath' | 'text' | 'role' | 'ariaLabel' | 'id' | 'index';
```

### Message Types

```typescript
// Background handles 40+ message types:
type MessageType =
  | 'getSettings'
  | 'saveSettings'
  | 'executeActions'
  | 'confirmActions'
  | 'getTabs'
  | 'captureScreenshot'
  | 'getSwarmStatus'
  | 'getToolStats'
  | 'getAutonomousSession'
  | 'createAutonomousSession'
  | 'getCacheStats'
  | 'getMemoryStats'
  | 'sanitizeInput'
  | 'sanitizeUrl';
// ... and more
```

---

## Common Pitfalls

### 1. localStorage in Service Worker

```typescript
// ❌ WRONG - crashes service worker
localStorage.setItem('key', value);

// ✅ CORRECT
await chrome.storage.local.set({ key: value });
```

### 2. Synchronous Storage Operations

```typescript
// ❌ WRONG - storage is async
const data = chrome.storage.local.get('key');

// ✅ CORRECT
const data = await chrome.storage.local.get('key');
```

### 3. Private Properties in Subclasses

```typescript
// ❌ WRONG - subclass can't access
private config: Config;

// ✅ CORRECT
protected config: Config;
```

### 4. Map Iteration in TypeScript

```typescript
// May need downlevelIteration flag or use:
Array.from(map.entries());
// Instead of:
for (const [k, v] of map) {
}
```

---

## LLM Configuration

### Current Model

- **Primary:** `google/gemini-2.0-flash-001`
- **Endpoint:** OpenRouter API
- **Base URL:** `https://openrouter.ai/api/v1`

### System Prompt

Located in `shared/llmClient.ts` - defines:

- Available actions and their parameters
- Locator strategy preferences
- Response format (JSON)
- Safety rules

### Response Format

```json
{
  "thinking": "Internal reasoning",
  "summary": "User-facing explanation",
  "actions": [{ "type": "click", "locator": {...} }],
  "needsScreenshot": false,
  "done": false,
  "askUser": "Optional question"
}
```

---

## Testing Notes

### Test Environment

- Playwright with Chromium
- Chrome APIs are mocked
- 19 tests currently passing

### Known Test Warnings

- "Command not cleared - expected without chrome APIs" (normal)
- "Tab not marked as active - expected in test environment" (normal)
- These are expected behaviors in test environment

### Running Tests

```bash
npm test                    # Run all tests
npx playwright test --ui    # Interactive mode
```

---

## Deployment

### Build Output

```
.output/chrome-mv3/
├── manifest.json
├── background.js          # Service worker
├── content-scripts/
│   └── content.js         # Injected script
├── chunks/
│   ├── options-*.js
│   └── sidepanel-*.js
├── assets/
│   ├── options-*.css
│   └── sidepanel-*.css
└── icon/
    └── *.png
```

### Loading in Chrome

1. Build: `npm run build`
2. Open Chrome → `chrome://extensions`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select `.output/chrome-mv3/`

---

## Recent Changes (Iteration 32)

### Added Module Integrations

1. **PersistentAutonomousEngine** - Never-stop autonomy with session persistence
2. **AdvancedCache** - LLM response caching (15 min TTL)
3. **MemoryManager** - Memory leak detection and cleanup
4. **InputSanitizer** - XSS protection for all inputs

### New Message Handlers (15+)

- Autonomous session management
- Cache operations
- Memory monitoring
- Input sanitization

### Fixed Issues

- localStorage → chrome.storage.local in service worker
- Protected config access for subclasses
- RetryConfig type mismatch
- Missing id in AutonomousPlan

---

## Git Status

```bash
# Current branch
main

# Uncommitted changes
- AGENTS.md (iteration 32 documentation)
- STATUS.md (this file)

# Recent commits
8b695ec - Connect remaining disconnected modules
5c60499 - Add Swarm Intelligence UI tab
c1e1f67 - Connect major disconnected modules
```

---

## Contact & Resources

- **Repository:** https://github.com/ranoli90/hyper-agent
- **Issues:** https://github.com/ranoli90/hyper-agent/issues
- **WXT Docs:** https://wxt.dev/
- **Chrome Extensions:** https://developer.chrome.com/docs/extensions/

---

## Quick Start for New Developers

1. **Clone & Install**

   ```bash
   git clone https://github.com/ranoli90/hyper-agent.git
   cd hyper-agent
   npm install
   ```

2. **Set API Key**
   - Open extension options after loading
   - Enter OpenRouter API key
   - Key stored in chrome.storage.local

3. **Run Development**

   ```bash
   npm run dev
   ```

4. **Test**

   ```bash
   npm test
   ```

5. **Key Files to Understand**
   - `entrypoints/background.ts` - Main orchestration
   - `shared/types.ts` - All type definitions
   - `shared/llmClient.ts` - LLM integration
   - `entrypoints/content.ts` - DOM interaction

---

_Generated: 2026-02-20_
