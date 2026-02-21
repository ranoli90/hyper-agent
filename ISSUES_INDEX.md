# HyperAgent — Complete Issues Index

**Generated:** 2026-02-21  
**Purpose:** Exhaustive catalog of all known issues (fixed, open, and potential) across the codebase.

---

## Legend

| Status | Meaning |
|--------|---------|
| ✅ FIXED | Resolved in this or prior sessions |
| ⬜ OPEN | Known, not yet addressed |
| ⚠️ PARTIAL | Partially addressed or documented |
| 🔍 OBSERVED | Noted during audit, unverified |

---

## 1. FIXED IN DEBUG/HARDENING SESSIONS (2026-02-21)

### Critical / High

| # | Issue | Location | Fix Applied |
|---|-------|----------|-------------|
| F1 | Missing `err` in catch blocks (TS2304) | sidepanel/main.ts | Added `(err)` parameter to 11 catch blocks |
| F2 | ReDoS — local isSafeRegex lacked safe-regex check | background.ts, content.ts | Import shared `isSafeRegex` from safe-regex.ts |
| F3 | XSS in renderMarkdown — paragraph content unescaped | sidepanel/main.ts | `escapeHtml(p)` before `<p>` insertion |
| F4 | localStorage in service worker (ReferenceError) | neuroplasticity-engine.ts | Switched to chrome.storage.local with guards |
| F5 | Division by zero in calculateCommandSimilarity | neuroplasticity-engine.ts | Guard `union.size === 0`; filter empty strings |
| F6 | Unsanitized chat_history_backup on import | sidepanel/main.ts | Sanitize via inputSanitizer before storage.set |

### Medium / Low

| # | Issue | Location | Fix Applied |
|---|-------|----------|-------------|
| F7 | 32 ESLint no-unused-vars | 12 files | Prefixed with `_`, removed unused imports |
| F8 | Concatenated config comments | config.ts | Separated ERROR_REPORTING / LLM_TIMEOUT comments |

---

## 2. OPEN — CRITICAL / HIGH

### Security

| # | Issue | Source | Notes |
|---|-------|--------|------|
| O1 | API key stored in plain text | PROD-2.1 | chrome.storage.local unencrypted |
| O2 | Security module integration | PROD-2.11 | ✅ checkDomainAllowed, checkActionAllowed, checkRateLimit used in background (lines 1802, 1811, 2191) |
| O3 | Billing license key no server validation | PROD-2.9 | verifyLicenseKey format-only; forgeable |

### Crashes / Data Loss

| # | Issue | Source | Notes |
|---|-------|--------|------|
| O4 | ~~memory-management performance.memory in SW~~ | PROD-6.11 | ✅ FIXED: `if (!memInfo) return` in takeMemorySnapshot |
| O5 | ~~memory-management document in SW~~ | PROD-6.12 | ✅ FIXED: `if (typeof document === 'undefined') return` guards |

### Broken Features

| # | Issue | Source | Notes |
|---|-------|--------|------|
| O6 | ~~Workflow conditions not evaluated~~ | AGENTS, STATUS | ✅ FIXED: runWorkflow now accepts getContextFn, evaluates conditions |
| O7 | Marketplace workflows display only | AGENTS, STATUS | No actual workflow definitions |
| O8 | LLM retry not integrated | AGENTS, STATUS | retry-circuit-breaker exists; not wired to llmClient |
| O9 | TikTok Moderator selectors may be stale | PROD-4.13 | .tiktok-chat-messages etc. — verify against live DOM |
| O10 | ~~visionUpdate screenshot format~~ | PROD-4.12 | ✅ FIXED: visionUpdate sends full data URL |

---

## 3. OPEN — MEDIUM

### UX / Consistency

| # | Issue | Source | Notes |
|---|-------|--------|------|
| O11 | Duplicate visibilitychange handler | PROD-3.1 | saveHistory registered twice |
| O12 | Ask modal backdrop doesn't resolve | PROD-3.2 | state.askResolve not called on backdrop click |
| O13 | require-confirm default mismatch | PROD-3.4 | Config vs options HTML |
| O14 | Dark mode no system preference | PROD-3.6 | No prefers-color-scheme |
| O15 | Duplicate font loading | PROD-3.7 | Inter loaded twice |
| O16 | Dead import getUserSiteConfigs | PROD-3.9 | options/main.ts |

