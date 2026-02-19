interface AutonomousCallbacks {
    onProgress: (status: string, step: string, summary: string) => void;
    onAskUser: (question: string) => Promise<string>;
    onConfirmActions: (actions: any[], step: number, summary: string) => Promise<boolean>;
    executeAction: (action: any) => Promise<any>;
    captureScreenshot: () => Promise<string>;
    onDone: (summary: string, success: boolean) => void;
}

interface AutonomousPlan {
    steps: any[];
    actions: any[];
    reasoning: string;
    summary: string;
    needsScreenshot: boolean;
    done: boolean;
    askUser?: string;
}

interface AutonomousResult {
    success: boolean;
    results: any[];
    learnings: string[];
    error?: string;
}

export const autonomousIntelligence = {
    analyze: () => { },
    setLLMClient: (_client: any) => { },
    understandAndPlan: async (_cmd: string, _ctx?: any): Promise<AutonomousPlan> => ({
        steps: [], actions: [], reasoning: '', summary: '', needsScreenshot: false, done: false, askUser: undefined
    }),
    setCallbacks: (_callbacks: AutonomousCallbacks) => { },
    executeWithAdaptation: async (_plan: AutonomousPlan): Promise<AutonomousResult> => ({
        success: true, results: [], learnings: [], error: undefined
    }),
};