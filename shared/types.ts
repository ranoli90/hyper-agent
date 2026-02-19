// ─── Context Window Types ─────────────────────────────────────────────
export interface ContextItem {
  type: 'action' | 'result' | 'error' | 'thought' | 'system';
  content: string;
  timestamp: number;
  importance: number; // 0-10
  tokens: number;
}

export interface ContextWindow {
  items: ContextItem[];
  totalTokens: number;
  maxTokens: number;
}

// ─── LLM Request with Context Window ───────────────────────────────────
// ─── LLM Request with Context Window ───────────────────────────────────
export interface LLMRequest {
  messages?: Message[];
  contextWindow?: ContextWindow;
  // Extended properties used by llmClient.ts
  command?: string;
  history?: any[]; // Using any[] to avoid circular dependency with HistoryEntry if needed
  context?: PageContext;
  temperature?: number;
  maxTokens?: number;
}

// ─── Message Types ─────────────────────────────────────────────────────
export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string | MessageContent[];
}

export type MessageContent =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail: 'low' | 'high' | 'auto' } };

// ─── Error Classification ──────────────────────────────────────────
export type ErrorType =
  | 'ELEMENT_NOT_FOUND'
  | 'ELEMENT_NOT_VISIBLE'
  | 'ELEMENT_DISABLED'
  | 'ACTION_FAILED'
  | 'TIMEOUT'
  | 'NAVIGATION_ERROR'
  | 'UNKNOWN';

// Supported languages for multi-language support
export type Language = 'en' | 'es' | 'fr' | 'de' | 'zh' | 'ja' | 'ko' | 'pt' | 'ru';

// ─── Recovery Strategy Types ────────────────────────────────────────
export interface RecoveryStrategy {
  name: string;
  errorTypes: ErrorType[];
  maxRetries: number;
  strategy: 'retry' | 'fallback' | 'reconstruct' | 'skip';
  reconstruct?: (action: Action, error: ErrorType) => Action | null;
  fallback?: Action;
}

export interface ErrorContext {
  error: ErrorType;
  action: Action;
  attempt: number;
  pageUrl: string;
  previousResults?: ActionResult[];
}

// ─── Memory Types ───────────────────────────────────────────────────
export interface SiteStrategy {
  domain: string;
  successfulLocators: { locator: Locator; actionType: string; successCount: number }[];
  failedLocators: { locator: Locator; errorType: string; failCount: number }[];
  lastUsed: number;
}

export interface ActionLogEntry {
  timestamp: number;
  domain: string;
  actionType: string;
  locator: Locator;
  success: boolean;
  errorType?: string;
}

// ─── Action Result with Error Classification ──────────────────────────
export interface ActionResult {
  success: boolean;
  error?: string;
  errorType?: ErrorType;
  extractedData?: string;
  recovered?: boolean; // true if we self-healed from an error
}

// ─── Semantic Element ───────────────────────────────────────────────
export interface SemanticElement {
  tag: string;
  id: string;
  classes: string;
  role: string;
  ariaLabel: string;
  ariaDescribedBy: string;
  placeholder: string;
  name: string;
  visibleText: string;
  value: string;
  type: string;
  href: string;
  isDisabled: boolean;
  isChecked: boolean;
  isRequired: boolean;
  isEditable: boolean;
  boundingBox: { x: number; y: number; width: number; height: number } | null;
  index: number;
  parentTag: string;
  childCount: number;
}

// ─── Page Context ───────────────────────────────────────────────────
export interface PageContext {
  url: string;
  title: string;
  bodyText: string;
  metaDescription: string;
  formCount: number;
  semanticElements: SemanticElement[];
  screenshotBase64?: string;
  needsScreenshot?: boolean; // Vision-first fallback flag
  timestamp: number;
  scrollPosition: { x: number; y: number };
  viewportSize: { width: number; height: number };
  pageHeight: number;
}

// ─── Locator ────────────────────────────────────────────────────────
export type LocatorStrategy = 'css' | 'text' | 'aria' | 'role' | 'xpath' | 'index';

export type Locator =
  | string
  | { strategy: LocatorStrategy; value: string; index?: number; fallback?: Locator };

