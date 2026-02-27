import type { Action, PageContext, Locator, LocatorStrategy } from './types';
import { type RiskLevel } from './ai-types';

export interface Tool {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  parameters: ToolParameter[];
  execute: (params: Record<string, any>, context?: ToolContext) => Promise<ToolResult>;
  validate?: (params: Record<string, any>) => boolean;
  requiresConfirmation?: boolean;
  riskLevel: RiskLevel;
  enabled: boolean;
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description: string;
  default?: any;
  enum?: string[];
}

export interface ToolContext {
  tabId?: number;
  pageContext?: PageContext;
  sessionId?: string;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  actions?: Action[];
  message?: string;
}

export enum ToolCategory {
  NAVIGATION = 'navigation',
  INTERACTION = 'interaction',
  EXTRACTION = 'extraction',
  ANALYSIS = 'analysis',
  AUTOMATION = 'automation',
  COMMUNICATION = 'communication',
  DATA = 'data',
  SYSTEM = 'system',
}

function createLocator(selector?: string, text?: string, index?: number): Locator {
  if (text) {
    return { strategy: 'text' as LocatorStrategy, value: text, index: index ?? 0 };
  }
  if (selector) {
    return { strategy: 'css' as LocatorStrategy, value: selector, index: index ?? 0 };
  }
  return { strategy: 'css' as LocatorStrategy, value: '*', index: 0 };
}

class ToolRegistryImpl {
  private tools: Map<string, Tool> = new Map();
  private categories: Map<ToolCategory, Set<string>> = new Map();
  private executionHistory: ToolExecutionRecord[] = [];
  private maxHistorySize = 1000;

  constructor() {
    this.initializeBuiltinTools();
  }