### Incomplete Features

| # | Issue | Source | Notes |
|---|-------|--------|------|
| O17 | Swarm tab static data | PROD-4.4 | UI shows 8 agents; getSwarmStatus returns empty |
| O18 | Vision "Analyze Page" no handler | PROD-4.5 | btn-analyze-vision created but no click handler |
| O19 | ~~Scheduler "once" task validation~~ | PROD-4.11 | ✅ schedule() validates once time; creates disabled if invalid |
| O20 | Tasks "New" button | PROD-4.3 | btn-add-task-ui no handler |

### Performance

| # | Issue | Source | Notes |
|---|-------|--------|------|
| O21 | getPageContext re-indexes every call | PROD-6.2 | Context cache exists; verify TTL sufficient |
| O22 | Screenshot capture size | PROD-6.3 | Large viewports → big base64 |
| O23 | StructuredLogger in-memory only | PROD-6.4 | Lost on SW eviction |
| O24 | apiCache / generalCache TTL | PROD-6.5 | Audit invalidation |
| O25 | loadHistory on every open | PROD-6.6 | requestIdleCallback added; verify |
| O26 | Storage quota / eviction | PROD-6.9 | storage-monitor exists; snapshot eviction? |

### Technical Debt

| # | Issue | Source | Notes |
|---|-------|--------|------|
| O27 | Many `any` types | PROD-10.1 | message handlers, recoveryStats, etc. |
| O28 | Storage key sprawl | PROD-10.3 | STORAGE_KEYS exists; audit completeness |
| O29 | Circular dependency llmClient ↔ autonomousIntelligence | PROD-10.2 | "inject self" workaround |
| O30 | Background script ~2600+ lines | PROD-10.5 | Monolithic |
| O31 | Side panel main.ts ~1800+ lines | PROD-10.6 | Monolithic |
| O32 | Deprecated substr | PROD-10.7 | billing.ts; use substring/slice |
| O33 | Console.log in production | PROD-10.8 | debug.ts exists; audit coverage |
| O34 | Scheduler scheduled flag unused | PROD-10.9 | executeCommand includes it; handler? |
| O35 | Metrics storage callback style | PROD-10.10 | Inconsistent with async/await |
| O36 | Condition.value sanitization | PROD-1.10 | ✅ checkCondition enforces MAX_VALUE_LENGTH 500 |
| O37 | InputSanitizer allowedDomains | PROD-2.4 | Vestigial? |
| O38 | redact patterns | PROD-2.6 | ✅ Added sk-or-v1- (OpenRouter) pattern |

---

## 4. OPEN — LOW / POLISH

### Missing Features

| # | Issue | Source | Notes |
|---|-------|--------|------|
| O39 | No analytics | PROD-5.2 | Usage metrics, success rate |
| O40 | Export chat history | PROD-5.7 | ✅ /export-chat and exportChatHistory() exist |
| O41 | Export settings warning | PROD-5.9 | Sensitive data in export |
| O42 | Changelog on update | PROD-5.10 | chrome.runtime.onInstalled reason=update |
| O43 | A/B testing | PROD-5.8 | Strategic |

### Accessibility

| # | Issue | Source | Notes |
|---|-------|--------|------|
| O44 | Color contrast | PROD-8.7 | WCAG AA audit |
| O45 | Keyboard navigation | PROD-8.8 | Tabs, modals, marketplace |
| O46 | Dynamic Type / rem | PROD-8.6 | Font scaling |

### Store / Compliance

| # | Issue | Source | Notes |
|---|-------|--------|------|
| O47 | Single purpose description | PROD-7.1 | "Hyper-intelligent" broad |
| O48 | Screenshots / promo | PROD-7.4 | Store listing |
| O49 | Data usage disclosure | PROD-7.5 | External requests |
| O50 | Permission justification | PROD-7.2 | PERMISSIONS.md exists; verify |

### Localization

| # | Issue | Source | Notes |
|---|-------|--------|------|
| O51 | No i18n | PROD-9.1 | All strings English |
| O52 | Language type unused | PROD-9.2 | types.ts |
| O53 | RTL support | PROD-9.3 | Arabic/Hebrew |

### Dependencies / Build

