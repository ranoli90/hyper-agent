
export interface Tool {
    name: string;
    description: string;
    usage: string; // Dynamic usage example for LLM
    execute: (args: string) => Promise<string>;
}

export class ToolRegistry {
    private tools: Map<string, Tool> = new Map();

    constructor() {
        this.registerTool(new CalculatorTool());
        this.registerTool(new TimeTool());
        this.registerTool(new EmailTool());
        this.registerTool(new CalendarTool());
        this.registerTool(new FileTool());
    }

    registerTool(tool: Tool) {
        this.tools.set(tool.name.toLowerCase(), tool);
    }

    getTools(): Tool[] {
        return Array.from(this.tools.values());
    }

    getTool(name: string): Tool | undefined {
        return this.tools.get(name.toLowerCase());
    }

    getToolDescriptions(): string {
        return Array.from(this.tools.values())
            .map(t => `- ${t.name}: ${t.description} (Usage: ${t.usage})`)
            .join('\n');
    }

    async executeTool(name: string, args: string): Promise<string> {
        const tool = this.getTool(name);
        if (!tool) {
            throw new Error(`Tool '${name}' not found.`);
        }
        try {
            const result = await tool.execute(args);
            return result;
        } catch (error: any) {
            const errorMsg = `[Tool:${name}] Error: ${error.message || String(error)}`;
            console.error(errorMsg, error);
            return errorMsg;
        }
    }
}

class CalculatorTool implements Tool {
    name = 'Calculator';
    description = 'Performs basic arithmetic operations (+, -, *, /, ^, %, sqrt). Use this for ANY math calculation.';
    usage = 'Calculator: (150 * 0.15) + 12';

    async execute(args: string): Promise<string> {
        // Sanitize input: only allow numbers, operators, parentheses, and Math functions
        const sanitized = args.replace(/[^0-9+\-*/^%().\sMathsqrt]/g, '');

        try {
            // Use Function constructor for safer evaluation than eval(), but still constrained
            // We essentially want to evaluate a math expression.
            // A strictly safer way is a parser, but for this MVP, we'll use a restricted Function.
            // We will restrict to returning a number.
            const result = new Function(`"use strict"; return (${sanitized})`)();
            return String(result);
        } catch (e) {
            return `Invalid math expression: ${args}`;
        }
    }
}

class TimeTool implements Tool {
    name = 'Time';
    description = 'Returns the current local date and time.';
    usage = 'Time: current';

    async execute(_args: string): Promise<string> {
        const now = new Date();
        return now.toLocaleString(undefined, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            timeZoneName: 'short'
        });
    }
}

class EmailTool implements Tool {
    name = 'Email';
    description = 'Drafts or sends emails. Usage: Email: compose { to: "recips...", subject: "...", body: "..." }';
    usage = 'Email: compose { to: "ceo@company.com", subject: "Proposal", body: "Check this out." }';

    async execute(args: string): Promise<string> {
        try {
            // Simple heuristic to extract data from string/JSON-like args
            const toMatch = args.match(/to:\s*["']([^"']+)["']/);
            const subMatch = args.match(/subject:\s*["']([^"']+)["']/);
            const bodyMatch = args.match(/body:\s*["']([^"']+)["']/);

            const to = toMatch ? toMatch[1] : '';
            const subject = subMatch ? encodeURIComponent(subMatch[1]) : '';
            const body = bodyMatch ? encodeURIComponent(bodyMatch[1]) : '';

            const mailto = `mailto:${to}?subject=${subject}&body=${body}`;

            // Trigger browser to open mailto
            chrome.tabs.create({ url: mailto });

            return `Triggered mail client for: ${to}. Subject: ${subject || 'None'}`;
        } catch (e: any) {
            return `Email failed: ${e.message}`;
        }
    }
}

class CalendarTool implements Tool {
    name = 'Calendar';
    description = 'Schedules tasks or reminders. Integrated with HyperAgent Scheduler.';
    usage = 'Calendar: remind { title: "Meeting", inMinutes: 15, task: "Check latest stocks" }';

    async execute(args: string): Promise<string> {
        try {
            const { schedulerEngine } = await import('./scheduler-engine');

            const titleMatch = args.match(/title:\s*["']([^"']+)["']/);
            const minMatch = args.match(/inMinutes:\s*(\d+)/);
            const taskMatch = args.match(/task:\s*["']([^"']+)["']/);

            const title = titleMatch ? titleMatch[1] : 'Reminder';
            const minutes = minMatch ? parseInt(minMatch[1]) : 60;
            const command = taskMatch ? taskMatch[1] : 'Help';

            await schedulerEngine.addTask(title, command, minutes);

            return `Successfully scheduled reminder "${title}" in ${minutes} minutes. Execution: ${command}`;
        } catch (e: any) {
            return `Calendar failed: ${e.message}`;
        }
    }
}

class FileTool implements Tool {
    name = 'File';
    description = 'Manages persistent agent data storage. Usage: File: store { key: "...", value: "..." } or File: retrieve { key: "..." }';
    usage = 'File: store { key: "meeting_notes", value: "Summary of Q3 results..." }';

    async execute(args: string): Promise<string> {
        try {
            const isStore = args.toLowerCase().includes('store');
            const keyMatch = args.match(/key:\s*["']([^"']+)["']/);
            const valMatch = args.match(/value:\s*["']([^"']+)["']/);

            const key = keyMatch ? keyMatch[1] : 'unsorted';

            if (isStore) {
                const value = valMatch ? valMatch[1] : '';
                await chrome.storage.local.set({ [`file_${key}`]: value });
                return `Data stored under key: ${key}`;
            } else {
                const result = await chrome.storage.local.get(`file_${key}`);
                return result[`file_${key}`] || `No data found for key: ${key}`;
            }
        } catch (e: any) {
            return `File operation failed: ${e.message}`;
        }
    }
}

export const toolRegistry = new ToolRegistry();
