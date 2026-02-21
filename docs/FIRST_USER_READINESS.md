# First User Readiness Checklist

**Purpose:** Ensure HyperAgent can fully accept its first user — install, configure, and run a simple automation without blockers.

**Last Updated:** 2026-02-21

---

## Pre-Launch Checklist

### Install & Build

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | `npm install` succeeds | ✅ | Use `--legacy-peer-deps` if peer conflicts |
| 2 | `npm run build` produces `.output/chrome-mv3/` | ✅ | |
| 3 | Extension loads in Chrome | ✅ | chrome://extensions → Load unpacked |
| 4 | No console errors on load | ✅ | Check background, sidepanel, options |

### First-Run Experience

| # | Item | Status | Notes |
|---|------|--------|-------|
| 5 | Onboarding modal shown on first install | ✅ | `hyperagent_show_onboarding` set in onInstalled |
| 6 | "Open Settings" opens options page | ✅ | Opens chrome-extension://.../options.html |
| 7 | "Get Started" closes modal and shows chat | ✅ | |
| 8 | Clear instructions for API key | ✅ | Step 1: "Add your API key" with OpenRouter link |

### API Key Setup

| # | Item | Status | Notes |
|---|------|--------|-------|
| 9 | Settings page accessible from sidepanel | ✅ | Gear icon → Options |
| 10 | API key input accepts OpenRouter key | ✅ | sk-or-v1-... format |
| 11 | Missing API key → clear error message | ✅ | "API key not set. Open settings (gear icon) and add your API key." |
| 12 | API key validation on save | ✅ | validateApiKey checks format and endpoint |
| 13 | API key link in onboarding | ✅ | OpenRouter: https://openrouter.ai/keys |

### First Command

| # | Item | Status | Notes |
|---|------|--------|-------|
| 14 | User can type a command in chat | ✅ | |
| 15 | Command executes when API key is set | ✅ | ReAct loop runs |
| 16 | Rate limit feedback if exceeded | ✅ | Wait time shown |
| 17 | Offline detection | ✅ | Graceful message when network fails |

### Documentation

| # | Item | Status | Notes |
|---|------|--------|-------|
| 18 | README Quick Start | ✅ | Clone, install, build, load, API key |
| 19 | User Guide in README | ✅ | Getting Started, Basic Commands, Troubleshooting |
| 20 | Privacy policy | ✅ | public/PRIVACY_POLICY.md |
| 21 | Permission justifications | ✅ | public/PERMISSIONS.md |

### Known Non-Blockers (Acceptable for First User)

| # | Item | Status | Notes |
|---|------|--------|-------|
| 22 | API key stored unencrypted | ⚠️ | Acceptable — extension storage is isolated |
| 23 | Marketplace workflows display only | ⚠️ | Labeled "Coming Soon" |
| 24 | LLM retry not integrated | ⚠️ | Single retry on failure; manual retry works |

---

## First User Journey (Expected Flow)

1. **Install** → User loads unpacked extension from `.output/chrome-mv3/`
2. **Open** → Clicks extension icon; sidepanel opens
3. **Onboarding** → Modal: "Welcome to HyperAgent!" with 3 steps
4. **Settings** → User clicks "Open Settings" or gear icon
5. **API Key** → Enter OpenRouter key (get from https://openrouter.ai/keys)
6. **Save** → Validation runs; green border on success
7. **Command** → User types e.g. "Go to amazon.com"
8. **Success** → Agent navigates, user sees automation

---

## Verification Commands

```bash
# Ensure build passes
npm run build

# Ensure tests pass
npm run test:unit   # 94 tests
npm run type-check
npm run lint
```

---

## Sign-Off

When all items above are ✅ or ⚠️ (documented), the extension is ready to accept its first user.

**Status:** Ready for first user acceptance
