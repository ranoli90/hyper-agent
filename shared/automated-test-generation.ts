import type { Action, PageContext, SemanticElement } from './types';

export interface GeneratedTest {
  id: string;
  name: string;
  description: string;
  actions: Action[];
  assertions: TestAssertion[];
  category: TestCategory;
  priority: number;
  generatedAt: number;
  source: GenerationSource;
  confidence: number;
}

export interface TestAssertion {
  type: AssertionType;
  target: string;
  expected: any;
  message: string;
}

export enum AssertionType {
  ELEMENT_EXISTS = 'element_exists',
  ELEMENT_VISIBLE = 'element_visible',
  ELEMENT_TEXT = 'element_text',
  ELEMENT_VALUE = 'element_value',
  ELEMENT_ATTRIBUTE = 'element_attribute',
  URL_MATCHES = 'url_matches',
  URL_CONTAINS = 'url_contains',
  TITLE_MATCHES = 'title_matches',
  PAGE_CONTAINS_TEXT = 'page_contains_text',
  ELEMENT_COUNT = 'element_count',
  NO_ERRORS = 'no_errors',
}

export enum TestCategory {
  SMOKE = 'smoke',
  REGRESSION = 'regression',
  FUNCTIONAL = 'functional',
  ACCESSIBILITY = 'accessibility',
  NAVIGATION = 'navigation',
  FORM_VALIDATION = 'form_validation',
  INTERACTION = 'interaction',
  EDGE_CASE = 'edge_case',
}

export enum GenerationSource {
  PAGE_ANALYSIS = 'page_analysis',
  USER_FLOW = 'user_flow',
  ERROR_RECOVERY = 'error_recovery',
  MUTATION = 'mutation',
  EXPLORATORY = 'exploratory',
}

export interface GenerationConfig {
  maxTests: number;
  categories: TestCategory[];
  includeEdgeCases: boolean;
  includeAccessibility: boolean;
  minConfidence: number;
}

export class AutomatedTestGenerator {
  private generatedTests: Map<string, GeneratedTest> = new Map();

  generateFromPage(context: PageContext, config?: Partial<GenerationConfig>): GeneratedTest[] {
    const cfg: GenerationConfig = {
      maxTests: config?.maxTests ?? 20,
      categories: config?.categories ?? Object.values(TestCategory),
      includeEdgeCases: config?.includeEdgeCases ?? true,
      includeAccessibility: config?.includeAccessibility ?? true,
      minConfidence: config?.minConfidence ?? 0.5,
    };

    const tests: GeneratedTest[] = [];

    if (cfg.categories.includes(TestCategory.NAVIGATION)) {
      tests.push(...this.generateNavigationTests(context));
    }
    if (cfg.categories.includes(TestCategory.FORM_VALIDATION)) {
      tests.push(...this.generateFormTests(context));
    }
    if (cfg.categories.includes(TestCategory.INTERACTION)) {
      tests.push(...this.generateInteractionTests(context));
    }
    if (cfg.categories.includes(TestCategory.ACCESSIBILITY) && cfg.includeAccessibility) {
      tests.push(...this.generateAccessibilityTests(context));
    }
    if (cfg.categories.includes(TestCategory.SMOKE)) {
      tests.push(...this.generateSmokeTests(context));
    }
    if (cfg.categories.includes(TestCategory.EDGE_CASE) && cfg.includeEdgeCases) {
      tests.push(...this.generateEdgeCaseTests(context));
    }

    const filtered = tests
      .filter(t => t.confidence >= cfg.minConfidence)
      .slice(0, cfg.maxTests);

    for (const test of filtered) {
      this.generatedTests.set(test.id, test);
    }

    return filtered;
  }