// ─── Actions ────────────────────────────────────────────────────────
export interface ClickAction {
  type: 'click';
  locator: Locator;
  description?: string;
  destructive?: boolean;
  doubleClick?: boolean;
}

export interface FillAction {
  type: 'fill';
  locator: Locator;
  value: string;
  clearFirst?: boolean;
  description?: string;
  destructive?: boolean;
}

export interface SelectAction {
  type: 'select';
  locator: Locator;
  value: string;
  description?: string;
  destructive?: boolean;
}

export interface ScrollAction {
  type: 'scroll';
  direction: 'up' | 'down' | 'left' | 'right';
  amount?: number;
  locator?: Locator;
  description?: string;
  destructive?: boolean;
}

export interface NavigateAction {
  type: 'navigate';
  url: string;
  description?: string;
  destructive?: boolean;
}

export interface GoBackAction {
  type: 'goBack';
  description?: string;
  destructive?: boolean;
}

export interface WaitAction {
  type: 'wait';
  ms: number;
  description?: string;
  destructive?: boolean;
}

export interface PressKeyAction {
  type: 'pressKey';
  key: string;
  modifiers?: ('ctrl' | 'shift' | 'alt' | 'meta')[];
  description?: string;
  destructive?: boolean;
}

export interface HoverAction {
  type: 'hover';
  locator: Locator;
  description?: string;
  destructive?: boolean;
}

export interface FocusAction {
  type: 'focus';
  locator: Locator;
  description?: string;
  destructive?: boolean;
}

export interface ExtractAction {
  type: 'extract';
  locator: Locator;
  attribute?: string;
  filter?: string; // Filter pattern (regex)
  multiple?: boolean; // Extract multiple items
  format?: 'text' | 'json' | 'csv';
  description?: string;
  destructive?: boolean;
}

export interface OpenTabAction {
  type: 'openTab';
  url: string;
  active?: boolean;
  description?: string;
  destructive?: boolean;
}

export interface CloseTabAction {
  type: 'closeTab';
  tabId?: number;
  description?: string;
  destructive?: boolean;
}

export interface SwitchTabAction {
  type: 'switchTab';
  tabId?: number;
  urlPattern?: string;
  description?: string;
  destructive?: boolean;
}

export interface SubmitAction {
  type: 'submit';
  locator: Locator;
  description?: string;
  destructive?: boolean;
}

export interface GetTabsAction {
  type: 'getTabs';
  description?: string;
  destructive?: boolean;
}

// ─── Macro Types ───────────────────────────────────────────────────────
export interface Macro {
  id: string;
  name: string;
  description?: string;
  actions: Action[];
  createdAt: number;
  lastUsed?: number;
  useCount: number;
}

export interface MacroAction {
  type: 'runMacro';
  macroId: string;
  destructive?: boolean;
}

export interface WorkflowAction {
  type: 'runWorkflow';
  workflowId: string;
  destructive?: boolean;
}

export type Action =
  | ClickAction
  | FillAction
  | SelectAction
  | ScrollAction
  | NavigateAction
  | GoBackAction
  | WaitAction
  | PressKeyAction
  | HoverAction
  | FocusAction
  | ExtractAction
  | OpenTabAction
  | CloseTabAction
  | SwitchTabAction
  | SubmitAction
  | GetTabsAction
  | MacroAction
  | WorkflowAction;

// ─── LLM Interface ─────────────────────────────────────────────────────
export interface CompletionRequest {
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json_object';
}

export interface LLMClientInterface {
  callLLM(request: LLMRequest, signal?: AbortSignal): Promise<LLMResponse>;
  callCompletion(request: CompletionRequest, signal?: AbortSignal): Promise<string>;
  getEmbedding(text: string): Promise<number[]>;
}

// ─── LLM Response ───────────────────────────────────────────────────
export interface LLMResponse {
  thinking?: string;
  summary: string;
  actions: Action[];
  needsScreenshot?: boolean;
  done?: boolean;
  error?: string;
  askUser?: string;
}

// ─── Messages (side panel ↔ background ↔ content) ──────────────────
export interface MsgExecuteCommand {
  type: 'executeCommand';
  command: string;
  useAutonomous?: boolean;
}

export interface MsgStopAgent {
  type: 'stopAgent';
}

