import type { Action, PageContext, LLMClientInterface, ActionResult } from './types';

export interface TestDiscoveryResult {
  suggestedTests: SuggestedTest[];
  coverage: CoverageAnalysis;
  priority: PrioritizedTest[];
}

export interface SuggestedTest {
  id: string;
  name: string;
  description: string;
  actions: Action[];
  rationale: string;
  confidence: number;
  category: string;
  estimatedDuration: number;
}

export interface CoverageAnalysis {
  coveredElements: number;
  totalElements: number;
  coveredPaths: number;
  totalPaths: number;
  coveragePercent: number;
  gaps: CoverageGap[];
}

export interface CoverageGap {
  element: string;
  type: string;
  reason: string;
  suggestedAction: string;
}

export interface PrioritizedTest {
  testId: string;
  name: string;
  priority: number;
  riskScore: number;
  reason: string;
}

export interface AdaptiveExecutionConfig {
  maxRetries: number;
  adaptiveTimeout: boolean;
  healLocators: boolean;
  learnFromFailures: boolean;
  parallelExecution: boolean;
}

export interface ExecutionAdaptation {
  type: 'retry' | 'locator_heal' | 'timeout_adjust' | 'strategy_change' | 'skip';
  originalAction: Action;
  adaptedAction?: Action;
  reason: string;
  confidence: number;
}

export interface SelfHealingResult {
  originalLocator: any;
  healedLocator: any;
  confidence: number;
  strategy: string;
  success: boolean;
}

export interface TestMaintenanceAction {
  type: 'update_locator' | 'update_assertion' | 'update_value' | 'remove_step' | 'add_step';
  testId: string;
  stepIndex?: number;
  oldValue?: any;
  newValue?: any;
  reason: string;
  automated: boolean;
}

export class IntelligentTestDiscovery {
  private llmClient: LLMClientInterface | null = null;

  setLLMClient(client: LLMClientInterface): void {
    this.llmClient = client;
  }

  analyzePageForTests(context: PageContext): TestDiscoveryResult {
    const suggestedTests: SuggestedTest[] = [];
    const gaps: CoverageGap[] = [];

    const interactiveElements = context.semanticElements.filter(el =>
      ['button', 'a', 'input', 'select', 'textarea'].includes(el.tag) ||
      ['button', 'link', 'textbox', 'checkbox', 'radio', 'combobox'].includes(el.role)
    );

    const forms = context.semanticElements.filter(el => el.tag === 'form');
    const buttons = context.semanticElements.filter(el => el.tag === 'button' || el.role === 'button');
    const links = context.semanticElements.filter(el => el.tag === 'a' && el.href);
    const inputs = context.semanticElements.filter(el =>
      el.tag === 'input' || el.tag === 'textarea' || el.tag === 'select'
    );

    if (buttons.length > 0) {
      for (const button of buttons.slice(0, 5)) {
        suggestedTests.push({
          id: `disc_btn_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          name: `Test button: ${button.visibleText || button.ariaLabel || 'Unknown'}`,
          description: `Verify button "${button.visibleText}" responds to clicks correctly`,
          actions: [{
            type: 'click',
            locator: this.bestLocator(button),
            description: `Click ${button.visibleText || button.ariaLabel || 'button'}`,
          }],
          rationale: 'Interactive button should be testable',
          confidence: 0.7,
          category: 'interaction',
          estimatedDuration: 2000,
        });
      }
    }

    if (inputs.length > 0) {
      const formTest: SuggestedTest = {
        id: `disc_form_${Date.now()}`,
        name: `Test form with ${inputs.length} inputs`,
        description: 'Fill and validate form inputs',
        actions: inputs.slice(0, 5).map(input => ({
          type: 'fill' as const,
          locator: this.bestLocator(input),
          value: this.suggestValue(input),
          clearFirst: true,
          description: `Fill ${input.name || input.ariaLabel || 'input'}`,
        })),
        rationale: `Form has ${inputs.length} inputs to test`,
        confidence: 0.75,
        category: 'form',
        estimatedDuration: 5000,
      };
      suggestedTests.push(formTest);
    }

    if (links.length > 0) {
      for (const link of links.slice(0, 3)) {
        suggestedTests.push({
          id: `disc_nav_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          name: `Navigate: ${link.visibleText || 'Link'}`,
          description: `Test navigation via "${link.visibleText}"`,
          actions: [{
            type: 'click',
            locator: this.bestLocator(link),
            description: `Click "${link.visibleText || 'link'}"`,
          }],
          rationale: 'Navigation links should work correctly',
          confidence: 0.65,
          category: 'navigation',
          estimatedDuration: 3000,
        });
      }
    }

    for (const el of interactiveElements) {
      if (!el.ariaLabel && !el.visibleText && !el.id) {
        gaps.push({
          element: `${el.tag}[index=${el.index}]`,
          type: 'unlabeled_element',
          reason: 'Element lacks accessible label',
          suggestedAction: 'Add aria-label or visible text',
        });
      }
    }

    const coveredElements = interactiveElements.filter(el => el.ariaLabel || el.visibleText || el.id).length;

    return {
      suggestedTests,
      coverage: {
        coveredElements,
        totalElements: interactiveElements.length,
        coveredPaths: suggestedTests.length,
        totalPaths: Math.max(suggestedTests.length, interactiveElements.length),
        coveragePercent: interactiveElements.length > 0 ? (coveredElements / interactiveElements.length) * 100 : 100,
        gaps,
      },
      priority: suggestedTests.map((t, i) => ({
        testId: t.id,
        name: t.name,
        priority: Math.max(1, 10 - i),
        riskScore: t.confidence * 10,
        reason: t.rationale,
      })),
    };
  }

