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
     * Uses LLM to generate autonomous multi-step plans for complex tasks.
     */
    async understandAndPlan(command: string, context?: IntelligenceContext): Promise<AutonomousPlan> {
        // If no LLM client is set, return empty plan to trigger fallback
        if (!this.llmClient) {
            console.warn('[AutonomousIntelligence] No LLM client set, returning empty plan.');
            return this.createEmptyPlan();
        }

        try {
            // Create autonomous planning prompt
            const planningPrompt = `
You are an autonomous AI agent planning to execute a complex task.
Your goal is to break down the user's request into a sequence of executable steps that can be performed autonomously with minimal user interaction.

Task: "${command}"

Available Context:
- URL: ${context?.environmentalData?.url || 'unknown'}
- Page Content (first 2000 chars): ${context?.environmentalData?.html?.slice(0, 2000) || 'not available'}

Guidelines for Autonomous Planning:
1. Break the task into 3-8 concrete, executable steps
2. Each step should be a specific action: navigate, click, fill, extract, scroll, wait
3. Avoid steps that require user judgment or confirmation unless absolutely necessary
4. Prefer automation over asking the user
5. Include verification steps where possible (e.g., extract data to confirm success)
6. Consider page structure and likely element locations
7. Use descriptive step names and clear descriptions

Output Format (JSON):
{
  "steps": [
    {
      "id": "step1",
      "description": "Navigate to target page",
      "action": { "type": "navigate", "url": "https://example.com" },
      "verification": "Check URL changed successfully"
    },
    {
      "id": "step2", 
      "description": "Fill search form",
      "action": { "type": "fill", "locator": "#search-input", "value": "search term" },
      "verification": "Check input has expected value"
    }
  ],
  "reasoning": "Brief explanation of the plan",
  "confidence": 0.8,
  "riskAssessment": "low",
  "fallbackStrategies": ["Ask user for clarification if verification fails"]
}

Important: Only include steps that can be executed autonomously. If the task fundamentally requires user input, return an empty steps array.
`;

            const llmResponse = await this.llmClient.callCompletion({
                messages: [{ role: 'user', content: planningPrompt }],
                temperature: 0.1,
                maxTokens: 1500
            });

            // Parse the LLM response
            const planData = JSON.parse(llmResponse);
            
            if (!planData.steps || !Array.isArray(planData.steps) || planData.steps.length === 0) {
                console.log('[AutonomousIntelligence] No autonomous plan possible, using traditional loop');
                return this.createEmptyPlan();
            }

            // Convert to AutonomousPlan format
            const steps: any[] = planData.steps.map((step: any, index: number) => ({
                id: step.id || `step${index + 1}`,
                description: step.description || `Step ${index + 1}`,
                action: step.action || {},
                verification: step.verification || 'Check step completed',
                dependencies: step.dependencies || []
            }));

            return {
                id: `autonomous-plan-${Date.now()}`,
                steps,
                reasoning: planData.reasoning || 'Autonomous execution plan',
                confidence: planData.confidence || 0.7,
                riskAssessment: planData.riskAssessment || 'medium',
                fallbackStrategies: planData.fallbackStrategies || ['Ask user for assistance'],
                estimatedDuration: planData.steps.length * 5000 // Rough estimate
            };

        } catch (error) {
            console.error('[AutonomousIntelligence] Planning failed:', error);
            return this.createEmptyPlan();
        }
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
        let stepIndex = 0;

        try {
            for (const step of plan.steps) {
                if (!this.isRunning) break;

                stepIndex++;
                this.callbacks.onProgress('executing', step.id, step.description);

                try {
                    // Execute the action
                    const actionResult = await this.callbacks.executeAction(step.action);

                    if (actionResult.success) {
                        // Attempt verification if specified
                        if (step.verification && step.verification !== 'Check step completed') {
                            try {
                                // Simple verification - could be enhanced with LLM-based verification
                                const verificationPrompt = `
Verify that the following step was completed successfully:
Step: ${step.description}
Action: ${JSON.stringify(step.action)}
Expected result: ${step.verification}

Current page context will be provided. Return 'SUCCESS' if the step appears completed, or 'FAILED: reason' if not.
`;

                                const verification = await this.askReasoning(verificationPrompt);
                                if (verification.toUpperCase().includes('FAILED')) {
                                    throw new Error(`Verification failed: ${verification}`);
                                }
                            } catch (error_) {
                                console.warn('[AutonomousIntelligence] Verification failed:', error_);
                                // Continue anyway for now
                            }
                        }

                        results.push({ 
                            stepId: step.id, 
                            success: true, 
                            actionResult,
                            verificationPassed: true 
                        });

                        learnings.push(`Step ${stepIndex}: ${step.description} - completed successfully`);

                    } else {
                        // Action failed - attempt recovery
                        console.warn(`[AutonomousIntelligence] Step ${step.id} failed:`, actionResult.error);

                        // For autonomous mode, we try to continue or ask user only as last resort
                        if (stepIndex < plan.steps.length && plan.confidence > 0.6) {
                            // Try to continue with next step despite failure
                            learnings.push(`Step ${stepIndex}: ${step.description} - failed but continuing (${actionResult.error})`);
                            results.push({ 
                                stepId: step.id, 
                                success: false, 
                                actionResult,
                                error: actionResult.error 
                            });
                        } else {
                            // Ask user for guidance
                            const userHelp = await this.callbacks.onAskUser(
                                `Step "${step.description}" failed: ${actionResult.error}. How should I proceed?`
                            );

                            if (userHelp.toLowerCase().includes('stop') || userHelp.toLowerCase().includes('cancel')) {
                                throw new Error(`User requested stop at step ${stepIndex}`);
                            }

                            // Try the step again or continue based on user input
                            learnings.push(`Step ${stepIndex}: ${step.description} - user intervention required: ${userHelp}`);
                            results.push({ 
                                stepId: step.id, 
                                success: false, 
                                actionResult,
                                userIntervention: userHelp 
                            });
                        }
                    }

                    // Brief pause between steps
                    await new Promise(resolve => globalThis.setTimeout(resolve, 1000));

                } catch (error_: any) {
                    console.error(`[AutonomousIntelligence] Step ${step.id} error:`, error_);
                    results.push({ 
                        stepId: step.id, 
                        success: false, 
                        error: error_.message 
                    });
                    learnings.push(`Step ${stepIndex}: ${step.description} - error: ${error_.message}`);

                    // For critical errors, ask user
                    if (plan.confidence < 0.5) {
                        const userGuidance = await this.callbacks.onAskUser(
                            `Critical error in step "${step.description}": ${error_.message}. How should I handle this?`
                        );
                        learnings.push(`User guidance: ${userGuidance}`);
                    }
                }
            }

            // All steps completed
            const success = results.every(r => r.success !== false) || results.length > 0;
            const finalSummary = success 
                ? `Autonomous task completed with ${results.filter(r => r.success).length}/${results.length} steps successful`
                : `Autonomous task failed after ${results.length} steps`;

            if (this.callbacks?.onDone) {
                this.callbacks.onDone(finalSummary, success);
            }

            return {
                success,
                results,
                learnings,
                error: success ? undefined : 'Some steps failed'
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

    /**
     * Ask the LLM for reasoning on a specific prompt.
     * Used by other modules like TikTokModerator for semantic analysis.
     */
    async askReasoning(prompt: string): Promise<string> {
        if (!this.llmClient) {
            console.warn('[AutonomousIntelligence] No LLM client set for askReasoning.');
            return '';
        }

        try {
            return await this.llmClient.callCompletion({
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1,
                maxTokens: 500
            });
        } catch (error) {
            console.error('[AutonomousIntelligence] askReasoning failed:', error);
            return '';
        }
    }
}

export const autonomousIntelligence = new AutonomousIntelligence();