export interface MsgGetContext {
  type: 'getContext';
}

export interface MsgGetContextResponse {
  type: 'getContextResponse';
  context: PageContext;
}

export interface MsgPerformAction {
  type: 'performAction';
  action: Action;
}

export interface MsgPerformActionResponse {
  type: 'performActionResponse';
  success: boolean;
  error?: string;
  errorType?: ErrorType;
  extractedData?: string;
  recovered?: boolean;
}

export interface MsgExecuteActionOnPage {
  type: 'executeActionOnPage';
  action: Action;
}

export interface MsgCaptureScreenshot {
  type: 'captureScreenshot';
}

export interface MsgCaptureScreenshotResponse {
  type: 'captureScreenshotResponse';
  dataUrl: string;
}

export interface MsgVisionUpdate {
  type: 'visionUpdate';
  screenshot: string;
}

export interface MsgAgentProgress {
  type: 'agentProgress';
  step?: 'observe' | 'plan' | 'act' | 'verify' | string;
  maxSteps?: number;
  summary?: string;
  thinking?: string;
  status: string;
  actionDescriptions?: string[];
}

export interface MsgConfirmActions {
  type: 'confirmActions';
  actions: Action[];
  step: number;
  summary: string;
}

export interface MsgConfirmResponse {
  type: 'confirmResponse';
  confirmed: boolean;
}

export interface MsgAgentDone {
  type: 'agentDone';
  finalSummary: string;
  success: boolean;
  stepsUsed: number;
}

export interface MsgContextMenuCommand {
  type: 'contextMenuCommand';
  command: string;
}

export interface MsgAskUser {
  type: 'askUser';
  question: string;
}

export interface MsgUserReply {
  type: 'userReply';
  reply: string;
}

export interface MsgGetTabsResponse {
  type: 'getTabsResponse';
  tabs: { id: number; url: string; title: string; active: boolean }[];
}

// ─── Security & Privacy Types (Iteration 15) ─────────────────────────────
export interface MsgGetSecuritySettings {
  type: 'getSecuritySettings';
}

export interface MsgGetSecuritySettingsResponse {
  type: 'getSecuritySettingsResponse';
  privacySettings: {
    allowScreenshots: boolean;
    storeActionHistory: boolean;
    shareUsageData: boolean;
    allowedDomains: string[];
    blockedDomains: string[];
  };
  securityPolicy: {
    maxActionsPerMinute: number;
    requireConfirmationFor: string[];
    allowExternalUrls: boolean;
  };
}

export interface MsgSetSecuritySettings {
  type: 'setSecuritySettings';
  privacySettings?: {
    allowScreenshots?: boolean;
    storeActionHistory?: boolean;
    shareUsageData?: boolean;
    allowedDomains?: string[];
    blockedDomains?: string[];
  };
  securityPolicy?: {
    maxActionsPerMinute?: number;
    requireConfirmationFor?: string[];
    allowExternalUrls?: boolean;
  };
}

export interface MsgSecurityCheck {
  type: 'securityCheck';
  url: string;
}

export interface MsgSecurityCheckResponse {
  type: 'securityCheckResponse';
  allowed: boolean;
  reason?: string;
}

// ─── Background Status & Metrics ──────────────────────────────────────

export interface MsgGetAgentStatus {
  type: 'getAgentStatus';
}

export interface MsgGetAgentStatusResponse {
  type: 'getAgentStatusResponse';
  status: {
    isRunning: boolean;
    isAborted: boolean;
    currentSessionId: string | null;
    hasPendingConfirm: boolean;
    hasPendingReply: boolean;
    recoveryStats: any;
  };
}

export interface MsgClearHistory {
  type: 'clearHistory';
}

export interface MsgGetMetrics {
  type: 'getMetrics';
}

export interface MsgGetMetricsResponse {
  type: 'getMetricsResponse';
  metrics: {
    logs: any[];
    recovery: any;
    rateLimitStatus: {
      canAccept: boolean;
      timeUntilReset: number;
    };
  };
}

// ─── Intent Types ───────────────────────────────────────────────────────
export interface CommandIntent {
  action: string;
  target?: string;
  modifiers?: string[];
  confidence: number;
  language?: Language;
  originalText?: string;
}

