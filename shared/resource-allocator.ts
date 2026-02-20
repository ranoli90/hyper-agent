export interface ResourcePool {
  id: string;
  type: ResourceType;
  total: number;
  available: number;
  allocated: Map<string, number>;
  utilizationHistory: { timestamp: number; utilization: number }[];
}

export enum ResourceType {
  CPU = 'cpu',
  MEMORY = 'memory',
  NETWORK = 'network',
  TABS = 'tabs',
  STORAGE = 'storage',
}

export interface ResourceRequest {
  requesterId: string;
  resources: { type: ResourceType; amount: number }[];
  priority: number;
  timeout: number;
}

export interface AllocationResult {
  success: boolean;
  allocations: { type: ResourceType; amount: number; poolId: string }[];
  error?: string;
  waitTime?: number;
}

export interface ResourceMetrics {
  poolId: string;
  type: ResourceType;
  total: number;
  available: number;
  utilization: number;
  peakUtilization: number;
  averageUtilization: number;
  allocationCount: number;
}

const MAX_HISTORY_ENTRIES = 500;

export class IntelligentResourceAllocator {
  private pools: Map<string, ResourcePool> = new Map();
  private pendingRequests: ResourceRequest[] = [];
  private maxTabCount = 10;
  private maxMemoryMB = 512;

  constructor() {
    this.initializeDefaultPools();
  }

  private initializeDefaultPools(): void {
    this.createPool('cpu', ResourceType.CPU, 100);
    this.createPool('memory', ResourceType.MEMORY, this.maxMemoryMB);
    this.createPool('network', ResourceType.NETWORK, 50);
    this.createPool('tabs', ResourceType.TABS, this.maxTabCount);
    this.createPool('storage', ResourceType.STORAGE, 100);
  }

  createPool(id: string, type: ResourceType, total: number): ResourcePool {
    const pool: ResourcePool = {
      id,
      type,
      total,
      available: total,
      allocated: new Map(),
      utilizationHistory: [],
    };
    this.pools.set(id, pool);
    return pool;
  }

  allocate(request: ResourceRequest): AllocationResult {
    const allocations: { type: ResourceType; amount: number; poolId: string }[] = [];

    for (const req of request.resources) {
      const pool = this.findPool(req.type);
      if (!pool) {
        this.rollbackAllocations(allocations, request.requesterId);
        return { success: false, error: `No pool for resource type: ${req.type}`, allocations: [] };
      }

      if (pool.available < req.amount) {
        this.rollbackAllocations(allocations, request.requesterId);
        return {
          success: false,
          error: `Insufficient ${req.type}: requested ${req.amount}, available ${pool.available}`,
          allocations: [],
          waitTime: this.estimateWaitTime(pool, req.amount),
        };
      }

      pool.available -= req.amount;
      const existing = pool.allocated.get(request.requesterId) || 0;
      pool.allocated.set(request.requesterId, existing + req.amount);
      this.recordUtilization(pool);

      allocations.push({ type: req.type, amount: req.amount, poolId: pool.id });
    }

    return { success: true, allocations };
  }

  release(requesterId: string, resources?: { type: ResourceType; amount: number }[]): void {
    if (resources) {
      for (const res of resources) {
        const pool = this.findPool(res.type);
        if (!pool) continue;

        const allocated = pool.allocated.get(requesterId) || 0;
        const toRelease = Math.min(res.amount, allocated);
        pool.available += toRelease;
        const remaining = allocated - toRelease;

        if (remaining <= 0) {
          pool.allocated.delete(requesterId);
        } else {
          pool.allocated.set(requesterId, remaining);
        }
        this.recordUtilization(pool);
      }
    } else {
      for (const pool of this.pools.values()) {
        const allocated = pool.allocated.get(requesterId) || 0;
        if (allocated > 0) {
          pool.available += allocated;
          pool.allocated.delete(requesterId);
          this.recordUtilization(pool);
        }
      }
    }

    this.processPendingRequests();
  }

