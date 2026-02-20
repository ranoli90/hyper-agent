# Shared Modules

Core business logic used by background, content script, and side panel.

## Core

| Module | Purpose |
|--------|---------|
| `types.ts` | All TypeScript interfaces (Action, PageContext, etc.) |
| `config.ts` | Settings, defaults, storage keys |
| `llmClient.ts` | LLM API client, caching, response parsing |

## Intelligence & Planning

| Module | Purpose |
|--------|---------|
| `autonomous-intelligence.ts` | Planning engine for autonomous tasks |
| `reasoning-engine.ts` | LLM reasoning orchestration |
| `intent.ts` | Command parsing, suggestions |
| `swarm-intelligence.ts` | Multi-agent coordination |

## Persistence & State

| Module | Purpose |
|--------|---------|
| `session.ts` | Session management, action history |
| `memory.ts` | Site strategy learning, locator success/failure |
| `snapshot-manager.ts` | Task state persistence for resume |
| `persistent-autonomous.ts` | Never-stop autonomy, proactive suggestions |

## Security & Reliability

| Module | Purpose |
|--------|---------|
| `security.ts` | Data redaction, rate limiting |
| `input-sanitization.ts` | XSS protection, input validation |
| `safe-regex.ts` | ReDoS protection for user regex |
| `failure-recovery.ts` | Retry strategies, error classification |
| `error-boundary.ts` | Graceful degradation |

## Infrastructure

| Module | Purpose |
|--------|---------|
| `advanced-caching.ts` | LLM/API response caching |
| `memory-management.ts` | Leak detection, cleanup |
| `metrics.ts` | Performance tracking |
| `scheduler-engine.ts` | Background task scheduling |

## Utilities

| Module | Purpose |
|--------|---------|
| `url-utils.ts` | extractDomain and URL helpers |
| `workflows.ts` | Workflow execution, conditions |
| `macros.ts` | Macro recording/playback |
| `billing.ts` | Stripe subscription, usage limits |
| `siteConfig.ts` | Per-domain configuration |

## Feature-Specific

| Module | Purpose |
|--------|---------|
| `voice-interface.ts` | Speech-to-text |
| `stealth-engine.ts` | Bot detection evasion |
| `tiktok-moderator.ts` | TikTok automation |
| `tool-system.ts` | Tool registry |
