# Workflows and Tools

This document describes how to add new workflows and tools in HyperAgent.

## Workflow templates

Built-in workflow templates live in `shared/workflow-templates.ts`. Each template has:

- **id**: Unique identifier (e.g. `template_search_extract`)
- **name**: Display name
- **description**: Short description for the UI
- **parameters**: List of parameters the user must fill before running (name, required, description, default)
- **workflow**: The workflow definition (name, description, steps). Step action values can use `{{paramName}}` for substitution.

### Adding a new workflow template

1. Open `shared/workflow-templates.ts`.
2. Add a new entry to the `WORKFLOW_TEMPLATES` array:

```ts
{
  id: 'template_my_task',
  name: 'My task',
  description: 'What this workflow does.',
  parameters: [
    { name: 'url', required: true, description: 'Target URL' },
    { name: 'query', required: false, description: 'Optional query', default: '' },
  ],
  workflow: {
    name: 'My task',
    description: 'Same as above',
    steps: [
      { id: 'step1', action: { type: 'navigate', url: '{{url}}' } },
      { id: 'step2', action: { type: 'fill', locator: { strategy: 'css', value: '#q', index: 0 }, value: '{{query}}' } },
      // ...
    ],
  },
},
```

3. Use `substituteParams(steps, params)` to build the concrete workflow at run time.
4. Pre-validate with `validateTemplateParameters(templateId, params)` before starting the agent loop.

### Workflow step actions

Steps use the same `Action` types as the agent: `navigate`, `click`, `fill`, `select`, `scroll`, `extract`, `wait`, `submit`, etc. See `shared/types.ts` for full action shapes.

### Safety

- Workflows that include destructive actions (e.g. delete, remove) should set `destructive: true` on the action and will require user confirmation when `requireConfirm` is enabled in settings.
- Automated tests in `tests/unit/workflows.test.ts` assert that destructive actions are not executed without confirmation when the safety flag is on.

---

## Tools (tool-system.ts)

The tool system in `shared/tool-system.ts` defines **tools** that the LLM or automation can call. Each tool has:

- **id**: Unique id (e.g. `web_navigate`, `web_click`)
- **name**, **description**: For prompts and UI
- **category**: One of `NAVIGATION`, `INTERACTION`, `EXTRACTION`, `ANALYSIS`, `AUTOMATION`, `COMMUNICATION`, `DATA`, `SYSTEM`
- **parameters**: Typed parameters (name, type, required, description, default, enum)
- **execute**: Async function `(params, context?) => Promise<ToolResult>`
- **validate**: Optional `(params) => boolean`
- **requiresConfirmation**: Optional boolean
- **riskLevel**: `low` | `medium` | `high`
- **enabled**: boolean

### Adding a new tool

1. Open `shared/tool-system.ts`.
2. In `initializeBuiltinTools()`, call `this.register({ ... })`:

```ts
this.register({
  id: 'my_tool',
  name: 'My tool',
  description: 'What it does',
  category: ToolCategory.AUTOMATION,
  parameters: [
    { name: 'input', type: 'string', required: true, description: 'Input value' },
  ],
  execute: async (params) => {
    // Return { success, data?, error?, actions?, message? }
    return { success: true, message: 'Done' };
  },
  riskLevel: 'low',
  enabled: true,
});
```

3. To expose the tool to the LLM, ensure it is listed in the agent’s available tools (e.g. in the system prompt or tool-call layer). Integration with the LLM is in `shared/llmClient.ts` and the background agent loop; tools can be mapped to actions or used via a dedicated tool-calling path.

### Tool result

Return `{ success: boolean; data?: any; error?: string; actions?: Action[]; message?: string }`. Returning `actions` lets the tool emit browser actions that the agent will execute.

---

## Rate limits

- **Global**: Workflow runs are subject to the same usage/billing limits as the rest of the agent (see Subscription/usage).
- **Per-domain**: Workflow runs are recorded per domain in `WORKFLOW_RUNS`; the agent loop and domain action tracker respect `MAX_ACTIONS_PER_DOMAIN` so workflows cannot exceed that without session reset.

---

## Storage keys

- `hyperagent_workflows`: User-saved workflows.
- `hyperagent_workflow_runs`: Per-domain run history (last N per domain).
- `hyperagent_last_workflow_runs_list`: Last N runs globally (for “View last workflow runs”).
- `hyperagent_last_successful_workflow`: Last successful workflow id and timestamp for quick rerun.
