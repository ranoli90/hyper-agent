export interface CoordinatorMessage {
  id: string;
  type: CoordinatorMessageType;
  senderId: string;
  targetId?: string;
  payload: any;
  timestamp: number;
  ttl: number;
}

export enum CoordinatorMessageType {
  TASK_ASSIGN = 'task_assign',
  TASK_COMPLETE = 'task_complete',
  TASK_FAILED = 'task_failed',
  STATUS_REQUEST = 'status_request',
  STATUS_RESPONSE = 'status_response',
  SYNC_STATE = 'sync_state',
  HEARTBEAT = 'heartbeat',
  LOCK_ACQUIRE = 'lock_acquire',
  LOCK_RELEASE = 'lock_release',
  LOCK_GRANTED = 'lock_granted',
  LOCK_DENIED = 'lock_denied',
  DATA_BROADCAST = 'data_broadcast',
}

export interface TabWorker {
  id: string;
  tabId: number;
  status: WorkerStatus;
  lastHeartbeat: number;
  currentTask?: string;
  capabilities: string[];
  load: number;
}

export enum WorkerStatus {
  IDLE = 'idle',
  BUSY = 'busy',
  OFFLINE = 'offline',
  ERROR = 'error',
}

export interface DistributedLock {
  resource: string;
  holder: string;
  acquiredAt: number;
  expiresAt: number;
}

export interface CoordinationResult {
  success: boolean;
  data?: any;
  error?: string;
}

const STORAGE_KEY = 'hyperagent_coordination';
const HEARTBEAT_INTERVAL = 5000;
const HEARTBEAT_TIMEOUT = 15000;
const LOCK_DEFAULT_TTL = 30000;

export class DistributedCoordinator {
  private workers: Map<string, TabWorker> = new Map();
  private locks: Map<string, DistributedLock> = new Map();
  private messageQueue: CoordinatorMessage[] = [];
  private messageHandlers: Map<CoordinatorMessageType, ((msg: CoordinatorMessage) => void)[]> = new Map();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private selfId: string;
  private maxQueueSize = 1000;

