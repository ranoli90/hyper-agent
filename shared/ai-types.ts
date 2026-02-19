import { type RetryConfig } from './retry-circuit-breaker';

// ─── Interfaces ────────────────────────────────────────────────────────
export interface IntelligenceContext {
    taskDescription: string;
    availableTools: string[];
    previousAttempts: ExecutionAttempt[];
    environmentalData: Record<string, any>;
    userPreferences: Record<string, any>;
    domainKnowledge: Record<string, any>;
    successPatterns: SuccessPattern[];
}

export interface ExecutionAttempt {
    task: string;
    approach: string;
    success: boolean;
    duration: number;
    error?: string;
    learnings: string[];
    timestamp: number;
}

export interface SuccessPattern {
    pattern: string;
    context: string;
    successRate: number;
    lastUsed: number;
    confidence: number;
}

export interface ReasoningStep {
    step: number;
    thought: string;
    action: string;
    confidence: number;
    alternatives: string[];
    timestamp: number;
}

export interface AutonomousPlan {
    id: string;
    steps: PlanStep[];
    reasoning: string;
    confidence: number;
    riskAssessment: RiskLevel;
    fallbackStrategies: string[];
    estimatedDuration: number;
    availableTools?: string[];
    taskDescription?: string;
}

export interface PlanStep {
    id: string;
    description: string;
    action: Action | any; // Allow flexible action structure for autonomous execution
    prerequisites?: string[];
    successCriteria?: string[];
    timeout?: number;
    retryPolicy?: RetryConfig;
    confidence?: number;
    verification?: string;
    dependencies?: string[];
}

export interface StepResult {
    stepId: string;
    success: boolean;
    duration: number;
    output?: any;
    error?: string;
    confidence: number;
}

export interface ExecutionResult {
    success: boolean;
    executionId: string;
    duration: number;
    results: StepResult[];
    learnings: string[];
    error?: string;
}

export interface AutonomousResult {
    success: boolean;
    results: any[];
    learnings: string[];
    error?: string;
}

// ─── Enums & Types ─────────────────────────────────────────────────────
export enum RiskLevel {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical'
}