  getMetrics(poolId?: string): ResourceMetrics[] {
    const pools = poolId ? [this.pools.get(poolId)].filter(Boolean) : Array.from(this.pools.values());
    return (pools as ResourcePool[]).map(pool => {
      const utilization = pool.total > 0 ? (pool.total - pool.available) / pool.total : 0;
      const history = pool.utilizationHistory;
      const peak = history.length > 0 ? Math.max(...history.map(h => h.utilization)) : utilization;
      const avg = history.length > 0
        ? history.reduce((s, h) => s + h.utilization, 0) / history.length
        : utilization;

      return {
        poolId: pool.id,
        type: pool.type,
        total: pool.total,
        available: pool.available,
        utilization,
        peakUtilization: peak,
        averageUtilization: avg,
        allocationCount: pool.allocated.size,
      };
    });
  }

  getPoolUtilization(type: ResourceType): number {
    const pool = this.findPool(type);
    if (!pool || pool.total === 0) return 0;
    return (pool.total - pool.available) / pool.total;
  }

  isResourceAvailable(type: ResourceType, amount: number): boolean {
    const pool = this.findPool(type);
    return pool ? pool.available >= amount : false;
  }

  optimizeAllocations(): { freed: number; optimizations: string[] } {
    let freed = 0;
    const optimizations: string[] = [];

    for (const pool of this.pools.values()) {
      const underutilized: { requesterId: string; amount: number }[] = [];

      for (const [requesterId, amount] of pool.allocated) {
        if (amount > 0 && pool.available < pool.total * 0.1) {
          const reduction = Math.floor(amount * 0.2);
          if (reduction > 0) {
            underutilized.push({ requesterId, amount: reduction });
          }
        }
      }

      for (const { requesterId, amount } of underutilized) {
        const currentAlloc = pool.allocated.get(requesterId) || 0;
        pool.allocated.set(requesterId, currentAlloc - amount);
        pool.available += amount;
        freed += amount;
        optimizations.push(`Reclaimed ${amount} ${pool.type} from ${requesterId}`);
      }
    }

    return { freed, optimizations };
  }

  scalePool(poolId: string, newTotal: number): boolean {
    const pool = this.pools.get(poolId);
    if (!pool) return false;

    const used = pool.total - pool.available;
    if (newTotal < used) return false;

    pool.available += newTotal - pool.total;
    pool.total = newTotal;
    this.recordUtilization(pool);
    return true;
  }

  private findPool(type: ResourceType): ResourcePool | undefined {
    for (const pool of this.pools.values()) {
      if (pool.type === type) return pool;
    }
    return undefined;
  }

  private rollbackAllocations(
    allocations: { type: ResourceType; amount: number; poolId: string }[],
    requesterId: string
  ): void {
    for (const alloc of allocations) {
      const pool = this.pools.get(alloc.poolId);
      if (!pool) continue;

      pool.available += alloc.amount;
      const existing = pool.allocated.get(requesterId) || 0;
      const remaining = existing - alloc.amount;
      if (remaining <= 0) {
        pool.allocated.delete(requesterId);
      } else {
        pool.allocated.set(requesterId, remaining);
      }
    }
  }

  private recordUtilization(pool: ResourcePool): void {
    const utilization = pool.total > 0 ? (pool.total - pool.available) / pool.total : 0;
    pool.utilizationHistory.push({ timestamp: Date.now(), utilization });
    if (pool.utilizationHistory.length > MAX_HISTORY_ENTRIES) {
      pool.utilizationHistory.shift();
    }
  }

  private estimateWaitTime(pool: ResourcePool, needed: number): number {
    const deficit = needed - pool.available;
    if (deficit <= 0) return 0;
    return Math.min(deficit * 1000, 30000);
  }

  private processPendingRequests(): void {
    const resolved: number[] = [];
    for (let i = 0; i < this.pendingRequests.length; i++) {
      const result = this.allocate(this.pendingRequests[i]);
      if (result.success) {
        resolved.push(i);
      }
    }
    for (let i = resolved.length - 1; i >= 0; i--) {
      this.pendingRequests.splice(resolved[i], 1);
    }
  }
}

export const resourceAllocator = new IntelligentResourceAllocator();
