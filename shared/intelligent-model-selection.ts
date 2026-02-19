// ─── Single Model Configuration ───────────────────────────────────

export interface ModelCapabilities {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  strengths: string[];
  weaknesses: string[];
  bestFor: TaskType[];
  speed: 'fast' | 'medium' | 'slow';
  cost: 'free' | 'low' | 'medium' | 'high';
  supportsJson: boolean;
  supportsVision: boolean;
  performance: Record<TaskType, number>;
}

export enum TaskType {
  SIMPLE_NAVIGATION = 'simple_navigation',
  COMPLEX_AUTOMATION = 'complex_automation',
  TEXT_EXTRACTION = 'text_extraction',
  FORM_FILLING = 'form_filling',
  VISUAL_ANALYSIS = 'visual_analysis',
  DECISION_MAKING = 'decision_making',
  ERROR_RECOVERY = 'error_recovery',
  MULTI_STEP_WORKFLOW = 'multi_step_workflow'
}

export interface RequestAnalysis {
  primaryTask: TaskType;
  complexity: 'low' | 'medium' | 'high';
  requiresVision: boolean;
  requiresReasoning: boolean;
  timeSensitive: boolean;
  contextLength: number;
  keywords: string[];
  confidence: number;
}

const SINGLE_MODEL_ID = 'google/gemini-2.5-flash';

const SINGLE_MODEL: ModelCapabilities = {
  id: SINGLE_MODEL_ID,
  name: 'Gemini 2.5 Flash',
  provider: 'google',
  contextWindow: 1048576,
  strengths: ['vision', 'speed', 'multimodal', 'long context', 'reasoning'],
  weaknesses: [],
  bestFor: [TaskType.VISUAL_ANALYSIS, TaskType.SIMPLE_NAVIGATION, TaskType.TEXT_EXTRACTION, TaskType.COMPLEX_AUTOMATION, TaskType.DECISION_MAKING, TaskType.ERROR_RECOVERY, TaskType.MULTI_STEP_WORKFLOW, TaskType.FORM_FILLING],
  speed: 'fast',
  cost: 'low',
  supportsJson: true,
  supportsVision: true,
  performance: {
    [TaskType.SIMPLE_NAVIGATION]: 10,
    [TaskType.COMPLEX_AUTOMATION]: 10,
    [TaskType.TEXT_EXTRACTION]: 10,
    [TaskType.FORM_FILLING]: 10,
    [TaskType.VISUAL_ANALYSIS]: 10,
    [TaskType.DECISION_MAKING]: 10,
    [TaskType.ERROR_RECOVERY]: 10,
    [TaskType.MULTI_STEP_WORKFLOW]: 10
  }
};

export function analyzeRequest(command: string, context: any): RequestAnalysis {
  const lowerCommand = command.toLowerCase();
  const keywords = extractKeywords(lowerCommand);

  return {
    primaryTask: determinePrimaryTask(lowerCommand, keywords),
    complexity: assessComplexity(lowerCommand, keywords, context),
    requiresVision: checkVisionRequirements(lowerCommand, context),
    requiresReasoning: checkReasoningRequirements(lowerCommand),
    timeSensitive: checkTimeSensitivity(lowerCommand),
    contextLength: estimateContextLength(context),
    keywords,
    confidence: 0.85
  };
}

function extractKeywords(text: string): string[] {
  const actionWords = [
    'click', 'fill', 'enter', 'type', 'select', 'choose', 'press', 'scroll',
    'navigate', 'go', 'visit', 'open', 'close', 'search', 'find', 'extract',
    'read', 'analyze', 'check', 'verify', 'submit', 'login', 'logout'
  ];

  const taskWords = [
    'form', 'button', 'link', 'input', 'text', 'image', 'video', 'table',
    'list', 'menu', 'dropdown', 'checkbox', 'radio', 'file', 'upload'
  ];

  const keywords = [...actionWords, ...taskWords].filter(word =>
    text.includes(word) || text.includes(word + 's')
  );

  return [...new Set(keywords)];
}

