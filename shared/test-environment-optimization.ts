export interface TestEnvironmentConfig {
  id: string;
  name: string;
  platform: PlatformType;
  resources: EnvironmentResources;
  dependencies: EnvironmentDependency[];
  variables: Record<string, string>;
  healthChecks: HealthCheck[];
  status: EnvironmentStatus;
  createdAt: number;
  lastHealthCheck?: number;
}

export enum PlatformType {
  LOCAL = 'local',
  DOCKER = 'docker',
  KUBERNETES = 'kubernetes',
  CLOUD = 'cloud',
  HYBRID = 'hybrid',
}

export interface EnvironmentResources {
  cpu: number;
  memoryMB: number;
  diskMB: number;
  networkBandwidthMbps: number;
}

export interface EnvironmentDependency {
  name: string;
  version: string;
  type: 'runtime' | 'build' | 'test' | 'optional';
  source: string;
  resolved: boolean;
  installedVersion?: string;
}

export interface HealthCheck {
  name: string;
  type: 'http' | 'tcp' | 'script' | 'process';
  target: string;
  interval: number;
  timeout: number;
  retries: number;
  status: 'healthy' | 'unhealthy' | 'unknown';
  lastCheck?: number;
  lastError?: string;
}

export enum EnvironmentStatus {
  PROVISIONING = 'provisioning',
  READY = 'ready',
  DEGRADED = 'degraded',
  FAILED = 'failed',
  SCALING = 'scaling',
  TERMINATING = 'terminating',
  TERMINATED = 'terminated',
}

export interface OptimizationRecommendation {
  category: 'resource' | 'dependency' | 'configuration' | 'performance';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  impact: string;
  action: string;
  estimatedImprovement: number;
}

export interface EnvironmentBenchmark {
  envId: string;
  timestamp: number;
  startupTime: number;
  testExecutionTime: number;
  resourceUtilization: {
    cpuPercent: number;
    memoryPercent: number;
    diskIOps: number;
  };
  networkLatency: number;
  score: number;
}

const STORAGE_KEY = 'hyperagent_env_optimization';

export class EnvironmentManager {
  private environments: Map<string, TestEnvironmentConfig> = new Map();
  private benchmarks: Map<string, EnvironmentBenchmark[]> = new Map();
  private maxBenchmarksPerEnv = 50;

  createEnvironment(config: Omit<TestEnvironmentConfig, 'status' | 'createdAt'>): TestEnvironmentConfig {
    const env: TestEnvironmentConfig = {
      ...config,
      status: EnvironmentStatus.PROVISIONING,
      createdAt: Date.now(),
    };
    this.environments.set(config.id, env);
    return env;
  }

  getEnvironment(id: string): TestEnvironmentConfig | undefined {
    return this.environments.get(id);
  }

  getAllEnvironments(): TestEnvironmentConfig[] {
    return Array.from(this.environments.values());
  }

  updateStatus(id: string, status: EnvironmentStatus): boolean {
    const env = this.environments.get(id);
    if (!env) return false;
    env.status = status;
    return true;
  }

  removeEnvironment(id: string): boolean {
    this.benchmarks.delete(id);
    return this.environments.delete(id);
  }

  async runHealthChecks(id: string): Promise<{ healthy: boolean; checks: HealthCheck[] }> {
    const env = this.environments.get(id);
    if (!env) return { healthy: false, checks: [] };

    const results: HealthCheck[] = [];
    let allHealthy = true;

    for (const check of env.healthChecks) {
      const result = await this.executeHealthCheck(check);
      results.push(result);
      if (result.status !== 'healthy') allHealthy = false;
    }

    env.lastHealthCheck = Date.now();
    env.status = allHealthy ? EnvironmentStatus.READY : EnvironmentStatus.DEGRADED;

    return { healthy: allHealthy, checks: results };
  }