// ─── Site-Specific Configuration ─────────────────────────────────────
export interface SiteConfig {
  domain: string;
  maxRetries?: number;
  scrollBeforeLocate?: boolean;
  customSelectors?: string[];
  waitAfterAction?: number;
  description?: string;
}

export interface MsgIntentSuggestion {
  type: 'intentSuggestion';
  suggestions: string[];
}

export interface MsgGetSiteConfig {
  type: 'getSiteConfig';
}

export interface MsgGetSiteConfigResponse {
  type: 'getSiteConfigResponse';
  config: SiteConfig | null;
  hostname: string;
}

// ─── Session Types ───────────────────────────────────────────────────────
export interface Session {
  id: string;
  createdAt: number;
  lastActive: number;
  pageUrl: string;
  pageTitle: string;
  context: ContextSnapshot;
  actionHistory: Action[];
  results: ActionResult[];
}

export interface ContextSnapshot {
  extractedData: Record<string, unknown>;
  lastIntent: CommandIntent | null;
  lastAction: Action | null;
  pendingActions: Action[];
}

// ─── Performance Metrics Types ───────────────────────────────────────────
export interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
}

export interface ActionMetrics {
  actionType: string;
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  averageDurationMs: number;
  successRate: number;
}

// ─── Workflow Types ───────────────────────────────────────────────────────
export interface WorkflowStep {
  id: string;
  action: Action;
  condition?: Condition;
  onSuccess?: string; // Next step ID
  onError?: string; // Next step ID on error
}

export interface Condition {
  type: 'elementExists' | 'elementMissing' | 'textContains' | 'urlMatches';
  value: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
  startStep?: string;
}

export interface WorkflowAction {
  type: 'runWorkflow';
  workflowId: string;
  destructive?: boolean;
}

export type ExtensionMessage =
  | MsgExecuteCommand
  | MsgStopAgent
  | MsgGetContext
  | MsgGetContextResponse
  | MsgPerformAction
  | MsgPerformActionResponse
  | MsgCaptureScreenshot
  | MsgCaptureScreenshotResponse
  | MsgExecuteActionOnPage
  | MsgAgentProgress
  | MsgConfirmActions
  | MsgConfirmResponse
  | MsgAgentDone
  | MsgContextMenuCommand
  | MsgAskUser
  | MsgUserReply
  | MsgVisionUpdate
  | MsgGetTabsResponse
  | MsgIntentSuggestion
  | MsgGetSiteConfig
  | MsgGetSiteConfigResponse
  // Security & Privacy (Iteration 15)
  | MsgGetSecuritySettings
  | MsgGetSecuritySettingsResponse
  | MsgSetSecuritySettings
  | MsgSetSecuritySettingsResponse
  | MsgSecurityCheck
  | MsgSecurityCheckResponse
  // Background status and metrics
  | MsgGetAgentStatus
  | MsgGetAgentStatusResponse
  | MsgClearHistory
  | MsgGetMetrics
  | MsgGetMetricsResponse
  // TikTok Moderator
  | MsgStartModerator
  | MsgStopModerator
  | MsgUpdateModerationRules
  | MsgModerationLog
  | MsgModeratorStats
  // Usage & Billing
  | MsgGetUsage
  | MsgGetUsageResponse;

export interface MsgStartModerator {
  type: 'startModerator';
}

export interface MsgStopModerator {
  type: 'stopModerator';
}

export interface MsgUpdateModerationRules {
  type: 'updateModerationRules';
  rules: any[]; // Using any[] to avoid circular dependency
}

export interface MsgModerationLog {
  type: 'moderationLog';
  log: any; // ModerationLog
}

export interface MsgSetSecuritySettingsResponse {
  type: 'setSecuritySettingsResponse';
  success: boolean;
  error?: string;
}

export interface MsgModeratorStats {
  type: 'moderatorStats';
  stats: {
    checked: number;
    actions: number;
  };
}

export interface MsgGetUsage {
  type: 'getUsage';
}

export interface MsgGetUsageResponse {
  type: 'getUsageResponse';
  usage: {
    actions: number;
    sessions: number;
    sessionTime: number;
  };
  limits: {
    actions: number;
    sessions: number;
    tier: string;
  };
}
