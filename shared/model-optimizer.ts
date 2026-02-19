import { loadSettings } from './config';

/**
 * Intelligent Model Selector
 * 
 * Optimizes AI cost by selecting the most cost-effective model for each task.
 * High-complexity tasks get the "Pro" models, while routine extraction 
 * uses high-speed "Flash" or "Mini" models.
 */
export class ModelOptimizer {
    private static COMPLEX_KEYWORDS = [
        'reason', 'analyze', 'plan', 'solve', 'critique',
        'ethics', 'strategy', 'predict', 'complex'
    ];

    /**
     * Selects the most efficient AI model based on the complexity of the task description.
     * 
     * @param taskDescription - A string describing the task the agent needs to perform.
     * @returns The ID of the optimal model to use (e.g., 'gemini-1.5-pro' for complex tasks).
     */
    static async getOptimalModel(taskDescription: string): Promise<string> {
        const settings = await loadSettings();
        const desc = taskDescription.toLowerCase();

        // If user has forced a specific model, respect it
        if (settings.modelName && settings.modelName !== 'auto') {
            return settings.modelName;
        }

        // Logic to determine if task is "Expensive/Pro" or "Cheap/Flash"
        const isComplex = this.COMPLEX_KEYWORDS.some(kw => desc.includes(kw)) || taskDescription.length > 200;

        if (isComplex) {
            // Return high-intelligence model (e.g. Gemini 1.5 Pro)
            return 'gemini-1.5-pro';
        } else {
            // Return high-speed/low-cost model (e.g. Gemini 1.5 Flash or GPT-4o-mini)
            return 'gemini-1.5-flash';
        }
    }

    /**
     * Determines if vision is required for a specific action.
     * Prevents expensive vision-tokens on text-only pages.
     */
    static shouldEnableVision(actionDescription: string): boolean {
        const visionKeywords = ['look', 'see', 'find', 'visual', 'color', 'image', 'picture', 'screenshot', 'ui'];
        return visionKeywords.some(kw => actionDescription.toLowerCase().includes(kw));
    }
}
