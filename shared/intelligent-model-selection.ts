// ─── Intelligent Model Selection for Maximum Efficiency ──────────────────

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
  performance: Record<TaskType, number>; // 0-10 score
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

// ─── Available Models (Auto-Selected Based on Task) ───────────────────────────────────
// Two models - system automatically picks based on task requirements
const PAID_MODELS: ModelCapabilities[] = [
  {
    id: 'minimax/minimax-m2.5',
    name: 'MiniMax M2.5',
    provider: 'minimax',
    contextWindow: 131072,
    strengths: ['reasoning', 'speed', 'coding', 'analysis', 'multimodal'],
    weaknesses: [],
    bestFor: [TaskType.COMPLEX_AUTOMATION, TaskType.DECISION_MAKING, TaskType.MULTI_STEP_WORKFLOW, TaskType.ERROR_RECOVERY],
    speed: 'fast',
    cost: 'low',
    supportsJson: true,
    supportsVision: true,
    performance: {
      [TaskType.SIMPLE_NAVIGATION]: 9,
      [TaskType.COMPLEX_AUTOMATION]: 10,
      [TaskType.TEXT_EXTRACTION]: 9,
      [TaskType.FORM_FILLING]: 9,
      [TaskType.VISUAL_ANALYSIS]: 10,
      [TaskType.DECISION_MAKING]: 10,
      [TaskType.ERROR_RECOVERY]: 10,
      [TaskType.MULTI_STEP_WORKFLOW]: 10
    }
  },
  {
    id: 'moonshotai/kimi-k2.5',
    name: 'Moonshot Kimi K2.5',
    provider: 'moonshotai',
    contextWindow: 131072,
    strengths: ['vision', 'speed', 'multimodal', 'long context'],
    weaknesses: [],
    bestFor: [TaskType.VISUAL_ANALYSIS, TaskType.SIMPLE_NAVIGATION, TaskType.TEXT_EXTRACTION, TaskType.FORM_FILLING],
    speed: 'fast',
    cost: 'low',
    supportsJson: true,
    supportsVision: true,
    performance: {
      [TaskType.SIMPLE_NAVIGATION]: 10,
      [TaskType.COMPLEX_AUTOMATION]: 8,
      [TaskType.TEXT_EXTRACTION]: 10,
      [TaskType.FORM_FILLING]: 10,
      [TaskType.VISUAL_ANALYSIS]: 10,
      [TaskType.DECISION_MAKING]: 8,
      [TaskType.ERROR_RECOVERY]: 8,
      [TaskType.MULTI_STEP_WORKFLOW]: 8
    }
  }
];

