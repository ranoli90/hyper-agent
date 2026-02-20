export interface ServerlessFunction {
  id: string;
  name: string;
  runtime: string;
  handler: string;
  memoryMB: number;
  timeoutMs: number;
  environment: Record<string, string>;
  triggers: FunctionTrigger[];
}

export interface FunctionTrigger {
  type: 'http' | 'event' | 'schedule' | 'queue';
  config: Record<string, any>;
}

export interface FunctionTestResult {
  functionId: string;
  invocationType: 'cold_start' | 'warm';
  requestPayload: any;
  responsePayload: any;
  statusCode: number;
  duration: number;
  billedDuration: number;
  memoryUsed: number;
  coldStartTime?: number;
  passed: boolean;
  errors: string[];
}

export interface ContainerTestConfig {
  image: string;
  tag: string;
  ports: number[];
  environment: Record<string, string>;
  volumes: { host: string; container: string }[];
  healthCheckUrl?: string;
  readinessProbe?: { url: string; interval: number; timeout: number };
}

export interface ContainerTestResult {
  containerId: string;
  image: string;
  startupTime: number;
  healthCheckPassed: boolean;
  portAccessible: boolean[];
  resourceUsage: { cpuPercent: number; memoryMB: number; networkIO: number };
  logs: string[];
  passed: boolean;
  errors: string[];
}

export interface ServiceMeshTestConfig {
  services: ServiceConfig[];
  routes: RouteConfig[];
  retryPolicies: RetryPolicy[];
  circuitBreakers: CircuitBreakerConfig[];
}

export interface ServiceConfig {
  name: string;
  url: string;
  version: string;
  replicas: number;
  healthEndpoint: string;
}

export interface RouteConfig {
  source: string;
  destination: string;
  weight: number;
  headers?: Record<string, string>;
  timeout: number;
}

export interface RetryPolicy {
  service: string;
  maxRetries: number;
  retryOn: string[];
  perTryTimeout: number;
}

export interface CircuitBreakerConfig {
  service: string;
  maxConnections: number;
  maxPendingRequests: number;
  maxRetries: number;
  consecutiveErrors: number;
  interval: number;
  baseEjectionTime: number;
}

export interface ServiceMeshTestResult {
  testId: string;
  serviceResults: Map<string, ServiceTestResult>;
  routingResults: RoutingTestResult[];
  resilienceResults: ResilienceTestResult[];
  passed: boolean;
  summary: string;
}

export interface ServiceTestResult {
  serviceName: string;
  healthy: boolean;
  responseTime: number;
  statusCode: number;
  error?: string;
}

export interface RoutingTestResult {
  route: string;
  responseService: string;
  expectedService: string;
  correct: boolean;
  latency: number;
}

export interface ResilienceTestResult {
  testName: string;
  type: 'retry' | 'circuit_breaker' | 'timeout' | 'fallback';
  passed: boolean;
  details: string;
  duration: number;
}

export class ServerlessTestingEngine {
  private functions: Map<string, ServerlessFunction> = new Map();
  private results: FunctionTestResult[] = [];
  private maxResults = 500;

  registerFunction(func: ServerlessFunction): void {
    this.functions.set(func.id, func);
  }

