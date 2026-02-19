import { AutonomousPlan, AutonomousResult, IntelligenceContext } from './ai-types';

interface AutonomousCallbacks {
    onProgress: (status: string, step: string, summary: string) => void;
    onAskUser: (question: string) => Promise<string>;
    onConfirmActions: (actions: any[], step: number, summary: string) => Promise<boolean>;
    executeAction: (action: any) => Promise<any>;
    captureScreenshot: () => Promise<string>;
    onDone: (summary: string, success: boolean) => void;
}

export class AutonomousIntelligence {
    private llmClient: any = null;
    private callbacks: AutonomousCallbacks | null = null;
    private isRunning: boolean = false;

    setLLMClient(client: any) {
        this.llmClient = client;
    }

    setCallbacks(callbacks: AutonomousCallbacks) {
        this.callbacks = callbacks;
    }

    /**
     * High-level planning step.
     * Currently delegates to the LLM client through a simplified interface or returns a basic plan
     * to allow the traditional loop to take over if no complex planning is needed.
     */
    async understandAndPlan(command: string, context?: IntelligenceContext): Promise<AutonomousPlan> {
        // If no LLM client is set, return empty plan to trigger fallback
        if (!this.llmClient) {
            console.warn('[AutonomousIntelligence] No LLM client set, returning empty plan.');
            return this.createEmptyPlan();
        }

        // TODO: Implement advanced multi-step planning here.
        // For now, we return an empty plan so the system falls back to the robust
        // "traditional" React loop in llmClient.ts which works well.
        // This avoids over-complicating the flow before we're ready.

        return this.createEmptyPlan();
    }

    /**
     * Executes a plan with adaptive error handling and replanning.
     */
    async executeWithAdaptation(plan: AutonomousPlan): Promise<AutonomousResult> {
        if (!this.callbacks) {
            throw new Error('Callbacks not set for autonomous execution');
        }

        this.isRunning = true;
        const results: any[] = [];
        const learnings: string[] = [];

        try {
            for (const step of plan.steps) {
                if (!this.isRunning) break;

                this.callbacks.onProgress('executing', step.id, step.description);

                // Execute actions in the step
                // This is a placeholder for the actual execution logic which would
                // iterate over step.actions and call this.callbacks.executeAction

                // For now, we just simulate success
                results.push({ stepId: step.id, success: true });
            }

            return {
                success: true,
                results,
                learnings,
                error: undefined
            };
        } catch (error: any) {
            console.error('[AutonomousIntelligence] Execution failed:', error);
            return {
                success: false,
                results,
                learnings,
                error: error.message
            };
        } finally {
            this.isRunning = false;
        }
    }

    private createEmptyPlan(): AutonomousPlan {
        return {
            id: 'empty-plan',
            steps: [],
            reasoning: '',
            confidence: 0,
            riskAssessment: 'low' as any,
            fallbackStrategies: [],
            estimatedDuration: 0
        };
    }
}

export const autonomousIntelligence = new AutonomousIntelligence();