function determinePrimaryTask(command: string, keywords: string[]): TaskType {
  if (keywords.includes('go') || keywords.includes('navigate') || keywords.includes('visit')) {
    return TaskType.SIMPLE_NAVIGATION;
  }

  if (keywords.includes('analyze') || keywords.includes('check') || keywords.includes('verify') ||
      command.includes('what') || command.includes('describe') || command.includes('see')) {
    return TaskType.VISUAL_ANALYSIS;
  }

  if (keywords.includes('extract') || keywords.includes('read') || keywords.includes('get') ||
      command.includes('copy') || command.includes('save')) {
    return TaskType.TEXT_EXTRACTION;
  }

  if (keywords.includes('fill') || keywords.includes('enter') || keywords.includes('type') ||
      keywords.includes('login') || keywords.includes('submit')) {
    return TaskType.FORM_FILLING;
  }

  if (command.includes('then') || command.includes('after') || command.includes('next') ||
      command.includes('finally') || keywords.length > 3) {
    return TaskType.MULTI_STEP_WORKFLOW;
  }

  if (keywords.includes('find') && keywords.includes('click') ||
      command.includes('search') && keywords.includes('select')) {
    return TaskType.COMPLEX_AUTOMATION;
  }

  if (command.includes('try') || command.includes('retry') || command.includes('failed')) {
    return TaskType.ERROR_RECOVERY;
  }

  return TaskType.DECISION_MAKING;
}

function assessComplexity(command: string, keywords: string[], context: any): 'low' | 'medium' | 'high' {
  let score = 0;

  if (command.length > 100) score += 2;
  else if (command.length > 50) score += 1;

  if (keywords.length > 4) score += 2;
  else if (keywords.length > 2) score += 1;

  if (context?.semanticElements?.length > 50) score += 1;
  if (context?.formCount > 3) score += 1;

  if (command.includes('then') || command.includes('after') || command.includes('first')) score += 2;
  if (command.includes('and') || command.includes('also')) score += 1;

  if (command.includes('analyze') || command.includes('compare') || command.includes('verify')) score += 2;

  if (score >= 5) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
}

function checkVisionRequirements(command: string, context: any): boolean {
  const visualKeywords = ['see', 'look', 'visual', 'image', 'picture', 'screenshot', 'color', 'layout'];
  if (visualKeywords.some(kw => command.toLowerCase().includes(kw))) {
    return true;
  }

  if (context?.semanticElements) {
    const visualElements = context.semanticElements.filter((el: any) =>
      el.tag === 'img' || el.tag === 'video' || el.tag === 'canvas'
    );
    if (visualElements.length > 0) return true;
  }

  return false;
}

function checkReasoningRequirements(command: string): boolean {
  if (command.includes('if') || command.includes('when') || command.includes('unless')) return true;
  if (command.includes('best') || command.includes('optimal') || command.includes('choose')) return true;
  return false;
}

function checkTimeSensitivity(command: string): boolean {
  const urgentKeywords = ['quickly', 'fast', 'immediately', 'urgent', 'asap', 'now'];
  return urgentKeywords.some(kw => command.toLowerCase().includes(kw));
}

function estimateContextLength(context: any): number {
  if (!context) return 0;

  let length = 0;
  if (context.bodyText) length += context.bodyText.length;
  if (context.title) length += context.title.length;
  if (context.semanticElements) length += context.semanticElements.length * 100;

  return length;
}

export function selectOptimalModel(_analysis: RequestAnalysis): ModelCapabilities {
  return SINGLE_MODEL;
}

export function selectFallbackModel(_primaryModel: string, _analysis: RequestAnalysis): ModelCapabilities {
  return SINGLE_MODEL;
}

export function shouldSwitchModel(_currentModel: string, _analysis: RequestAnalysis): boolean {
  return false;
}

export { SINGLE_MODEL_ID, SINGLE_MODEL };
