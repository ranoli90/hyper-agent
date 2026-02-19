import type { IntelligenceContext, ReasoningStep, SuccessPattern, RiskLevel } from './ai-types';
import type { LLMClientInterface } from './types';

export class ReasoningEngine {
    private llmClient: LLMClientInterface;

    constructor(llmClient: LLMClientInterface) {
        this.llmClient = llmClient;
    }

    async analyzeTask(context: IntelligenceContext): Promise<string[]> {
        const reasoning: string[] = [];

        // Step 1: Domain analysis
        const domain = await this.analyzeDomain(context.taskDescription);
        reasoning.push(`Domain identified: ${domain}`);

        // Step 2: Complexity assessment
        const complexity = await this.assessComplexity(context);
        reasoning.push(`Complexity level: ${complexity.level} (Reason: ${complexity.reasoning})`);

        // Step 3: Tree of Thoughts (Brainstorming & Selection)
        // Instead of just listing approaches, we brainstorm, critique, and select the best one.
        const bestStrategy = await this.performTreeOfThoughts(context);
        reasoning.push(`Selected Strategy: ${bestStrategy.strategy}`);
        reasoning.push(`Reasoning for selection: ${bestStrategy.reasoning}`);
        reasoning.push(`Confidence Score: ${bestStrategy.score}/10`);

        // Step 4: Risk evaluation (for the selected strategy)
        const risks = await this.evaluateRisks(context, [bestStrategy.strategy]);
        reasoning.push(`Primary risks: ${risks.map(r => `${r.type}(${r.probability}%)`).join(', ')}`);

        return reasoning;
    }

    /**
     * Tree of Thoughts Implementation
     * 1. Generate multiple varied approaches (Thoughts)
     * 2. Evaluate/Critique each thought
     * 3. Select the best one
     */
    private async performTreeOfThoughts(context: IntelligenceContext): Promise<{ strategy: string; reasoning: string; score: number }> {
        console.log("[Reasoning] Starting Tree of Thoughts...");

        // 1. Brainstorm
        const approachesPrompt = `
Task: "${context.taskDescription}"
Tools: ${context.availableTools.join(', ')}

Brainstorm 3 distinct, high-level strategies to solve this.
- Strategy A: Fast/Direct approach
- Strategy B: Robust/Comprehensive approach (using verification)
- Strategy C: Creative/Alternative approach

Return format:
A|Description of A
B|Description of B
C|Description of C`;

        const brainstormResponse = await this.callReasoningLLM(approachesPrompt);
        const strategies = brainstormResponse.split('\n')
            .filter(line => line.includes('|'))
            .map(line => {
                const [id, desc] = line.split('|');
                return { id: id?.trim(), desc: desc?.trim() };
            });

        if (strategies.length === 0) {
            return { strategy: "Direct Execution", reasoning: "Fallback: brainstorming failed.", score: 5 };
        }

        // 2. Evaluate
        let bestStrategy = strategies[0];
        let bestScore = -1;
        let bestReasoning = "";

        for (const strat of strategies) {
            const evalPrompt = `
Task: "${context.taskDescription}"
Strategy: "${strat.desc}"

Evaluate this strategy.
- Feasibility (0-10)
- Risk of failure (0-10)
- Efficiency (0-10)

Output a single Overall Score (0-10) and a brief critique.
Format: SCORE|CRITIQUE`;

            const evalResponse = await this.callReasoningLLM(evalPrompt);
            const [scoreStr, critique] = evalResponse.split('|');
            const score = parseInt(scoreStr) || 0;

            console.log(`[Reasoning] Strategy ${strat.id} Score: ${score}. Critique: ${critique}`);

            if (score > bestScore) {
                bestScore = score;
                bestStrategy = strat;
                bestReasoning = critique;
            }
        }

        return {
            strategy: bestStrategy.desc || "Standard Approach",
            reasoning: bestReasoning || "Selected based on highest evaluation score.",
            score: bestScore
        };
    }

    private async callReasoningLLM(prompt: string): Promise<string> {
        // Use callCompletion API which accepts messages directly
        const response = await this.llmClient.callCompletion({
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.5,
            maxTokens: 1000
        });

        return response || '';
    }

    private async analyzeDomain(task: string): Promise<string> {
        const prompt = `
Analyze this task and determine the primary domain.
Task: "${task}"
Return only the domain name.`;
        return (await this.callReasoningLLM(prompt)).trim();
    }

    private async assessComplexity(context: IntelligenceContext): Promise<{ level: string; reasoning: string }> {
        const prompt = `
Assess complexity (1-10) for: "${context.taskDescription}"
Tools: ${context.availableTools.join(', ')}
Return format: LEVEL|REASONING`;
        const response = await this.callReasoningLLM(prompt);
        const [level, reasoning] = response.split('|');
        return { level: level?.trim() || '5', reasoning: reasoning?.trim() || 'Moderate' };
    }

    private async identifyApproaches(context: IntelligenceContext): Promise<string[]> {
        // Deprecated by performTreeOfThoughts, but kept for interface if needed
        return [];
    }

    private async evaluateRisks(context: IntelligenceContext, approaches: string[]): Promise<Array<{ type: string; probability: number }>> {
        const prompt = `
Evaluate risks for this strategy:
${approaches[0]}
Return format: RISK_TYPE|PROBABILITY%`;
        const response = await this.callReasoningLLM(prompt);
        return response.split('\n').map(line => {
            const [type, prob] = line.split('|');
            return { type: type?.trim() || 'UNKNOWN', probability: parseInt(prob) || 0 };
        });
    }
}
