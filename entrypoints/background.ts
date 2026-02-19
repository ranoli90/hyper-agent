/**
 * @fileoverview HyperAgent Background Service Worker
 *
 * This is the core orchestration layer of the HyperAgent autonomous AI browser agent.
 * The background service worker manages the entire agent lifecycle, coordinates between
 * different system components, and ensures reliable execution of autonomous tasks.
 *
 * Key Responsibilities:
 * - Orchestrates the ReAct agentic loop (Observe → Plan → Act → Re-observe)
 * - Manages communication between side panel, content scripts, and external systems
 * - Handles session management, state coordination, and error recovery
 * - Provides security enforcement, rate limiting, and resource management
 * - Coordinates autonomous intelligence with traditional LLM operations
 *
 * The background script is the "brain" of the HyperAgent system, making intelligent
 * decisions about task execution while maintaining safety and reliability.
 */

import { loadSettings, isSiteBlacklisted, DEFAULTS, STORAGE_KEYS } from '../shared/config';
import { type HistoryEntry, llmClient } from '../shared/llmClient';
import { runMacro as executeMacro } from '../shared/macros';
import { runWorkflow as executeWorkflow, getWorkflowById } from '../shared/workflows';
import {
  trackActionStart,
  trackActionEnd,
  getMetrics,
  getActionMetrics,
  getSuccessRateByDomain,
} from '../shared/metrics';
import {
  createSession,
  getActiveSession,
  updateSessionPageInfo,
  addActionToSession,
  addResultToSession,
  updateExtractedData,
} from '../shared/session';
import {
  checkDomainAllowed,
  checkActionAllowed,
  checkRateLimit,
  initializeSecuritySettings,
  getPrivacySettings,
  getSecurityPolicy,
  type PrivacySettings,
  type SecurityPolicy,
  redact,
} from '../shared/security';
import {
  ExtensionMessage,
  Action,
  ActionResult,
  MsgAgentProgress,
  MsgAgentDone,
  MsgConfirmActions,
  MsgAskUser,
  ErrorType,
  PageContext,
  MacroAction,
  WorkflowAction,
  MsgGetUsage,
  MsgGetUsageResponse,
} from '../shared/types';
import {
  withErrorBoundary,
  withGracefulDegradation,
  errorBoundary,
  gracefulDegradation,
} from '../shared/error-boundary';
import { toolRegistry } from '../shared/tool-system';
import { autonomousIntelligence } from '../shared/autonomous-intelligence';
import { globalLearning } from '../shared/global-learning';
import { billingManager } from '../shared/billing';
import { schedulerEngine } from '../shared/scheduler-engine';
import { getMemoryStats as getMemoryStatsUtil, getStrategiesForDomain } from '../shared/memory';

// ─── Usage Tracking for Monetization ──────────────────────────────────
interface UsageMetrics {
  actionsExecuted: number;
  autonomousSessions: number;
  totalSessionTime: number;
  lastActivity: number;
  subscriptionTier: 'free' | 'premium' | 'unlimited';
  monthlyUsage: {
    actions: number;
    sessions: number;
    resetDate: number;
  };
}

class UsageTracker {
  private metrics: UsageMetrics = {
    actionsExecuted: 0,
    autonomousSessions: 0,
    totalSessionTime: 0,
    lastActivity: Date.now(),
    subscriptionTier: 'free',
    monthlyUsage: {
      actions: 0,
      sessions: 0,
      resetDate: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  };

  async loadMetrics(): Promise<void> {
    try {
      const data = await chrome.storage.local.get('usage_metrics');
      if (data.usage_metrics) {
        this.metrics = { ...this.metrics, ...data.usage_metrics };
        this.checkMonthlyReset();
      }
    } catch (err) {
      console.warn('[UsageTracker] Failed to load metrics:', err);
    }
  }

  async saveMetrics(): Promise<void> {
    try {
      await chrome.storage.local.set({ usage_metrics: this.metrics });
    } catch (err) {
      console.warn('[UsageTracker] Failed to save metrics:', err);
    }
  }

  private checkMonthlyReset(): void {
    if (Date.now() > this.metrics.monthlyUsage.resetDate) {
      // Reset monthly counters
      this.metrics.monthlyUsage = {
        actions: 0,
        sessions: 0,
        resetDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
      };
      this.saveMetrics();
    }
  }

  trackAction(actionType: string): void {
    this.metrics.actionsExecuted++;
    this.metrics.monthlyUsage.actions++;
    this.metrics.lastActivity = Date.now();
    this.saveMetrics();
  }

  trackAutonomousSession(duration: number): void {
    this.metrics.autonomousSessions++;
    this.metrics.totalSessionTime += duration;
    this.metrics.monthlyUsage.sessions++;
    this.metrics.lastActivity = Date.now();
    this.saveMetrics();
  }

  setSubscriptionTier(tier: 'free' | 'premium' | 'unlimited'): void {
    this.metrics.subscriptionTier = tier;
    this.saveMetrics();
  }

  isPremiumFeatureAllowed(feature: string): boolean {
    switch (feature) {
      case 'autonomous_mode':
        return this.metrics.subscriptionTier !== 'free' || this.metrics.monthlyUsage.sessions < 3;
      case 'unlimited_actions':
        return this.metrics.subscriptionTier === 'unlimited';
      case 'advanced_workflows':
        return this.metrics.subscriptionTier !== 'free';
      default:
        return true;
    }
  }

  getUsageLimits(): { actions: number; sessions: number; tier: string } {
    const limits = {
      free: { actions: 100, sessions: 3 },
      premium: { actions: 1000, sessions: 50 },
      unlimited: { actions: -1, sessions: -1 },
    };

    return {
      actions: limits[this.metrics.subscriptionTier].actions,
      sessions: limits[this.metrics.subscriptionTier].sessions,
      tier: this.metrics.subscriptionTier,
    };
  }

  getCurrentUsage(): { actions: number; sessions: number; sessionTime: number } {
    return {
      actions: this.metrics.monthlyUsage.actions,
      sessions: this.metrics.monthlyUsage.sessions,
      sessionTime: this.metrics.totalSessionTime,
    };
  }
}

const usageTracker = new UsageTracker();

// ─── Enhanced Background Script with Production Features ─────────────────

/**
 * Structured logging system for the background service worker.
 *
 * Provides consistent, searchable logging with different severity levels,
 * automatic log rotation, and integration with the extension's monitoring system.
 */
class StructuredLogger {
  /** Current logging level threshold */
  private logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info';
  /** Maximum number of log entries to retain */
  private maxEntries = 1000;
  /** Circular buffer of log entries */
  private logEntries: LogEntry[] = [];

  /**
   * Log a message with specified level and optional data.
   * @param level - Severity level of the log entry
   * @param message - Human-readable log message
   * @param data - Optional structured data for debugging
   */
  log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      data,
      source: 'background',
    };

    this.logEntries.push(entry);
    if (this.logEntries.length > this.maxEntries) {
      this.logEntries.shift();
    }

    // Console output based on log level
    const consoleMethod =
      level === 'debug' ? 'debug' : level === 'warn' ? 'warn' : level === 'error' ? 'error' : 'log';

