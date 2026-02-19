import { LLMClientInterface } from './types';

export interface VisualElement {
    id: string;
    tag: string;
    text: string;
    attributes: Record<string, string>;
    isVisible: boolean;
    coordinates: { x: number; y: number; width: number; height: number };
    importanceScore: number;
    semanticRole: string; // e.g., 'submit_button', 'navigation_link', 'content_container'
}

export class VisualPerceptionEngine {
    private llmClient: LLMClientInterface;

    constructor(client: LLMClientInterface) {
        this.llmClient = client;
    }

    /**
     * Analyzes the page to identify interactive elements semantically.
     * Uses Computer Vision (via LLM) to "See" the page and identify elements by coordinates.
     */
    async perceivePage(htmlSnippet: string, screenshotBase64?: string): Promise<VisualElement[]> {
        const systemPrompt = `You are a Visual Perception Engine for a web agent.
Your job is to look at a webpage screenshot and the corresponding HTML snippet to identify key interactive elements.

Output a JSON array of elements that the user might want to interact with (buttons, links, inputs).
For each element, estimate its coordinates (x, y) relative to the viewport based on the visual layout.
IMPORTANT: You must correlate the visual element with its likely CSS selector.

Return format:
[
  {
    "id": "css_selector",
    "tag": "button",
    "text": "Submit",
    "semanticRole": "submit_button",
    "importanceScore": 0.9,
    "coordinates": { "x": 100, "y": 200 }
  }
]`;

        const userMessageContent: any[] = [
            { type: 'text', text: `Analyze this UI. HTML context: ${htmlSnippet.substring(0, 3000)}...` }
        ];

        if (screenshotBase64) {
            userMessageContent.push({
                type: 'image_url',
                image_url: {
                    url: `data:image/png;base64,${screenshotBase64}`,
                    detail: 'high'
                }
            });
        }

        try {
            const response = await this.llmClient.callCompletion({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessageContent }
                ],
                temperature: 0.1,
                maxTokens: 2000
            });

            // Parse JSON response safely
            const result = JSON.parse(response);
            const elements = Array.isArray(result) ? result : (result.elements || []);

            return elements.map((el: any) => ({
                ...el,
                isVisible: true,
                attributes: {},
                coordinates: el.coordinates || { x: 0, y: 0, width: 0, height: 0 }
            }));
        } catch (error) {
            console.error("Visual perception failed:", error);
            return [];
        }
    }

    /**
     * Determines if a UI change is significant enough to warrant re-planning.
     * Uses semantic role comparison to detect visibility of key elements.
     */
    detectVisualChange(oldSnapshot: VisualElement[], newSnapshot: VisualElement[]): boolean {
        if (Math.abs(oldSnapshot.length - newSnapshot.length) > 5) return true;

        const oldRoles = new Set(oldSnapshot.map(el => el.semanticRole));
        const newRoles = new Set(newSnapshot.map(el => el.semanticRole));

        // Check for new roles appearing (e.g., a modal or notification)
        for (const role of newRoles) {
            if (!oldRoles.has(role)) return true;
        }

        return false;
    }
}