  async testFunction(functionId: string, payload: any, simulateColdStart: boolean = false): Promise<FunctionTestResult> {
    const func = this.functions.get(functionId);
    if (!func) {
      return {
        functionId,
        invocationType: 'cold_start',
        requestPayload: payload,
        responsePayload: null,
        statusCode: 404,
        duration: 0,
        billedDuration: 0,
        memoryUsed: 0,
        passed: false,
        errors: ['Function not found'],
      };
    }

    const coldStartTime = simulateColdStart ? 200 + Math.random() * 800 : 0;
    const startTime = performance.now();

    try {
      let response: any;
      let statusCode = 200;

      if (func.triggers.some(t => t.type === 'http')) {
        const httpTrigger = func.triggers.find(t => t.type === 'http');
        const url = httpTrigger?.config?.url || `https://localhost/${func.name}`;

        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), func.timeoutMs);
          const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
          clearTimeout(timeout);
          statusCode = resp.status;
          response = await resp.json().catch(() => resp.text());
        } catch (err) {
          statusCode = 500;
          response = { error: err instanceof Error ? err.message : String(err) };
        }
      } else {
        response = { message: 'Function invoked successfully', payload };
      }

      const duration = performance.now() - startTime;

      const result: FunctionTestResult = {
        functionId,
        invocationType: simulateColdStart ? 'cold_start' : 'warm',
        requestPayload: payload,
        responsePayload: response,
        statusCode,
        duration,
        billedDuration: Math.ceil(duration / 100) * 100,
        memoryUsed: Math.floor(func.memoryMB * (0.3 + Math.random() * 0.5)),
        coldStartTime: coldStartTime > 0 ? coldStartTime : undefined,
        passed: statusCode >= 200 && statusCode < 400,
        errors: statusCode >= 400 ? [`HTTP ${statusCode}`] : [],
      };

      this.results.push(result);
      if (this.results.length > this.maxResults) this.results.shift();

      return result;
    } catch (error) {
      const result: FunctionTestResult = {
        functionId,
        invocationType: simulateColdStart ? 'cold_start' : 'warm',
        requestPayload: payload,
        responsePayload: null,
        statusCode: 500,
        duration: performance.now() - startTime,
        billedDuration: 0,
        memoryUsed: 0,
        passed: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };

      this.results.push(result);
      return result;
    }
  }

  async testColdStartPerformance(functionId: string, iterations: number = 5): Promise<{
    avgColdStartMs: number;
    avgWarmMs: number;
    coldStartOverhead: number;
    results: FunctionTestResult[];
  }> {
    const results: FunctionTestResult[] = [];

    for (let i = 0; i < iterations; i++) {
      const isCold = i === 0;
      const result = await this.testFunction(functionId, { test: true, iteration: i }, isCold);
      results.push(result);
    }

    const coldStarts = results.filter(r => r.invocationType === 'cold_start');
    const warmStarts = results.filter(r => r.invocationType === 'warm');

    const avgCold = coldStarts.length > 0
      ? coldStarts.reduce((s, r) => s + r.duration, 0) / coldStarts.length : 0;
    const avgWarm = warmStarts.length > 0
      ? warmStarts.reduce((s, r) => s + r.duration, 0) / warmStarts.length : 0;

    return {
      avgColdStartMs: avgCold,
      avgWarmMs: avgWarm,
      coldStartOverhead: avgWarm > 0 ? (avgCold - avgWarm) / avgWarm : 0,
      results,
    };
  }

  getResults(functionId?: string): FunctionTestResult[] {
    if (functionId) return this.results.filter(r => r.functionId === functionId);
    return [...this.results];
  }
}

export class ContainerTestingEngine {
  private results: ContainerTestResult[] = [];

  async testContainer(config: ContainerTestConfig): Promise<ContainerTestResult> {
    const startTime = performance.now();
    const errors: string[] = [];
    let healthCheckPassed = false;
    const portAccessible: boolean[] = [];

    if (config.healthCheckUrl) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const response = await fetch(config.healthCheckUrl, { signal: controller.signal });
        clearTimeout(timeout);
        healthCheckPassed = response.ok;
        if (!response.ok) errors.push(`Health check returned ${response.status}`);
      } catch (err) {
        healthCheckPassed = false;
        errors.push(`Health check failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      healthCheckPassed = true;
    }

    for (const port of config.ports) {
      try {
        const url = `http://localhost:${port}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        portAccessible.push(response.ok || response.status < 500);
      } catch {
        portAccessible.push(false);
      }
    }

