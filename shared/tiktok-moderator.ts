import { autonomousIntelligence } from './autonomous-intelligence';

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface ModerationRule {
    id: string;
    name: string;
    type: 'regex' | 'keyword' | 'semantic' | 'user_whitelist' | 'user_blacklist';
    value: string; // Regex pattern, keyword, or semantic description
    action: 'delete' | 'ban' | 'mute' | 'report';
    enabled: boolean;
}

export interface TikTokComment {
    id: string;
    username: string;
    text: string;
    timestamp: number;
    elementSelector: string; // Store selector instead of DOM reference (Issue #127)
}

export interface ModerationLog {
    commentId: string;
    username: string;
    text: string;
    actionTaken: string;
    ruleId: string;
    timestamp: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────
const MAX_LOG_ENTRIES = 100; // Limit log size (Issue #129)
const SEMANTIC_RATE_LIMIT_MS = 2000;

// ─── Stream Observer ────────────────────────────────────────────────────────

/**
 * Efficiently watches the DOM for new TikTok comments using MutationObserver.
 */
export class StreamObserver {
    private observer: MutationObserver | null = null;
    private onCommentDetected: (comment: TikTokComment) => void;
    private isObserving: boolean = false;
    private chatContainerSelector: string = '.tiktok-chat-messages'; // Example selector, needs verification
    private commentSelector: string = '.tiktok-chat-item'; // Example selector

    constructor(onCommentDetected: (comment: TikTokComment) => void) {
        this.onCommentDetected = onCommentDetected;
    }

    start(containerElement: Element): void {
        if (this.isObserving) return;

        this.observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node instanceof HTMLElement) {
                            this.processNode(node);
                        }
                    });
                }
            }
        });

        this.observer.observe(containerElement, { childList: true, subtree: true });
        this.isObserving = true;
        console.log('[TikTokModerator] Stream observer started');
    }

    stop(): void {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        this.isObserving = false;
        console.log('[TikTokModerator] Stream observer stopped');
    }

    private processNode(node: HTMLElement): void {
        // Simple check - in reality, we'd check classes or attributes
        // This is a placeholder for the actual extraction logic
        const usernameEl = node.querySelector('.unique-id'); // Placeholder class
        const textEl = node.querySelector('.comment-text');   // Placeholder class

        if (usernameEl && textEl) {
            // Generate unique selector for the element (Issue #127)
            const elementSelector = this.generateSelector(node);
            const comment: TikTokComment = {
                id: node.getAttribute('data-id') || Date.now().toString(),
                username: usernameEl.textContent || 'Unknown',
                text: textEl.textContent || '',
                timestamp: Date.now(),
                elementSelector
            };
            this.onCommentDetected(comment);
        }
    }

    private generateSelector(element: HTMLElement): string {
        if (element.id) return `#${element.id}`;
        const path: string[] = [];
        let current: HTMLElement | null = element;
        while (current && current.tagName !== 'HTML') {
            let selector = current.tagName.toLowerCase();
            if (current.className && typeof current.className === 'string') {
                const classes = current.className.split(' ').filter(c => c).slice(0, 2).join('.');
                if (classes) selector += '.' + classes;
            }
            path.unshift(selector);
            current = current.parentElement;
        }
        return path.join(' > ');
    }
}

// ─── Moderation Engine ──────────────────────────────────────────────────────

export class ModerationEngine {
    private rules: ModerationRule[] = [];

    constructor(rules: ModerationRule[]) {
        this.rules = rules.filter(r => r.enabled);
    }

    updateRules(rules: ModerationRule[]): void {
        this.rules = rules.filter(r => r.enabled);
    }

    async evaluate(comment: TikTokComment): Promise<ModerationRule | null> {
        for (const rule of this.rules) {
            const isMatch = await this.checkRule(comment, rule);
            if (isMatch) {
                return rule;
            }
        }
        return null;
    }

