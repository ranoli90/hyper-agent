import { llmClient } from './llmClient'; // Ensure singleton is used

export interface MemoryEntry {
    id: string;
    content: string;
    type: 'fact' | 'preference' | 'task_history';
    tags: string[];
    timestamp: number;
    confidence: number; // 0-1
    embedding?: number[]; // Vector embedding
}

export class MemoryManager {
    private static STORAGE_KEY = 'hyperagent_long_term_memory';
    private memories: MemoryEntry[] = [];
    private initialized = false;

    constructor() { }

    async initialize(): Promise<void> {
        if (this.initialized) return;
        const result = await chrome.storage.local.get(MemoryManager.STORAGE_KEY);
        this.memories = result[MemoryManager.STORAGE_KEY] || [];
        this.initialized = true;
        console.log(`[Memory] Initialized with ${this.memories.length} entries.`);
    }

    async addMemory(content: string, type: MemoryEntry['type'], tags: string[] = []): Promise<void> {
        await this.initialize();

        // Check for duplicates (exact match)
        if (this.memories.some(m => m.content === content && m.type === type)) return;

        // Generate embedding
        let embedding: number[] | undefined;
        try {
            embedding = await llmClient.getEmbedding(content);
        } catch (e) {
            console.warn('[Memory] Failed to generate embedding, falling back to keyword only.', e);
        }

        const entry: MemoryEntry = {
            id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            content,
            type,
            tags,
            timestamp: Date.now(),
            confidence: 1.0,
            embedding
        };

        this.memories.push(entry);
        await this.save();
        console.log(`[Memory] Added semantic memory: ${content}`);
    }

    /*
      Simple "Semantic" Search.
      In a real vector DB, this would be embeddings.
      Here, we use keyword matching + basic scoring.
    */
    async searchMemories(query: string, limit: number = 5): Promise<MemoryEntry[]> {
        await this.initialize();

        let queryEmbedding: number[] | undefined;
        try {
            queryEmbedding = await llmClient.getEmbedding(query);
        } catch (e) {
            console.warn('[Memory] Embedding failed for query, using keyword search.');
        }

        const scored = this.memories.map(mem => {
            let score = 0;

            // 1. Vector Similarity (Cosine Similarity)
            if (queryEmbedding && mem.embedding) {
                const dotProduct = queryEmbedding.reduce((sum, val, i) => sum + val * (mem.embedding![i] || 0), 0);
                // Assuming normalized embeddings from OpenAI, dot product is cosine similarity
                score += dotProduct * 100; // Scale up
            }

            // 2. Keyword Fallback/Boost
            const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 3);
            const contentLower = mem.content.toLowerCase();
            if (contentLower.includes(query.toLowerCase())) score += 20; // Exact phrase match
            queryTerms.forEach(term => {
                if (contentLower.includes(term)) score += 5;
            });

            // 3. Recency Bias
            const ageHours = (Date.now() - mem.timestamp) / (1000 * 60 * 60);
            score += Math.max(0, 5 - ageHours / 24); // Boost very recent

            return { mem, score };
        });

        return scored
            .filter(s => s.score > 70) // Threshold for relevance
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map(s => s.mem);
    }

    async retrieveContext(task: string): Promise<string> {
        const relevant = await this.searchMemories(task, 5);
        if (relevant.length === 0) return '';

        return `
Relevant Memories:
${relevant.map(m => `- [${m.type.toUpperCase()}] ${m.content}`).join('\n')}
`;
    }

    private async save(): Promise<void> {
        // Quota management: strict 500 items to avoid storage limits with embeddings
        if (this.memories.length > 500) {
            // Keep recent + important
            this.memories = this.memories
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, 500);
        }
        await chrome.storage.local.set({ [MemoryManager.STORAGE_KEY]: this.memories });
    }

    async clear(): Promise<void> {
        this.memories = [];
        await this.save();
    }

    /**
     * Synchronizes memory with the collective swarm wisdom.
     * Incorporates anonymized high-success patterns from other agents.
     */
    async syncWithSwarm(): Promise<void> {
        await this.initialize();
        const { globalLearning } = await import('./global-learning');

        console.log('[Memory] Synchronizing with collective swarm...');

        // This is a placeholder for fetching and merging global memories
        // In reality, we would fetch specialized "GlobalFact" or "GlobalSuccessPattern"
        // and add them as memories of type 'fact'

        await globalLearning.fetchGlobalWisdom();
    }
}

export const memoryManager = new MemoryManager();
