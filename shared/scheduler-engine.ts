export interface ScheduledTask {
  id: string;
  name: string;
  command: string;
  schedule: {
    type: 'once' | 'interval' | 'daily' | 'weekly';
    time?: number;
    intervalMinutes?: number;
    dayOfWeek?: number;
  };
  enabled: boolean;
  lastRun?: number;
  nextRun?: number;
  createdAt: number;
}

export interface TaskExecutionResult {
  taskId: string;
  executedAt: number;
  success: boolean;
  error?: string;
}

class SchedulerEngineImpl {
  private tasks: Map<string, ScheduledTask> = new Map();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.loadTasks();
    this.setupAlarmListener();
    this.initialized = true;
    console.log('[Scheduler] Initialized with', this.tasks.size, 'tasks');
  }

  private async loadTasks(): Promise<void> {
    try {
      const data = await chrome.storage.local.get('hyperagent_scheduled_tasks');
      const savedTasks = data.hyperagent_scheduled_tasks || [];

      for (const task of savedTasks) {
        this.tasks.set(task.id, task);
        if (task.enabled) {
          this.scheduleAlarm(task);
        }
      }
    } catch (err) {
      console.error('[Scheduler] Failed to load tasks:', err);
    }
  }

  private async saveTasks(): Promise<void> {
    try {
      const taskArray = Array.from(this.tasks.values());
      await chrome.storage.local.set({ hyperagent_scheduled_tasks: taskArray });
    } catch (err) {
      console.error('[Scheduler] Failed to save tasks:', err);
    }
  }

  private setupAlarmListener(): void {
    chrome.alarms.onAlarm.addListener(async alarm => {
      await this.handleAlarm(alarm);
    });
  }

  async handleAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
    const taskId = alarm.name.replace('task_', '');
    const task = this.tasks.get(taskId);

    if (!task || !task.enabled) {
      return;
    }

    console.log('[Scheduler] Executing task:', task.name);

    try {
      await chrome.runtime.sendMessage({
        type: 'executeCommand',
        command: task.command,
        scheduled: true,
      });

      task.lastRun = Date.now();

      if (task.schedule.type === 'once') {
        task.enabled = false;
        chrome.alarms.clear(alarm.name);
      } else {
        task.nextRun = this.calculateNextRun(task);
      }

      await this.saveTasks();
    } catch (err: any) {
      console.error('[Scheduler] Task execution failed:', err);
    }
  }

  private scheduleAlarm(task: ScheduledTask): void {
    const alarmName = `task_${task.id}`;

    switch (task.schedule.type) {
      case 'once':
        if (task.schedule.time && task.schedule.time > Date.now()) {
          chrome.alarms.create(alarmName, { when: task.schedule.time });
        }
        break;

      case 'interval':
        if (task.schedule.intervalMinutes) {
          chrome.alarms.create(alarmName, {
            delayInMinutes: 1,
            periodInMinutes: task.schedule.intervalMinutes,
          });
        }
        break;

      case 'daily':
        const dailyTime = this.getNextDailyTime(task.schedule.time);
        chrome.alarms.create(alarmName, {
          when: dailyTime,
          periodInMinutes: 24 * 60,
        });
        break;

      case 'weekly':
        const weeklyTime = this.getNextWeeklyTime(task.schedule.time, task.schedule.dayOfWeek);
        chrome.alarms.create(alarmName, {
          when: weeklyTime,
          periodInMinutes: 7 * 24 * 60,
        });
        break;
    }

    task.nextRun = this.calculateNextRun(task);
  }

  private getNextDailyTime(baseTime?: number): number {
    if (!baseTime) return Date.now() + 24 * 60 * 60 * 1000;

    const now = new Date();
    const target = new Date(baseTime);
    target.setFullYear(now.getFullYear(), now.getMonth(), now.getDate());

    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }

    return target.getTime();
  }

  private getNextWeeklyTime(baseTime?: number, dayOfWeek?: number): number {
    const now = new Date();
    const target = baseTime ? new Date(baseTime) : new Date();

    if (dayOfWeek !== undefined) {
      const currentDay = now.getDay();
      const daysUntil = (dayOfWeek - currentDay + 7) % 7;
      target.setDate(now.getDate() + (daysUntil || 7));
    }

    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 7);
    }

    return target.getTime();
  }

  private calculateNextRun(task: ScheduledTask): number {
    switch (task.schedule.type) {
      case 'once':
        return task.schedule.time || 0;
      case 'interval':
        return Date.now() + (task.schedule.intervalMinutes || 60) * 60 * 1000;
      case 'daily':
        return this.getNextDailyTime(task.schedule.time);
      case 'weekly':
        return this.getNextWeeklyTime(task.schedule.time, task.schedule.dayOfWeek);
      default:
        return 0;
    }
  }

  schedule(task: Omit<ScheduledTask, 'id' | 'createdAt' | 'nextRun'>): ScheduledTask {
    const newTask: ScheduledTask = {
      ...task,
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      createdAt: Date.now(),
      nextRun: undefined,
    };

    this.tasks.set(newTask.id, newTask);

    if (newTask.enabled) {
      this.scheduleAlarm(newTask);
    }

    this.saveTasks();
    return newTask;
  }

  updateTask(taskId: string, updates: Partial<ScheduledTask>): ScheduledTask | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    Object.assign(task, updates);

    chrome.alarms.clear(`task_${taskId}`);

    if (task.enabled) {
      this.scheduleAlarm(task);
    }

    this.saveTasks();
    return task;
  }

  deleteTask(taskId: string): boolean {
    const deleted = this.tasks.delete(taskId);
    if (deleted) {
      chrome.alarms.clear(`task_${taskId}`);
      this.saveTasks();
    }
    return deleted;
  }

  getTask(taskId: string): ScheduledTask | undefined {
    return this.tasks.get(taskId);
  }

  getAllTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values());
  }

  getEnabledTasks(): ScheduledTask[] {
    return this.getAllTasks().filter(t => t.enabled);
  }

  enableTask(taskId: string, enabled: boolean): ScheduledTask | null {
    return this.updateTask(taskId, { enabled });
  }
}

export const schedulerEngine = new SchedulerEngineImpl();
