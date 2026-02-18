import { ResourceAllocation } from './test-isolation';

export interface ResourcePool {
  total: ResourceAllocation;
  allocated: ResourceAllocation;
  available: ResourceAllocation;
  reserved: ResourceAllocation;
}

export interface ResourceRequest {
  id: string;
  requirements: ResourceAllocation;
  priority: RequestPriority;
  duration: number;
  flexible: boolean;
  maxWaitTime: number;
}

export enum RequestPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export interface ResourceAllocation {
  cpu: number;
  memory: number;
  network: number;
  storage: number;
}

export interface AllocationResult {
  requestId: string;
  allocated: ResourceAllocation;
  actualAllocation: ResourceAllocation;
  waitTime: number;
  success: boolean;
  reason?: string;
}

export interface ResourceUtilization {
  timestamp: number;
  cpu: number;
  memory: number;
  network: number;
  storage: number;
  activeAllocations: number;
  queuedRequests: number;
}

export interface OptimizationStrategy {
  type: OptimizationType;
  description: string;
  expectedBenefit: number;
  implementationCost: number;
  priority: StrategyPriority;
}

export enum OptimizationType {
  COMPACT_ALLOCATION = 'compact_allocation',
  PREDICTIVE_SCALING = 'predictive_scaling',
  DYNAMIC_REALLOCATION = 'dynamic_reallocation',
  PRIORITY_BASED_SCHEDULING = 'priority_based_scheduling',
  RESOURCE_SHARING = 'resource_sharing'
}

export enum StrategyPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ResourcePrediction {
  timestamp: number;
  predictedDemand: ResourceAllocation;
  confidence: number;
  factors: PredictionFactor[];
}

export interface PredictionFactor {
  type: FactorType;
  weight: number;
  description: string;
}

export enum FactorType {
  HISTORICAL_USAGE = 'historical_usage',
  TIME_OF_DAY = 'time_of_day',
  WORKLOAD_PATTERN = 'workload_pattern',
  SEASONAL_TREND = 'seasonal_trend'
}

export class IntelligentResourceAllocator {
  private resourcePool: ResourcePool;
  private allocationQueue: ResourceRequest[] = [];
  private activeAllocations: Map<string, AllocationResult> = new Map();
  private utilizationHistory: ResourceUtilization[] = [];
  private optimizationStrategies: OptimizationStrategy[] = [];
  private maxHistorySize = 1000;

  constructor(totalResources: ResourceAllocation) {
    this.resourcePool = {
      total: totalResources,
      allocated: { cpu: 0, memory: 0, network: 0, storage: 0 },
      available: { ...totalResources },
      reserved: { cpu: 0, memory: 0, network: 0, storage: 0 }
    };

    this.initializeOptimizationStrategies();
    this.startResourceMonitoring();
  }

  async allocateResources(request: ResourceRequest): Promise<AllocationResult> {
    const startTime = Date.now();
    
    // Check if resources can be allocated immediately
    if (this.canAllocateImmediately(request)) {
      const allocation = this.performAllocation(request);
      const result: AllocationResult = {
        requestId: request.id,
        allocated: request.requirements,
        actualAllocation: allocation,
        waitTime: 0,
        success: true
      };

      this.activeAllocations.set(request.id, result);
      this.updateResourcePool(allocation, true);
      
      return result;
    }

    // Add to queue if flexible or wait for resources
    if (request.flexible) {
      return await this.handleFlexibleAllocation(request, startTime);
    } else {
      return await this.handleQueuedAllocation(request, startTime);
    }
  }

  releaseResources(requestId: string): void {
    const allocation = this.activeAllocations.get(requestId);
    if (!allocation) return;

    this.updateResourcePool(allocation.actualAllocation, false);
    this.activeAllocations.delete(requestId);
    
    // Process queued requests
    this.processAllocationQueue();
  }