| # | Issue | Source | Notes |
|---|-------|--------|------|
| O54 | npm audit | PROD-15.1 | 23 vulnerabilities; --legacy-peer-deps for install |
| O55 | ESLint @eslint/js peer conflict | OBSERVED | eslint 9 vs @eslint/js 10 peerOptional |
| O56 | WXT tar vulnerability | PROD-15.4 | Check advisories |
| O57 | Service worker unit tests | PROD-14.6 | Mocking infrastructure |
| O58 | E2E with real extension | PROD-14.4 | Playwright extension load |
| O59 | Content script path verify | PROD-13.8, 13.15 | content-scripts/content.js |
| O60 | iframe handling | PROD-21.3 | DOM extraction in iframes |

---

## 5. OBSERVED / EDGE CASES

| # | Observation | Location | Risk |
|---|-------------|----------|------|
| E1 | XPath value from LLM — document.evaluate | content.ts | Malformed XPath throws; try/catch present |
| E2 | CSS selector from user — document.querySelector | content.ts | Invalid selector throws; try/catch present |
| E3 | visionSnapshot optional — used with && checks | sidepanel/main.ts | Null checks present |
| E4 | tool-system format_data JSON.parse | tool-system.ts | try/catch present |
| E5 | swarm-intelligence JSON.parse(response) | swarm-intelligence.ts | try/catch; rethrows |
| E6 | llmClient extractJSON | llmClient.ts | Multiple try/catch paths |
| E7 | config.ts getTyped — JSON.parse | config.ts | try/catch present |
| E8 | trapFocus — focusableElements.length 0 | sidepanel/main.ts | Early return; firstFocusable?.focus() safe |
| E9 | neuroplasticity recentEmotions/recentInteractions | neuroplasticity-engine.ts | length guards; slice(-5) safe |
| E10 | content script size increase | OBSERVED | safe-regex in content → ~168KB (was ~39KB) |

---

## 6. KNOWN LIMITATIONS (Documented)

| # | Limitation | Source |
|---|------------|--------|
| L1 | LLM Retry — infrastructure exists, not integrated | AGENTS.md, STATUS.md |
| L2 | Workflow Conditions — not evaluated during execution | AGENTS.md, STATUS.md |
| L3 | Marketplace — display only, no definitions | AGENTS.md, STATUS.md |
| L4 | buildFallbackPlan — stub, returns null | PROD-1.9 |
| L5 | Content script navigate/goBack — dead code (background routes) | PROD-1.7 |
| L6 | Duplicate getMemoryStats handlers | PROD-1.8 |
| L7 | Macro runMacro stops on first failure | PROD-10.11 |
| L8 | Shadow DOM — queryWithShadowDOM exists; complex structures | PROD-21.1 |

---

## 7. TEST / CI GAPS

| # | Gap | Notes |
|---|-----|-------|
| T1 | Unit test coverage | 93 tests; neuroplasticity, swarm, persistent-autonomous largely untested |
| T2 | renderMarkdown XSS | No unit test for escapeHtml in paragraphs |
| T3 | isSafeRegex in background/content | Covered by security.test.ts for shared; integration untested |
| T4 | Import sanitization | storage.test.ts covers validateAndFilterImportData; chat_history sanitization untested |
| T5 | Playwright — some tests expect chrome APIs | "Command not cleared", "No chat messages" — mock limitations |
| T6 | Service worker lifecycle | No tests for SW-specific behavior |

---

## 8. SUMMARY COUNTS

| Category | Fixed | Open | Partial | Observed |
|----------|-------|------|---------|----------|
| Critical/High | 6 | 10 | 0 | 0 |
| Medium | 2 | 27 | 0 | 0 |
| Low/Polish | 0 | 21 | 0 | 0 |
| Edge Cases | 0 | 0 | 0 | 10 |
| Known Limitations | 0 | 8 | 0 | 0 |
| Test Gaps | 0 | 6 | 0 | 0 |

---

## 9. SOURCES

- **DEBUG_SESSION_LOG.md** — Fixes from 2026-02-21 debug sessions
- **PRODUCTION_READINESS_AUDIT.md** — Full audit (PROD-*)
- **AUDIT.md** — Pre-production audit summary
- **AGENTS.md** — Known limitations
- **STATUS.md** — Current status
- **Direct code analysis** — OBSERVED, E*

---

*Last updated: 2026-02-21*