  generateFromUserFlow(actions: Action[], results: { success: boolean; error?: string }[]): GeneratedTest {
    const testActions = [...actions];
    const assertions: TestAssertion[] = [];

    for (let i = 0; i < actions.length; i++) {
      if (results[i]?.success) {
        if (actions[i].type === 'navigate') {
          assertions.push({
            type: AssertionType.URL_CONTAINS,
            target: (actions[i] as any).url || '',
            expected: true,
            message: `URL should contain expected path after navigation`,
          });
        }
        if (actions[i].type === 'click') {
          assertions.push({
            type: AssertionType.NO_ERRORS,
            target: 'page',
            expected: true,
            message: 'No errors after click action',
          });
        }
      }
    }

    const test: GeneratedTest = {
      id: `test_flow_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name: `User Flow: ${actions.map(a => a.type).join(' -> ')}`,
      description: `Recorded user flow with ${actions.length} actions`,
      actions: testActions,
      assertions,
      category: TestCategory.FUNCTIONAL,
      priority: 7,
      generatedAt: Date.now(),
      source: GenerationSource.USER_FLOW,
      confidence: 0.8,
    };

    this.generatedTests.set(test.id, test);
    return test;
  }

  generateMutationTests(originalTest: GeneratedTest): GeneratedTest[] {
    const mutations: GeneratedTest[] = [];

    for (let i = 0; i < originalTest.actions.length; i++) {
      const action = originalTest.actions[i];

      if (action.type === 'fill') {
        const emptyTest = this.createMutatedTest(originalTest, i, {
          ...action,
          value: '',
        } as any, 'empty_input');
        mutations.push(emptyTest);

        const xssTest = this.createMutatedTest(originalTest, i, {
          ...action,
          value: '<script>alert(1)</script>',
        } as any, 'xss_input');
        mutations.push(xssTest);

        const longTest = this.createMutatedTest(originalTest, i, {
          ...action,
          value: 'a'.repeat(1000),
        } as any, 'long_input');
        mutations.push(longTest);

        const specialCharTest = this.createMutatedTest(originalTest, i, {
          ...action,
          value: "!@#$%^&*()_+-=[]{}|;':\",./<>?",
        } as any, 'special_chars');
        mutations.push(specialCharTest);
      }

      if (action.type === 'click') {
        const skipTest: GeneratedTest = {
          ...originalTest,
          id: `test_mut_skip_${i}_${Date.now()}`,
          name: `${originalTest.name} (skip step ${i + 1})`,
          actions: [...originalTest.actions.slice(0, i), ...originalTest.actions.slice(i + 1)],
          category: TestCategory.EDGE_CASE,
          source: GenerationSource.MUTATION,
          confidence: 0.6,
          generatedAt: Date.now(),
        };
        mutations.push(skipTest);
      }
    }

    for (const test of mutations) {
      this.generatedTests.set(test.id, test);
    }

    return mutations;
  }

  getGeneratedTests(): GeneratedTest[] {
    return Array.from(this.generatedTests.values());
  }

  getTest(testId: string): GeneratedTest | undefined {
    return this.generatedTests.get(testId);
  }

  clearGeneratedTests(): void {
    this.generatedTests.clear();
  }

  private generateNavigationTests(context: PageContext): GeneratedTest[] {
    const tests: GeneratedTest[] = [];
    const links = context.semanticElements.filter(
      el => el.tag === 'a' && el.href && !el.href.startsWith('javascript:')
    );

    for (const link of links.slice(0, 5)) {
      tests.push({
        id: `test_nav_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        name: `Navigate: ${link.visibleText || link.href}`,
        description: `Test navigation to ${link.href}`,
        actions: [
          { type: 'click', locator: { strategy: 'text', value: link.visibleText || '' }, description: `Click "${link.visibleText}"` },
        ],
        assertions: [
          { type: AssertionType.NO_ERRORS, target: 'page', expected: true, message: 'No errors after navigation' },
        ],
        category: TestCategory.NAVIGATION,
        priority: 5,
        generatedAt: Date.now(),
        source: GenerationSource.PAGE_ANALYSIS,
        confidence: 0.7,
      });
    }

    return tests;
  }

  private generateFormTests(context: PageContext): GeneratedTest[] {
    const tests: GeneratedTest[] = [];
    const inputs = context.semanticElements.filter(
      el => el.tag === 'input' || el.tag === 'textarea' || el.tag === 'select'
    );

    if (inputs.length === 0) return tests;

    const formFillActions: Action[] = inputs.slice(0, 5).map(input => {
      if (input.tag === 'select') {
        return {
          type: 'select' as const,
          locator: this.buildLocator(input),
          value: 'first',
          description: `Select option in ${input.name || input.ariaLabel || 'select'}`,
        };
      }
      return {
        type: 'fill' as const,
        locator: this.buildLocator(input),
        value: this.generateTestValue(input),
        clearFirst: true,
        description: `Fill ${input.name || input.ariaLabel || input.type || 'input'}`,
      };
    });

    if (formFillActions.length > 0) {
      tests.push({
        id: `test_form_valid_${Date.now()}`,
        name: 'Form: Valid submission',
        description: 'Fill form with valid data',
        actions: formFillActions,
        assertions: [
          { type: AssertionType.NO_ERRORS, target: 'page', expected: true, message: 'No validation errors' },
        ],
        category: TestCategory.FORM_VALIDATION,
        priority: 8,
        generatedAt: Date.now(),
        source: GenerationSource.PAGE_ANALYSIS,
        confidence: 0.75,
      });

      const emptySubmitActions: Action[] = inputs.filter(i => i.isRequired).slice(0, 3).map(input => ({
        type: 'fill' as const,
        locator: this.buildLocator(input),
        value: '',
        clearFirst: true,
        description: `Clear required field ${input.name || 'input'}`,
      }));

      if (emptySubmitActions.length > 0) {
        tests.push({
          id: `test_form_empty_${Date.now()}`,
          name: 'Form: Empty required fields',
          description: 'Submit form with empty required fields',
          actions: emptySubmitActions,
          assertions: [
            { type: AssertionType.NO_ERRORS, target: 'page', expected: false, message: 'Should show validation errors' },
          ],
          category: TestCategory.FORM_VALIDATION,
          priority: 7,
          generatedAt: Date.now(),
          source: GenerationSource.PAGE_ANALYSIS,
          confidence: 0.7,
        });
      }
    }

    return tests;
  }

  private generateInteractionTests(context: PageContext): GeneratedTest[] {
    const tests: GeneratedTest[] = [];
    const buttons = context.semanticElements.filter(
      el => el.tag === 'button' || (el.role === 'button') || (el.tag === 'a' && el.role === 'button')
    );

    for (const button of buttons.slice(0, 5)) {
      tests.push({
        id: `test_click_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        name: `Click: ${button.visibleText || button.ariaLabel || 'button'}`,
        description: `Test clicking ${button.visibleText || 'button'}`,
        actions: [
          { type: 'click', locator: this.buildLocator(button), description: `Click "${button.visibleText}"` },
        ],
        assertions: [
          { type: AssertionType.NO_ERRORS, target: 'page', expected: true, message: 'No errors after click' },
        ],
        category: TestCategory.INTERACTION,
        priority: 5,
        generatedAt: Date.now(),
        source: GenerationSource.PAGE_ANALYSIS,
        confidence: 0.65,
      });
    }

    return tests;
  }

  private generateAccessibilityTests(context: PageContext): GeneratedTest[] {
    const tests: GeneratedTest[] = [];

    const imagesWithoutAlt = context.semanticElements.filter(
      el => el.tag === 'img' && !el.ariaLabel
    );

    if (imagesWithoutAlt.length > 0) {
      tests.push({
        id: `test_a11y_img_alt_${Date.now()}`,
        name: 'Accessibility: Images have alt text',
        description: `${imagesWithoutAlt.length} images missing alt text`,
        actions: [],
        assertions: [
          { type: AssertionType.ELEMENT_COUNT, target: 'img:not([alt])', expected: 0, message: 'All images should have alt text' },
        ],
        category: TestCategory.ACCESSIBILITY,
        priority: 6,
        generatedAt: Date.now(),
        source: GenerationSource.PAGE_ANALYSIS,
        confidence: 0.9,
      });
    }

    const interactiveElements = context.semanticElements.filter(
      el => (el.tag === 'button' || el.tag === 'a' || el.tag === 'input') && !el.ariaLabel && !el.visibleText
    );

    if (interactiveElements.length > 0) {
      tests.push({
        id: `test_a11y_labels_${Date.now()}`,
        name: 'Accessibility: Interactive elements have labels',
        description: `${interactiveElements.length} interactive elements missing labels`,
        actions: [],
        assertions: [
          { type: AssertionType.ELEMENT_EXISTS, target: '[aria-label]', expected: true, message: 'Interactive elements should have accessible labels' },
        ],
        category: TestCategory.ACCESSIBILITY,
        priority: 7,
        generatedAt: Date.now(),
        source: GenerationSource.PAGE_ANALYSIS,
        confidence: 0.85,
      });
    }

    return tests;
  }

  private generateSmokeTests(context: PageContext): GeneratedTest[] {
    return [
      {
        id: `test_smoke_load_${Date.now()}`,
        name: 'Smoke: Page loads successfully',
        description: `Verify ${context.url} loads`,
        actions: [
          { type: 'navigate', url: context.url, description: `Navigate to ${context.url}` },
        ],
        assertions: [
          { type: AssertionType.URL_CONTAINS, target: context.url, expected: true, message: 'Page URL is correct' },
          { type: AssertionType.TITLE_MATCHES, target: context.title, expected: context.title, message: 'Page title matches' },
          { type: AssertionType.NO_ERRORS, target: 'page', expected: true, message: 'No console errors' },
        ],
        category: TestCategory.SMOKE,
        priority: 10,
        generatedAt: Date.now(),
        source: GenerationSource.PAGE_ANALYSIS,
        confidence: 0.95,
      },
    ];
  }

  private generateEdgeCaseTests(context: PageContext): GeneratedTest[] {
    const tests: GeneratedTest[] = [];

    tests.push({
      id: `test_edge_rapid_scroll_${Date.now()}`,
      name: 'Edge Case: Rapid scrolling',
      description: 'Test rapid scrolling up and down',
      actions: [
        { type: 'scroll', direction: 'down', amount: 5000, description: 'Scroll to bottom' },
        { type: 'scroll', direction: 'up', amount: 5000, description: 'Scroll to top' },
        { type: 'scroll', direction: 'down', amount: 2000, description: 'Scroll to middle' },
      ],
      assertions: [
        { type: AssertionType.NO_ERRORS, target: 'page', expected: true, message: 'No errors during scrolling' },
      ],
      category: TestCategory.EDGE_CASE,
      priority: 3,
      generatedAt: Date.now(),
      source: GenerationSource.PAGE_ANALYSIS,
      confidence: 0.6,
    });

    tests.push({
      id: `test_edge_back_forward_${Date.now()}`,
      name: 'Edge Case: Back/Forward navigation',
      description: 'Test browser history navigation',
      actions: [
        { type: 'goBack', description: 'Go back' },
        { type: 'wait', ms: 1000, description: 'Wait for navigation' },
      ],
      assertions: [
        { type: AssertionType.NO_ERRORS, target: 'page', expected: true, message: 'No errors after back navigation' },
      ],
      category: TestCategory.EDGE_CASE,
      priority: 4,
      generatedAt: Date.now(),
      source: GenerationSource.PAGE_ANALYSIS,
      confidence: 0.55,
    });

    return tests;
  }

  private createMutatedTest(
    original: GeneratedTest,
    actionIndex: number,
    mutatedAction: Action,
    mutationType: string
  ): GeneratedTest {
    const actions = [...original.actions];
    actions[actionIndex] = mutatedAction;

    return {
      id: `test_mut_${mutationType}_${actionIndex}_${Date.now()}`,
      name: `${original.name} (mutation: ${mutationType} at step ${actionIndex + 1})`,
      description: `Mutation test: ${mutationType} applied to step ${actionIndex + 1}`,
      actions,
      assertions: original.assertions,
      category: TestCategory.EDGE_CASE,
      priority: original.priority - 1,
      generatedAt: Date.now(),
      source: GenerationSource.MUTATION,
      confidence: 0.6,
    };
  }

  private buildLocator(element: SemanticElement): any {
    if (element.id) return { strategy: 'id', value: element.id };
    if (element.ariaLabel) return { strategy: 'ariaLabel', value: element.ariaLabel };
    if (element.role && element.visibleText) return { strategy: 'role', value: `${element.role}:${element.visibleText}` };
    if (element.visibleText) return { strategy: 'text', value: element.visibleText };
    return { strategy: 'index', value: String(element.index) };
  }

  private generateTestValue(element: SemanticElement): string {
    switch (element.type) {
      case 'email': return 'test@example.com';
      case 'tel': return '(555) 123-4567';
      case 'number': return '42';
      case 'url': return 'https://example.com';
      case 'password': return 'TestPass123!';
      case 'date': return '2025-01-15';
      case 'search': return 'test search query';
      default: return 'Test Value';
    }
  }
}

export const testGenerator = new AutomatedTestGenerator();