  private bestLocator(element: any): any {
    if (element.id) return { strategy: 'id', value: element.id };
    if (element.ariaLabel) return { strategy: 'ariaLabel', value: element.ariaLabel };
    if (element.visibleText) return { strategy: 'text', value: element.visibleText };
    return { strategy: 'index', value: String(element.index) };
  }

  private suggestValue(element: any): string {
    switch (element.type) {
      case 'email': return 'test@example.com';
      case 'tel': return '(555) 000-1234';
      case 'number': return '42';
      case 'url': return 'https://example.com';
      case 'password': return 'TestPass123!';
      case 'date': return '2025-06-15';
      case 'search': return 'test query';
      default: return 'Test Input';
    }
  }
}

export class AdaptiveTestExecution {
  private config: AdaptiveExecutionConfig;
  private adaptationHistory: ExecutionAdaptation[] = [];
  private healingCache: Map<string, SelfHealingResult> = new Map();

  constructor(config?: Partial<AdaptiveExecutionConfig>) {
    this.config = {
      maxRetries: config?.maxRetries ?? 3,
      adaptiveTimeout: config?.adaptiveTimeout ?? true,
      healLocators: config?.healLocators ?? true,
      learnFromFailures: config?.learnFromFailures ?? true,
      parallelExecution: config?.parallelExecution ?? false,
    };
  }

