/**
 * @fileoverview Built-in workflow templates for common tasks.
 * Stored under WORKFLOWS; users can install and customize these.
 * @see docs/WORKFLOWS_AND_TOOLS.md for how to add new workflows and tools.
 */

import type { Workflow, WorkflowStep } from './types';

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  /** Parameter names that should be pre-filled or validated before run. */
  parameters: Array<{ name: string; required: boolean; description: string; default?: string }>;
  /** The workflow definition (steps may reference params as {{paramName}}). */
  workflow: Omit<Workflow, 'id'>;
}

function escapeRegExp(key: string): string {
  return key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function substituteString(str: string, params: Record<string, string>): string {
  let out = str;
  for (const [key, value] of Object.entries(params)) {
    const escaped = escapeRegExp(key);
    out = out.replace(new RegExp(`\\{\\{\\s*${escaped}\\s*\\}\\}`, 'g'), value ?? '');
  }
  return out;
}

function substituteInObject(obj: unknown, params: Record<string, string>): unknown {
  if (typeof obj === 'string') return substituteString(obj, params);
  if (Array.isArray(obj)) return obj.map(item => substituteInObject(item, params));
  if (obj && typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = substituteInObject(v, params);
    }
    return out;
  }
  return obj;
}

/** Substitute {{paramName}} in action (and nested fields) with params. */
export function substituteParams(
  steps: WorkflowStep[],
  params: Record<string, string>
): WorkflowStep[] {
  return steps.map(step => ({
    ...step,
    action: substituteInObject(step.action, params) as WorkflowStep['action'],
  }));
}

/** Built-in workflow templates. */
export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'template_search_extract',
    name: 'Search and extract',
    description: 'Navigate to a search URL, run a query, and extract result text or links.',
    parameters: [
      { name: 'searchUrl', required: true, description: 'Full URL of the search page', default: 'https://www.google.com/search' },
      { name: 'query', required: true, description: 'Search query' },
      { name: 'extractSelector', required: false, description: 'CSS selector or text for results to extract', default: '' },
    ],
    workflow: {
      name: 'Search and extract',
      description: 'Run a search and extract results',
      steps: [
        {
          id: 'nav',
          action: { type: 'navigate', url: '{{searchUrl}}?q={{query}}' },
        },
        {
          id: 'wait',
          action: { type: 'wait' },
        },
        {
          id: 'extract',
          action: {
            type: 'extract',
            locator: { strategy: 'css' as const, value: '{{extractSelector}}', index: 0 },
            multiple: true,
          },
        },
      ],
    },
  },
  {
    id: 'template_form_fill',
    name: 'Fill form and submit',
    description: 'Fill a form with provided values and submit.',
    parameters: [
      { name: 'formUrl', required: true, description: 'URL of the page with the form' },
      { name: 'fieldValues', required: true, description: 'JSON object of field name/value pairs', default: '{}' },
    ],
    workflow: {
      name: 'Fill form and submit',
      description: 'Navigate, fill fields, submit',
      steps: [
        { id: 'nav', action: { type: 'navigate', url: '{{formUrl}}' } },
        { id: 'wait', action: { type: 'wait', ms: 1000 } },
        { id: 'submit', action: { type: 'submit', locator: { strategy: 'css' as const, value: 'form', index: 0 } } },
      ],
    },
  },
  {
    id: 'template_login_action',
    name: 'Login and perform action',
    description: 'Navigate to login page, fill credentials, submit, then navigate to a target URL.',
    parameters: [
      { name: 'loginUrl', required: true, description: 'Login page URL' },
      { name: 'usernameSelector', required: true, description: 'CSS selector for username field', default: 'input[name="username"], #email' },
      { name: 'passwordSelector', required: true, description: 'CSS selector for password field', default: 'input[name="password"], #password' },
      { name: 'username', required: true, description: 'Username to fill' },
      { name: 'password', required: true, description: 'Password to fill' },
      { name: 'afterLoginUrl', required: false, description: 'URL to open after login (optional)' },
    ],
    workflow: {
      name: 'Login and perform action',
      description: 'Login then navigate to target',
      steps: [
        { id: 'nav', action: { type: 'navigate', url: '{{loginUrl}}' } },
        { id: 'wait', action: { type: 'wait', ms: 1000 } },
        { id: 'fillUser', action: { type: 'fill', locator: { strategy: 'css' as const, value: '{{usernameSelector}}', index: 0 }, value: '{{username}}' } },
        { id: 'fillPass', action: { type: 'fill', locator: { strategy: 'css' as const, value: '{{passwordSelector}}', index: 0 }, value: '{{password}}' } },
        { id: 'submit', action: { type: 'submit', locator: { strategy: 'css' as const, value: 'form', index: 0 } } },
        { id: 'after', action: { type: 'navigate', url: '{{afterLoginUrl}}' } },
      ],
    },
  },
  {
    id: 'template_extract_list',
    name: 'Extract list from page',
    description: 'Extract repeated items (e.g. product names, links) from the current or a given URL.',
    parameters: [
      { name: 'pageUrl', required: false, description: 'URL to open (leave empty to use current page)' },
      { name: 'itemSelector', required: true, description: 'CSS selector for each list item', default: 'li, [data-item], .result' },
    ],
    workflow: {
      name: 'Extract list from page',
      description: 'Extract multiple items',
      steps: [
        { id: 'nav', action: { type: 'navigate', url: '{{pageUrl}}' } },
        { id: 'wait', action: { type: 'wait', ms: 1000 } },
        { id: 'extract', action: { type: 'extract', locator: { strategy: 'css' as const, value: '{{itemSelector}}', index: 0 }, multiple: true } },
      ],
    },
  },
];

/** Get a template by id. */
export function getWorkflowTemplateById(id: string): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find(t => t.id === id);
}

/** Pre-validate workflow template parameters before starting the agent loop. */
export function validateTemplateParameters(
  templateId: string,
  params: Record<string, string>
): { valid: boolean; missing: string[]; errors: string[] } {
  const template = getWorkflowTemplateById(templateId);
  const missing: string[] = [];
  const errors: string[] = [];
  if (!template) {
    return { valid: false, missing: [], errors: [`Unknown template: ${templateId}`] };
  }
  for (const p of template.parameters) {
    if (p.required) {
      const val = params[p.name];
      if (val === undefined || val === null || String(val).trim() === '') {
        missing.push(p.name);
      }
    }
  }
  if (missing.length > 0) {
    errors.push(`Missing required parameters: ${missing.join(', ')}`);
  }
  return {
    valid: missing.length === 0 && errors.length === 0,
    missing,
    errors,
  };
}

/** Convert a template into a concrete Workflow with a unique id and substituted params. */
export function instantiateTemplate(
  templateId: string,
  params: Record<string, string>,
  uniqueSuffix?: string
): Workflow | null {
  const template = getWorkflowTemplateById(templateId);
  if (!template) return null;
  const id = uniqueSuffix ? `${template.id}_${uniqueSuffix}` : `${template.id}_${Date.now()}`;
  const steps = substituteParams(
    template.workflow.steps as WorkflowStep[],
    params
  );
  return {
    id,
    name: template.workflow.name,
    description: template.workflow.description,
    steps,
    startStep: template.workflow.startStep || steps[0]?.id,
  };
}
