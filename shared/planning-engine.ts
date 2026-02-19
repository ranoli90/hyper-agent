import type { IntelligenceContext, AutonomousPlan, PlanStep, RiskLevel } from './ai-types';
import type { LLMClientInterface } from './types';
import type { RetryConfig } from './retry-circuit-breaker';

export class PlanningEngine {
    private llmClient: LLMClientInterface;

    constructor(llmClient: LLMClientInterface) {
        this.llmClient = llmClient;
    }

    async generatePlan(context: IntelligenceContext, reasoning: string[]): Promise<AutonomousPlan> {
        const steps = await this.createSteps(context, reasoning);

        return {
            steps,
            reasoning: reasoning.join('. '),
            confidence: 0.8, // Placeholder
            riskAssessment: 'medium' as RiskLevel,
            fallbackStrategies: [],
            estimatedDuration: steps.length * 30000,
            availableTools: context.availableTools,
            taskDescription: context.taskDescription
        };
    }

    private async createSteps(context: IntelligenceContext, reasoning: string[]): Promise<PlanStep[]> {
        const prompt = `
Create a step-by-step plan for this task.
Task: "${context.taskDescription}"
Reasoning: ${reasoning.join('; ')}
Available tools: ${context.availableTools.join(', ')}

Return format:
STEP|DESCRIPTION|ACTION|SUCCESS_CRITERIA|TIMEOUT_SECONDS`;

        const response = await this.callPlanningLLM(prompt);
        return this.parseSteps(response);
    }

    private parseSteps(response: string): PlanStep[] {
        return response.split('\n').filter(line => line.includes('|')).map((line, index) => {
            const parts = line.split('|');
            return {
                id: `step_${index + 1}`,
                description: parts[1]?.trim() || 'Step',
                action: parts[2]?.trim() || 'wait',
                prerequisites: [],
                successCriteria: [parts[3]?.trim() || 'success'],
                timeout: parseInt(parts[4]) || 30,
                retryPolicy: { maxRetries: 3, backoffFactor: 1.5, initialDelayMs: 1000 } as RetryConfig
            };
        });
    }

    private async callPlanningLLM(prompt: string): Promise<string> {
        // Use completion API to avoid recursive callLLM -> planning loop
        const response = await this.llmClient.callCompletion({
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            maxTokens: 1000
        });
        return response;
    }
}
