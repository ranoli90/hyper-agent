# Pre-Production Audit

**Date:** 2026-02-20

## Resolved (as of merge to main)

| # | Item | Resolution |
|---|------|------------|
| 1 | VoiceInterface start/stop | Already using startListening/stopListening |
| 2-4 | renderMarkdown XSS | Already has escapeHtml, href validation |
| 5 | loadHistory XSS | Now uses inputSanitizer.sanitize() |
| 6 | SnapshotManager shape | Fixed: full AgentSnapshot passed |
| 7 | saveHistory on close | visibilitychange + beforeunload handlers |
| 8 | Workflow regex ReDoS | isSafeRegex() in shared/safe-regex.ts |
| 9 | Metrics falsy value | Already using ?? |
| 11 | Voice interim results | lastFinalVoiceText, execute only on final |
| 12 | Stripe checkout URL | Already uses new URL() + searchParams |
| 13 | switchToTab | Already gets windowId from tab |
| 14 | Scheduler alarm | No duplicate listener |
| 19 | clearSnapshot | Handles no taskId = clear all |
| 21 | SnapshotManager.clear | Only clears last_active when matching |
| 27 | Workflow infinite loop | MAX_WORKFLOW_ITERATIONS guard |

## Remaining (lower priority)

- API key encryption
- Error monitoring (Sentry)
- UsageTracker debouncing — **DONE**
- LLM timeout config — **DONE**
- Tab overflow — **DONE** (overflow-x: auto)
- ARIA labels — Partial
- Duplicate extractDomain — **DONE** (url-utils.ts)

See [docs/DEVELOPER.md](docs/DEVELOPER.md) for current state.
