# Module Breakdown & API Reference

HyperAgent is composed of specialized modules that orchestrate web interactions securely. Below is a detailed review of the core files across `entrypoints/` and `shared/` directories.

## Entrypoints

### `background.ts`
The orchestration master for the entire extension. It acts as the "brain," managing extension lifecycles and bridging the LLM client with the active user session.
- **`UsageTracker`**: Enforces subscription tiers (`free`, `premium`, `enterprise`) by measuring `actionsExecuted` and `autonomousSessions`. Provides token expenditure and cost bounds.
- **`StructuredLogger`**: A robust logging mechanism (`log(level, message, data)`) that integrates directly with telemetry.
- **`UsageMetrics`**: Maintains state regarding the reset dates and cumulative limits across billing cycles.
- **Event Listeners**: Captures incoming messages from `content.ts` (e.g., `performAction`) and delegates them to the `AutonomousIntelligence` execution stack.

### `content.ts`
The "hands and eyes" injected into the target tab. Sandboxed away from direct LLM interaction.
- **`createVisualCursor()` / `moveVisualCursor(x, y)`**: Injects a custom CSS cursor that follows bezier curve movements to visually indicate agent actions to the user.
- **`getPageContext()`**: Extracts a sanitized, minimized payload of the DOM, preserving element bounds, roles, text content, and interactable states (ignoring invisible structural nodes).
- **`resolveLocator(locator)`**: Extremely resilient locator resolution. Falls back gracefully through querySelectors to `findByText`, `findByAriaLabel`, and raw role match checks.
- **`queryAllWithShadow(selector, root)`**: Deeply traverses complex corporate SPAs bypassing shadow DOM restrictions to grab elements.

---

## Shared Services (`shared/`)

### `llmClient.ts`
Handles all LLM interactions and manages rate limits and cost via OpenRouter APIs.
- **`sanitizeForPrompt(text)`**: Strips prompt injections (`ignore all previous instructions`, `pretend you are`, etc.) before passing parameters to the model.
- **`classifyError(error)`**: Deeply categorizes API responses (Rate Limits vs Service Outages vs Model failures), enabling retry mechanisms via `retry-circuit-breaker.ts`.
- **`CostTracker`**: Live-calculates token utility costs enforcing warnings against `DEFAULTS.COST_WARNING_THRESHOLD`.
- Dynamically generates the **System Prompt** on the fly, tailoring boundaries and instructions based on context constraints.

### `autonomous-intelligence.ts`
Algorithmic logic solver used to sequence operations.
- **`understandAndPlan(command, context)`**: Creates an `AutonomousPlan`. Uses the LLM client to split complex tasks (e.g., "Find me round-trip tickets to JFK on Friday") into discrete, linear execution instructions.
- **`executeWithAdaptation(plan)`**: Executes the plan. If step 2 fails (e.g., the target button doesn't exist anymore), it pauses, extracts new context, and asks the LLM to devise an ad-hoc recovery mechanism.

### `tool-system.ts`
Dynamic execution registry mapped to JSON-schema payloads.
- **`ToolRegistryImpl`**: Exposes `register()`, `enable()`, `disable()`, and `execute(toolId, params)`.
- **`ToolExecutionRecord`**: Stores exhaustive histories detailing API duration, success status, and specific parameters used. Allows real-time optimization and analytics tracking.

### `stealth-engine.ts`
Anti-bot mitigation algorithms designed to execute commands like a real user.
- **`typeStealthily(element, text)`**: Randomizes keystroke timings between 50ms to 250ms, deliberately creating a 1% chance for a mistype and human-like backspace correction.
- **`moveMouseStealthily(targetX, targetY)`**: Casts a Quadratic Bezier path rather than a straight linear jump, completely defeating simple pointer-track analysis.
- **`applyPropertyMasks()`**: Rewrites standard WebDriver objects (`navigator.webdriver`, masked permission API queries).

### `security.ts`
Hardened boundaries to ensure client intent is preserved and user safety secured.
- **`checkActionAllowed(action, url)`**: Intercepts `Action` objects preventing forbidden operations against blacklisted or protected hosts.
- **`PrivacySettings` & `SecurityPolicy`**: Requires explicit UI confirmations before the agent is allowed to execute `navigate` or `fill` form commands unless over-ridden.
- **`redact(value)`**: General purpose data scraper specifically looking to mask identifiable telemetry values prior to remote ingestion.