  private initializeBuiltinTools(): void {
    this.register({
      id: 'web_navigate',
      name: 'Navigate to URL',
      description: 'Navigate the browser to a specific URL',
      category: ToolCategory.NAVIGATION,
      parameters: [
        { name: 'url', type: 'string', required: true, description: 'The URL to navigate to' },
        {
          name: 'waitForLoad',
          type: 'boolean',
          required: false,
          description: 'Wait for page load',
          default: true,
        },
      ],
      execute: async params => ({
        success: true,
        actions: [{ type: 'navigate' as const, url: params.url }],
        message: `Navigating to ${params.url}`,
      }),
      riskLevel: 'low',
      enabled: true,
    });

    this.register({
      id: 'web_click',
      name: 'Click Element',
      description: 'Click on an element on the page',
      category: ToolCategory.INTERACTION,
      parameters: [
        {
          name: 'selector',
          type: 'string',
          required: false,
          description: 'CSS selector for the element',
        },
        {
          name: 'text',
          type: 'string',
          required: false,
          description: 'Text content to find element',
        },
        {
          name: 'index',
          type: 'number',
          required: false,
          description: 'Index of element if multiple matches',
          default: 0,
        },
      ],
      execute: async params => ({
        success: true,
        actions: [
          {
            type: 'click' as const,
            locator: createLocator(params.selector, params.text, params.index),
          },
        ],
        message: `Clicking element: ${params.selector || params.text}`,
      }),
      riskLevel: 'medium',
      enabled: true,
    });

    this.register({
      id: 'web_fill',
      name: 'Fill Form Field',
      description: 'Fill a form field with text',
      category: ToolCategory.INTERACTION,
      parameters: [
        {
          name: 'selector',
          type: 'string',
          required: false,
          description: 'CSS selector for the input',
        },
        { name: 'value', type: 'string', required: true, description: 'Value to fill' },
        {
          name: 'clearFirst',
          type: 'boolean',
          required: false,
          description: 'Clear field before filling',
          default: true,
        },
      ],
      execute: async params => ({
        success: true,
        actions: [
          {
            type: 'fill' as const,
            locator: createLocator(params.selector),
            value: params.value,
            clearFirst: params.clearFirst ?? true,
          },
        ],
        message: `Filling field with: ${params.value.substring(0, 50)}...`,
      }),
      riskLevel: 'medium',
      enabled: true,
    });

    this.register({
      id: 'web_extract',
      name: 'Extract Data',
      description: 'Extract data from the page',
      category: ToolCategory.EXTRACTION,
      parameters: [
        {
          name: 'selector',
          type: 'string',
          required: false,
          description: 'CSS selector for elements to extract',
        },
        {
          name: 'attribute',
          type: 'string',
          required: false,
          description: 'Attribute to extract (href, src, text)',
        },
        {
          name: 'multiple',
          type: 'boolean',
          required: false,
          description: 'Extract multiple elements',
          default: false,
        },
      ],
      execute: async params => ({
        success: true,
        actions: [
          {
            type: 'extract' as const,
            locator: createLocator(params.selector),
            attribute: params.attribute,
            multiple: params.multiple,
          },
        ],
        message: `Extracting data from: ${params.selector || 'page'}`,
      }),
      riskLevel: 'low',
      enabled: true,
    });

    this.register({
      id: 'web_scroll',
      name: 'Scroll Page',
      description: 'Scroll the page in a direction',
      category: ToolCategory.NAVIGATION,
      parameters: [
        {
          name: 'direction',
          type: 'string',
          required: false,
          description: 'Direction to scroll',
          enum: ['up', 'down', 'top', 'bottom'],
          default: 'down',
        },
        {
          name: 'amount',
          type: 'number',
          required: false,
          description: 'Pixels to scroll',
          default: 400,
        },
      ],
      execute: async params => ({
        success: true,
        actions: [
          {
            type: 'scroll' as const,
            direction: params.direction ?? 'down',
            amount: params.amount ?? 400,
          },
        ],
        message: `Scrolling ${params.direction ?? 'down'}`,
      }),
      riskLevel: 'low',
      enabled: true,
    });

    this.register({
      id: 'web_wait',
      name: 'Wait',
      description: 'Wait for a duration',
      category: ToolCategory.AUTOMATION,
      parameters: [
        { name: 'ms', type: 'number', required: true, description: 'Milliseconds to wait' },
      ],
      execute: async params => ({
        success: true,
        actions: [{ type: 'wait' as const, ms: params.ms }],
        message: `Waiting for ${params.ms}ms`,
      }),
      riskLevel: 'low',
      enabled: true,
    });

    this.register({
      id: 'web_select',
      name: 'Select Option',
      description: 'Select an option from a dropdown',
      category: ToolCategory.INTERACTION,
      parameters: [
        {
          name: 'selector',
          type: 'string',
          required: true,
          description: 'CSS selector for select element',
        },
        { name: 'value', type: 'string', required: false, description: 'Value to select' },
        { name: 'text', type: 'string', required: false, description: 'Visible text to select' },
      ],
      execute: async params => ({
        success: true,
        actions: [
          { type: 'select' as const, locator: createLocator(params.selector), value: params.value },
        ],
        message: `Selecting option in: ${params.selector}`,
      }),
      riskLevel: 'medium',
      enabled: true,
    });

    this.register({
      id: 'web_hover',
      name: 'Hover Element',
      description: 'Hover over an element',
      category: ToolCategory.INTERACTION,
      parameters: [
        { name: 'selector', type: 'string', required: false, description: 'CSS selector' },
        { name: 'text', type: 'string', required: false, description: 'Text to find element' },
      ],
      execute: async params => ({
        success: true,
        actions: [{ type: 'hover' as const, locator: createLocator(params.selector, params.text) }],
        message: `Hovering over: ${params.selector || params.text}`,
      }),
      riskLevel: 'low',
      enabled: true,
    });

    this.register({
      id: 'web_press_key',
      name: 'Press Key',
      description: 'Press a keyboard key',
      category: ToolCategory.INTERACTION,
      parameters: [
        {
          name: 'key',
          type: 'string',
          required: true,
          description: 'Key to press (Enter, Tab, Escape, etc.)',
        },
      ],
      execute: async params => ({
        success: true,
        actions: [{ type: 'pressKey' as const, key: params.key }],
        message: `Pressing key: ${params.key}`,
      }),
      riskLevel: 'low',
      enabled: true,
    });

    this.register({
      id: 'web_go_back',
      name: 'Go Back',
      description: 'Navigate back in history',
      category: ToolCategory.NAVIGATION,
      parameters: [],
      execute: async () => ({
        success: true,
        actions: [{ type: 'goBack' as const }],
        message: 'Navigating back',
      }),
      riskLevel: 'low',
      enabled: true,
    });

    this.register({
      id: 'web_open_tab',
      name: 'Open New Tab',
      description: 'Open a new browser tab',
      category: ToolCategory.NAVIGATION,
      parameters: [
        { name: 'url', type: 'string', required: false, description: 'URL to open in new tab' },
        {
          name: 'active',
          type: 'boolean',
          required: false,
          description: 'Focus the new tab',
          default: true,
        },
      ],
      execute: async params => ({
        success: true,
        actions: [{ type: 'openTab' as const, url: params.url, active: params.active ?? true }],
        message: `Opening new tab: ${params.url || 'blank'}`,
      }),
      riskLevel: 'medium',
      enabled: true,
    });

    this.register({
      id: 'web_switch_tab',
      name: 'Switch Tab',
      description: 'Switch to a different browser tab',
      category: ToolCategory.NAVIGATION,
      parameters: [
        { name: 'tabId', type: 'number', required: false, description: 'Tab ID to switch to' },
        {
          name: 'urlPattern',
          type: 'string',
          required: false,
          description: 'URL pattern to match tab',
        },
      ],
      execute: async params => ({
        success: true,
        actions: [
          { type: 'switchTab' as const, tabId: params.tabId, urlPattern: params.urlPattern },
        ],
        message: 'Switching tab',
      }),
      riskLevel: 'low',
      enabled: true,
    });

    this.register({
      id: 'web_close_tab',
      name: 'Close Tab',
      description: 'Close a browser tab',
      category: ToolCategory.NAVIGATION,
      parameters: [
        {
          name: 'tabId',
          type: 'number',
          required: false,
          description: 'Tab ID to close (current if omitted)',
        },
      ],
      execute: async params => ({
        success: true,
        actions: [{ type: 'closeTab' as const, tabId: params.tabId }],
        message: 'Closing tab',
      }),
      riskLevel: 'medium',
      enabled: true,
    });

    this.register({
      id: 'data_calculate',
      name: 'Calculate',
      description: 'Perform a calculation',
      category: ToolCategory.DATA,
      parameters: [
        {
          name: 'expression',
          type: 'string',
          required: true,
          description: 'Mathematical expression',
        },
      ],
      execute: async params => {
        try {
          const sanitized = params.expression.replace(/[^0-9+\-*/().%\s]/g, '');
          const result = Function(`"use strict"; return (${sanitized})`)();
          return { success: true, data: result, message: `Result: ${result}` };
        } catch {
          return { success: false, error: 'Invalid expression' };
        }
      },
      riskLevel: 'low',
      enabled: true,
    });

    this.register({
      id: 'time_current',
      name: 'Get Current Time',
      description: 'Get the current date and time',
      category: ToolCategory.SYSTEM,
      parameters: [
        {
          name: 'timezone',
          type: 'string',
          required: false,
          description: 'Timezone (e.g., America/New_York)',
        },
      ],
      execute: async params => {
        const now = new Date();
        let result: string;
        try {
          result = params.timezone
            ? now.toLocaleString('en-US', { timeZone: params.timezone })
            : now.toLocaleString();
        } catch {
          result = now.toLocaleString();
        }
        return {
          success: true,
          data: { iso: now.toISOString(), locale: result, timestamp: now.getTime() },
          message: result,
        };
      },
      riskLevel: 'low',
      enabled: true,
    });

    this.register({
      id: 'data_format',
      name: 'Format Data',
      description: 'Format data in a specific format',
      category: ToolCategory.DATA,
      parameters: [
        { name: 'data', type: 'string', required: true, description: 'Data to format' },
        {
          name: 'format',
          type: 'string',
          required: true,
          description: 'Output format',
          enum: ['json', 'csv', 'markdown', 'table'],
        },
      ],
      execute: async params => {
        let formatted: string;
        try {
          const parsed = typeof params.data === 'string' ? JSON.parse(params.data) : params.data;
          switch (params.format) {
            case 'json':
              formatted = JSON.stringify(parsed, null, 2);
              break;
            case 'csv':
              if (Array.isArray(parsed)) {
                const keys = Object.keys(parsed[0] || {});
                formatted = [
                  keys.join(','),
                  ...parsed.map((row: any) => keys.map(k => row[k]).join(',')),
                ].join('\n');
              } else {
                formatted = String(parsed);
              }
              break;
            case 'markdown':
              formatted = '```\n' + JSON.stringify(parsed, null, 2) + '\n```';
              break;
            case 'table':
              formatted = Array.isArray(parsed)
                ? '| Index | Value |\n|-------|-------|\n' +
                  parsed.map((v, i) => `| ${i} | ${JSON.stringify(v)} |`).join('\n')
                : String(parsed);
              break;
            default:
              formatted = String(parsed);
          }
          return { success: true, data: formatted, message: `Formatted as ${params.format}` };
        } catch {
          return { success: false, error: 'Failed to format data' };
        }
      },
      riskLevel: 'low',
      enabled: true,
    });
  }