  constructor() {
    this.selfId = `coord_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  async initialize(): Promise<void> {
    await this.loadState();
    this.startHeartbeat();
    this.setupMessageListener();
    console.log(`[DistributedCoordinator] Initialized as ${this.selfId}`);
  }

  shutdown(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  registerWorker(tabId: number, capabilities: string[] = []): TabWorker {
    const workerId = `worker_${tabId}_${Date.now()}`;
    const worker: TabWorker = {
      id: workerId,
      tabId,
      status: WorkerStatus.IDLE,
      lastHeartbeat: Date.now(),
      capabilities,
      load: 0,
    };
    this.workers.set(workerId, worker);
    return worker;
  }

  unregisterWorker(workerId: string): void {
    this.workers.delete(workerId);
    for (const [resource, lock] of this.locks) {
      if (lock.holder === workerId) {
        this.locks.delete(resource);
      }
    }
  }

  getWorkers(): TabWorker[] {
    return Array.from(this.workers.values());
  }

  getIdleWorkers(): TabWorker[] {
    return this.getWorkers().filter(w => w.status === WorkerStatus.IDLE);
  }

  findBestWorker(requiredCapabilities: string[] = []): TabWorker | null {
    const candidates = this.getWorkers()
      .filter(w => w.status === WorkerStatus.IDLE)
      .filter(w => requiredCapabilities.every(cap => w.capabilities.includes(cap)));

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => a.load - b.load);
    return candidates[0];
  }

  async assignTask(workerId: string, taskId: string, payload: any): Promise<CoordinationResult> {
    const worker = this.workers.get(workerId);
    if (!worker) return { success: false, error: 'Worker not found' };
    if (worker.status !== WorkerStatus.IDLE) return { success: false, error: 'Worker is busy' };

    worker.status = WorkerStatus.BUSY;
    worker.currentTask = taskId;
    worker.load++;

    const message: CoordinatorMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type: CoordinatorMessageType.TASK_ASSIGN,
      senderId: this.selfId,
      targetId: workerId,
      payload: { taskId, ...payload },
      timestamp: Date.now(),
      ttl: 60000,
    };

    await this.sendMessage(message);
    return { success: true, data: { workerId, taskId } };
  }

  completeTask(workerId: string, taskId: string, result: any): void {
    const worker = this.workers.get(workerId);
    if (!worker) return;

    worker.status = WorkerStatus.IDLE;
    worker.currentTask = undefined;

    this.sendMessage({
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type: CoordinatorMessageType.TASK_COMPLETE,
      senderId: workerId,
      payload: { taskId, result },
      timestamp: Date.now(),
      ttl: 30000,
    });
  }

  acquireLock(resource: string, holder: string, ttl: number = LOCK_DEFAULT_TTL): boolean {
    this.cleanupExpiredLocks();

    const existing = this.locks.get(resource);
    if (existing && existing.expiresAt > Date.now()) {
      return false;
    }

    this.locks.set(resource, {
      resource,
      holder,
      acquiredAt: Date.now(),
      expiresAt: Date.now() + ttl,
    });

    return true;
  }

  releaseLock(resource: string, holder: string): boolean {
    const lock = this.locks.get(resource);
    if (!lock || lock.holder !== holder) return false;
    this.locks.delete(resource);
    return true;
  }

  isLocked(resource: string): boolean {
    this.cleanupExpiredLocks();
    const lock = this.locks.get(resource);
    return !!lock && lock.expiresAt > Date.now();
  }

  getLockHolder(resource: string): string | null {
    const lock = this.locks.get(resource);
    if (!lock || lock.expiresAt <= Date.now()) return null;
    return lock.holder;
  }

  broadcast(payload: any): void {
    this.sendMessage({
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type: CoordinatorMessageType.DATA_BROADCAST,
      senderId: this.selfId,
      payload,
      timestamp: Date.now(),
      ttl: 10000,
    });
  }

  onMessage(type: CoordinatorMessageType, handler: (msg: CoordinatorMessage) => void): () => void {
    const handlers = this.messageHandlers.get(type) || [];
    handlers.push(handler);
    this.messageHandlers.set(type, handlers);
    return () => {
      const current = this.messageHandlers.get(type) || [];
      this.messageHandlers.set(type, current.filter(h => h !== handler));
    };
  }

  getStats(): {
    totalWorkers: number;
    idleWorkers: number;
    busyWorkers: number;
    activeLocks: number;
    queuedMessages: number;
  } {
    this.cleanupOfflineWorkers();
    return {
      totalWorkers: this.workers.size,
      idleWorkers: this.getIdleWorkers().length,
      busyWorkers: this.getWorkers().filter(w => w.status === WorkerStatus.BUSY).length,
      activeLocks: this.locks.size,
      queuedMessages: this.messageQueue.length,
    };
  }

  private async sendMessage(message: CoordinatorMessage): Promise<void> {
    this.messageQueue.push(message);
    if (this.messageQueue.length > this.maxQueueSize) {
      this.messageQueue.shift();
    }

    const handlers = this.messageHandlers.get(message.type) || [];
    for (const handler of handlers) {
      try {
        handler(message);
      } catch (err) {
        console.error('[DistributedCoordinator] Handler error:', err);
      }
    }

    await this.persistState();
  }

  private setupMessageListener(): void {
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (message?.type?.startsWith('coord_')) {
          this.handleIncomingMessage(message);
          sendResponse({ ok: true });
        }
        return false;
      });
    }
  }

  private handleIncomingMessage(message: any): void {
    if (message.ttl && message.timestamp + message.ttl < Date.now()) return;

    const handlers = this.messageHandlers.get(message.type) || [];
    for (const handler of handlers) {
      try {
        handler(message);
      } catch (err) {
        console.error('[DistributedCoordinator] Handler error:', err);
      }
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      for (const worker of this.workers.values()) {
        if (worker.status !== WorkerStatus.OFFLINE) {
          worker.lastHeartbeat = Date.now();
        }
      }
      this.cleanupOfflineWorkers();
    }, HEARTBEAT_INTERVAL);
  }

  private cleanupOfflineWorkers(): void {
    const now = Date.now();
    for (const [id, worker] of this.workers) {
      if (now - worker.lastHeartbeat > HEARTBEAT_TIMEOUT && worker.status !== WorkerStatus.OFFLINE) {
        worker.status = WorkerStatus.OFFLINE;
        if (worker.currentTask) {
          worker.currentTask = undefined;
        }
      }
    }
  }

  private cleanupExpiredLocks(): void {
    const now = Date.now();
    for (const [resource, lock] of this.locks) {
      if (lock.expiresAt <= now) {
        this.locks.delete(resource);
      }
    }
  }

  private async persistState(): Promise<void> {
    try {
      if (!chrome?.storage?.local) return;
      const state = {
        workers: Array.from(this.workers.entries()),
        locks: Array.from(this.locks.entries()),
        lastUpdate: Date.now(),
      };
      await chrome.storage.local.set({ [STORAGE_KEY]: state });
    } catch {
      // Storage not available
    }
  }

  private async loadState(): Promise<void> {
    try {
      if (!chrome?.storage?.local) return;
      const data = await chrome.storage.local.get(STORAGE_KEY);
      const state = data[STORAGE_KEY];
      if (!state) return;

      if (Array.isArray(state.workers)) {
        for (const [id, worker] of state.workers) {
          this.workers.set(id, worker);
        }
      }
      if (Array.isArray(state.locks)) {
        for (const [resource, lock] of state.locks) {
          if (lock.expiresAt > Date.now()) {
            this.locks.set(resource, lock);
          }
        }
      }
    } catch {
      // Fresh start
    }
  }
}

export const distributedCoordinator = new DistributedCoordinator();
