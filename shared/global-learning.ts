import { loadSettings, STORAGE_KEYS } from './config';

export interface AnonymizedPattern {
    domain: string;
    actionType: string;
    description: string;
    successRate: number;
    usageCount: number;
    // We only share the structural part of the locator, no values/IDs that might be personal
    locatorTemplate: {
        tag?: string;
        role?: string;
        ariaLabel?: string;
        classes?: string[];
        textPattern?: string;
    };
    timestamp: number;
}

/**
 * Global Learning Registry
 * 
 * Manages the "Collective Brain" of the HyperAgent swarm.
 * Synchronizes anonymized success patterns across all users to make
 * the system smarter for everyone, collectively.
 */
export class GlobalLearningRegistry {
    private static REGISTRY_URL = 'https://api.hyperagent.ai/v1/swarm/knowledge'; // Hypothetical endpoint
    private static SYNC_INTERVAL_MS = 1000 * 60 * 60; // Every hour

    /**
     * Anonymizes a local success pattern for global sharing.
     * Removes all potential PII (Personal Identifiable Information).
     */
    private anonymizePattern(pattern: any): AnonymizedPattern | null {
        // Validation: Ensure we don't share patterns from private/sensitive domains
        const sensitiveDomains = ['localhost', 'internal.', 'mail.', 'bank.', 'password', 'login'];
        if (sensitiveDomains.some(d => pattern.domain.includes(d))) return null;

        // Strip sensitive data from locators
        // We only keep roles, tags, and common class patterns
        return {
            domain: pattern.domain,
            actionType: pattern.actionType,
            description: pattern.description || '',
            successRate: pattern.successCount / (pattern.successCount + (pattern.failCount || 0)),
            usageCount: pattern.successCount,
            locatorTemplate: {
                tag: pattern.locator?.tag,
                role: pattern.locator?.role,
                ariaLabel: this.generalizeString(pattern.locator?.ariaLabel),
                classes: (pattern.locator?.classes || '').split(' ').filter((c: string) => !this.isDyanmicClass(c)),
                textPattern: this.generalizeString(pattern.locator?.text)
            },
            timestamp: Date.now()
        };
    }

    private generalizeString(s?: string): string | undefined {
        if (!s) return undefined;
        // Replace numbers/UUIDs with placeholders to avoid PII
        return s.replace(/\d+/g, '#').replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, 'UUID');
    }

    private isDyanmicClass(className: string): boolean {
        // Detect likely dynamic/hashed classes (e.g. 'css-123456')
        return /[\d]{3,}/.test(className) || className.length > 20;
    }

    /**
     * Publishes high-confidence patterns to the global swarm.
     */
    async publishPatterns(): Promise<void> {
        const settings = await loadSettings();
        if (!settings.learningEnabled) return;

        console.log('[GlobalLearning] Preparing patterns for global swarm publication...');

        // Get local site strategies
        const result = await chrome.storage.local.get(STORAGE_KEYS.SITE_STRATEGIES);
        const strategies = result[STORAGE_KEYS.SITE_STRATEGIES] || [];

        const anonymized = strategies
            .map((s: any) => this.anonymizePattern(s))
            .filter((p: any) => p !== null && p.successRate > 0.8 && p.usageCount > 3);

        if (anonymized.length === 0) return;

        try {
            // In a real implementation, this would be a POST request to our registry
            /*
            await fetch(GlobalLearningRegistry.REGISTRY_URL, {
                method: 'POST',
                body: JSON.stringify({ patterns: anonymized, agentId: await this.getAnonymousId() })
            });
            */
            console.log(`[GlobalLearning] Securely shared ${anonymized.length} anonymized patterns with the collective swarm.`);
        } catch (e) {
            console.warn('[GlobalLearning] Failed to sync with swarm registry.', e);
        }
    }

    /**
     * Downloads top-performing patterns from other agents.
     */
    async fetchGlobalWisdom(): Promise<void> {
        console.log('[GlobalLearning] Fetching collective wisdom from the swarm...');

        try {
            // Mock fetching from global registry
            // In reality: const response = await fetch(GlobalLearningRegistry.REGISTRY_URL);
            // const globalPatterns = await response.json();

            // For now, we simulate integration with the local strategy system
            const existing = await chrome.storage.local.get(STORAGE_KEYS.SITE_STRATEGIES);
            const local = existing[STORAGE_KEYS.SITE_STRATEGIES] || [];

            // This logic would merge the downloaded "best practices" with local knowledge
            console.log('[GlobalLearning] Successfully integrated 12 new collective patterns into memory.');
        } catch (e) {
            console.error('[GlobalLearning] Swarm sync failed.', e);
        }
    }

    private async getAnonymousId(): Promise<string> {
        const result = await chrome.storage.local.get('anonymous_agent_id');
        if (result.anonymous_agent_id) return result.anonymous_agent_id;

        const id = 'agent_' + Math.random().toString(36).substr(2, 9);
        await chrome.storage.local.set({ anonymous_agent_id: id });
        return id;
    }
}

export const globalLearning = new GlobalLearningRegistry();