  resolveDependencies(id: string): { resolved: boolean; missing: EnvironmentDependency[] } {
    const env = this.environments.get(id);
    if (!env) return { resolved: false, missing: [] };

    const missing: EnvironmentDependency[] = [];

    for (const dep of env.dependencies) {
      if (!dep.resolved) {
        if (dep.type === 'optional') {
          dep.resolved = true;
          continue;
        }
        missing.push(dep);
      }
    }

    return {
      resolved: missing.length === 0,
      missing,
    };
  }

  recordBenchmark(benchmark: EnvironmentBenchmark): void {
    const benchmarks = this.benchmarks.get(benchmark.envId) || [];
    benchmarks.push(benchmark);
    if (benchmarks.length > this.maxBenchmarksPerEnv) {
      benchmarks.shift();
    }
    this.benchmarks.set(benchmark.envId, benchmarks);
  }

  getBenchmarks(envId: string): EnvironmentBenchmark[] {
    return this.benchmarks.get(envId) || [];
  }

  analyze(id: string): OptimizationRecommendation[] {
    const env = this.environments.get(id);
    if (!env) return [];

    const recommendations: OptimizationRecommendation[] = [];
    const benchmarks = this.benchmarks.get(id) || [];

    if (benchmarks.length > 0) {
      const latestBenchmark = benchmarks[benchmarks.length - 1];

      if (latestBenchmark.resourceUtilization.cpuPercent < 20) {
        recommendations.push({
          category: 'resource',
          severity: 'info',
          title: 'CPU underutilized',
          description: `CPU utilization is ${latestBenchmark.resourceUtilization.cpuPercent}%`,
          impact: 'Reduce CPU allocation to save resources',
          action: `Reduce CPU from ${env.resources.cpu} to ${Math.max(1, Math.ceil(env.resources.cpu * 0.5))}`,
          estimatedImprovement: 30,
        });
      }

      if (latestBenchmark.resourceUtilization.cpuPercent > 85) {
        recommendations.push({
          category: 'resource',
          severity: 'warning',
          title: 'CPU bottleneck detected',
          description: `CPU utilization is ${latestBenchmark.resourceUtilization.cpuPercent}%`,
          impact: 'Tests may be slower due to CPU constraints',
          action: `Increase CPU from ${env.resources.cpu} to ${Math.ceil(env.resources.cpu * 1.5)}`,
          estimatedImprovement: 25,
        });
      }

      if (latestBenchmark.resourceUtilization.memoryPercent > 90) {
        recommendations.push({
          category: 'resource',
          severity: 'critical',
          title: 'Memory near limit',
          description: `Memory utilization is ${latestBenchmark.resourceUtilization.memoryPercent}%`,
          impact: 'Risk of OOM errors during test execution',
          action: `Increase memory from ${env.resources.memoryMB}MB to ${Math.ceil(env.resources.memoryMB * 1.5)}MB`,
          estimatedImprovement: 40,
        });
      }

      if (latestBenchmark.startupTime > 30000) {
        recommendations.push({
          category: 'performance',
          severity: 'warning',
          title: 'Slow environment startup',
          description: `Startup takes ${(latestBenchmark.startupTime / 1000).toFixed(1)}s`,
          impact: 'Slow feedback loop for developers',
          action: 'Consider caching dependencies or using snapshots',
          estimatedImprovement: 50,
        });
      }

      if (latestBenchmark.networkLatency > 200) {
        recommendations.push({
          category: 'performance',
          severity: 'info',
          title: 'High network latency',
          description: `Network latency is ${latestBenchmark.networkLatency}ms`,
          impact: 'Network-dependent tests may be slow',
          action: 'Consider using local mocks or service virtualization',
          estimatedImprovement: 20,
        });
      }
    }

    const unresolvedDeps = env.dependencies.filter(d => !d.resolved && d.type !== 'optional');
    if (unresolvedDeps.length > 0) {
      recommendations.push({
        category: 'dependency',
        severity: 'critical',
        title: 'Unresolved dependencies',
        description: `${unresolvedDeps.length} required dependencies are unresolved`,
        impact: 'Tests may fail due to missing dependencies',
        action: `Resolve: ${unresolvedDeps.map(d => d.name).join(', ')}`,
        estimatedImprovement: 100,
      });
    }

    const unhealthyChecks = env.healthChecks.filter(h => h.status !== 'healthy');
    if (unhealthyChecks.length > 0) {
      recommendations.push({
        category: 'configuration',
        severity: 'warning',
        title: 'Failing health checks',
        description: `${unhealthyChecks.length} health checks are failing`,
        impact: 'Environment may not be fully functional',
        action: `Fix: ${unhealthyChecks.map(h => h.name).join(', ')}`,
        estimatedImprovement: 50,
      });
    }

    return recommendations.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3);
    });
  }

  compareEnvironments(envId1: string, envId2: string): {
    faster: string;
    performanceDiff: number;
    recommendations: string[];
  } | null {
    const benchmarks1 = this.benchmarks.get(envId1) || [];
    const benchmarks2 = this.benchmarks.get(envId2) || [];

    if (benchmarks1.length === 0 || benchmarks2.length === 0) return null;

    const avg1 = benchmarks1.reduce((s, b) => s + b.testExecutionTime, 0) / benchmarks1.length;
    const avg2 = benchmarks2.reduce((s, b) => s + b.testExecutionTime, 0) / benchmarks2.length;

    const faster = avg1 < avg2 ? envId1 : envId2;
    const diff = Math.abs(avg1 - avg2);
    const diffPercent = Math.min(avg1, avg2) > 0 ? (diff / Math.min(avg1, avg2)) * 100 : 0;

    const recommendations: string[] = [];
    if (diffPercent > 20) {
      recommendations.push(`${faster} is ${diffPercent.toFixed(0)}% faster. Consider using it as the primary environment.`);
    }

    return {
      faster,
      performanceDiff: diffPercent,
      recommendations,
    };
  }

  async persist(): Promise<void> {
    try {
      if (!chrome?.storage?.local) return;
      await chrome.storage.local.set({
        [STORAGE_KEY]: {
          environments: Array.from(this.environments.entries()),
          benchmarks: Array.from(this.benchmarks.entries()),
        },
      });
    } catch (err) {
      console.error('[EnvironmentManager] Persist failed:', err);
    }
  }

  async restore(): Promise<void> {
    try {
      if (!chrome?.storage?.local) return;
      const data = await chrome.storage.local.get(STORAGE_KEY);
      const stored = data[STORAGE_KEY];
      if (!stored) return;

      if (Array.isArray(stored.environments)) {
        for (const [id, env] of stored.environments) this.environments.set(id, env);
      }
      if (Array.isArray(stored.benchmarks)) {
        for (const [id, b] of stored.benchmarks) this.benchmarks.set(id, b);
      }
    } catch (err) {
      console.error('[EnvironmentManager] Restore failed:', err);
    }
  }

  private async executeHealthCheck(check: HealthCheck): Promise<HealthCheck> {
    const result = { ...check };
    result.lastCheck = Date.now();

    try {
      switch (check.type) {
        case 'http': {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), check.timeout);
          try {
            const response = await fetch(check.target, { signal: controller.signal });
            result.status = response.ok ? 'healthy' : 'unhealthy';
            if (!response.ok) result.lastError = `HTTP ${response.status}`;
          } finally {
            clearTimeout(timeout);
          }
          break;
        }
        case 'tcp':
        case 'script':
        case 'process':
          result.status = 'healthy';
          break;
        default:
          result.status = 'unknown';
      }
    } catch (error) {
      result.status = 'unhealthy';
      result.lastError = error instanceof Error ? error.message : String(error);
    }

    return result;
  }
}

export const environmentManager = new EnvironmentManager();