    private async checkRule(comment: TikTokComment, rule: ModerationRule): Promise<boolean> {
        switch (rule.type) {
            case 'keyword':
                return comment.text.toLowerCase().includes(rule.value.toLowerCase());

            case 'regex':
                try {
                    const regex = new RegExp(rule.value, 'i');
                    return regex.test(comment.text);
                } catch (e) {
                    console.error(`Invalid regex rule ${rule.id}:`, e);
                    return false;
                }

            case 'user_blacklist':
                return comment.username.toLowerCase() === rule.value.toLowerCase();

            case 'user_whitelist':
                // Logic is inverted for whitelist usually, but here we check if a rule matches to take action.
                // A "Whitelisted" rule usually means "Do NOT moderate".
                // Typically, whitelist acts as a bypass. 
                // For now, let's assume this rule type checks if user IS in blacklist.
                return false;

            case 'semantic':
                // Delegate to AI for semantic analysis
                // This is expensive, so we might want to batch or rate limit
                return await this.checkSemanticRule(comment, rule);

            default:
                return false;
        }
    }

    private async checkSemanticRule(comment: TikTokComment, rule: ModerationRule): Promise<boolean> {
        await new Promise(resolve => globalThis.setTimeout(resolve, SEMANTIC_RATE_LIMIT_MS));

        const prompt = `
    Analyze this TikTok comment against the following rule.
    Rule: "${rule.value}"
    Comment: "${comment.text}"
    
    Return TRUE if the comment violates the rule, FALSE otherwise.
    `;

        try {
            const response = await autonomousIntelligence.askReasoning(prompt);
            return response.trim().toLowerCase().includes('true');
        } catch (error) {
            console.error('Semantic check failed:', error);
            return false;
        }
    }
}

// ─── Main Controller ────────────────────────────────────────────────────────

export class TikTokModerator {
    private observer: StreamObserver;
    private engine: ModerationEngine;
    private isRunning: boolean = false;
    private logs: ModerationLog[] = [];
    private stats = {
        checked: 0,
        actions: 0
    };

    constructor() {
        this.engine = new ModerationEngine([]);
        this.observer = new StreamObserver(this.handleComment.bind(this));
    }

    setRules(rules: ModerationRule[]): void {
        this.engine.updateRules(rules);
    }

    async start(): Promise<boolean> {
        // 1. Find the chat container
        // In a real scenario, we might use the VisualPerceptionEngine to find this dynamically!
        // For now, we'll try a few known selectors or ask the user to point it out.
        const container = document.querySelector('.tiktok-chat-messages') || document.body; // Fallback to body for testing

        if (!container) {
            console.error('TikTok chat container not found');
            return false;
        }

        this.observer.start(container);
        this.isRunning = true;
        this.notifyUI('TikTok Moderator started');
        return true;
    }

    stop(): void {
        this.observer.stop();
        this.isRunning = false;
        this.notifyUI('TikTok Moderator stopped');
    }

    private async handleComment(comment: TikTokComment): Promise<void> {
        console.log(`[TikTokModerator] New comment from ${comment.username}: ${comment.text}`);
        this.stats.checked++;
        this.sendStats();

        const violatedRule = await this.engine.evaluate(comment);

        if (violatedRule) {
            console.warn(`[TikTokModerator] Violation detected! Rule: ${violatedRule.name}`);
            await this.executeAction(comment, violatedRule);
        }
    }

    private async executeAction(comment: TikTokComment, rule: ModerationRule): Promise<void> {
        // Execute the moderation action (Delete, Ban, etc.)
        // This would involve finding the "options" button on the comment element, clicking it,
        // and then clicking the appropriate action in the menu.

        console.log(`[TikTokModerator] Executing logic for ${rule.action} on comment ${comment.id}`);

        // Placeholder for DOM interaction
        // await visualPerception.click(comment.element, 'More options');
        // await visualPerception.click(menu, rule.action);

        this.stats.actions++;
        this.sendStats();

        const log = {
            commentId: comment.id,
            username: comment.username,
            text: comment.text,
            actionTaken: rule.action,
            ruleId: rule.id,
            timestamp: Date.now()
        };
        this.logs.push(log);
        if (this.logs.length > MAX_LOG_ENTRIES) {
            this.logs.shift();
        }
        this.sendLog(log);
    }

    getLogs(): ModerationLog[] {
        return this.logs;
    }

    private sendStats() {
        chrome.runtime.sendMessage({
            type: 'moderatorStats',
            stats: this.stats
        }).catch(() => {
            // Ignore if sidepanel is closed
        });
    }

    private sendLog(log: ModerationLog) {
        chrome.runtime.sendMessage({
            type: 'moderationLog',
            log: log
        }).catch(() => {
            // Ignore if sidepanel is closed
        });
    }

    private notifyUI(_message: string) {
        // Optional: send status update
    }
}

export const tiktokModerator = new TikTokModerator();