  register(tool: Tool): void {
    this.tools.set(tool.id, tool);

    if (!this.categories.has(tool.category)) {
      this.categories.set(tool.category, new Set());
    }
    this.categories.get(tool.category)!.add(tool.id);

    console.log(`[ToolRegistry] Registered tool: ${tool.id} (${tool.category})`);
  }

  unregister(toolId: string): boolean {
    const tool = this.tools.get(toolId);
    if (!tool) return false;

    this.tools.delete(toolId);
    this.categories.get(tool.category)?.delete(toolId);
    return true;
  }

  get(toolId: string): Tool | undefined {
    return this.tools.get(toolId);
  }

  getByCategory(category: ToolCategory): Tool[] {
    const ids = this.categories.get(category);
    if (!ids) return [];
    return Array.from(ids)
      .map(id => this.tools.get(id)!)
      .filter(Boolean);
  }

  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  getEnabled(): Tool[] {
    return this.getAll().filter(t => t.enabled);
  }

  async execute(
    toolId: string,
    params: Record<string, any>,
    context?: ToolContext
  ): Promise<ToolResult> {
    const tool = this.tools.get(toolId);
    if (!tool) {
      return { success: false, error: `Tool not found: ${toolId}` };
    }

    if (!tool.enabled) {
      return { success: false, error: `Tool is disabled: ${toolId}` };
    }

    const missingParams = tool.parameters
      .filter(p => p.required && !(p.name in params))
      .map(p => p.name);

    if (missingParams.length > 0) {
      return { success: false, error: `Missing required parameters: ${missingParams.join(', ')}` };
    }

    if (tool.validate && !tool.validate(params)) {
      return { success: false, error: 'Parameter validation failed' };
    }

    const startTime = Date.now();
    try {
      const result = await tool.execute(params, context);

      this.recordExecution({
        toolId,
        params,
        result,
        success: result.success,
        duration: Date.now() - startTime,
        timestamp: Date.now(),
      });

      return result;
    } catch (error: any) {
      const result: ToolResult = { success: false, error: error.message || 'Unknown error' };

      this.recordExecution({
        toolId,
        params,
        result,
        success: false,
        duration: Date.now() - startTime,
        timestamp: Date.now(),
        error: error.message,
      });

      return result;
    }
  }

