# Changelog

All notable changes to HyperAgent will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [4.0.0] - 2026-02-22

### Added

#### Local AI (Ollama Support)
- **Ollama Integration** — Free offline inference via localhost:11434
- **Auto-Detection** — Automatically detects local Ollama server
- **Model Selection** — Supports llama3.2, mistral, codellama, and more
- **Auto-Fallback** — Seamless switch to OpenRouter when Ollama unavailable
- **Settings** — New "Use Local AI" toggle in Settings

#### Companion App Foundation
- **Companion Detection Stub** — Infrastructure for future desktop companion
- **IPC Protocol** — WebSocket message protocol defined for extension-companion communication

#### Documentation Overhaul
- Complete README rewrite with new positioning
- New COMPARISON.md vs Clawbot
- Updated ARCHITECTURE.md for v4.0+
- New SECURITY_AUDIT.md
- Updated PRIVACY_POLICY.md and PERMISSIONS.md

### Changed
- **Pricing Page** — Updated to reflect new tiered model (Free/Pro/Team/Enterprise)
- **Default Model** — Still Gemini 2.0 Flash, but now with Ollama fallback

### Technical
- New `shared/ollamaClient.ts` module
- Extended `Settings` interface with Ollama fields
- Updated `llmClient.ts` with Ollama fallback logic

### Migration from v3.x
- Settings automatically migrated (new Ollama fields default to off)
- Existing API key users can enable "Use Local AI" in Settings
- No breaking changes to existing functionality

---

## [3.1.1] - 2026-02-22

### Fixed

#### Security
- ReDoS protection for workflow regex patterns
- XSS protection for chat history load
- Navigation URL validation (block dangerous protocols)
- Import schema validation for settings

#### Reliability
- Agent loop lock to prevent concurrent execution
- Tab title restoration per-tab (not global)
- UsageTracker initialization with proper loadPromise
- Background interval tracking for cleanup on shutdown
- Tab closure check for correct agent tab
- Confirmation/reply timeout cleanup on early resolution
- WeakRef cleanup for indexed elements (every 30s)
- beforeunload cleanup for visual cursor and glowing frame
- Stale messageRate entry cleanup (every minute)

#### Workflow System
- Self-reference detection in workflow validation
- Orphaned steps detection via reachability graph
- Whitespace-only workflow name validation
- Safe regex warning for unsafe patterns

#### Scheduler
- Context check before sending messages (chrome.runtime?.id)
- Initialization lock for async startup
- Notification button click handler
- Interval clamping (minimum 1 minute)

#### Billing
- Crypto verification error handling (return false on error)
- Real-time ETH price fetching from CoinGecko

#### TikTok Moderator
- Element selector instead of DOM reference (memory leak fix)
- Log size limits (MAX_LOG_ENTRIES = 100)
- Semantic rate limiting (2s between checks)

#### Performance
- Lazy site config loading
- Context caching for getPageContext
- requestIdleCallback for history load

#### Code Quality
- All lint errors fixed (0 errors)
- Service worker compatibility (globalThis, guards)
- Unused variable cleanup

### Tests
- All 253 unit tests passing
- All 19 E2E tests passing

---

## [3.1.0] - 2026-02-21

### Added
- $5 Beta subscription plan with premium features
- Cryptocurrency payments (ETH, USDC on Ethereum, Base, Polygon)
- Stripe payment integration
- Enhanced AI brain with optimized token usage
- Model selection in settings
- Task failure notifications
- Accessibility improvements (reduced motion, skip links, color blind support)
- Example commands on first load
- Privacy summary in onboarding

### Changed
- New unique pricing model (no action limits!)
- Improved first-time user experience
- Better subscription UI

### Fixed
- Multiple accessibility issues
- Color contrast problems
- Focus management

---

## [3.0.0] - 2026-02-21

### Added

#### Core Features
- ReAct-style agent loop (Observe → Plan → Act → Re-observe)
- Self-healing locators with multiple strategies (css, text, aria, role, xpath, index, ariaLabel, id)
- Vision capabilities for sparse DOM fallback
- Snapshot resume for interrupted missions
- Security module integration (domain allowlist, action policy, rate limits)

#### User Experience
- First-run onboarding modal with quick start guide
- Dark mode with system preference detection
- Offline detection and user notifications
- `/export-chat` command for chat history export
- Rate limit feedback with specific wait times
- Modal focus trap for keyboard accessibility
- Dynamic Type support (rem units for font sizes)

#### Infrastructure
- Error reporting infrastructure with sensitive data redaction
- Storage quota monitoring with warnings at 80%/95%
- Token/cost tracking per session with configurable caps
- Production-safe debug logging module
- Comprehensive storage keys registry

#### Security
- Expanded redaction patterns for API keys (OpenAI, Anthropic, Google AI, Stripe, AWS)
- Condition.value sanitization in workflows
- Input sanitization tests

#### Testing
- Unit tests for security module (10 tests)
- Unit tests for workflows module (2 tests)
- Total: 80 unit tests passing

#### Documentation
- Privacy policy with data usage disclosure
- Permission justification document
- Cache TTL audit documentation

### Fixed

- Service worker compatibility (window.setInterval → globalThis, document/window guards)
- Message handler sendResponse on all code paths
- Import settings validation (allowlist, schema)
- verifyActionWithVision fail-closed on parse error
- visionUpdate screenshot format (base64 prefix)
- ReDoS protection via safe-regex
- Empty command rejection
- Scheduler once task validation
- Duplicate getMemoryStats handler consolidated
- escapeHtml single-quote escaping
- Lazy loading for site config and chat history
- Context caching for getPageContext (performance)
- Stripe checkout return flow handler

### Changed

- Marketplace workflows labeled as "Coming Soon" (no actual workflow definitions)
- Base font sizes from px to rem for Dynamic Type support

### Security

- Import schema validation
- validateExtensionMessage rejects unknown types
- Command length limit (10000 chars)
- API key redaction in logs
- Condition value length limits

### Dependencies

- npm audit fix applied (partial - dev dependencies have remaining vulnerabilities)

---

## [2.0.0] - 2026-02-15

### Added
- Initial Chrome MV3 extension structure
- WXT framework integration
- OpenRouter LLM integration
- Basic automation capabilities

---

## [1.0.0] - 2026-01-01

### Added
- Project initialization