    console[consoleMethod](`[HyperAgent:${level.toUpperCase()}] ${message}`, data || '');
  }

  /**
   * Retrieve log entries, optionally filtered by level.
   * @param level - Optional level filter
   * @returns Array of matching log entries
   */
  getEntries(level?: 'debug' | 'info' | 'warn' | 'error'): LogEntry[] {
    if (!level) return this.logEntries;
    return this.logEntries.filter(entry => entry.level === level);
  }

  /** Clear all log entries */
  clear(): void {
    this.logEntries = [];
  }
}

/**
 * Log entry structure for structured logging.
 */
interface LogEntry {
  /** Timestamp when the log entry was created */
  timestamp: number;
  /** Severity level of the log entry */
  level: 'debug' | 'info' | 'warn' | 'error';
  /** Human-readable log message */
  message: string;
  /** Optional structured data for debugging */
  data?: any;
  /** Source component that generated the log entry */
  source: string;
}

// ─── Security helpers ─────────────────────────

function isSafeRegex(pattern: string, maxLength = 256): boolean {
  if (typeof pattern !== 'string' || pattern.length === 0 || pattern.length > maxLength)
    return false;
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

function safeInlineText(str: string, max = 500): string {
  const s = (str || '').replace(/[\n\r\t]+/g, ' ').replace(/["'`]/g, '');
  return s.length > max ? s.slice(0, max) : s;
}

// ─── Message Rate Limiter ───────────────────────────────────────────────

/**
 * Rate limiter for extension messages to prevent abuse and ensure stability.
 *
 * Implements sliding window rate limiting per sender to protect against
 * excessive message traffic while allowing legitimate usage patterns.
 */
class MessageRateLimiter {
  /** Rate limit tracking per sender */
  private messageCounts = new Map<string, { count: number; resetTime: number }>();
  /** Maximum messages allowed per minute per sender */
  private readonly maxMessagesPerMinute = 120; // Reasonable limit for extension
  /** Rate limit window duration in milliseconds */
  private readonly windowMs = 60000; // 1 minute

  /**
   * Check if a message can be accepted from the given sender.
   * @param sender - Identifier for the message sender
   * @returns True if message can be accepted, false if rate limited
   */
  canAcceptMessage(sender: string): boolean {
    const now = Date.now();
    const senderData = this.messageCounts.get(sender);

    if (!senderData || now > senderData.resetTime) {
      // Reset or new sender
      this.messageCounts.set(sender, { count: 1, resetTime: now + this.windowMs });
      return true;
    }

    if (senderData.count >= this.maxMessagesPerMinute) {
      return false; // Rate limited
    }

    senderData.count++;
    return true;
  }

  /**
   * Get time until rate limit reset for a sender.
   * @param sender - Sender identifier
   * @returns Milliseconds until rate limit resets
   */
  getTimeUntilReset(sender: string): number {
    const senderData = this.messageCounts.get(sender);
    if (!senderData) return 0;

    const now = Date.now();
    return Math.max(0, senderData.resetTime - now);
  }

  /** Clean up expired rate limit entries */
  cleanup(): void {
    const now = Date.now();
    for (const [sender, data] of this.messageCounts) {
      if (now > data.resetTime) {
        this.messageCounts.delete(sender);
      }
    }
  }
}

// ─── Agent State Manager ───────────────────────────────────────────────

interface AgentState {
  isRunning: boolean;
  isPaused: boolean;
  isAborted: boolean;
  currentSessionId?: string | null;
  hasPendingConfirm?: boolean;
  hasPendingReply?: boolean;
}

/**
 * Comprehensive state management for the autonomous agent.
 *
 * Tracks execution state, manages user confirmations and replies,
 * coordinates recovery attempts, and maintains session information.
 * This is the central nervous system for agent coordination.
 */
class AgentStateManager {
  /** Core agent execution state */
  private state = {
    isRunning: false,
    isAborted: false,
    currentSessionId: null as string | null,
    pendingConfirmResolve: null as ((confirmed: boolean) => void) | null,
    pendingUserReplyResolve: null as ((reply: string) => void) | null,
  };

  private listeners: ((state: AgentState) => void)[] = [];
  private abortController: AbortController | null = null;

  // Recovery state
  /** Tracks recovery attempts per action to prevent infinite loops */
  private recoveryAttempts = new Map<
    string,
    { attempt: number; strategy: string; timestamp: number }
  >();
  /** Maximum recovery attempts allowed per action */
  private readonly MAX_RECOVERY_ATTEMPTS = 3;
  /** Maximum recovery log entries to retain */
  private readonly RECOVERY_LOG_MAX_ENTRIES = 100;
  /** Recovery attempt history for analysis */
  private recoveryLog: {
    timestamp: number;
    action: string;
    error: string;
    strategy: string;
    outcome: string;
  }[] = [];

  // Getters
  /** @returns True if agent is currently executing */
  get isRunning(): boolean {
    return this.state.isRunning;
  }
  /** @returns True if agent execution has been aborted */
  get isAborted(): boolean {
    return this.state.isAborted;
  }
  /** @returns Current session ID or null */
  get currentSessionId(): string | null {
    return this.state.currentSessionId;
  }
  /** @returns True if waiting for user confirmation */
  get hasPendingConfirm(): boolean {
    return this.state.pendingConfirmResolve !== null;
  }
  /** @returns True if waiting for user reply */
  get hasPendingReply(): boolean {
    return this.state.pendingUserReplyResolve !== null;
  }

  getSignal(): AbortSignal | undefined {
    return this.abortController?.signal;
  }

  // Setters with validation
  /**
   * Set agent running state.
   * @param running - New running state
   * @throws Error if running is not boolean
   */
  setRunning(running: boolean): void {
    if (typeof running !== 'boolean') throw new Error('isRunning must be boolean');
    this.state.isRunning = running;

    if (running) {
      this.state.isAborted = false;
      this.abortController = new AbortController();
    } else {
      this.abortController = null;
    }
    this.notifyListeners();
  }

  /**
   * Set agent aborted state.
   * @param aborted - New aborted state
   * @throws Error if aborted is not boolean
   */
  setAborted(aborted: boolean): void {
    if (typeof aborted !== 'boolean') throw new Error('isAborted must be boolean');
    this.state.isAborted = aborted;
    this.notifyListeners();
  }

  abort() {
    this.state.isAborted = true;
    this.state.isRunning = false;

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    // Clear any pending confirmations/replies
    if (this.state.pendingConfirmResolve) {
      this.state.pendingConfirmResolve(false);
      this.state.pendingConfirmResolve = null;
    }
    if (this.state.pendingUserReplyResolve) {
      this.state.pendingUserReplyResolve('');
      this.state.pendingUserReplyResolve = null;
    }

    this.notifyListeners();
  }

  /**
   * Set current session ID.
   * @param sessionId - New session ID or null
   * @throws Error if sessionId is not string or null
   */
  setCurrentSession(sessionId: string | null): void {
    if (sessionId !== null && typeof sessionId !== 'string')
      throw new Error('sessionId must be string or null');
    this.state.currentSessionId = sessionId;
  }

  subscribe(listener: (state: AgentState) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    // Convert internal state to public AgentState
    const publicState: AgentState = {
      isRunning: this.state.isRunning,
      isPaused:
        this.state.pendingConfirmResolve !== null || this.state.pendingUserReplyResolve !== null,
      isAborted: this.state.isAborted,
    };
    this.listeners.forEach(listener => listener(publicState));
  }

  // Promise resolvers
  /**
   * Set resolver for pending confirmation.
   * @param resolve - Promise resolver function
   */
  setConfirmResolver(resolve: (confirmed: boolean) => void): void {
    if (this.state.pendingConfirmResolve) {
      this.state.pendingConfirmResolve(false); // Resolve existing with false
    }
    this.state.pendingConfirmResolve = resolve;
  }

  /**
   * Resolve pending confirmation.
   * @param confirmed - User's confirmation choice
   * @returns True if confirmation was resolved
   */
  resolveConfirm(confirmed: boolean): boolean {
    if (this.state.pendingConfirmResolve) {
      this.state.pendingConfirmResolve(confirmed);
      this.state.pendingConfirmResolve = null;
      return true;
    }
    return false;
  }

  /**
   * Set resolver for pending user reply.
   * @param resolve - Promise resolver function
   */
  setReplyResolver(resolve: (reply: string) => void): void {
    if (this.state.pendingUserReplyResolve) {
      this.state.pendingUserReplyResolve(''); // Resolve existing with empty string
    }
    this.state.pendingUserReplyResolve = resolve;
  }

  /**
   * Resolve pending user reply.
   * @param reply - User's reply text
   * @returns True if reply was resolved
   */
  resolveReply(reply: string): boolean {
    if (this.state.pendingUserReplyResolve) {
      this.state.pendingUserReplyResolve(reply);
      this.state.pendingUserReplyResolve = null;
      return true;
    }
    return false;
  }

  /** @returns Maximum recovery attempts allowed per action */
  get maxRecoveryAttempts(): number {
    return this.MAX_RECOVERY_ATTEMPTS;
  }
  /**
   * Generate a unique key for tracking recovery attempts per action.
   * @param action - The action being recovered
   * @returns Unique recovery key combining action type and content hash
   */
  getRecoveryKey(action: Action): string {
    return `${action.type}-${JSON.stringify(action).slice(0, 30)}`;
  }

  /**
   * Get the number of recovery attempts for a specific action.
   * @param action - The action to check recovery attempts for
   * @returns Number of recovery attempts made so far
   */
  getRecoveryAttempt(action: Action): number {
    const key = this.getRecoveryKey(action);
    const entry = this.recoveryAttempts.get(key);
    return entry?.attempt || 0;
  }

  /**
   * Increment the recovery attempt counter for an action.
   * @param action - The action being recovered
   * @param strategy - The recovery strategy being used
   */
  incrementRecoveryAttempt(action: Action, strategy: string): void {
    const key = this.getRecoveryKey(action);
    const entry = this.recoveryAttempts.get(key) || { attempt: 0, strategy: '', timestamp: 0 };
    entry.attempt += 1;
    entry.strategy = strategy;
    entry.timestamp = Date.now();
    this.recoveryAttempts.set(key, entry);
  }

  /**
   * Clear recovery attempt tracking for an action.
   * @param action - The action to clear recovery tracking for
   */
  clearRecoveryAttempt(action: Action): void {
    const key = this.getRecoveryKey(action);
    this.recoveryAttempts.delete(key);
  }

  /**
   * Log the outcome of a recovery attempt for analysis.
   * @param action - The action that was recovered
   * @param error - The original error that triggered recovery
   * @param strategy - The recovery strategy used
   * @param outcome - The outcome of the recovery attempt
   */
  logRecoveryOutcome(action: Action, error: string, strategy: string, outcome: string): void {
    const entry = {
      timestamp: Date.now(),
      action: action.type,
      error,
      strategy,
      outcome,
    };
    this.recoveryLog.push(entry);

    // Keep log bounded
    if (this.recoveryLog.length > this.RECOVERY_LOG_MAX_ENTRIES) {
      this.recoveryLog.shift();
    }

    console.log(`[HyperAgent] Recovery ${outcome}: ${action.type} - ${error} - ${strategy}`);
  }

  // Cleanup methods
  /** Clean up expired recovery attempt tracking (older than 24 hours) */
  cleanupExpiredRecoveryAttempts(): void {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours
    for (const [key, entry] of this.recoveryAttempts) {
      if (entry.timestamp < cutoff) {
        this.recoveryAttempts.delete(key);
      }
    }
  }

  /**
   * Get comprehensive recovery statistics for monitoring.
   * @returns Recovery statistics including active attempts and failure rates
   */
  getRecoveryStats(): any {
    return {
      activeAttempts: this.recoveryAttempts.size,
      totalLoggedRecoveries: this.recoveryLog.length,
      recentFailures: this.recoveryLog.filter(
        entry => entry.timestamp > Date.now() - 60 * 60 * 1000 && entry.outcome === 'failed'
      ).length,
    };
  }

  // Reset all state (for testing/cleanup)
  /** Reset all agent state for testing or cleanup purposes */
  reset(): void {
    this.state = {
      isRunning: false,
      isAborted: false,
      currentSessionId: null,
      pendingConfirmResolve: null,
      pendingUserReplyResolve: null,
    };
    this.recoveryAttempts.clear();
    this.recoveryLog = [];
  }
}

// ─── Global instances ───────────────────────────────────────────────────
/** Global structured logger for consistent logging across the background script */
const logger = new StructuredLogger();
/** Global message rate limiter to prevent abuse and ensure stability */
const rateLimiter = new MessageRateLimiter();
/** Global agent state manager for coordinating agent execution and recovery */
const agentState = new AgentStateManager();
/** Global enhanced LLM client instance with autonomous intelligence integration */
// llmClient is imported from shared/llmClient as a singleton instance

// ─── Input validation ───────────────────────────────────────────────────

/**
 * Validate incoming extension messages for security and correctness.
 *
 * Ensures messages conform to expected structure and contain required fields
 * before processing to prevent security vulnerabilities and runtime errors.
 *
 * @param message - The message to validate
 * @returns True if message is valid and properly structured
 */
function validateExtensionMessage(message: any): message is ExtensionMessage {
  if (!message || typeof message !== 'object') return false;
  const { type } = message as any;
  if (typeof type !== 'string') return false;

  switch (type) {
    case 'executeCommand':
      return (
        typeof (message as any).command === 'string' &&
        ((message as any).useAutonomous === undefined ||
          typeof (message as any).useAutonomous === 'boolean')
      );
    case 'stopAgent':
      return true;
    case 'confirmResponse':
      return typeof (message as any).confirmed === 'boolean';
    case 'userReply':
      return typeof (message as any).reply === 'string';
    case 'getAgentStatus':
    case 'clearHistory':
    case 'getMetrics':
    case 'contextMenuCommand':
      return typeof (message as any).command === 'string';
    case 'captureScreenshot':
      return true;
    default:
      return false;
  }
}

// ─── Main script ────────────────────────────────────────────────────────

/**
 * Main background service worker definition using WXT framework.
 *
 * This is the entry point for the background script that orchestrates the entire
 * HyperAgent autonomous AI browser agent. It sets up event listeners, initializes
 * background tasks, and coordinates all system components.
 *
 * Key responsibilities:
 * - Extension installation and setup
 * - Context menu handling
 * - Message routing and validation
 * - Background task scheduling (cleanup, monitoring)
 * - Error boundary setup for reliability
 */
export default defineBackground(() => {
  // ─── Cleanup intervals ───────────────────────────────────────────────
  setInterval(
    () => {
      rateLimiter.cleanup();
      agentState.cleanupExpiredRecoveryAttempts();
    },
    5 * 60 * 1000
  ); // Every 5 minutes

  // ─── On install: configure side panel ───────────────────────────
  chrome.runtime.onInstalled.addListener(async () => {
    await withErrorBoundary('extension_installation', async () => {
      // 3. Initialize Global Learning
      globalLearning
        .fetchGlobalWisdom()
        .catch(e => logger.log('error', 'Global learning fetch failed', e));

      // Set up periodic sync
      setInterval(
        () => {
          globalLearning
            .publishPatterns()
            .catch(e => console.error('[GlobalLearning] Publish failed:', e));
          globalLearning
            .fetchGlobalWisdom()
            .catch(e => console.error('[GlobalLearning] Fetch failed:', e));
        },
        1000 * 60 * 60
      ); // Every hour

      logger.log('info', 'HyperAgent background initialized');

      if (chrome.sidePanel?.setPanelBehavior) {
        await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
      }

      // Ensure context menus are cleared before re-creating to avoid "duplicate ID" errors
      chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
          id: 'hyperagent-send-page',
          title: 'Send this page to HyperAgent',
          contexts: ['page'],
        });

        chrome.contextMenus.create({
          id: 'hyperagent-summarize',
          title: 'Summarize this page with HyperAgent',
          contexts: ['page'],
        });

        chrome.contextMenus.create({
          id: 'hyperagent-selection',
          title: 'Ask HyperAgent about selection',
          contexts: ['selection'],
        });
      });

      const settings = await loadSettings();
      if (!settings.apiKey) {
        chrome.runtime.openOptionsPage();
      }

      // Restore session on startup
      const existingSession = await withErrorBoundary('session_restoration', async () => {
        return await getActiveSession();
      });

      if (existingSession) {
        agentState.setCurrentSession(existingSession.id);
        logger.log('info', 'Restored session', { sessionId: existingSession.id });
      }

      // Initialize security settings
      await withErrorBoundary('security_initialization', async () => {
        await initializeSecuritySettings();
        // Initialize Long-Term Memory
        const { memoryManager } = await import('../shared/memory-system');
        await memoryManager.initialize();
        // Initialize Scheduler
        const { schedulerEngine } = await import('../shared/scheduler-engine');
        await schedulerEngine.initialize();
      });
    });
  });

  // ─── Context menu handler ──────────────────────────────────────
  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    await withErrorBoundary('context_menu_handling', async () => {
      if (!tab?.id) {
        logger.log('warn', 'Context menu clicked without valid tab');
        return;
      }

      // Rate limiting check
      if (!rateLimiter.canAcceptMessage(`tab_${tab.id}`)) {
        logger.log('warn', 'Rate limit exceeded for context menu');
        return;
      }

      if (chrome.sidePanel?.open) {
        await chrome.sidePanel.open({ tabId: tab.id });
      }

      let command = '';
      switch (info.menuItemId) {
        case 'hyperagent-send-page':
          command = `Analyze this page: ${tab.url}`;
          break;
        case 'hyperagent-summarize':
          command = `Summarize the content of this page in detail.`;
          break;
        case 'hyperagent-selection':
          command = `Regarding the selected text: "${safeInlineText(info.selectionText || '', 300)}" — explain or act on this.`;
          break;
      }

      if (command) {
        setTimeout(() => {
          sendToSidePanel({ type: 'contextMenuCommand', command });
        }, 600);
      }
    });
  });

  // ─── Autonomous Mode Integration ─────────────────────────────────────

  /**
   * High-intelligence execution loop using the AutonomousIntelligenceEngine.
   * This uses Tree of Thoughts reasoning, advanced planning, and adaptive learning.
   */
  async function runAutonomousLoop(command: string) {
    if (agentState.isRunning) return;

    // Check premium feature access
    if (!usageTracker.isPremiumFeatureAllowed('autonomous_mode')) {
      sendToSidePanel({
        type: 'agentDone',
        finalSummary:
          'Autonomous mode requires Premium subscription. Upgrade to unlock unlimited autonomous sessions.',
        success: false,
        stepsUsed: 0,
      });
      return;
    }

    agentState.setRunning(true);
    agentState.setAborted(false);

    const sessionStart = Date.now();

    const settings = await loadSettings();
    if (!settings.apiKey) {
      sendToSidePanel({
        type: 'agentDone',
        finalSummary: 'API key not set. Open settings (gear icon) and add your API key.',
        success: false,
        stepsUsed: 0,
      });
      agentState.setRunning(false);
      return;
    }
    const tabId = await getActiveTabId();
    const tab = await chrome.tabs.get(tabId);

    try {
      // 1. Initialize Autonomous Engine with Callbacks
      autonomousIntelligence.setLLMClient(llmClient);
      autonomousIntelligence.setCallbacks({
        onProgress: (status, step, summary) => {
          sendToSidePanel({ type: 'agentProgress', status, step: step as any, summary });
        },
        onAskUser: async question => {
          sendToSidePanel({ type: 'askUser', question });
          return await askUserForInfo(question);
        },
        onConfirmActions: async (actions, step, summary) => {
          return await askUserConfirmation(actions, step, summary);
        },
        executeAction: async action => {
          return await executeAction(tabId, action, settings.dryRun, settings.autoRetry, tab.url);
        },
        captureScreenshot: async () => {
          return await captureScreenshot();
        },
        onDone: (summary, success) => {
          sendToSidePanel({ type: 'agentDone', finalSummary: summary, success, stepsUsed: 0 });
        },
      });

      logger.log('info', 'Starting autonomous reasoning for task', { command: redact(command) });
      sendToSidePanel({ type: 'agentProgress', status: 'Thinking (Advanced)...', step: 'plan' });

      const pageCtx = await getPageContext(tabId);
      const plan = await autonomousIntelligence.understandAndPlan(command, {
        taskDescription: command,
        availableTools: [
          'navigate',
          'click',
          'fill',
          'extract',
          'scroll',
          'wait',
          'hover',
          'focus',
          'select',
        ],
        previousAttempts: [],
        environmentalData: {
          url: tab.url,
          html: pageCtx.bodyText.slice(0, 5000),
          screenshotBase64: settings.enableVision ? await captureScreenshot() : undefined,
        },
        userPreferences: {},
        domainKnowledge: {},
        successPatterns: [],
      });

      logger.log('info', 'Autonomous plan generated', { planSteps: plan.steps.length });

      // 3. Execute with Adaptation
      const result = await autonomousIntelligence.executeWithAdaptation(plan);

      const finalSummary = result.success
        ? `Task completed successfully. Learnings: ${result.learnings.slice(0, 2).join('; ')}`
        : `Task failed: ${result.error}`;

      sendToSidePanel({
        type: 'agentDone',
        finalSummary,
        success: result.success,
        stepsUsed: result.results.length,
      });
    } catch (err: any) {
      logger.log('error', 'Autonomous loop failed', { error: err.message });
      sendToSidePanel({
        type: 'agentDone',
        finalSummary: `Autonomous Error: ${err.message}`,
        success: false,
        stepsUsed: 0,
      });
    } finally {
      agentState.setRunning(false);
      // Track session usage
      const sessionDuration = Date.now() - sessionStart;
      usageTracker.trackAutonomousSession(sessionDuration);
    }
  }

  chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
    (async () => {
      await withErrorBoundary('message_processing', async () => {
        // Rate limiting
        const senderId = sender.tab?.id ? `tab_${sender.tab.id}` : 'unknown';
        if (!rateLimiter.canAcceptMessage(senderId)) {
          logger.log('warn', 'Message rate limited', { senderId });
          sendResponse({ ok: false, error: 'Rate limit exceeded' });
          return;
        }

        // Input validation
        if (!validateExtensionMessage(message)) {
          logger.log('warn', 'Invalid message received', { message: redact(message), senderId });
          sendResponse({ ok: false, error: 'Invalid message format' });
          return;
        }

        logger.log('debug', 'Processing message', { type: message.type, senderId });

        // Route message
        const result = await handleExtensionMessage(message, sender);
        sendResponse(result);
      });
    })();

    // Keep channel open for async response
    return true;
  });

  // ─── Message handler function ─────────────────────────────────────
  /**
   * Route and handle validated extension messages.
   *
   * This function processes all incoming messages from the side panel and content scripts,
   * routing them to appropriate handlers while maintaining security and state consistency.
   *
   * @param message - Validated extension message
   * @param sender - Chrome message sender information
   * @returns Response object with success status and optional data
   */
  async function handleExtensionMessage(
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender
  ): Promise<any> {
    switch (message.type) {
      case 'executeCommand': {
        if (agentState.isRunning) {
          return { ok: false, error: 'Agent is already running' };
        }

        // Determine which loop to run
        const loopToRun = message.useAutonomous ? runAutonomousLoop : runAgentLoop;

        // Start agent asynchronously
        loopToRun(message.command).catch(err => {
          logger.log('error', 'Agent loop error', err);
          sendToSidePanel({
            type: 'agentDone',
            finalSummary: `Agent error: ${err.message || String(err)}`,
            success: false,
            stepsUsed: 0,
          });
          agentState.setRunning(false);
        });

        return { ok: true };
      }

      case 'stopAgent': {
        agentState.setAborted(true);
        if (agentState.hasPendingConfirm) {
          agentState.resolveConfirm(false);
        }
        if (agentState.hasPendingReply) {
          agentState.resolveReply('');
        }
        return { ok: true };
      }

      case 'confirmResponse': {
        // Ensure confirmed is a boolean
        const confirmed = Boolean(message.confirmed);
        const resolved = agentState.resolveConfirm(confirmed);
        return { ok: resolved };
      }

      case 'userReply': {
        const resolved = agentState.resolveReply(message.reply);
        return { ok: resolved };
      }

      case 'getAgentStatus': {
        return {
          ok: true,
          status: {
            isRunning: agentState.isRunning,
            isAborted: agentState.isAborted,
            currentSessionId: agentState.currentSessionId,
            hasPendingConfirm: agentState.hasPendingConfirm,
            hasPendingReply: agentState.hasPendingReply,
            recoveryStats: agentState.getRecoveryStats(),
          },
        };
      }

      case 'clearHistory': {
        // Clear agent state and recovery logs
        agentState.reset();
        logger.clear();
        return { ok: true };
      }

      case 'getMetrics': {
        return {
          ok: true,
          metrics: {
            logs: logger.getEntries(),
            recovery: agentState.getRecoveryStats(),
            rateLimitStatus: {
              canAccept: rateLimiter.canAcceptMessage('query'),
              timeUntilReset: rateLimiter.getTimeUntilReset('query'),
            },
          },
        };
      }

      case 'captureScreenshot': {
        const dataUrl = await captureScreenshot();
        return { ok: true, dataUrl };
      }

      case 'getUsage': {
        const usage = usageTracker.getCurrentUsage();
        const limits = usageTracker.getUsageLimits();
        return {
          ok: true,
          usage,
          limits,
        };
      }

      case 'getMemoryStats': {
        const stats = await getMemoryStatsUtil();
        const strategiesData = await chrome.storage.local.get('hyperagent_site_strategies');
        return {
          ok: true,
          ...stats,
          strategies: strategiesData.hyperagent_site_strategies || {},
        };
      }

      case 'getScheduledTasks': {
        const tasks = schedulerEngine.getAllTasks();
        return { ok: true, tasks };
      }

      case 'toggleScheduledTask': {
        const msg = message as any;
        const task = schedulerEngine.enableTask(msg.taskId, msg.enabled ?? true);
        return { ok: !!task, task };
      }

      case 'deleteScheduledTask': {
        const msg = message as any;
        const deleted = schedulerEngine.deleteTask(msg.taskId);
        return { ok: deleted };
      }

      case 'installWorkflow': {
        const msg = message as any;
        const workflows: Record<string, any> = {
          'web-scraper': {
            id: 'web-scraper',
            name: 'Web Scraper',
            actions: [{ type: 'extract', description: 'Extract data from page' }],
          },
          'email-automation': {
            id: 'email-automation',
            name: 'Email Automation',
            actions: [{ type: 'fill', description: 'Fill email form' }],
          },
          'social-media-poster': {
            id: 'social-media-poster',
            name: 'Social Media Poster',
            actions: [{ type: 'click', description: 'Post to social media' }],
          },
          'invoice-processor': {
            id: 'invoice-processor',
            name: 'Invoice Processor',
            actions: [{ type: 'extract', description: 'Extract invoice data' }],
          },
        };
        const workflow = workflows[msg.workflowId];
        if (workflow) {
          return { ok: true, workflow };
        }
        return { ok: false, error: 'Workflow not found' };
      }

      default:
        return { ok: false, error: 'Unknown message type' };
    }
  }

  // ─── Helper functions ─────────────────────────────────────────────

  function sendToSidePanel(msg: ExtensionMessage) {
    chrome.runtime.sendMessage(msg).catch(() => {});
  }

  async function getActiveTabId(): Promise<number> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('No active tab found');
    return tab.id;
  }

  async function getPageContext(tabId: number): Promise<PageContext> {
    // Try direct message first
    try {
      const response = await chrome.tabs.sendMessage(tabId, { type: 'getContext' });
      if (response?.context) return response.context;
    } catch (err: any) {
      // Check if this is a chrome:// URL error (expected behavior)
      if (err?.message?.includes('Cannot access a chrome:// URL')) {
        logger.log('info', 'Skipping chrome:// URL context extraction (expected behavior)');
      } else {
        console.warn('[HyperAgent] Failed to get direct context:', err);
      }
    }

    // Inject content script (skip for chrome:// URLs)
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.url?.startsWith('chrome://')) {
        // Return minimal context for chrome:// pages
        return {
          url: tab.url || '',
          title: tab.title || 'Chrome Settings',
          bodyText: '',
          metaDescription: '',
          formCount: 0,
          semanticElements: [],
          timestamp: Date.now(),
          scrollPosition: { x: 0, y: 0 },
          viewportSize: { width: 0, height: 0 },
          pageHeight: 0,
        };
      }

      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['/content-scripts/content.js'],
      });
      await delay(400);
      const response = await chrome.tabs.sendMessage(tabId, { type: 'getContext' });
      if (response?.context) return response.context;
    } catch (err: any) {
      console.error('[HyperAgent] Failed to inject/query content script:', err);
    }

    // Minimal fallback
    const tab = await chrome.tabs.get(tabId);
    return {
      url: tab.url || '',
      title: tab.title || '',
      bodyText: '',
      metaDescription: '',
      formCount: 0,
      semanticElements: [],
      timestamp: Date.now(),
      scrollPosition: { x: 0, y: 0 },
      viewportSize: { width: 0, height: 0 },
      pageHeight: 0,
    };
  }

  async function captureScreenshot(): Promise<string> {
    try {
      const dataUrl = await chrome.tabs.captureVisibleTab(undefined as any, {
        format: 'jpeg',
        quality: 60,
      });
      return dataUrl.replace(/^data:image\/\w+;base64,/, '');
    } catch (err) {
      console.warn('[HyperAgent] Screenshot capture failed:', err);
      return '';
    }
  }

  function isDestructive(action: Action): boolean {
    if (action.destructive === true) return true;
    if (action.type === 'navigate') return true;
    if (action.type === 'goBack') return true;
    if (action.type === 'closeTab') return true;
    if (action.type === 'click' || action.type === 'pressKey') {
      const desc = ((action as any).description || '').toLowerCase();
      const destructiveKeywords = [
        'submit',
        'buy',
        'purchase',
        'order',
        'confirm',
        'delete',
        'remove',
        'post',
        'send',
        'pay',
        'checkout',
        'sign out',
        'log out',
        'unsubscribe',
        'cancel subscription',
        'place order',
        'complete purchase',
        'publish',
        'reply',
        'comment',
      ];
      if (destructiveKeywords.some(kw => desc.includes(kw))) return true;
    }
    return false;
  }

  function askUserConfirmation(actions: Action[], step: number, summary: string): Promise<boolean> {
    return new Promise(resolve => {
      agentState.setConfirmResolver(resolve);
      sendToSidePanel({
        type: 'confirmActions',
        actions,
        step,
        summary,
      } as MsgConfirmActions);

      setTimeout(() => {
        if (agentState.hasPendingConfirm) {
          agentState.resolveConfirm(false);
        }
      }, DEFAULTS.CONFIRM_TIMEOUT_MS);
    });
  }

  function askUserForInfo(question: string): Promise<string> {
    return new Promise(resolve => {
      agentState.setReplyResolver(resolve);
      sendToSidePanel({ type: 'askUser', question });

      setTimeout(() => {
        if (agentState.hasPendingReply) {
          agentState.resolveReply('');
        }
      }, 120000); // 2 min timeout for user replies
    });
  }

  function jitter(base: number, pct = 0.2): number {
    const delta = base * pct;
    return Math.max(0, base + (Math.random() * 2 - 1) * delta);
  }

  function delayForErrorType(errorType?: string): number {
    switch (errorType) {
      case 'ELEMENT_NOT_VISIBLE':
        return jitter(800, 0.3);
      case 'ELEMENT_DISABLED':
        return jitter(1500, 0.25);
      case 'TIMEOUT':
        return jitter(1000, 0.3);
      default:
        return jitter(300, 0.5);
    }
  }

  async function executeAction(
    tabId: number,
    action: Action,
    dryRun: boolean,
    autoRetry: boolean,
    pageUrl?: string
  ): Promise<ActionResult> {
    const startTime = Date.now();

    // Track action start
    const actionId = trackActionStart(action, pageUrl);

    if (dryRun) {
      console.log('[HyperAgent][DRY-RUN] Would execute:', JSON.stringify(action));
      trackActionEnd(actionId, true, Date.now() - startTime, pageUrl);
      return { success: true };
    }

    // Handle navigation in background
    if (action.type === 'navigate') {
      try {
        await chrome.tabs.update(tabId, { url: action.url });
        await waitForTabLoad(tabId);
        return { success: true };
      } catch (err: any) {
        return {
          success: false,
          error: `Navigation failed: ${err.message}`,
          errorType: 'NAVIGATION_ERROR' as ErrorType,
        };
      }
    }

    if (action.type === 'goBack') {
      try {
        await chrome.tabs.goBack(tabId);
        await waitForTabLoad(tabId);
        return { success: true };
      } catch (err: any) {
        return {
          success: false,
          error: `Go back failed: ${err.message}`,
          errorType: 'NAVIGATION_ERROR' as ErrorType,
        };
      }
    }

    if (action.type === 'wait') {
      await delay(action.ms);
      return { success: true };
    }

    // Handle tab actions in background (no content script needed)
    if (action.type === 'openTab') {
      const result = await openTab(action.url, action.active);
      if (result.success && result.tabId) {
        return { success: true, extractedData: `Opened tab ${result.tabId}: ${action.url}` };
      }
      return { success: false, error: result.error || 'Failed to open tab' };
    }

    if (action.type === 'closeTab') {
      const targetTabId = action.tabId ?? tabId;
      const result = await closeTab(targetTabId);
      if (result.success) {
        return { success: true, extractedData: `Closed tab ${targetTabId}` };
      }
      return { success: false, error: result.error || 'Failed to close tab' };
    }

    if (action.type === 'switchTab') {
      let targetTabId = action.tabId;

      // If no tabId provided, try to find by URL pattern
      if (!targetTabId && action.urlPattern) {
        const findResult = await findTabByUrl(action.urlPattern);
        if (!findResult.success || !findResult.tabId) {
          return { success: false, error: findResult.error || 'Tab not found' };
        }
        targetTabId = findResult.tabId;
      }

      if (!targetTabId) {
        return { success: false, error: 'No tabId or urlPattern provided for switchTab' };
      }

      const result = await switchToTab(targetTabId);
      if (result.success) {
        return { success: true, extractedData: `Switched to tab ${targetTabId}` };
      }
      return { success: false, error: result.error || 'Failed to switch tab' };
    }

    if (action.type === 'getTabs') {
      const result = await getAllTabs();
      if (result.success && result.tabs) {
        return { success: true, extractedData: JSON.stringify(result.tabs) };
      }
      return { success: false, error: result.error || 'Failed to get tabs' };
    }

    // Handle runMacro action - execute a saved sequence of actions
    if (action.type === 'runMacro') {
      const macroAction = action as MacroAction;
      const macroResult = await executeMacro(macroAction.macroId, async (subAction: Action) => {
        // Execute each action in the macro
        return await executeAction(tabId, subAction, dryRun, autoRetry);
      });

      if (macroResult.success) {
        return {
          success: true,
          extractedData: `Macro executed successfully with ${macroResult.results.length} actions`,
        };
      }
      return { success: false, error: macroResult.error || 'Macro execution failed' };
    }

    // Handle runWorkflow action - execute a saved workflow with conditional logic
    if (action.type === 'runWorkflow') {
      const workflowAction = action as WorkflowAction;
      const workflowResult = await executeWorkflow(
        workflowAction.workflowId,
        async (subAction: Action) => {
          // Execute each action in the workflow
          return await executeAction(tabId, subAction, dryRun, autoRetry);
        }
      );

      if (workflowResult.success) {
        return {
          success: true,
          extractedData: `Workflow executed successfully with ${workflowResult.results?.length || 0} steps`,
        };
      }
      return { success: false, error: workflowResult.error || 'Workflow execution failed' };
    }

    // Higher-order function for the content script action to allow retries
    const attempt = async (): Promise<ActionResult> => {
      try {
        const response = await chrome.tabs.sendMessage(tabId, {
          type: 'executeActionOnPage',
          action,
        });
        // Validate response structure
        if (!response || typeof response !== 'object') {
          return {
            success: false,
            error: 'Invalid response from content script',
            errorType: 'ACTION_FAILED' as ErrorType,
          };
        }
        if (typeof response.success !== 'boolean') {
          return {
            success: false,
            error: 'Response missing success field',
            errorType: 'ACTION_FAILED' as ErrorType,
          };
        }
        return response as ActionResult;
      } catch (err: any) {
        return {
          success: false,
          error: `Content script error: ${err.message}`,
          errorType: 'ACTION_FAILED' as ErrorType,
        };
      }
    };

    let result: ActionResult = await attempt();

    // Ensure result is always valid
    if (!result) {
      result = {
        success: false,
        error: 'Unknown action error',
        errorType: 'ACTION_FAILED' as ErrorType,
      };
    }

    // Auto-retry with enhanced error classification and recovery tracking
    if (!result.success && autoRetry) {
      // Validate and sanitize error type
      const validErrorTypes: ErrorType[] = [
        'ELEMENT_NOT_FOUND',
        'ELEMENT_NOT_VISIBLE',
        'ELEMENT_DISABLED',
        'ACTION_FAILED',
        'TIMEOUT',
        'NAVIGATION_ERROR',
        'UNKNOWN',
      ];
      let errorType: ErrorType = result.errorType || 'ACTION_FAILED';
      if (!validErrorTypes.includes(errorType)) {
        errorType = 'ACTION_FAILED' as ErrorType;
      }

      const currentAttempt = agentState.getRecoveryAttempt(action);

      // Check if we've exceeded max recovery attempts
      if (currentAttempt >= agentState.maxRecoveryAttempts) {
        agentState.logRecoveryOutcome(action, errorType, 'max-attempts-exceeded', 'failed');
        agentState.clearRecoveryAttempt(action);
        trackActionEnd(actionId, false, Date.now() - startTime, pageUrl);
        return result;
      }

      console.log(
        `[HyperAgent] Action failed with error type: ${errorType}. Recovery attempt ${currentAttempt + 1}/${agentState.maxRecoveryAttempts}...`
      );

      // Determine recovery strategy based on error type
      let recoveryStrategy = 'basic-retry';
      if (errorType === 'ELEMENT_NOT_FOUND') {
        recoveryStrategy = 'element-not-found-retry';
      } else if (errorType === 'ELEMENT_NOT_VISIBLE') {
        recoveryStrategy = 'element-not-visible-scroll';
      } else if (errorType === 'ELEMENT_DISABLED') {
        recoveryStrategy = 'element-disabled-wait';
      } else if (errorType === 'ACTION_FAILED' || errorType === 'TIMEOUT') {
        recoveryStrategy = 'action-failed-reconstruct';
      } else if (errorType === 'NAVIGATION_ERROR') {
        recoveryStrategy = 'navigation-error-skip';
      }

      // Enhanced retry based on error type
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['/content-scripts/content.js'],
        });

        // Wait based on error type with jitter
        await delay(delayForErrorType(errorType));

        // Increment recovery attempt counter
        agentState.incrementRecoveryAttempt(action, recoveryStrategy);

        result = await attempt();

        // If succeeded, log successful recovery
        if (result.success) {
          if (result.recovered) {
            agentState.logRecoveryOutcome(
              action,
              errorType || 'UNKNOWN',
              recoveryStrategy,
              'recovered'
            );
          } else {
            agentState.logRecoveryOutcome(
              action,
              errorType || 'UNKNOWN',
              recoveryStrategy,
              'success'
            );
          }
          agentState.clearRecoveryAttempt(action);
        }
      } catch (err) {
        // Injection failed — log and return original error
        agentState.logRecoveryOutcome(
          action,
          errorType || 'UNKNOWN',
          recoveryStrategy,
          'injection-failed'
        );
        agentState.clearRecoveryAttempt(action);
      }
    }

    // Track metrics for the action result
    trackActionEnd(actionId, result.success, Date.now() - startTime, pageUrl);

    // Track usage for billing
    if (result.success) {
      usageTracker.trackAction(action.type);
    }

    return result;
  }

  // ─── Main agent loop ──────────────────────────────────────────
  async function runAgentLoop(command: string) {
    logger.log('info', 'Starting agent loop', { command: redact(command) });
    agentState.setRunning(true);
    agentState.setAborted(false);

    const settings = await loadSettings();
    if (!settings.apiKey) {
      sendToSidePanel({
        type: 'agentDone',
        finalSummary: 'API key not set. Open settings (gear icon) and add your API key.',
        success: false,
        stepsUsed: 0,
      });
      agentState.setRunning(false);
      return;
    }
    const maxSteps = settings.maxSteps;
    const tabId = await getActiveTabId();

    const tab = await chrome.tabs.get(tabId);
    if (tab.url && isSiteBlacklisted(tab.url, settings.siteBlacklist)) {
      sendToSidePanel({
        type: 'agentDone',
        finalSummary: 'Site blacklisted.',
        success: false,
        stepsUsed: 0,
      });
      agentState.setRunning(false);
      return;
    }

    let session = await getActiveSession();
    if (!session || session.pageUrl !== tab.url) {
      session = await createSession(tab.url || '', tab.title || '');
    }
    agentState.setCurrentSession(session.id);

    const history: HistoryEntry[] = [];
    let requestScreenshot = false;

    try {
      for (let step = 1; step <= maxSteps; step++) {
        if (agentState.isAborted) {
          sendToSidePanel({
            type: 'agentDone',
            finalSummary: 'Stopped.',
            success: false,
            stepsUsed: step - 1,
          });
          return;
        }

        // ── Step 1: Observe ──
        sendToSidePanel({ type: 'agentProgress', status: 'Analyzing page...', step: 'observe' });
        let context = await getPageContext(tabId);

        if (requestScreenshot || (step === 1 && settings.enableVision)) {
          const screenshot = await captureScreenshot();
          if (screenshot) {
            context = { ...context, screenshotBase64: screenshot };
            sendToSidePanel({ type: 'visionUpdate', screenshot });
          }
          requestScreenshot = false;
        }

        // ── Step 2: Plan ──
        sendToSidePanel({ type: 'agentProgress', status: 'Planning...', step: 'plan' });
        logger.log('info', 'Calling LLM with command', {
          command: redact(command),
          historyCount: history.length,
        });
        let llmResponse: any;
        const llmCallPromise = llmClient.callLLM({ command, history, context });
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('LLM call timed out after 45 seconds')), 45000)
        );
        try {
          llmResponse = await Promise.race([llmCallPromise, timeoutPromise]);
          logger.log('info', 'LLM response received', {
            summary: llmResponse?.summary,
            actionsCount: llmResponse?.actions?.length,
            done: llmResponse?.done,
            askUser: llmResponse?.askUser,
          });
        } catch (err: any) {
          logger.log('error', 'LLM call failed or timed out', {
            error: err?.message || String(err),
          });
          sendToSidePanel({
            type: 'agentDone',
            finalSummary: `LLM call failed: ${err?.message || String(err)}`,
            success: false,
            stepsUsed: history.length,
          });
          return;
        }

        if (llmResponse.askUser) {
          sendToSidePanel({ type: 'askUser', question: llmResponse.askUser });
          const reply = await askUserForInfo(llmResponse.askUser);
          if (!reply || agentState.isAborted) return;
          history.push({ role: 'user', userReply: reply });
          continue;
        }

        sendToSidePanel({
          type: 'agentProgress',
          status: 'Thinking...',
          step: 'plan',
          summary: llmResponse.summary,
        });

        // Destructive path
        const hasDestructive = llmResponse.actions.some(isDestructive);
        if (hasDestructive) {
          const confirmed = await askUserConfirmation(
            llmResponse.actions,
            step,
            llmResponse.summary
          );
          if (!confirmed || agentState.isAborted) return;
        }

        // ── Step 4: Act ──
        sendToSidePanel({ type: 'agentProgress', status: 'Executing...', step: 'act' });
        const actionResults = [];
        for (const action of llmResponse.actions) {
          if (agentState.isAborted) break;

          if (!action || typeof action !== 'object' || !action.type) {
            logger.log('warn', 'Invalid action structure', { action });
            continue;
          }

          const result = await executeAction(
            tabId,
            action,
            settings.dryRun,
            settings.autoRetry,
            tab.url
          );

          if (
            result &&
            result.success &&
            settings.enableVision &&
            (action.type === 'click' || action.type === 'fill')
          ) {
            sendToSidePanel({ type: 'agentProgress', status: 'Verifying...', step: 'verify' });
            try {
              const vScreenshot = await captureScreenshot();
              if (vScreenshot) {
                sendToSidePanel({ type: 'visionUpdate', screenshot: vScreenshot });
                try {
                  const isVerified = await verifyActionWithVision(action, vScreenshot);
                  if (isVerified && !isVerified.success) {
                    result.success = false;
                    result.error = `Visual Failure: ${isVerified.reason || 'Verification failed'}`;
                  }
                } catch (verifyErr: any) {
                  logger.log('warn', 'Vision verification error', { error: verifyErr.message });
                  // Continue without verification rather than fail
                }
              }
            } catch (screenErr: any) {
              logger.log('warn', 'Screenshot capture failed', { error: screenErr.message });
              // Continue without verification
            }
          }

          if (result) {
            actionResults.push({ action, ...result });
          }
          await delay(DEFAULTS.ACTION_DELAY_MS);
        }

        history.push({ role: 'user', context, command });
        history.push({ role: 'assistant', response: llmResponse, actionsExecuted: actionResults });

        if (llmResponse.done || llmResponse.actions.length === 0) {
          sendToSidePanel({
            type: 'agentDone',
            finalSummary: llmResponse.summary || 'Done',
            success: true,
            stepsUsed: step,
          });
          return;
        }
        await delay(350);
      }
      sendToSidePanel({
        type: 'agentDone',
        finalSummary: 'Max steps reached.',
        success: false,
        stepsUsed: maxSteps,
      });
    } catch (err: any) {
      sendToSidePanel({
        type: 'agentDone',
        finalSummary: `Agent error: ${err?.message || String(err)}`,
        success: false,
        stepsUsed: history.length,
      });
    } finally {
      agentState.setRunning(false);
    }
  }

  // ─── Tab management functions ───────────────────────────────────
  async function openTab(
    url: string,
    active?: boolean
  ): Promise<{ success: boolean; tabId?: number; error?: string }> {
    try {
      const tab = await chrome.tabs.create({ url, active: active ?? true });
      if (tab.id) {
        await waitForTabLoad(tab.id);
        return { success: true, tabId: tab.id };
      }
      return { success: false, error: 'Failed to create tab' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async function closeTab(tabId: number): Promise<{ success: boolean; error?: string }> {
    try {
      await chrome.tabs.remove(tabId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async function switchToTab(tabId: number): Promise<{ success: boolean; error?: string }> {
    try {
      await chrome.tabs.update(tabId, { active: true });
      await chrome.windows.update(tabId as unknown as number, { focused: true }).catch(() => {});
      await waitForTabLoad(tabId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async function findTabByUrl(
    pattern: string
  ): Promise<{ success: boolean; tabId?: number; error?: string }> {
    try {
      if (!isSafeRegex(pattern)) {
        return { success: false, error: 'Invalid or unsafe URL pattern' };
      }
      const tabs = await chrome.tabs.query({});
      const regex = new RegExp(pattern, 'i');
      const matched = tabs.find(tab => tab.url && regex.test(tab.url));
      if (matched?.id) {
        return { success: true, tabId: matched.id };
      }
      return { success: false, error: `No tab found matching pattern` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async function getAllTabs(): Promise<{
    success: boolean;
    tabs?: { id: number; url: string; title: string; active: boolean }[];
    error?: string;
  }> {
    try {
      const tabs = await chrome.tabs.query({});
      return {
        success: true,
        tabs: tabs.map(tab => ({
          id: tab.id!,
          url: tab.url || '',
          title: tab.title || '',
          active: tab.active,
        })),
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async function waitForTabLoad(tabId: number): Promise<void> {
    return new Promise(resolve => {
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      }, 15000);

      function listener(updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            chrome.tabs.onUpdated.removeListener(listener);
            setTimeout(resolve, 600);
          }
        }
      }

      chrome.tabs.onUpdated.addListener(listener);
    });
  }

  function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ─── Reflex Verification Helper ──────────────────────────────────
  async function verifyActionWithVision(
    action: Action,
    screenshotBase64: string
  ): Promise<{ success: boolean; reason?: string }> {
    try {
      const prompt = `
You are the "Reflex" system of an autonomous agent.
The user performed an action: ${JSON.stringify(action)}

Look at the screenshot of the page AFTER the action.
Did the action appear to succeed?

Signs of success:
- Modal closed or opened (if expected)
- Form submitted (no validation errors visible)
- Page navigated or content changed
- "Success" message visible

Signs of failure:
- "Error" or "Invalid" text visible near the element
- Nothing changed (stuck state)
- Validation red borders

Return JSON:
{
  "success": true | false,
  "reason": "Brief explanation"
}`;

      // Call LLM with Vision
      const response = await llmClient.callCompletion({
        messages: [
          { role: 'system', content: prompt },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:image/png;base64,${screenshotBase64}`, detail: 'low' },
              },
            ],
          },
        ],
        temperature: 0.0, // Strict verification
        maxTokens: 300,
      });

      const parsed = JSON.parse(response);
      return {
        success: parsed.success === true,
        reason: parsed.reason,
      };
    } catch (err) {
      console.warn('[Reflex] Verification failed:', err);
      return { success: true }; // Fail open (assume success if check fails)
    }
  }

  // ─── Fallback planner (placeholder for now) ──────────────────────
  function buildFallbackPlan(
    command: string,
    context: PageContext
  ): { summary: string; actions: Action[] } | null {
    // This would be implemented with the comprehensive workflow system
    return null;
  }

  // ─── Scheduler Integration ─────────────────────────────────────
  schedulerEngine.initialize().catch((err: any) => {
    console.error('[Background] Scheduler initialization failed:', err);
  });

  chrome.alarms.onAlarm.addListener(alarm => {
    schedulerEngine.handleAlarm(alarm).catch((err: any) => {
      console.error('[Background] Scheduler alarm handle failed:', err);
    });
  });
});