// ─── Request Analysis ──────────────────────────────────────────────────
export function analyzeRequest(command: string, context: any): RequestAnalysis {
  const lowerCommand = command.toLowerCase();
  const keywords = extractKeywords(lowerCommand);

  // Determine primary task type
  const primaryTask = determinePrimaryTask(lowerCommand, keywords);

  // Assess complexity
  const complexity = assessComplexity(lowerCommand, keywords, context);

  // Check vision requirements
  const requiresVision = checkVisionRequirements(lowerCommand, context);

  // Check reasoning requirements
  const requiresReasoning = checkReasoningRequirements(lowerCommand, primaryTask, complexity);

  // Check time sensitivity
  const timeSensitive = checkTimeSensitivity(lowerCommand);

  // Estimate context length
  const contextLength = estimateContextLength(context);

  return {
    primaryTask,
    complexity,
    requiresVision,
    requiresReasoning,
    timeSensitive,
    contextLength,
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

  return [...new Set(keywords)]; // Remove duplicates
}

function determinePrimaryTask(command: string, keywords: string[]): TaskType {
  // Simple navigation patterns
  if (keywords.includes('go') || keywords.includes('navigate') || keywords.includes('visit')) {
    return TaskType.SIMPLE_NAVIGATION;
  }

  // Visual analysis patterns
  if (keywords.includes('analyze') || keywords.includes('check') || keywords.includes('verify') ||
      command.includes('what') || command.includes('describe') || command.includes('see')) {
    return TaskType.VISUAL_ANALYSIS;
  }

  // Text extraction patterns
  if (keywords.includes('extract') || keywords.includes('read') || keywords.includes('get') ||
      command.includes('copy') || command.includes('save')) {
    return TaskType.TEXT_EXTRACTION;
  }

  // Form filling patterns
  if (keywords.includes('fill') || keywords.includes('enter') || keywords.includes('type') ||
      keywords.includes('login') || keywords.includes('submit')) {
    return TaskType.FORM_FILLING;
  }

  // Multi-step workflow patterns
  if (command.includes('then') || command.includes('after') || command.includes('next') ||
      command.includes('finally') || keywords.length > 3) {
    return TaskType.MULTI_STEP_WORKFLOW;
  }

  // Complex automation patterns
  if (keywords.includes('find') && keywords.includes('click') ||
      command.includes('search') && keywords.includes('select')) {
    return TaskType.COMPLEX_AUTOMATION;
  }

  // Error recovery patterns
  if (command.includes('try') || command.includes('retry') || command.includes('failed')) {
    return TaskType.ERROR_RECOVERY;
  }

  // Default to complex automation for decision making
  return TaskType.DECISION_MAKING;
}

function assessComplexity(command: string, keywords: string[], context: any): 'low' | 'medium' | 'high' {
  let score = 0;

  // Length-based complexity
  if (command.length > 100) score += 2;
  else if (command.length > 50) score += 1;

  // Keyword diversity
  if (keywords.length > 4) score += 2;
  else if (keywords.length > 2) score += 1;

  // Context complexity
  if (context?.semanticElements?.length > 50) score += 1;
  if (context?.formCount > 3) score += 1;

  // Multi-step indicators
  if (command.includes('then') || command.includes('after') || command.includes('first')) score += 2;
  if (command.includes('and') || command.includes('also')) score += 1;

  // Advanced operations
  if (command.includes('analyze') || command.includes('compare') || command.includes('verify')) score += 2;

  if (score >= 5) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
}

function checkVisionRequirements(command: string, context: any): boolean {
  // Check command for visual keywords
  const visualKeywords = ['see', 'look', 'visual', 'image', 'picture', 'screenshot', 'color', 'layout'];
  if (visualKeywords.some(kw => command.toLowerCase().includes(kw))) {
    return true;
  }

  // Check context for visual elements
  if (context?.semanticElements) {
    const visualElements = context.semanticElements.filter((el: any) =>
      el.tag === 'img' || el.tag === 'video' || el.tag === 'canvas'
    );
    if (visualElements.length > 0) return true;
  }

  return false;
}

function checkReasoningRequirements(command: string, taskType: TaskType, complexity: string): boolean {
  // Complex tasks always require reasoning
  if (complexity === 'high') return true;

  // Decision-making tasks require reasoning
  if (taskType === TaskType.DECISION_MAKING || taskType === TaskType.ERROR_RECOVERY) return true;

  // Commands with conditionals require reasoning
  if (command.includes('if') || command.includes('when') || command.includes('unless')) return true;

  // Commands requiring understanding context
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
  if (context.semanticElements) length += context.semanticElements.length * 100; // Rough estimate

  return length;
}

// ─── Intelligent Model Selection ──────────────────────────────────────
export function selectOptimalModel(analysis: RequestAnalysis): ModelCapabilities {
  const candidates = PAID_MODELS.filter(model => {
    // Filter by vision requirements
    if (analysis.requiresVision && !model.supportsVision) return false;

    // Filter by context window
    if (analysis.contextLength > model.contextWindow * 0.8) return false;

    return true;
  });

  if (candidates.length === 0) {
    // Fallback to minimax as default
    return PAID_MODELS.find(m => m.id === 'minimax/minimax-m2.5') || PAID_MODELS[0];
  }

  // Score each candidate
  const scoredCandidates = candidates.map(model => ({
    model,
    score: calculateModelScore(model, analysis)
  }));

  // Sort by score and return best
  scoredCandidates.sort((a, b) => b.score - a.score);
  return scoredCandidates[0].model;
}

function calculateModelScore(model: ModelCapabilities, analysis: RequestAnalysis): number {
  let score = 0;

  // Primary task performance (40% weight)
  const taskScore = model.performance[analysis.primaryTask] || 5;
  score += taskScore * 4;

  // Complexity alignment (20% weight)
  const complexityMultiplier = {
    'low': model.speed === 'fast' ? 2 : 1,
    'medium': model.speed === 'medium' ? 2 : 1,
    'high': model.speed === 'slow' ? 2 : 1
  }[analysis.complexity] || 1;
  score += complexityMultiplier * 2;

  // Reasoning requirements (15% weight)
  if (analysis.requiresReasoning) {
    const reasoningScore = model.strengths.includes('reasoning') ? 10 :
                          model.strengths.includes('instruction following') ? 8 : 5;
    score += reasoningScore * 1.5;
  }

  // Time sensitivity (10% weight)
  if (analysis.timeSensitive) {
    const speedScore = { 'fast': 10, 'medium': 5, 'slow': 1 }[model.speed];
    score += speedScore;
  }

  // Vision capability bonus (10% weight)
  if (analysis.requiresVision && model.supportsVision) {
    score += 10;
  }

  // Context efficiency (5% weight)
  const contextEfficiency = Math.min(analysis.contextLength / model.contextWindow, 1);
  score += (1 - contextEfficiency) * 5;

  return score;
}

// ─── Fallback Model Selection ─────────────────────────────────────────
export function selectFallbackModel(primaryModel: string, analysis: RequestAnalysis): ModelCapabilities {
  const primary = PAID_MODELS.find(m => m.id === primaryModel);
  const candidates = PAID_MODELS.filter(m => m.id !== primaryModel);

  // Find best alternative with different strengths
  const scoredCandidates = candidates.map(model => ({
    model,
    score: calculateFallbackScore(model, primary, analysis)
  }));

  scoredCandidates.sort((a, b) => b.score - a.score);
  return scoredCandidates[0]?.model || PAID_MODELS[0];
}

function calculateFallbackScore(model: ModelCapabilities, primary?: ModelCapabilities, analysis?: RequestAnalysis): number {
  let score = 0;

  // Prefer different providers for diversity
  if (primary && model.provider !== primary.provider) {
    score += 3;
  }

  // Base performance on task
  if (analysis) {
    score += model.performance[analysis.primaryTask] || 5;
  }

  // Prefer faster models as fallbacks
  if (model.speed === 'fast') score += 2;
  else if (model.speed === 'medium') score += 1;

  return score;
}

// ─── Model Switching Logic ───────────────────────────────────────────
export function shouldSwitchModel(currentModel: string, analysis: RequestAnalysis): boolean {
  const current = PAID_MODELS.find(m => m.id === currentModel);
  const optimal = selectOptimalModel(analysis);

  if (!current || !optimal) return false;

  // Switch if optimal model scores significantly higher
  const currentScore = calculateModelScore(current, analysis);
  const optimalScore = calculateModelScore(optimal, analysis);

  return (optimalScore - currentScore) > 3; // 30% improvement threshold
}

// ─── Export Functions ─────────────────────────────────────────────────
export { PAID_MODELS };