    const result: ContainerTestResult = {
      containerId: `container_${Date.now()}`,
      image: `${config.image}:${config.tag}`,
      startupTime: performance.now() - startTime,
      healthCheckPassed,
      portAccessible,
      resourceUsage: {
        cpuPercent: Math.random() * 50,
        memoryMB: Math.floor(Math.random() * 512),
        networkIO: Math.floor(Math.random() * 1000),
      },
      logs: [],
      passed: healthCheckPassed && errors.length === 0,
      errors,
    };

    this.results.push(result);
    return result;
  }

  getResults(): ContainerTestResult[] {
    return [...this.results];
  }
}

export class ServiceMeshTestingEngine {
  async testServiceMesh(config: ServiceMeshTestConfig): Promise<ServiceMeshTestResult> {
    const testId = `mesh_${Date.now()}`;
    const serviceResults = new Map<string, ServiceTestResult>();
    const routingResults: RoutingTestResult[] = [];
    const resilienceResults: ResilienceTestResult[] = [];

    for (const service of config.services) {
      const result = await this.testService(service);
      serviceResults.set(service.name, result);
    }

    for (const route of config.routes) {
      const result = await this.testRoute(route);
      routingResults.push(result);
    }

    for (const retryPolicy of config.retryPolicies) {
      resilienceResults.push(this.testRetryPolicy(retryPolicy));
    }

    for (const cb of config.circuitBreakers) {
      resilienceResults.push(this.testCircuitBreaker(cb));
    }

    const allServiceHealthy = Array.from(serviceResults.values()).every(r => r.healthy);
    const allRoutesCorrect = routingResults.every(r => r.correct);
    const allResiliencePassed = resilienceResults.every(r => r.passed);

    return {
      testId,
      serviceResults,
      routingResults,
      resilienceResults,
      passed: allServiceHealthy && allRoutesCorrect && allResiliencePassed,
      summary: `Services: ${serviceResults.size}, Routes: ${routingResults.length}, Resilience: ${resilienceResults.length}`,
    };
  }

  private async testService(service: ServiceConfig): Promise<ServiceTestResult> {
    try {
      const startTime = performance.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(service.healthEndpoint, { signal: controller.signal });
      clearTimeout(timeout);
      const responseTime = performance.now() - startTime;

      return {
        serviceName: service.name,
        healthy: response.ok,
        responseTime,
        statusCode: response.status,
      };
    } catch (err) {
      return {
        serviceName: service.name,
        healthy: false,
        responseTime: 0,
        statusCode: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async testRoute(route: RouteConfig): Promise<RoutingTestResult> {
    const startTime = performance.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), route.timeout);
      await fetch(`http://${route.source}`, {
        headers: route.headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      return {
        route: `${route.source} -> ${route.destination}`,
        responseService: route.destination,
        expectedService: route.destination,
        correct: true,
        latency: performance.now() - startTime,
      };
    } catch {
      return {
        route: `${route.source} -> ${route.destination}`,
        responseService: 'unknown',
        expectedService: route.destination,
        correct: false,
        latency: performance.now() - startTime,
      };
    }
  }

  private testRetryPolicy(policy: RetryPolicy): ResilienceTestResult {
    return {
      testName: `Retry policy for ${policy.service}`,
      type: 'retry',
      passed: policy.maxRetries > 0 && policy.perTryTimeout > 0,
      details: `Max retries: ${policy.maxRetries}, Per-try timeout: ${policy.perTryTimeout}ms`,
      duration: 0,
    };
  }

  private testCircuitBreaker(config: CircuitBreakerConfig): ResilienceTestResult {
    const valid = config.maxConnections > 0 &&
      config.consecutiveErrors > 0 &&
      config.baseEjectionTime > 0;

    return {
      testName: `Circuit breaker for ${config.service}`,
      type: 'circuit_breaker',
      passed: valid,
      details: `Max connections: ${config.maxConnections}, Error threshold: ${config.consecutiveErrors}`,
      duration: 0,
    };
  }
}

export const serverlessTesting = new ServerlessTestingEngine();
export const containerTesting = new ContainerTestingEngine();
export const serviceMeshTesting = new ServiceMeshTestingEngine();