  getResourceUtilization(): ResourceUtilization {
    const utilization: ResourceUtilization = {
      timestamp: Date.now(),
      cpu: (this.resourcePool.allocated.cpu / this.resourcePool.total.cpu) * 100,
      memory: (this.resourcePool.allocated.memory / this.resourcePool.total.memory) * 100,
      network: (this.resourcePool.allocated.network / this.resourcePool.total.network) * 100,
      storage: (this.resourcePool.allocated.storage / this.resourcePool.total.storage) * 100,
      activeAllocations: this.activeAllocations.size,
      queuedRequests: this.allocationQueue.length
    };

    this.utilizationHistory.push(utilization);
    this.trimHistoryIfNeeded();

    return utilization;
  }

  predictResourceDemand(timeHorizon: number): ResourcePrediction[] {
    const predictions: ResourcePrediction[] = [];
    const currentTime = Date.now();

    for (let i = 1; i <= timeHorizon; i++) {
      const futureTime = currentTime + (i * 3600000); // hourly predictions
      const prediction = this.calculateResourcePrediction(futureTime);
      predictions.push(prediction);
    }

    return predictions;
  }

  optimizeResourceAllocation(): OptimizationStrategy[] {
    const utilization = this.getResourceUtilization();
    const applicableStrategies: OptimizationStrategy[] = [];

    for (const strategy of this.optimizationStrategies) {
      if (this.isStrategyApplicable(strategy, utilization)) {
        applicableStrategies.push(strategy);
      }
    }

    // Sort by priority and expected benefit
    applicableStrategies.sort((a, b) => {
      const priorityScore = this.getPriorityScore(b.priority) - this.getPriorityScore(a.priority);
      if (priorityScore !== 0) return priorityScore;
      return b.expectedBenefit - a.expectedBenefit;
    });

    return applicableStrategies;
  }

  applyOptimizationStrategy(strategy: OptimizationType): boolean {
    switch (strategy) {
      case OptimizationType.COMPACT_ALLOCATION:
        return this.applyCompactAllocation();
      case OptimizationType.PREDICTIVE_SCALING:
        return this.applyPredictiveScaling();
      case OptimizationType.DYNAMIC_REALLOCATION:
        return this.applyDynamicReallocation();
      case OptimizationType.PRIORITY_BASED_SCHEDULING:
        return this.applyPriorityBasedScheduling();
      case OptimizationType.RESOURCE_SHARING:
        return this.applyResourceSharing();
      default:
        return false;
    }
  }

  getResourcePoolStatus(): ResourcePool {
    return { ...this.resourcePool };
  }

  getAllocationQueueStatus(): ResourceRequest[] {
    return [...this.allocationQueue];
  }

  getActiveAllocations(): AllocationResult[] {
    return Array.from(this.activeAllocations.values());
  }

  private canAllocateImmediately(request: ResourceRequest): boolean {
    return (
      this.resourcePool.available.cpu >= request.requirements.cpu &&
      this.resourcePool.available.memory >= request.requirements.memory &&
      this.resourcePool.available.network >= request.requirements.network &&
      this.resourcePool.available.storage >= request.requirements.storage
    );
  }

  private performAllocation(request: ResourceRequest): ResourceAllocation {
    // Allocate with potential for over-allocation if flexible
    if (request.flexible) {
      return this.allocateWithFlexibility(request.requirements);
    }
    
    return { ...request.requirements };
  }

  private allocateWithFlexibility(requirements: ResourceAllocation): ResourceAllocation {
    const available = this.resourcePool.available;
    
    return {
      cpu: Math.min(requirements.cpu, available.cpu),
      memory: Math.min(requirements.memory, available.memory),
      network: Math.min(requirements.network, available.network),
      storage: Math.min(requirements.storage, available.storage)
    };
  }

  private async handleFlexibleAllocation(request: ResourceRequest, startTime: number): Promise<AllocationResult> {
    // Try to allocate with reduced requirements
    const flexibleRequirements = this.calculateFlexibleRequirements(request.requirements);
    const flexibleRequest: ResourceRequest = {
      ...request,
      requirements: flexibleRequirements
    };

    if (this.canAllocateImmediately(flexibleRequest)) {
      const allocation = this.performAllocation(flexibleRequest);
      const result: AllocationResult = {
        requestId: request.id,
        allocated: request.requirements,
        actualAllocation: allocation,
        waitTime: Date.now() - startTime,
        success: true,
        reason: 'Allocated with flexible requirements'
      };

      this.activeAllocations.set(request.id, result);
      this.updateResourcePool(allocation, true);
      
      return result;
    }

    // Add to queue with flexible priority
    this.allocationQueue.push(request);
    return await this.waitForAllocation(request, startTime);
  }

