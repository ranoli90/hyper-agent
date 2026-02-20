// ─── Context Management Types ────────────────────────────────────────
export interface ContextItem {
  type: 'action' | 'result' | 'error' | 'thought' | 'system';
  content: string;
  timestamp: number;
  importance: number;  // 0-10
  tokens: number;
}

export interface ContextWindow {
  items: ContextItem[];
  totalTokens: number;
  maxTokens: number;
}

// Default max tokens for context window
const DEFAULT_MAX_TOKENS = 60000;

// Approximate tokens per character (conservative estimate)
const TOKENS_PER_CHAR = 4;

// ─── Context Manager Class ───────────────────────────────────────────────
export class ContextManager {
  private items: ContextItem[] = [];
  private maxTokens: number;

  constructor(maxTokens: number = DEFAULT_MAX_TOKENS) {
    this.maxTokens = maxTokens;
  }

  // Calculate approximate token count for content
  private calculateTokens(content: string): number {
    return Math.ceil(content.length / TOKENS_PER_CHAR);
  }

  // Add a new context item
  addContextItem(item: Omit<ContextItem, 'tokens'>): void {
    const tokens = this.calculateTokens(item.content);
    const newItem: ContextItem = {
      ...item,
      tokens,
    };
    this.items.push(newItem);
    this.compressOldItems();
  }

  // Get context items optimized for LLM within token budget
  getContextForLLM(maxTokens: number): ContextItem[] {
    // First, prioritize recent items
    const recentItems = this.prioritizeRecent(maxTokens);
    
    // Then fill with important items
    const importantItems = this.items
      .filter(item => !recentItems.includes(item))
      .sort((a, b) => b.importance - a.importance);
    
    let currentTokens = recentItems.reduce((sum, item) => sum + item.tokens, 0);
    const result: ContextItem[] = [...recentItems];
    
    for (const item of importantItems) {
      if (currentTokens + item.tokens <= maxTokens) {
        result.push(item);
        currentTokens += item.tokens;
      } else {
        break;
      }
    }
    
    // Sort by timestamp to maintain chronological order
    return result.sort((a, b) => a.timestamp - b.timestamp);
  }

  // Compress old items to save tokens
  compressOldItems(): void {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    
    for (const item of this.items) {
      // Skip high-importance items
      if (item.importance >= 8) continue;
      
      // Skip recent items
      if (item.timestamp > oneHourAgo) continue;
      
      // Compress by summarizing (simple truncation for now)
      if (item.content.length > 200) {
        item.content = item.content.slice(0, 200) + '... [compressed]';
        item.tokens = this.calculateTokens(item.content);
      }
    }
  }

  // Prioritize recent items within token budget
  prioritizeRecent(maxTokens: number): ContextItem[] {
    // Sort by timestamp (most recent first)
    const sorted = [...this.items].sort((a, b) => b.timestamp - a.timestamp);
    
    const result: ContextItem[] = [];
    let currentTokens = 0;
    
    for (const item of sorted) {
      if (currentTokens + item.tokens <= maxTokens) {
        result.push(item);
        currentTokens += item.tokens;
      } else {
        break;
      }
    }
    
    return result;
  }

  // Clear old items based on age
  clearOldItems(olderThanMs: number): number {
    const cutoff = Date.now() - olderThanMs;
    const beforeCount = this.items.length;
    this.items = this.items.filter(item => item.timestamp > cutoff);
    return beforeCount - this.items.length;
  }

  // Get current context window state
  getContextWindow(): ContextWindow {
    return {
      items: [...this.items],
      totalTokens: this.items.reduce((sum, item) => sum + item.tokens, 0),
      maxTokens: this.maxTokens,
    };
  }

  // Set max tokens
  setMaxTokens(maxTokens: number): void {
    this.maxTokens = maxTokens;
    this.compressOldItems();
  }

  // Clear all items
  clear(): void {
    this.items = [];
  }

  // Get item count
  get itemCount(): number {
    return this.items.length;
  }
}

// ─── Singleton instance for global use ───────────────────────────────────
let globalContextManager: ContextManager | null = null;

export function getContextManager(maxTokens?: number): ContextManager {
  if (!globalContextManager) {
    globalContextManager = new ContextManager(maxTokens);
  }
  return globalContextManager;
}

export function resetContextManager(): void {
  globalContextManager = null;
}