  async executeWithAdaptation(
    action: Action,
    executor: (action: Action) => Promise<ActionResult>,
    context?: PageContext
  ): Promise<{ result: ActionResult; adaptations: ExecutionAdaptation[] }> {
    const adaptations: ExecutionAdaptation[] = [];
    let currentAction = action;
    let result: ActionResult = { success: false, error: 'Not executed' };

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      result = await executor(currentAction);

      if (result.success) break;

      if (attempt < this.config.maxRetries) {
        const adaptation = this.adaptAction(currentAction, result, context, attempt);
        if (adaptation) {
          adaptations.push(adaptation);
          if (adaptation.adaptedAction) {
            currentAction = adaptation.adaptedAction;
          }
          if (adaptation.type === 'skip') break;
        }

        await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt)));
      }
    }

    this.adaptationHistory.push(...adaptations);
    if (this.adaptationHistory.length > 500) {
      this.adaptationHistory = this.adaptationHistory.slice(-250);
    }

    return { result, adaptations };
  }

  healLocator(action: Action, context: PageContext): SelfHealingResult | null {
    if (!('locator' in action)) return null;

    const locator = (action as any).locator;
    const cacheKey = JSON.stringify(locator);
    const cached = this.healingCache.get(cacheKey);
    if (cached?.success) return cached;

    const description = (action as any).description || '';
    const elements = context.semanticElements;

    if (description) {
      const keywords = description.toLowerCase().split(/\s+/);
      for (const element of elements) {
        const elementText = `${element.visibleText} ${element.ariaLabel} ${element.name}`.toLowerCase();
        const matchScore = keywords.filter((kw: string) => elementText.includes(kw)).length / keywords.length;

        if (matchScore > 0.5) {
          const result: SelfHealingResult = {
            originalLocator: locator,
            healedLocator: this.buildLocator(element),
            confidence: matchScore,
            strategy: 'text_similarity',
            success: true,
          };
          this.healingCache.set(cacheKey, result);
          return result;
        }
      }
    }

    if (locator && typeof locator === 'object' && locator.value) {
      const originalText = locator.value.toLowerCase();
      let bestMatch: any = null;
      let bestScore = 0;

      for (const element of elements) {
        const texts = [element.visibleText, element.ariaLabel, element.name, element.placeholder].filter(Boolean);
        for (const text of texts) {
          const score = this.similarityScore(originalText, text.toLowerCase());
          if (score > bestScore && score > 0.3) {
            bestScore = score;
            bestMatch = element;
          }
        }
      }

      if (bestMatch) {
        const result: SelfHealingResult = {
          originalLocator: locator,
          healedLocator: this.buildLocator(bestMatch),
          confidence: bestScore,
          strategy: 'fuzzy_match',
          success: true,
        };
        this.healingCache.set(cacheKey, result);
        return result;
      }
    }

    return null;
  }

  getAdaptationHistory(): ExecutionAdaptation[] {
    return [...this.adaptationHistory];
  }

  getHealingStats(): { total: number; successful: number; successRate: number } {
    const results = Array.from(this.healingCache.values());
    const successful = results.filter(r => r.success).length;
    return {
      total: results.length,
      successful,
      successRate: results.length > 0 ? successful / results.length : 0,
    };
  }

  private adaptAction(action: Action, result: ActionResult, context?: PageContext, attempt?: number): ExecutionAdaptation | null {
    if (result.errorType === 'ELEMENT_NOT_FOUND' && this.config.healLocators && context) {
      const healed = this.healLocator(action, context);
      if (healed?.success) {
        const adaptedAction = { ...action } as any;
        adaptedAction.locator = healed.healedLocator;
        return {
          type: 'locator_heal',
          originalAction: action,
          adaptedAction,
          reason: `Healed locator using ${healed.strategy}`,
          confidence: healed.confidence,
        };
      }
    }

    if (result.errorType === 'TIMEOUT' && this.config.adaptiveTimeout) {
      return {
        type: 'timeout_adjust',
        originalAction: action,
        adaptedAction: action,
        reason: 'Increasing timeout due to slow response',
        confidence: 0.6,
      };
    }

    if (result.errorType === 'ELEMENT_NOT_VISIBLE') {
      const scrollAction: Action = {
        type: 'scroll',
        direction: 'down',
        amount: 400,
        description: 'Scroll to find element',
      };
      return {
        type: 'strategy_change',
        originalAction: action,
        adaptedAction: scrollAction,
        reason: 'Element not visible, attempting scroll',
        confidence: 0.5,
      };
    }

    if (attempt && attempt >= this.config.maxRetries - 1) {
      return {
        type: 'skip',
        originalAction: action,
        reason: 'Max retries exceeded, skipping action',
        confidence: 0.3,
      };
    }

    return {
      type: 'retry',
      originalAction: action,
      adaptedAction: action,
      reason: `Retry attempt ${(attempt || 0) + 1}`,
      confidence: 0.5,
    };
  }

  private buildLocator(element: any): any {
    if (element.id) return { strategy: 'id', value: element.id };
    if (element.ariaLabel) return { strategy: 'ariaLabel', value: element.ariaLabel };
    if (element.visibleText) return { strategy: 'text', value: element.visibleText };
    return { strategy: 'index', value: String(element.index) };
  }

  private similarityScore(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length === 0 || b.length === 0) return 0;

    const shorter = a.length < b.length ? a : b;
    const longer = a.length < b.length ? b : a;

    if (longer.includes(shorter)) return shorter.length / longer.length;

    let matches = 0;
    const minLen = Math.min(a.length, b.length);
    for (let i = 0; i < minLen; i++) {
      if (a[i] === b[i]) matches++;
    }

    return matches / Math.max(a.length, b.length);
  }
}

export const testDiscovery = new IntelligentTestDiscovery();
export const adaptiveExecution = new AdaptiveTestExecution();
