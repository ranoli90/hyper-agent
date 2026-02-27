# HyperAgent

**Personal AI Infrastructure for the Web**

HyperAgent is an enterprise-grade Chrome Extension (Manifest V3) that delivers robust, autonomous AI navigation and interaction capabilities directly in the browser. Engineered for reliability, stealth, and security, HyperAgent transforms complex web workflows into autonomous, programmable intelligence.

---

## 🚀 Vision

HyperAgent bridges the gap between Large Language Models and real-world web execution. It provides a secure, state-of-the-art orchestration layer that allows AI agents to "see" the DOM, plan complex multi-step actions, and interact with web pages seamlessly. Ideal for automated research, web testing, data extraction, and personal assistance tasks.

## ✨ Core Capabilities

### 🧠 Autonomous Intelligence Engine
At the core of HyperAgent is the `AutonomousIntelligence` module, capable of parsing abstract user intents into execution plans. It features:
- **Dynamic Replanning**: Fallback mechanisms if the DOM state changes unexpectedly.
- **Smart Locators (Self-Healing)**: An advanced DOM resolution system that pieces through Shadow DOMs, fuzzily matches text, and utilizes ARIA labels to ensure stable element targeting.
- **Multi-Model Support**: Integrated seamlessly with OpenRouter to select specialized LLMs based on task complexity.

### 🥷 Advanced Stealth & Anti-Bot
Built to navigate modern web defenses:
- **Human-like Interaction**: Translates simple `click` or `type` commands into high-fidelity interactions. Mouse movements utilize **Bezier curves**, while typing simulates variable cadences and occasional "human" mistakes (and self-corrections).
- **Environment Masking**: Modifies the `navigator` and `window` objects early in the page lifecycle to override generic bot detection patterns, including WebDriver signatures.

### 🛡️ Enterprise-Grade Security
Built with user privacy and safety at the forefront:
- **Granular Execution Policies**: Supports execution confirmation prompts for high-risk actions (e.g., forms, purchases).
- **Domain Allowance & Mitigation**: Enforces strict URL matching for allowed vs. blocked interactions.
- **Prompt Injection Defense**: Sanitizes LLM outputs and strips payloads attempting jailbreaks, ensuring the LLM respects bounded constraints.
- **Data Redaction**: Sensitive attributes can be redacted from the DOM context before they ever reach the LLM.

### 🧩 Extensible Tool Registry
An onboard `ToolRegistryImpl` dynamically maps specialized capabilities to the AI.
- **Built-In Tooling**: Built-in functions allow the AI to extract page data, summarize context, and interact securely.
- **Analytics & History**: Maintains precise `ToolExecutionRecords` to measure success rates, execution duration, and costs for rigorous telemetry.

---

## 🏗️ Architecture Overview

HyperAgent follows the strict requirements of Chrome Extensions MV3, splitting responsibilities cleanly:

1. **Background Service Worker (`background.ts`)**: The orchestration master. Manages state, session lifecycles, structured logging, subscription tier limitations, and usage telemetry.
2. **Content Scripts (`content.ts`)**: The eyes and hands of the agent. Injected safely into the DOM, it manages cursor virtualization, target element retrieval, and raw interaction dispatch.
3. **Shared Intermediaries (`shared/`)**: Contains the unified LLM client, intent parser, error boundary, retry-circuit breakers, and execution memory.

For an in-depth understanding of the system's structural design, view the [Architecture Specification](./docs/ARCHITECTURE.md).

For detailed documentation on internal modules and APIs, view the [Modules Documentation](./docs/MODULES.md).

---

## 🛠️ Build and Development

The modern toolchain ensures high developer velocity and code quality:
- Built with **TypeScript** and **WXT**.
- Styled using **TailwindCSS** & **PostCSS**.
- Tested rigorously using **Playwright** (E2E) and **Vitest** (Unit Tests).

*Note: For build instructions and encoding configurations, refer to the developer sections inside `docs/` or `.github/` workflows as available.*
