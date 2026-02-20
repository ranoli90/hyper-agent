# Changelog

All notable changes to HyperAgent will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [3.0.0] - 2026-02-20

### Added

- ReAct-style agent loop (Observe → Plan → Act → Re-observe)
- Self-healing locators with multiple strategies (css, text, aria, role, xpath, index, ariaLabel, id)
- Vision capabilities for sparse DOM fallback
- Snapshot resume for interrupted missions
- Security module integration (domain allowlist, action policy, rate limits)
- Keyboard shortcut Ctrl/Cmd+K to focus command input
- Dark mode with system preference detection
- Accessibility: aria-live on chat and status, aria-selected on tabs

### Fixed

- Service worker compatibility (window.setInterval → setInterval, document/window guards)
- Message handler sendResponse on all code paths
- Import settings validation (allowlist, schema)
- verifyActionWithVision fail-closed on parse error
- visionUpdate screenshot format (base64 prefix)
- ReDoS protection via safe-regex
- Empty command rejection
- Scheduler once task validation
- Duplicate getMemoryStats handler consolidated
- escapeHtml single-quote escaping

### Security

- Import schema validation
- validateExtensionMessage rejects unknown types
- Command length limit (10000 chars)
