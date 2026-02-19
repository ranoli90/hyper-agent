/**
 * SchedulerEngine
 * Manages recurring background tasks for HyperAgent.
 * Uses chrome.alarms for reliability in service workers.
 */

export interface ScheduledTask {
    id: string;
    name: string;
    command: string;
    intervalMinutes: number;
    lastRun?: number;
    nextRun: number;
    enabled: boolean;
}

export class SchedulerEngine {
    private static STORAGE_KEY = 'hyperagent_scheduled_tasks';
    private tasks: ScheduledTask[] = [];
    private initialized = false;

    constructor() { }

    async initialize(): Promise<void> {
        if (this.initialized) return;
        const result = await chrome.storage.local.get(SchedulerEngine.STORAGE_KEY);
        this.tasks = result[SchedulerEngine.STORAGE_KEY] || [];
        this.initialized = true;
        console.log(`[Scheduler] Initialized with ${this.tasks.length} tasks.`);

        // Sync with chrome.alarms
        await this.syncAlarms();
    }

    async addTask(name: string, command: string, intervalMinutes: number): Promise<string> {
        await this.initialize();

        // Hardening: Validate inputs
        if (!name || !command) throw new Error("Name and command are required.");
        if (intervalMinutes < 1) throw new Error("Interval must be at least 1 minute.");

        const id = `task_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const newTask: ScheduledTask = {
            id,
            name,
            command,
            intervalMinutes,
            nextRun: Date.now() + (intervalMinutes * 60 * 1000),
            enabled: true
        };

        this.tasks.push(newTask);
        await this.save();
        await this.syncAlarms();
        return id;
    }

    async removeTask(id: string): Promise<void> {
        await this.initialize();
        this.tasks = this.tasks.filter(t => t.id !== id);
        await this.save();
        await chrome.alarms.clear(id);
    }

    async getTasks(): Promise<ScheduledTask[]> {
        await this.initialize();
        return this.tasks;
    }

    async toggleTask(id: string, enabled: boolean): Promise<void> {
        await this.initialize();
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            task.enabled = enabled;
            await this.save();
            await this.syncAlarms();
        }
    }

    private async save(): Promise<void> {
        await chrome.storage.local.set({ [SchedulerEngine.STORAGE_KEY]: this.tasks });
    }

    private async syncAlarms(): Promise<void> {
        // Clear all related alarms first (or handle incrementally)
        const existingAlarms = await chrome.alarms.getAll();
        for (const alarm of existingAlarms) {
            if (alarm.name.startsWith('task_')) {
                await chrome.alarms.clear(alarm.name);
            }
        }

        // Re-create alarms for enabled tasks
        for (const task of this.tasks) {
            if (task.enabled) {
                chrome.alarms.create(task.id, {
                    periodInMinutes: task.intervalMinutes,
                    delayInMinutes: task.intervalMinutes // Start after first interval
                });
            }
        }
    }

    /**
     * Called by background script when an alarm fires.
     */
    async handleAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
        if (!alarm.name.startsWith('task_')) return;

        await this.initialize();
        const task = this.tasks.find(t => t.id === alarm.name);
        if (!task || !task.enabled) return;

        console.log(`[Scheduler] Triggering task: ${task.name} (${task.command})`);

        // Update task metadata
        task.lastRun = Date.now();
        task.nextRun = Date.now() + (task.intervalMinutes * 60 * 1000);
        await this.save();

        // Trigger execution via background channel
        // In background.ts, we should listen for this or just call runAgentLoop
        chrome.runtime.sendMessage({
            type: 'executeCommand',
            command: task.command,
            isBackground: true
        }).catch(() => {
            // If side panel is closed, we need to handle this in background.ts directly
            // We'll add a direct execution path in background.ts
        });
    }
}

export const schedulerEngine = new SchedulerEngine();
