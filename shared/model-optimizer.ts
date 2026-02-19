import { loadSettings } from './config';

const SINGLE_MODEL = 'google/gemini-2.5-flash';

export class ModelOptimizer {
    static COMPLEX_KEYWORDS = [
        'reason', 'analyze', 'plan', 'solve', 'critique',
        'ethics', 'strategy', 'predict', 'complex'
    ];

    static async getOptimalModel(_taskDescription: string): Promise<string> {
        return SINGLE_MODEL;
    }

    static shouldEnableVision(actionDescription: string): boolean {
        const visionKeywords = ['look', 'see', 'find', 'visual', 'color', 'image', 'picture', 'screenshot', 'ui'];
        return visionKeywords.some(kw => actionDescription.toLowerCase().includes(kw));
    }
}