  private recordExecution(record: ToolExecutionRecord): void {
    this.executionHistory.push(record);
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory.shift();
    }
  }

  getHistory(limit: number = 100): ToolExecutionRecord[] {
    return this.executionHistory.slice(-limit);
  }

  getStats(): ToolStats {
    const total = this.executionHistory.length;
    const successful = this.executionHistory.filter(r => r.success).length;
    const byTool: Record<string, { count: number; successRate: number; avgDuration: number }> = {};

    for (const record of this.executionHistory) {
      if (!byTool[record.toolId]) {
        byTool[record.toolId] = { count: 0, successRate: 0, avgDuration: 0 };
      }
      byTool[record.toolId].count++;
    }

    for (const toolId in byTool) {
      const toolRecords = this.executionHistory.filter(r => r.toolId === toolId);
      byTool[toolId].successRate = toolRecords.filter(r => r.success).length / toolRecords.length;
      byTool[toolId].avgDuration =
        toolRecords.reduce((sum, r) => sum + r.duration, 0) / toolRecords.length;
    }

    return {
      totalExecutions: total,
      successRate: total > 0 ? successful / total : 0,
      toolsRegistered: this.tools.size,
      byTool,
    };
  }

  enable(toolId: string): boolean {
    const tool = this.tools.get(toolId);
    if (!tool) return false;
    tool.enabled = true;
    return true;
  }

  disable(toolId: string): boolean {
    const tool = this.tools.get(toolId);
    if (!tool) return false;
    tool.enabled = false;
    return true;
  }

  search(query: string): Tool[] {
    const lowerQuery = query.toLowerCase();
    return this.getAll().filter(
      tool =>
        tool.name.toLowerCase().includes(lowerQuery) ||
        tool.description.toLowerCase().includes(lowerQuery) ||
        tool.id.toLowerCase().includes(lowerQuery)
    );
  }

  getToolSchema(toolId: string): object | null {
    const tool = this.tools.get(toolId);
    if (!tool) return null;

    return {
      name: tool.id,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: tool.parameters.reduce(
          (acc, p) => {
            acc[p.name] = {
              type: p.type,
              description: p.description,
              ...(p.enum && { enum: p.enum }),
              ...(p.default !== undefined && { default: p.default }),
            };
            return acc;
          },
          {} as Record<string, any>
        ),
        required: tool.parameters.filter(p => p.required).map(p => p.name),
      },
    };
  }

  getAllSchemas(): object[] {
    return this.getAll()
      .map(t => this.getToolSchema(t.id)!)
      .filter(Boolean);
  }
}

interface ToolExecutionRecord {
  toolId: string;
  params: Record<string, any>;
  result: ToolResult;
  success: boolean;
  duration: number;
  timestamp: number;
  error?: string;
}

interface ToolStats {
  totalExecutions: number;
  successRate: number;
  toolsRegistered: number;
  byTool: Record<string, { count: number; successRate: number; avgDuration: number }>;
}

export const toolRegistry = new ToolRegistryImpl();

/**
 * Returns a string describing enabled tools for inclusion in the LLM system prompt,
 * so the model can use well-defined tools instead of free-form actions (138).
 */
export function getToolsDescriptionForPrompt(): string {
  const tools = toolRegistry.getEnabled();
  if (tools.length === 0) return '';
  const lines = [
    '',
    '## Well-defined tools (prefer these; they map to the actions above)',
    ...tools.map((t) => {
      const params = t.parameters.map((p) => `${p.name}${p.required ? '*' : ''}: ${p.description}`).join(', ');
      return `- ${t.id}: ${t.description}. Params: ${params}`;
    }),
  ];
  return lines.join('\n');
}