  private async handleQueuedAllocation(request: ResourceRequest, startTime: number): Promise<AllocationResult> {
    this.allocationQueue.push(request);
    return await this.waitForAllocation(request, startTime);
  }

  private async waitForAllocation(request: ResourceRequest, startTime: number): Promise<AllocationResult> {
    const maxWaitTime = request.maxWaitTime || 30000; // 30 seconds default
    const checkInterval = 1000; // Check every second

    while (Date.now() - startTime < maxWaitTime) {
      if (this.canAllocateImmediately(request)) {
        const allocation = this.performAllocation(request);
        const result: AllocationResult = {
          requestId: request.id,
          allocated: request.requirements,
          actualAllocation: allocation,
          waitTime: Date.now() - startTime,
          success: true
        };

        this.activeAllocations.set(request.id, result);
        this.updateResourcePool(allocation, true);
        
        // Remove from queue
        const queueIndex = this.allocationQueue.findIndex(r => r.id === request.id);
        if (queueIndex > -1) {
          this.allocationQueue.splice(queueIndex, 1);
        }
        
        return result;
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    // Timeout reached
    const queueIndex = this.allocationQueue.findIndex(r => r.id === request.id);
    if (queueIndex > -1) {
      this.allocationQueue.splice(queueIndex, 1);
    }

    return {
      requestId: request.id,
      allocated: request.requirements,
      actualAllocation: { cpu: 0, memory: 0, network: 0, storage: 0 },
      waitTime: Date.now() - startTime,
      success: false,
      reason: 'Allocation timeout - resources not available'
    };
  }

  private processAllocationQueue(): void {
    if (this.allocationQueue.length === 0) return;

    // Sort queue by priority and wait time
    this.allocationQueue.sort((a, b) => {
      const priorityScore = this.getPriorityScore(b.priority) - this.getPriorityScore(a.priority);
      if (priorityScore !== 0) return priorityScore;
      return 0; // FIFO for same priority
    });

    // Try to allocate queued requests
    for (let i = this.allocationQueue.length - 1; i >= 0; i--) {
      const request = this.allocationQueue[i];
      
      if (this.canAllocateImmediately(request)) {
        this.allocationQueue.splice(i, 1);
        // Allocation will be handled asynchronously
        setImmediate(() => {
          this.allocateResources(request);
        });
      }
    }
  }

  private updateResourcePool(allocation: ResourceAllocation, allocate: boolean): void {
    const multiplier = allocate ? 1 : -1;
    
    this.resourcePool.allocated.cpu += allocation.cpu * multiplier;
    this.resourcePool.allocated.memory += allocation.memory * multiplier;
    this.resourcePool.allocated.network += allocation.network * multiplier;
    this.resourcePool.allocated.storage += allocation.storage * multiplier;

    this.resourcePool.available.cpu -= allocation.cpu * multiplier;
    this.resourcePool.available.memory -= allocation.memory * multiplier;
    this.resourcePool.available.network -= allocation.network * multiplier;
    this.resourcePool.available.storage -= allocation.storage * multiplier;
  }

  private calculateFlexibleRequirements(requirements: ResourceAllocation): ResourceAllocation {
    const flexibilityFactor = 0.8; // Allow 20% reduction
    
    return {
      cpu: Math.ceil(requirements.cpu * flexibilityFactor),
      memory: Math.ceil(requirements.memory * flexibilityFactor),
      network: Math.ceil(requirements.network * flexibilityFactor),
      storage: Math.ceil(requirements.storage * flexibilityFactor)
    };
  }

  private initializeOptimizationStrategies(): void {
    this.optimizationStrategies = [
      {
        type: OptimizationType.COMPACT_ALLOCATION,
        description: 'Compact resource allocation to reduce fragmentation',
        expectedBenefit: 15,
        implementationCost: 5,
        priority: StrategyPriority.MEDIUM
      },
      {
        type: OptimizationType.PREDICTIVE_SCALING,
        description: 'Predictive resource scaling based on usage patterns',
        expectedBenefit: 25,
        implementationCost: 8,
        priority: StrategyPriority.HIGH
      },
      {
        type: OptimizationType.DYNAMIC_REALLOCATION,
        description: 'Dynamic reallocation of unused resources',
        expectedBenefit: 20,
        implementationCost: 6,
        priority: StrategyPriority.MEDIUM
      },
      {
        type: OptimizationType.PRIORITY_BASED_SCHEDULING,
        description: 'Priority-based resource scheduling',
        expectedBenefit: 30,
        implementationCost: 4,
        priority: StrategyPriority.HIGH
      },
      {
        type: OptimizationType.RESOURCE_SHARING,
        description: 'Enable resource sharing between compatible tasks',
        expectedBenefit: 35,
        implementationCost: 10,
        priority: StrategyPriority.CRITICAL
      }
    ];
  }

  private startResourceMonitoring(): void {
    setInterval(() => {
      this.getResourceUtilization();
      this.checkOptimizationOpportunities();
    }, 5000); // Monitor every 5 seconds
  }

  private checkOptimizationOpportunities(): void {
    const utilization = this.getResourceUtilization();
    
    // Check for optimization opportunities
    if (utilization.cpu > 90 || utilization.memory > 90) {
      this.applyOptimizationStrategy(OptimizationType.COMPACT_ALLOCATION);
    }
    
    if (utilization.queuedRequests > 5) {
      this.applyOptimizationStrategy(OptimizationType.PRIORITY_BASED_SCHEDULING);
    }
  }

  private isStrategyApplicable(strategy: OptimizationStrategy, utilization: ResourceUtilization): boolean {
    switch (strategy.type) {
      case OptimizationType.COMPACT_ALLOCATION:
        return utilization.cpu > 80 || utilization.memory > 80;
      case OptimizationType.PREDICTIVE_SCALING:
        return utilization.activeAllocations > 3;
      case OptimizationType.DYNAMIC_REALLOCATION:
        return utilization.cpu < 50 && utilization.memory < 50;
      case OptimizationType.PRIORITY_BASED_SCHEDULING:
        return utilization.queuedRequests > 2;
      case OptimizationType.RESOURCE_SHARING:
        return utilization.activeAllocations > 5;
      default:
        return false;
    }
  }

  private getPriorityScore(priority: RequestPriority | StrategyPriority): number {
    switch (priority) {
      case RequestPriority.CRITICAL:
      case StrategyPriority.CRITICAL:
        return 4;
      case RequestPriority.HIGH:
      case StrategyPriority.HIGH:
        return 3;
      case RequestPriority.MEDIUM:
      case StrategyPriority.MEDIUM:
        return 2;
      case RequestPriority.LOW:
      case StrategyPriority.LOW:
        return 1;
      default:
        return 0;
    }
  }

  private applyCompactAllocation(): boolean {
    // Implement compact allocation logic
    console.log('Applying compact allocation optimization');
    return true;
  }

  private applyPredictiveScaling(): boolean {
    // Implement predictive scaling logic
    console.log('Applying predictive scaling optimization');
    return true;
  }

  private applyDynamicReallocation(): boolean {
    // Implement dynamic reallocation logic
    console.log('Applying dynamic reallocation optimization');
    return true;
  }

  private applyPriorityBasedScheduling(): boolean {
    // Sort allocation queue by priority
    this.processAllocationQueue();
    console.log('Applied priority-based scheduling optimization');
    return true;
  }

  private applyResourceSharing(): boolean {
    // Implement resource sharing logic
    console.log('Applying resource sharing optimization');
    return true;
  }

  private calculateResourcePrediction(timestamp: number): ResourcePrediction {
    const historicalFactor = this.getHistoricalUsageFactor(timestamp);
    const timeOfDayFactor = this.getTimeOfDayFactor(timestamp);
    const workloadFactor = this.getWorkloadPatternFactor(timestamp);
    const seasonalFactor = this.getSeasonalTrendFactor(timestamp);

    const baseDemand = this.calculateBaseDemand();
    const predictedDemand = {
      cpu: baseDemand.cpu * historicalFactor * timeOfDayFactor * workloadFactor * seasonalFactor,
      memory: baseDemand.memory * historicalFactor * timeOfDayFactor * workloadFactor * seasonalFactor,
      network: baseDemand.network * historicalFactor * timeOfDayFactor * workloadFactor * seasonalFactor,
      storage: baseDemand.storage * historicalFactor * timeOfDayFactor * workloadFactor * seasonalFactor
    };

    const factors = [
      { type: FactorType.HISTORICAL_USAGE, weight: historicalFactor, description: 'Based on historical usage patterns' },
      { type: FactorType.TIME_OF_DAY, weight: timeOfDayFactor, description: 'Time of day usage pattern' },
      { type: FactorType.WORKLOAD_PATTERN, weight: workloadFactor, description: 'Current workload pattern' },
      { type: FactorType.SEASONAL_TREND, weight: seasonalFactor, description: 'Seasonal usage trend' }
    ];

    const confidence = this.calculatePredictionConfidence(factors);

    return {
      timestamp,
      predictedDemand,
      confidence,
      factors
    };
  }

  private getHistoricalUsageFactor(timestamp: number): number {
    // Simple implementation - in real system would analyze historical data
    return 1.0 + (Math.random() - 0.5) * 0.2; // ±10% variation
  }

  private getTimeOfDayFactor(timestamp: number): number {
    const hour = new Date(timestamp).getHours();
    
    // Peak hours: 9-17
    if (hour >= 9 && hour <= 17) {
      return 1.3;
    }
    
    // Evening hours: 18-22
    if (hour >= 18 && hour <= 22) {
      return 1.1;
    }
    
    // Night hours: 23-6
    return 0.7;
  }

  private getWorkloadPatternFactor(timestamp: number): number {
    // Simple workload pattern analysis
    return 1.0 + (Math.random() - 0.5) * 0.3; // ±15% variation
  }

  private getSeasonalTrendFactor(timestamp: number): number {
    // Simple seasonal trend
    const month = new Date(timestamp).getMonth();
    
    // Higher demand in winter months (Nov-Feb)
    if (month >= 10 || month <= 1) {
      return 1.2;
    }
    
    // Lower demand in summer months (Jun-Aug)
    if (month >= 5 && month <= 7) {
      return 0.8;
    }
    
    return 1.0;
  }

  private calculateBaseDemand(): ResourceAllocation {
    const activeAllocations = this.getActiveAllocations();
    
    if (activeAllocations.length === 0) {
      return { cpu: 1, memory: 512, network: 10, storage: 100 };
    }

    const totalAllocated = activeAllocations.reduce((sum, allocation) => ({
      cpu: sum.cpu + allocation.actualAllocation.cpu,
      memory: sum.memory + allocation.actualAllocation.memory,
      network: sum.network + allocation.actualAllocation.network,
      storage: sum.storage + allocation.actualAllocation.storage
    }), { cpu: 0, memory: 0, network: 0, storage: 0 });

    return {
      cpu: totalAllocated.cpu / activeAllocations.length,
      memory: totalAllocated.memory / activeAllocations.length,
      network: totalAllocated.network / activeAllocations.length,
      storage: totalAllocated.storage / activeAllocations.length
    };
  }

  private calculatePredictionConfidence(factors: PredictionFactor[]): number {
    const variance = factors.reduce((sum, factor) => sum + Math.abs(factor.weight - 1), 0) / factors.length;
    return Math.max(0.5, 1 - variance);
  }

  private trimHistoryIfNeeded(): void {
    if (this.utilizationHistory.length > this.maxHistorySize) {
      this.utilizationHistory = this.utilizationHistory.slice(-this.maxHistorySize);
    }
  }
}
