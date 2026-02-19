import type { LLMClientInterface, Action, ActionResult } from './types';
import type {
  IntelligenceContext,
  AutonomousPlan,
  ExecutionAttempt,
  SuccessPattern,
  ReasoningStep,
  PlanStep,
  RiskLevel
} from './ai-types';
import { ReasoningEngine } from './reasoning-engine';
import { PlanningEngine } from './planning-engine';
import { VisualPerceptionEngine } from './visual-perception';
import { SnapshotManager } from './snapshot-manager';




/**
 * The core autonomous intelligence engine that revolutionizes AI task execution.
 *
 * This class implements a meta-system that dynamically understands and executes ANY task
 * without relying on preprogrammed workflows or rigid templates. Instead of following
 * hardcoded patterns, the AI reasons about tasks, learns from experience, and adapts
 * its approach based on context and results.
 *
 * Key revolutionary features:
 * - Dynamic task analysis without predefined categories
 * - Self-learning from successes and failures
 * - Adaptive execution with real-time strategy modification
 * - Creative problem-solving using multiple approaches
 * - Risk assessment and intelligent fallback strategies
 *
 * @example
 * ```typescript
 * const ai = new AutonomousIntelligenceEngine();
 *
 * // The AI figures out how to handle any task dynamically
 * const plan = await ai.understandAndPlan(
 *   "Find me the best wireless headphones under $50",
 *   { availableTools: ['web_search', 'price_comparison'] }
 * );
 *
 * const result = await ai.executeWithAdaptation(plan);
 * console.log(`Task completed in ${result.duration}ms`);
 * ```
 */
export interface AutonomousCallbacks {
  onProgress: (status: string, step?: string, summary?: string) => void;
  onAskUser: (question: string) => Promise<string>;
  onConfirmActions: (actions: Action[], step: number, summary: string) => Promise<boolean>;
  executeAction: (action: Action) => Promise<ActionResult>;
  captureScreenshot: () => Promise<string>;
  onDone: (summary: string, success: boolean) => void;
}

export class AutonomousIntelligenceEngine {
  /** Chain of reasoning steps for transparency and debugging */
  private reasoningChain: ReasoningStep[] = [];
  /** Knowledge base of successful patterns learned over time */
  private knowledgeBase: Map<string, SuccessPattern[]> = new Map();
  /** Historical execution attempts for continuous learning */
  private adaptationHistory: ExecutionAttempt[] = [];

  private reasoningEngine?: ReasoningEngine;
  private planningEngine?: PlanningEngine;
  private visualPerceptionEngine?: VisualPerceptionEngine;
  private perceptionEngine?: VisualPerceptionEngine;
  private callbacks?: AutonomousCallbacks;
  private llmClient?: LLMClientInterface;

  constructor() {
    this.initializeKnowledgeBase();
  }

