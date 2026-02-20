import type { Action, ActionResult } from './types';

export interface ParallelTask {
  id: string;
  name: string;
  actions: Action[];
  priority: number;
  dependencies: string[];
  timeout: number;
  retryCount: number;
  maxRetries: number;
  status: TaskStatus;
  result?: TaskResult;
  startTime?: number;
  endTime?: number;
}

export enum TaskStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  RETRYING = 'retrying',
}

export interface TaskResult {
  taskId: string;
  success: boolean;
  results: ActionResult[];
  duration: number;
  error?: string;
  retryCount: number;
}

export interface ExecutorConfig {
  maxConcurrency: number;
  defaultTimeout: number;
  maxRetries: number;
  retryDelay: number;
  onTaskStart?: (task: ParallelTask) => void;
  onTaskComplete?: (task: ParallelTask, result: TaskResult) => void;
  onTaskError?: (task: ParallelTask, error: Error) => void;
}

type ActionExecutor = (action: Action) => Promise<ActionResult>;

export class ParallelTestExecutor {
  private config: ExecutorConfig;
  private tasks: Map<string, ParallelTask> = new Map();
  private runningTasks: Set<string> = new Set();
  private taskQueue: string[] = [];
  private executor: ActionExecutor | null = null;
  private aborted = false;

  constructor(config?: Partial<ExecutorConfig>) {
    this.config = {
      maxConcurrency: config?.maxConcurrency ?? 4,
      defaultTimeout: config?.defaultTimeout ?? 30000,
      maxRetries: config?.maxRetries ?? 2,
      retryDelay: config?.retryDelay ?? 1000,
      onTaskStart: config?.onTaskStart,
      onTaskComplete: config?.onTaskComplete,
      onTaskError: config?.onTaskError,
    };
  }

  setExecutor(executor: ActionExecutor): void {
    this.executor = executor;
  }

  addTask(task: Omit<ParallelTask, 'status' | 'retryCount'>): ParallelTask {
    const fullTask: ParallelTask = {
      ...task,
      status: TaskStatus.PENDING,
      retryCount: 0,
      maxRetries: task.maxRetries ?? this.config.maxRetries,
      timeout: task.timeout ?? this.config.defaultTimeout,
    };
    this.tasks.set(task.id, fullTask);
    return fullTask;
  }

  removeTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    if (task.status === TaskStatus.RUNNING) return false;
    this.tasks.delete(taskId);
    this.taskQueue = this.taskQueue.filter(id => id !== taskId);
    return true;
  }

  async executeAll(): Promise<Map<string, TaskResult>> {
    this.aborted = false;
    const results = new Map<string, TaskResult>();

    const sortedTasks = this.topologicalSort();
    this.taskQueue = sortedTasks.map(t => t.id);

    for (const task of sortedTasks) {
      task.status = TaskStatus.QUEUED;
    }

    while (this.taskQueue.length > 0 || this.runningTasks.size > 0) {
      if (this.aborted) break;

      while (
        this.runningTasks.size < this.config.maxConcurrency &&
        this.taskQueue.length > 0
      ) {
        const nextId = this.findNextReady();
        if (!nextId) break;

        this.taskQueue = this.taskQueue.filter(id => id !== nextId);
        this.runTask(nextId, results);
      }

      if (this.runningTasks.size > 0) {
        await this.waitForAnyComplete();
      }
    }

    return results;
  }

  async executeBatch(taskIds: string[]): Promise<Map<string, TaskResult>> {
    this.aborted = false;
    const results = new Map<string, TaskResult>();
    this.taskQueue = [...taskIds];

    for (const id of taskIds) {
      const task = this.tasks.get(id);
      if (task) task.status = TaskStatus.QUEUED;
    }

    while (this.taskQueue.length > 0 || this.runningTasks.size > 0) {
      if (this.aborted) break;

      while (
        this.runningTasks.size < this.config.maxConcurrency &&
        this.taskQueue.length > 0
      ) {
        const nextId = this.taskQueue.shift();
        if (!nextId) break;
        this.runTask(nextId, results);
      }

      if (this.runningTasks.size > 0) {
        await this.waitForAnyComplete();
      }
    }

    return results;
  }

  abort(): void {
    this.aborted = true;
    for (const taskId of this.runningTasks) {
      const task = this.tasks.get(taskId);
      if (task) task.status = TaskStatus.CANCELLED;
    }
    this.runningTasks.clear();
    this.taskQueue = [];
  }

  getTask(taskId: string): ParallelTask | undefined {
    return this.tasks.get(taskId);
  }

  getAllTasks(): ParallelTask[] {
    return Array.from(this.tasks.values());
  }

  getRunningCount(): number {
    return this.runningTasks.size;
  }

  getQueuedCount(): number {
    return this.taskQueue.length;
  }

  getStats(): {
    total: number;
    pending: number;
    queued: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
  } {
    const stats = { total: 0, pending: 0, queued: 0, running: 0, completed: 0, failed: 0, cancelled: 0 };
    for (const task of this.tasks.values()) {
      stats.total++;
      switch (task.status) {
        case TaskStatus.PENDING: stats.pending++; break;
        case TaskStatus.QUEUED: stats.queued++; break;
        case TaskStatus.RUNNING:
        case TaskStatus.RETRYING: stats.running++; break;
        case TaskStatus.COMPLETED: stats.completed++; break;
        case TaskStatus.FAILED: stats.failed++; break;
        case TaskStatus.CANCELLED: stats.cancelled++; break;
      }
    }
    return stats;
  }

  private async runTask(taskId: string, results: Map<string, TaskResult>): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task || !this.executor) return;

    task.status = TaskStatus.RUNNING;
    task.startTime = Date.now();
    this.runningTasks.add(taskId);
    this.config.onTaskStart?.(task);

    try {
      const actionResults: ActionResult[] = [];

      for (const action of task.actions) {
        if (this.aborted) break;

        const timeoutPromise = new Promise<ActionResult>((_, reject) =>
          setTimeout(() => reject(new Error(`Action timed out after ${task.timeout}ms`)), task.timeout)
        );

        const result = await Promise.race([
          this.executor(action),
          timeoutPromise,
        ]);

        actionResults.push(result);

        if (!result.success) break;
      }

      const allSuccess = actionResults.every(r => r.success);
      task.endTime = Date.now();

      const taskResult: TaskResult = {
        taskId,
        success: allSuccess,
        results: actionResults,
        duration: task.endTime - (task.startTime || task.endTime),
        retryCount: task.retryCount,
      };

      if (!allSuccess && task.retryCount < task.maxRetries) {
        task.retryCount++;
        task.status = TaskStatus.RETRYING;
        this.runningTasks.delete(taskId);

        await new Promise(resolve =>
          setTimeout(resolve, this.config.retryDelay * Math.pow(2, task.retryCount - 1))
        );

        if (!this.aborted) {
          await this.runTask(taskId, results);
          return;
        }
      }

      task.status = allSuccess ? TaskStatus.COMPLETED : TaskStatus.FAILED;
      task.result = taskResult;
      results.set(taskId, taskResult);
      this.config.onTaskComplete?.(task, taskResult);
    } catch (error) {
      task.endTime = Date.now();
      const taskResult: TaskResult = {
        taskId,
        success: false,
        results: [],
        duration: task.endTime - (task.startTime || task.endTime),
        error: error instanceof Error ? error.message : String(error),
        retryCount: task.retryCount,
      };

      if (task.retryCount < task.maxRetries) {
        task.retryCount++;
        task.status = TaskStatus.RETRYING;
        this.runningTasks.delete(taskId);

        await new Promise(resolve =>
          setTimeout(resolve, this.config.retryDelay * Math.pow(2, task.retryCount - 1))
        );

        if (!this.aborted) {
          await this.runTask(taskId, results);
          return;
        }
      }

      task.status = TaskStatus.FAILED;
      task.result = taskResult;
      results.set(taskId, taskResult);
      this.config.onTaskError?.(task, error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.runningTasks.delete(taskId);
    }
  }

  private findNextReady(): string | null {
    for (const taskId of this.taskQueue) {
      const task = this.tasks.get(taskId);
      if (!task) continue;

      if (task.dependencies.length === 0) return taskId;

      const allDepsComplete = task.dependencies.every(depId => {
        const dep = this.tasks.get(depId);
        return dep && dep.status === TaskStatus.COMPLETED;
      });

      if (allDepsComplete) return taskId;
    }
    return null;
  }

  private topologicalSort(): ParallelTask[] {
    const sorted: ParallelTask[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (taskId: string) => {
      if (visited.has(taskId)) return;
      if (visiting.has(taskId)) return; // Cycle detected, skip

      visiting.add(taskId);
      const task = this.tasks.get(taskId);
      if (task) {
        for (const depId of task.dependencies) {
          visit(depId);
        }
        visiting.delete(taskId);
        visited.add(taskId);
        sorted.push(task);
      }
    };

    for (const taskId of this.tasks.keys()) {
      visit(taskId);
    }

    return sorted;
  }

  private waitForAnyComplete(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 50));
  }
}

export const parallelExecutor = new ParallelTestExecutor();
