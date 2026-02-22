# Changelog

All notable changes to HyperAgent will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
