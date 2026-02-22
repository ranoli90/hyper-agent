# Chrome Web Store Readiness

Checklist for submitting HyperAgent to the Chrome Web Store (or any app store).

---

## Pre-Submission Checklist

### Build & Quality

| # | Item | Status |
|---|------|--------|
| 1 | `npm run build` succeeds | ✅ |
| 2 | `npm run type-check` passes | ✅ |
| 3 | `npm run test:unit` — 253 tests pass | ✅ |
| 4 | No console errors on extension load | Verify manually |
| 5 | Side panel, options, and context menus work | Verify manually |

### Manifest & Permissions

| # | Item | Status |
|---|------|--------|
| 6 | `manifest_version: 3` | ✅ |
| 7 | `version` matches package.json (e.g. 3.1.0) | ✅ |
| 8 | `minimum_chrome_version` set (114 for sidePanel) | ✅ |
| 9 | All permissions justified in public/PERMISSIONS.md | ✅ |
| 10 | Single purpose: AI-powered browser automation | ✅ |

### Privacy & Legal

| # | Item | Status |
|---|------|--------|
| 11 | Privacy policy URL (homepage_url or store listing) | ✅ public/privacy-policy.html, PRIVACY_POLICY.md |
| 12 | Privacy policy describes data stored and transmitted | ✅ |
| 13 | No collection of personal data without disclosure | ✅ (local only + LLM provider) |

### Listing Assets (Chrome Web Store)

| # | Item | Notes |
|---|------|--------|
| 14 | Short description (132 chars max) | e.g. "AI-powered browser agent. Automate any site with natural language." |
| 15 | Detailed description | Use README feature list and user guide |
| 16 | Icons: 128x128 required; 16, 32, 48 recommended | ✅ in public/icons/ and manifest |
| 17 | Screenshots (1280x800 or 640x400) | Add to store listing; optional in repo public/screenshots/ |
| 18 | Small promotional tile (440x280) optional | For featured placement |

### Security & Configuration

| # | Item | Status |
|---|------|--------|
| 19 | No test/live API keys in code (Stripe: publishable only) | ✅ pk_live_ in config is publishable (safe) |
| 20 | Crypto wallet: zero address = "not configured" | ✅ Billing treats 0x0...0 as disabled |
| 21 | CSP: script-src 'self'; object-src 'self' | ✅ |
| 22 | Message validation rejects unknown types | ✅ validateExtensionMessage default false |

### User Experience

| # | Item | Status |
|---|------|--------|
| 23 | First-run onboarding | ✅ |
| 24 | Clear API key setup (OpenRouter link) | ✅ |
| 25 | Error messages user-friendly (rate limit, offline) | ✅ |
| 26 | Accessibility: focus trap, labels, reduced motion | ✅ |

---

## Policy Alignment

- **Single purpose:** Browser automation via natural language (ReAct agent).
- **Honest:** Description matches behavior; permissions justified.
- **Safe:** No remote code; storage local; API key redaction in logs.
- **Useful:** Automation, scheduling, workflows, model choice.

---

## Post-Submission

- Monitor Chrome Web Store dashboard for policy or rejection feedback.
- Keep privacy policy and support email (e.g. support@hyperagent.ai) current.
- Bump version for each store update; match in package.json, wxt.config.ts, and docs.