  setCallbacks(callbacks: AutonomousCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Inject the LLM client and initialize sub-engines.
   */
  setLLMClient(client: LLMClientInterface): void {
    this.llmClient = client;
    this.reasoningEngine = new ReasoningEngine(client);
    this.planningEngine = new PlanningEngine(client);
    this.visualPerceptionEngine = new VisualPerceptionEngine(client);
  }



  // ─── Core Intelligence Methods ────────────────────────────────────────

  /**
   * Analyzes any task and creates a dynamic execution plan without predefined workflows.
   *
   * This is the revolutionary core method that replaces traditional workflow systems.
   * Instead of checking against hardcoded templates, the AI dynamically:
   * 1. Analyzes the task domain and complexity
   * 2. Identifies available approaches and tools
   * 3. Assesses risks and generates fallback strategies
   * 4. Creates an adaptive execution plan
   *
   * @param taskDescription - Natural language description of the task
   * @param context - Environmental context and historical data
   * @returns Complete autonomous execution plan with reasoning and risk assessment
   *
   * @example
   * ```typescript
   * const plan = await ai.understandAndPlan(
   *   "Research and book vacation to Europe",
   *   {
   *     availableTools: ['web_search', 'booking_api'],
   *     previousAttempts: []
   *   }
   * );
   * // AI dynamically creates multi-step plan for research, comparison, booking
   * ```
   */
  async understandAndPlan(
    taskDescription: string,
    context: Partial<IntelligenceContext>
  ): Promise<AutonomousPlan> {
    if (!this.reasoningEngine || !this.planningEngine) {
      throw new Error('Engines not initialized. Call setLLMClient first.');
    }

    const intelligenceContext = await this.buildIntelligenceContext(taskDescription, context);

    // Delegate to ReasoningEngine
    const reasoning = await this.reasoningEngine.analyzeTask(intelligenceContext);

    // Delegate to PlanningEngine
    const plan = await this.planningEngine.generatePlan(intelligenceContext, reasoning);
    plan.id = `plan_${Date.now()}`;
    plan.taskDescription = taskDescription;

    return plan;
  }

  /**
   * Perceives the current state of the user interface using visual and semantic analysis.
   * @param htmlSnippet - The HTML content of the current page or specific element
   */
  async perceiveState(htmlSnippet: string): Promise<any[]> {
    if (!this.visualPerceptionEngine) return [];
    return this.visualPerceptionEngine.perceivePage(htmlSnippet);
  }

  /**
   * Asks the reasoning engine to analyze a specific prompt.
   * Useful for lightweight checks like moderation or semantic matching.
   */
  async askReasoning(prompt: string): Promise<string> {
    return this.callReasoningLLM(prompt);
  }

  /**
   * Executes the plan with continuous adaptation and learning.
   *
   * Unlike traditional automation that follows rigid scripts, this method:
   * - Monitors execution in real-time
   * - Adapts strategy when steps fail
   * - Learns from both successes and failures
   * - Implements intelligent recovery strategies
   *
   * @param plan - The autonomous execution plan to execute
   * @returns Detailed execution results with learnings and adaptations
   *
   * @example
   * ```typescript
   * const result = await ai.executeWithAdaptation(plan);
   * if (result.success) {
   *   console.log(`Learned: ${result.learnings.join(', ')}`);
   * } else {
   *   console.log(`Adapted strategy due to: ${result.error}`);
   * }
   * ```
   */
  async executeWithAdaptation(plan: AutonomousPlan): Promise<ExecutionResult> {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
      let currentStep = 0;
      const results: StepResult[] = [];

      while (currentStep < plan.steps.length) {
        const step = plan.steps[currentStep];

        // Adaptive execution with real-time adjustment
        const stepResult = await this.executeStepWithAdaptation(step, plan, results);

        results.push(stepResult);

        // 🟢 Checkpoint: Save state after every step
        await SnapshotManager.save({
          sessionId: executionId,
          taskId: plan.id,
          command: plan.taskDescription || 'Unknown Task',
          currentStep: currentStep + 1,
          totalSteps: plan.steps.length,
          plan: plan,
          history: [], // Would normally be the history from understandAndPlan
          results: results.map(r => r.output),
          status: stepResult.success ? 'in_progress' : 'error',
          timestamp: Date.now()
        });

        if (!stepResult.success) {
          // Dynamic failure handling - don't just retry, adapt
          const adaptation = await this.adaptToFailure(stepResult, plan, results);

          if (adaptation.shouldRetryWithModification && adaptation.modifiedAction) {
            // Modify current step and retry
            step.action = adaptation.modifiedAction;
            continue;
          } else if (adaptation.shouldSkip) {
            // Skip this step and continue
            currentStep++;
            continue;
          } else {
            // Major failure - attempt recovery plan
            return await this.attemptRecovery(executionId, plan, results, adaptation);
          }
        }

        currentStep++;
      }

      // Learn from successful execution
      await this.learnFromSuccess(plan, results, Date.now() - startTime);

      return {
        success: true,
        executionId,
        duration: Date.now() - startTime,
        results,
        learnings: this.extractLearnings(results)
      };

    } catch (error) {
      // Learn from failure
      await this.learnFromFailure(plan, error, Date.now() - startTime);

      return {
        success: false,
        executionId,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        results: [],
        learnings: [`Failure pattern: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }



  // ─── Adaptive Execution ────────────────────────────────────────────────

  private async executeStepWithAdaptation(
    step: PlanStep,
    plan: AutonomousPlan,
    previousResults: StepResult[]
  ): Promise<StepResult> {
    const startTime = Date.now();

    try {
      // 🛡️ CAPTCHA Detection: Prevent agent from getting stuck or being flagged
      const hasCaptcha = await this.detectCaptcha();
      if (hasCaptcha) {
        if (this.callbacks?.onAskUser) {
          await this.callbacks.onAskUser("A CAPTCHA has been detected. Please solve it so I can continue my task.");
        } else {
          throw new Error('CAPTCHA_DETECTED: No user-interaction callback available to solve it.');
        }
      }

      // Dynamic action execution based on context
      const result = await this.executeDynamicAction(step, plan, previousResults);

      return {
        stepId: step.id,
        success: true,
        duration: Date.now() - startTime,
        output: result,
        confidence: step.confidence || 0.8
      };

    } catch (error) {
      return {
        stepId: step.id,
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        confidence: 0
      };
    }
  }

  private async executeDynamicAction(
    step: PlanStep,
    plan: AutonomousPlan,
    previousResults: StepResult[]
  ): Promise<any> {
    // Use LLM to dynamically execute the action based on the description
    const executionPrompt = `
Execute this step dynamically. Don't follow hardcoded logic - figure out how to accomplish it.

Step: ${step.description}
Action: ${step.action}

Previous results: ${previousResults.map(r => `${r.stepId}: ${r.success ? 'SUCCESS' : 'FAILED'}`).join(', ')}

Available tools: ${plan.availableTools?.join(', ') || 'web browsing, data entry, research'}

Think step by step:
1. What does this step actually require?
2. What tools or methods can accomplish this?
3. How should I adapt based on previous results?

Execute the step and return the result.`;

    // Check if the action matches a registered tool
    /*
      The AI might have outputted "Calculator: (5 * 5)" or similar.
      We check against our tool registry.
    */
    const toolRegex = /^(\w+):\s*(.+)$/;
    const match = step.action.match(toolRegex);

    if (match) {
      const toolName = match[1];
      const toolArgs = match[2];

      const { toolRegistry } = await import('./tool-system');
      const tool = toolRegistry.getTool(toolName);

      if (tool) {
        console.log(`[Autonomous] Executing Tool: ${toolName} with args: ${toolArgs}`);
        return await tool.execute(toolArgs);
      }
    }

    return await this.callExecutionLLM(executionPrompt);
  }

  private async adaptToFailure(
    failedStep: StepResult,
    plan: AutonomousPlan,
    allResults: StepResult[]
  ): Promise<{
    shouldRetryWithModification: boolean;
    modifiedAction?: string;
    shouldSkip: boolean;
    recoveryStrategy?: string;
  }> {
    const adaptationPrompt = `
A step failed. Analyze and suggest how to adapt.

Failed step: ${failedStep.stepId}
Error: ${failedStep.error}

Plan context: ${plan.reasoning}

All previous results:
${allResults.map(r => `${r.stepId}: ${r.success ? 'SUCCESS' : 'FAILED - ' + r.error}`).join('\n')}

Options:
1. RETRY_MODIFIED|new_action_description
2. SKIP_STEP
3. RECOVERY_STRATEGY|strategy_description

Choose the best adaptation approach.`;

    const response = await this.callReasoningLLM(adaptationPrompt);

    if (response.startsWith('RETRY_MODIFIED|')) {
      const modifiedAction = response.split('|')[1].trim();
      return { shouldRetryWithModification: true, modifiedAction, shouldSkip: false };
    } else if (response.startsWith('SKIP_STEP')) {
      return { shouldRetryWithModification: false, shouldSkip: true };
    } else if (response.startsWith('RECOVERY_STRATEGY|')) {
      const strategy = response.split('|')[1].trim();
      return { shouldRetryWithModification: false, shouldSkip: false, recoveryStrategy: strategy };
    }

    return { shouldRetryWithModification: false, shouldSkip: false };
  }

  // ─── Learning and Adaptation ──────────────────────────────────────────

  private async learnFromSuccess(
    plan: AutonomousPlan,
    results: StepResult[],
    totalDuration: number
  ): Promise<void> {
    const pattern: SuccessPattern = {
      pattern: plan.reasoning,
      context: plan.steps.map(s => s.description).join(' -> '),
      successRate: 1.0,
      lastUsed: Date.now(),
      confidence: plan.confidence
    };

    // Store in knowledge base
    const key = (plan.taskDescription || 'unknown_task').toLowerCase();
    const existing = this.knowledgeBase.get(key) || [];
    existing.push(pattern);
    this.knowledgeBase.set(key, existing.slice(-10)); // Keep last 10

    // Record execution attempt
    this.adaptationHistory.push({
      task: plan.taskDescription || 'Unknown Task',
      approach: plan.reasoning,
      success: true,
      duration: totalDuration,
      learnings: this.extractLearnings(results),
      timestamp: Date.now()
    });

    // CUSTOM: Store in Long-Term Memory
    try {
      const { memoryManager } = await import('./memory-system');
      await memoryManager.addMemory(
        `Task "${plan.taskDescription}" completed successfully using approach: ${plan.reasoning}`,
        'task_history',
        ['success', 'automomous_agent']
      );
    } catch (e) {
      console.warn('Failed to save memory', e);
    }
  }

  private async learnFromFailure(
    plan: AutonomousPlan,
    error: any,
    duration: number
  ): Promise<void> {
    this.adaptationHistory.push({
      task: plan.taskDescription || 'Unknown Task',
      approach: plan.reasoning,
      success: false,
      duration,
      error: error instanceof Error ? error.message : String(error),
      learnings: [`Failure pattern: ${error instanceof Error ? error.message : String(error)}`],
      timestamp: Date.now()
    });
  }

  private extractLearnings(results: StepResult[]): string[] {
    const learnings: string[] = [];

    // Analyze successful patterns
    const successfulSteps = results.filter(r => r.success);
    if (successfulSteps.length > 0) {
      learnings.push(`Successful steps: ${successfulSteps.map(s => s.stepId).join(', ')}`);
    }

    // Analyze timing patterns
    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    learnings.push(`Average step duration: ${avgDuration.toFixed(0)}ms`);

    return learnings;
  }

  // ─── Utility Methods ───────────────────────────────────────────────────




  private async callReasoningLLM(prompt: string): Promise<string> {
    if (!this.llmClient) throw new Error('LLM Client not initialized');
    // Use the injected LLM client for reasoning tasks
    return await this.llmClient.callCompletion({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3, // Lower temperature for more consistent reasoning
      maxTokens: 500
    });
  }

  private async callExecutionLLM(prompt: string): Promise<any> {
    if (!this.llmClient) throw new Error('LLM Client not initialized');
    // Use the injected LLM client for execution tasks
    const response = await this.llmClient.callCompletion({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1, // Very low temperature for consistent execution
      maxTokens: 1000
    });
    return response;
  }



  private async buildIntelligenceContext(
    task: string,
    partial: Partial<IntelligenceContext>
  ): Promise<IntelligenceContext> {
    // 1. Retrieve relevant memories
    const { memoryManager } = await import('./memory-system');
    await memoryManager.initialize();
    const memoryContext = await memoryManager.retrieveContext(task);

    // 2. Visual Perception (Active Vision)
    let visualElements: any[] = [];
    if (partial.environmentalData?.screenshotBase64) {
      if (!this.perceptionEngine) throw new Error('Perception Engine not initialized');
      // Limit HTML length to avoid token limits, rely on Vision
      const htmlSnippet = partial.environmentalData.html?.substring(0, 1000) || '';
      visualElements = await this.perceptionEngine.perceivePage(htmlSnippet, partial.environmentalData.screenshotBase64);
      console.log(`[Vision] Identified ${visualElements.length} interactive elements.`);
    }

    const enhancedDomainKnowledge = {
      ...(partial.domainKnowledge || {}),
      memory_context: memoryContext,
      visual_context: visualElements.length > 0 ? JSON.stringify(visualElements) : 'No visual data'
    };

    return {
      taskDescription: task,
      availableTools: partial.availableTools || (await import('./tool-system')).toolRegistry.getTools().map(t => `${t.name}: ${t.description}`),
      previousAttempts: partial.previousAttempts || [],
      environmentalData: partial.environmentalData || {},
      userPreferences: partial.userPreferences || {},
      domainKnowledge: enhancedDomainKnowledge,
      successPatterns: partial.successPatterns || []
    };
  }

  private initializeKnowledgeBase(): void {
    // Initialize with some basic patterns
    this.knowledgeBase.set('general task', [{
      pattern: 'Break complex tasks into smaller steps',
      context: 'Any multi-step task',
      successRate: 0.9,
      lastUsed: Date.now(),
      confidence: 0.8
    }]);
  }

  private async attemptRecovery(
    executionId: string,
    plan: AutonomousPlan,
    results: StepResult[],
    adaptation: any
  ): Promise<ExecutionResult> {
    console.log(`Attempting recovery for execution ${executionId}`);

    try {
      // 1. Analyze failure logic
      const failedStep = results.find(r => !r.success);
      const failureAnalysis = await this.analyzeFailure(plan, results);

      // 2. Determine strategy
      const strategy = adaptation.recoveryStrategy || await this.generateRecoveryStrategy(failureAnalysis, plan);

      console.log(`Recovery strategy: ${strategy}`);

      // 3. Re-plan with recovery context
      const recoveryTask = `Recover from failure in task "${plan.taskDescription}". Strategy: ${strategy}`;

      const recoveryContext: Partial<IntelligenceContext> = {
        previousAttempts: [{
          task: plan.taskDescription || 'Unknown Task',
          approach: plan.reasoning,
          success: false,
          duration: results.reduce((sum, r) => sum + r.duration, 0),
          error: failedStep?.error || 'Unknown error',
          learnings: this.extractLearnings(results),
          timestamp: Date.now()
        }],
        domainKnowledge: {
          'failure_analysis': failureAnalysis,
          'original_plan': JSON.stringify(plan.steps)
        }
      };

      // 4. Execute recovery plan (recursive but with new context)
      // We use a fresh engine instance or just re-call understandAndPlan to avoid state pollution?
      // Re-calling understandAndPlan is fine as it's stateless regarding execution, but stateful regarding learning.
      const recoveryPlan = await this.understandAndPlan(recoveryTask, recoveryContext);

      const recoveryResult = await this.executeWithAdaptation(recoveryPlan);

      // Merge results
      return {
        success: recoveryResult.success,
        executionId, // Keep original ID
        duration: recoveryResult.duration + results.reduce((sum, r) => sum + r.duration, 0),
        results: [...results, ...recoveryResult.results],
        learnings: [...this.extractLearnings(results), ...recoveryResult.learnings, `Recovery Strategy: ${strategy}`]
      };

    } catch (error) {
      return {
        success: false,
        executionId,
        duration: 0,
        error: `Recovery validation failed: ${error instanceof Error ? error.message : String(error)}`,
        results,
        learnings: ['Recovery attempted but failed to generate valid plan']
      };
    }
  }

  private async analyzeFailure(plan: AutonomousPlan, results: StepResult[]): Promise<string> {
    const failedStep = results.find(r => !r.success);
    const prompt = `
Analyze why this autonomous execution failed.

Task: "${plan.taskDescription}"
Plan context: ${plan.reasoning}

Failed Step: ${failedStep?.stepId} - ${failedStep?.error}

Execution Trace:
${results.map(r => `${r.stepId}: ${r.success ? 'OK' : 'FAIL'} (${r.duration}ms)`).join('\n')}

Identify:
1. Root cause
2. Why adaptation failed
3. Systemic issues vs transient errors

Return a concise analysis paragraph.`;

    return await this.callReasoningLLM(prompt);
  }

  private async generateRecoveryStrategy(analysis: string, plan: AutonomousPlan): Promise<string> {
    const prompt = `
Generate a high-level recovery strategy based on this failure analysis.

Task: "${plan.taskDescription}"
Analysis: ${analysis}

Suggest a fundamentally different approach or a way to bypass the blocker.
Return ONE clear strategy sentence.`;

    return await this.callReasoningLLM(prompt);
  }

  /**
   * Detects if a CAPTCHA is present on the current page to prevent bot-detection flags.
   */
  private async detectCaptcha(): Promise<boolean> {
    if (!this.callbacks?.executeAction) return false;

    // 1. Check for common CAPTCHA element patterns in the DOM via content script
    const checkResult = await this.callbacks.executeAction({
      type: 'extract',
      locator: { tag: 'body' }, // We just need to trigger a check
      description: 'Check for CAPTCHA patterns'
    } as any);

    const text = (checkResult.extractedData || '').toLowerCase();
    const captchaKeywords = [
      'g-recaptcha', 'cf-turnstile', 'h-captcha',
      'verify you are human', 'prove you are not a bot',
      'complete the puzzle', 'enter the characters'
    ];

    if (captchaKeywords.some(kw => text.includes(kw))) {
      return true;
    }

    return false;
  }
}

// ─── Interfaces for Execution Results ───────────────────────────────────

/**
 * Complete results from executing an autonomous plan.
 *
 * Contains detailed information about execution success, timing, step-by-step results,
 * and key learnings that can improve future executions.
 */
export interface ExecutionResult {
  /** Whether the overall execution was successful */
  success: boolean;
  /** Unique identifier for tracking this execution */
  executionId: string;
  /** Total time taken for the entire execution in milliseconds */
  duration: number;
  /** Detailed results for each step in the plan */
  results: StepResult[];
  /** Error message if execution failed */
  error?: string;
  /** Key insights and learnings from this execution */
  learnings: string[];
}

/**
 * Results from executing a single step in an autonomous plan.
 *
 * Provides detailed information about step execution, including success status,
 * timing, output data, and confidence metrics for analysis and learning.
 */
export interface StepResult {
  /** Unique identifier of the step that was executed */
  stepId: string;
  /** Whether this step executed successfully */
  success: boolean;
  /** Time taken to execute this step in milliseconds */
  duration: number;
  /** Output data produced by the step execution */
  output?: any;
  /** Error message if the step failed */
  error?: string;
  /** Confidence level in the step result (0.0 to 1.0) */
  confidence: number;
}

// ─── Global Intelligence Engine Instance ───────────────────────────────

/** Global instance of the autonomous intelligence engine for system-wide use */
export const autonomousIntelligence = new AutonomousIntelligenceEngine();

// ─── Convenience Functions ────────────────────────────────────────────

/**
 * Convenience function for simple autonomous task execution.
 *
 * Provides a high-level interface for executing tasks with the autonomous intelligence engine.
 * Automatically handles plan generation and execution with sensible defaults.
 *
 * @param task - Natural language description of the task to execute
 * @param context - Optional partial intelligence context for customization
 * @returns Detailed execution results with learnings and adaptations
 *
 * @example
 * ```typescript
 * const result = await thinkAndExecute(
 *   "Find the best coffee shops near my office",
 *   { availableTools: ['web_search', 'maps'] }
 * );
 *
 * if (result.success) {
 *   console.log(`Found ${result.results.length} coffee shops`);
 * }
 * ```
 */
export const thinkAndExecute = async (
  task: string,
  context?: Partial<IntelligenceContext>
): Promise<ExecutionResult> => {
  const plan = await autonomousIntelligence.understandAndPlan(task, context || {});
  return await autonomousIntelligence.executeWithAdaptation(plan);
};

// ─── Integration with Existing LLM Client ─────────────────────────────

/**
 * Integration module for connecting the autonomous intelligence engine
 * with the existing LLM client infrastructure.
 * 
 * NOTE: Circular dependency removed via dependency injection.
 * The LLM client must call autonomousIntelligence.setLLMClient(this)
 */
