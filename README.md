# HyperAgent

**Personal AI Infrastructure for the Web**

HyperAgent is an enterprise-grade Chrome Extension (Manifest V3) that delivers robust, autonomous AI navigation and interaction capabilities directly in the browser. Engineered for reliability, stealth, and security, HyperAgent transforms complex web workflows into autonomous, programmable intelligence.

---

## Vision

HyperAgent bridges the gap between Large Language Models and real-world web execution. It provides a secure, state-of-the-art orchestration layer that allows AI agents to "see" the DOM, plan complex multi-step actions, and interact with web pages seamlessly. Ideal for automated research, web testing, data extraction, and personal assistance tasks.

## Core Capabilities

### Autonomous Intelligence Engine
At the core of HyperAgent is the `AutonomousIntelligence` module, capable of parsing abstract user intents into execution plans. It features:
- **Dynamic Replanning**: Fallback mechanisms if the DOM state changes unexpectedly.
- **Smart Locators (Self-Healing)**: An advanced DOM resolution system that pieces through Shadow DOMs, fuzzily matches text, and utilizes ARIA labels to ensure stable element targeting.
- **OpenRouter Smart Router**: All AI calls go through OpenRouter using the `openrouter/auto` smart router. HyperAgent does not expose arbitrary provider/model selection; it normalizes configuration through a single OpenRouter base URL and model.

### Advanced Stealth & Anti-Bot
Built to navigate modern web defenses:
- **Human-like Interaction**: Translates simple `click` or `type` commands into high-fidelity interactions. Mouse movements utilize **Bezier curves**, while typing simulates variable cadences and occasional "human" mistakes (and self-corrections).
- **Environment Masking**: Modifies the `navigator` and `window` objects early in the page lifecycle to override generic bot detection patterns, including WebDriver signatures.

### Enterprise-Grade Security & Observability
Built with user privacy, safety, and debuggability at the forefront:
- **Granular Execution Policies**: Supports execution confirmation prompts for high-risk actions (e.g., forms, purchases).
- **Domain Allowance & Mitigation**: Enforces strict URL matching for allowed vs. blocked interactions.
- **Prompt Injection Defense**: Sanitizes LLM outputs and strips payloads attempting jailbreaks, ensuring the LLM respects bounded constraints.
- **Data Redaction**: Sensitive attributes can be redacted from the DOM context before they ever reach the LLM.
- **Structured Debugging**: A centralized debug service (`debug.ts`) records structured logs when debug mode is enabled, with sensitive fields redacted. Each task run is tagged with a short **Correlation ID** that appears both in logs and in the chat UI so issues can be traced end-to-end.

### Extensible Tool Registry
An onboard `ToolRegistryImpl` dynamically maps specialized capabilities to the AI.
- **Built-In Tooling**: Built-in functions allow the AI to extract page data, summarize context, and interact securely.
- **Analytics & History**: Maintains precise `ToolExecutionRecords` to measure success rates, execution duration, and costs for rigorous telemetry.

---

## Architecture Overview

HyperAgent follows the strict requirements of Chrome Extensions MV3, splitting responsibilities cleanly:

1. **Background Service Worker (`background.ts`)**: The orchestration master. Manages state, session lifecycles, structured logging, subscription/usage enforcement, rate limiting, and storage health checks.
2. **Content Scripts (`content.ts`)**: The eyes and hands of the agent. Injected safely into the DOM, it manages cursor virtualization, target element retrieval, and raw interaction dispatch.
3. **Shared Intermediaries (`shared/`)**: Contains the unified LLM client, intent parser, error boundary, retry-circuit breakers, execution memory, configuration, and observability helpers.

For an in-depth understanding of the system's structural design, view the [Architecture Specification](./docs/ARCHITECTURE.md).

For detailed documentation on internal modules and APIs, view the [Modules Documentation](./docs/MODULES.md).

If you are an AI/LLM (or human) coder working on HyperAgent, read the [LLM Coding Guide](./docs/LLM_AGENT_GUIDE.md) before making changes. It explains how sessions, memory, learning, prompts, and tests are expected to behave end-to-end.

---

## Build and Development

The modern toolchain ensures high developer velocity and code quality:
- Built with **TypeScript** and **WXT**.
- Styled using **TailwindCSS** & **PostCSS**.
- Tested rigorously using **Playwright** (E2E) and **Vitest** (Unit Tests).

*Note: For build instructions and encoding configurations, refer to the developer sections inside `docs/` or `.github/` workflows as available.*

### Testing

- **Unit tests**: `npm run test:unit` (Vitest in `tests/unit`).
- **E2E tests**: `npm run test` (Playwright specs in `tests/*.spec.ts`).
- **Combined**: `npm run test:all`.

When you add or change behavior:

- Update or add relevant unit tests in `tests/unit` (especially for `shared/config.ts`, `shared/session.ts`, `shared/memory.ts`, `shared/llmClient.ts`, and new background helpers).
- Update or add Playwright tests if the sidepanel UI or background message contract changes (e.g., new slash commands like `/debug`, new banners, or updated settings).
