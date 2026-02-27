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

import { loadSettings, isSiteBlacklisted, DEFAULTS, STORAGE_KEYS, LogLevel } from '../shared/config';
import { debugService, generateCorrelationId } from '../shared/debug';
import { checkStorageQuota } from '../shared/storage-monitor';
import { initErrorReporter } from '../shared/error-reporter';
import { type HistoryEntry, llmClient, classifyError, clearSemanticCache } from '../shared/llmClient';
import { runMacro as executeMacro } from '../shared/macros';
import { runWorkflow as executeWorkflow, getWorkflowById, hasDestructiveSteps, saveWorkflow } from '../shared/workflows';
import { WORKFLOW_TEMPLATES, validateTemplateParameters, instantiateTemplate, getWorkflowTemplateById } from '../shared/workflow-templates';
import { trackActionStart, trackActionEnd } from '../shared/metrics';
import {
  createSession,
  getActiveSession,
  addUserReply,
  addClarificationQuestion,
  getSessionGoal,
  updateLastIntent,
  deleteSession,
} from '../shared/session';
import {
  checkDomainAllowed,
  checkActionAllowed,
  checkRateLimit,
  initializeSecuritySettings,
  redact,
} from '../shared/security';
import { getOpenRouterHeaders as getOpenRouterHeadersWithEnv, normalizeOpenRouterBaseUrl } from '../shared/openrouterConfig';
import {
  ExtensionMessage,
  Action,
  ActionResult,
  MsgConfirmActions,
  MsgConfirmAutonomousPlan,
  MsgUserReply,
  ErrorType,
  PageContext,
  MacroAction,
  WorkflowAction,
} from '../shared/types';
import { withErrorBoundary } from '../shared/error-boundary';
import { isSafeRegex } from '../shared/safe-regex';
import { toolRegistry } from '../shared/tool-system';
import { autonomousIntelligence } from '../shared/autonomous-intelligence';
import { billingManager } from '../shared/billing';
import { schedulerEngine } from '../shared/scheduler-engine';

// ─── Type Aliases ────────────────────────────────────────────────



import { getMemoryStats as getMemoryStatsUtil } from '../shared/memory';
import { SnapshotManager } from '../shared/snapshot-manager';
import { parseIntent, getSuggestions } from '../shared/intent';
import { failureRecovery } from '../shared/failure-recovery';
import { apiCache, generalCache } from '../shared/advanced-caching';
import { memoryManager } from '../shared/memory-management';
import { inputSanitizer } from '../shared/input-sanitization';
import { validateExtensionMessage } from '../shared/messages';
import { validateStorageIntegrity, DEFAULTS } from '../shared/config';
import { clearDomainMemory, extractDomain, getStrategiesForDomain } from '../shared/memory';
import { debounce } from '../shared/utils';
import { trackAgentRunStart, trackAgentRunEnd } from '../shared/metrics';

// ─── Usage Tracking for Monetization ──────────────────────────────────
interface UsageMetrics {
  actionsExecuted: number;
  autonomousSessions: number;
  totalSessionTime: number;
  lastActivity: number;
  subscriptionTier: SubscriptionTier;
  monthlyUsage: {
    actions: number;
    sessions: number;
    resetDate: number;
  };
}

const SAVE_DEBOUNCE_MS = 500;

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

  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private loadPromise: Promise<void> | null = null;
  private initialized = false;

  async loadMetrics(): Promise<void> {
    if (this.initialized && this.loadPromise) return this.loadPromise;
    this.loadPromise = (async () => {
      try {
        const data = await chrome.storage.local.get('usage_metrics');
        if (data.usage_metrics) {
          this.metrics = { ...this.metrics, ...data.usage_metrics };
          this.checkDailyReset();
        }
        this.initialized = true;
      } catch (err) {
        void err;
        this.loadPromise = null;
        throw err;
      }
    })();
    return this.loadPromise;
  }

  async saveMetrics(): Promise<void> {
    try {
      await chrome.storage.local.set({ usage_metrics: this.metrics });
    } catch (err) {
      void err;
    }
  }

  private scheduleSave(): void {
    if (this.saveTimeout) globalThis.clearTimeout(this.saveTimeout);
    this.saveTimeout = globalThis.setTimeout(() => {
      this.saveTimeout = null;
      this.saveMetrics();
    }, SAVE_DEBOUNCE_MS);
  }

  private checkDailyReset(): void {
    if (Date.now() > this.metrics.monthlyUsage.resetDate) {
      // Reset daily counters to match UI's "Resets daily" label
      this.metrics.monthlyUsage = {
        actions: 0,
        sessions: 0,
        resetDate: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      };
      this.saveMetrics();
    }
  }

  trackAction(_actionType: string): void {
    this.checkDailyReset();
    this.metrics.actionsExecuted++;
    this.metrics.monthlyUsage.actions++;
    this.metrics.lastActivity = Date.now();
    this.scheduleSave();
  }

  trackAutonomousSession(duration: number): void {
    this.checkDailyReset();
    this.metrics.autonomousSessions++;
    this.metrics.totalSessionTime += duration;
    this.metrics.monthlyUsage.sessions++;
    this.metrics.lastActivity = Date.now();
    this.scheduleSave();
  }

  setSubscriptionTier(tier: SubscriptionTier): void {
    this.metrics.subscriptionTier = tier;
    this.scheduleSave();
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
    // Aligned with billing manager: community/free = 500 actions + 10 sessions/day
    // beta/premium/unlimited = unlimited
    const limits: Record<string, { actions: number; sessions: number }> = {
      free: { actions: 500, sessions: 10 },
      community: { actions: 500, sessions: 10 },
      premium: { actions: -1, sessions: -1 },
      beta: { actions: -1, sessions: -1 },
      unlimited: { actions: -1, sessions: -1 },
    };

    const tier = this.metrics.subscriptionTier;
    const tierLimits = limits[tier] || limits.free;

    return {
      actions: tierLimits.actions,
      sessions: tierLimits.sessions,
      tier,
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

// ─── Original Tab Titles (Issue #12, #18) ────────────────────────────
const originalTabTitles = new Map<number, string>();

function saveOriginalTabTitle(tabId: number, title: string): void {
  if (!originalTabTitles.has(tabId)) {
    originalTabTitles.set(tabId, title);
  }
}

function getOriginalTabTitle(tabId: number): string {
  return originalTabTitles.get(tabId) || 'HyperAgent';
}

function clearOriginalTabTitle(tabId: number): void {
  originalTabTitles.delete(tabId);
}

// ─── Enhanced Background Script with Production Features ─────────────────

type SubscriptionTier = 'free' | 'premium' | 'unlimited';

// ─── Security helpers ─────────────────────────

function safeInlineText(str: string, max = 500): string {
  const s = (str || '').replaceAll(/[\n\r\t]+/g, ' ').replaceAll(/["'`]/g, '');
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
  private readonly messageCounts = new Map<string, { count: number; resetTime: number }>();
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
    currentAgentTabId: null as number | null,
    wasScheduledRun: false,
    pendingConfirmResolve: null as ((confirmed: boolean) => void) | null,
    pendingUserReplyResolve: null as ((reply: string) => void) | null,
    currentCorrelationId: null as string | null,
  };

  private listeners: ((state: AgentState) => void)[] = [];
  private abortController: AbortController | null = null;

  // Recovery state
  /** Tracks recovery attempts per action to prevent infinite loops */
  private readonly recoveryAttempts = new Map<
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
  /** @returns Tab ID the agent is acting on, or null */
  get currentAgentTabId(): number | null {
    return this.state.currentAgentTabId;
  }

  /** @returns Correlation ID for the current task, if any */
  get currentCorrelationId(): string | null {
    return this.state.currentCorrelationId;
  }

  setCurrentAgentTabId(tabId: number | null): void {
    this.state.currentAgentTabId = tabId;
  }

  setCorrelationId(id: string | null): void {
    if (id !== null && typeof id !== 'string') throw new Error('correlationId must be string or null');
    this.state.currentCorrelationId = id;
  }

  get wasScheduledRun(): boolean {
    return this.state.wasScheduledRun;
  }
  setScheduledRun(scheduled: boolean): void {
    this.state.wasScheduledRun = scheduled;
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
    debugService.info('agentState', `Agent state changed: isRunning = ${running}`);

    if (running) {
      this.state.isAborted = false;
      this.abortController = new AbortController();
    } else {
      this.state.currentAgentTabId = null;
      this.state.wasScheduledRun = false;
      this.state.currentCorrelationId = null;
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
    debugService.info('agentState', `Agent state changed: isAborted = ${aborted}`);
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
    debugService.info('agentState', `Agent state changed: currentSessionId = ${sessionId}`);
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
      debugService.info('agentState', `User confirmation resolved: ${confirmed}`);
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
      debugService.info('agentState', `User reply resolved: ${reply}`);
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

    debugService.info('recovery', `Recovery ${outcome}: ${action.type} - ${error} - ${strategy}`);
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
      currentAgentTabId: null,
      wasScheduledRun: false,
      pendingConfirmResolve: null,
      pendingUserReplyResolve: null,
      currentCorrelationId: null,
    };
    this.recoveryAttempts.clear();
    this.recoveryLog = [];
  }
}

// ─── Global instances ───────────────────────────────────────────────────

/** Global message rate limiter to prevent abuse and ensure stability */
const rateLimiter = new MessageRateLimiter();
/** Global agent state manager for coordinating agent execution and recovery */
const agentState = new AgentStateManager();
// llmClient is imported from shared/llmClient as a singleton instance

// Initialize usage tracker
usageTracker.loadMetrics();

// Initialize billing manager so subscription state is available
(async () => {
  try {
    await billingManager.initialize();
  } catch (e) {
    debugService.warn('billing', 'init failed', { error: e });
  }
})();

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
  // Initialize error reporter
  initErrorReporter({
    enabled: DEFAULTS.ERROR_REPORTING_ENABLED ?? false,
    environment: "production",
    sampleRate: 0.1,
  });
  // ─── Cleanup intervals ───────────────────────────────────────────────
  globalThis.setInterval(
    () => {
      rateLimiter.cleanup();
      agentState.cleanupExpiredRecoveryAttempts();
    },
    5 * 60 * 1000
  ); // Every 5 minutes

  // ─── Tab closed during agent: abort and notify (Issue #66) ─────────────
  chrome.tabs.onRemoved.addListener((closedTabId) => {
    // Only act if this is the current agent tab
    if (agentState.currentAgentTabId !== closedTabId) return;
    if (!agentState.isRunning) return;

    // Clear saved title for this tab
    clearOriginalTabTitle(closedTabId);

    agentState.setAborted(true);
    if (agentState.hasPendingConfirm) agentState.resolveConfirm(false);
    if (agentState.hasPendingReply) agentState.resolveReply('');
    sendToSidePanel({
      type: 'agentDone',
      finalSummary: 'Tab was closed. Agent stopped.',
      success: false,
      stepsUsed: 0,
    });
    agentState.setRunning(false);
  });

  // ─── On install: configure side panel ───────────────────────────

  // Scenario 50: When update is pending, persist so panel can show "task interrupted"
  if (chrome.runtime.onUpdateAvailable) {
    chrome.runtime.onUpdateAvailable.addListener(() => {
      chrome.storage.local.set({ hyperagent_agent_interrupted_by_update: true }).catch(() => { });
    });
  }

  // Clear stale caches on startup (do NOT remove user preferences like model_name)
  async function clearOldSettings(): Promise<void> {
    try {
      const keysToRemove: string[] = [];

      // Only clear cache entries, not user preferences
      const allKeys = await chrome.storage.local.get(null);
      for (const key of Object.keys(allKeys)) {
        if (key.startsWith('hyperagent_cache_') || key.startsWith('llm_')) {
          keysToRemove.push(key);
        }
      }

      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
        debugService.info('cache', 'Cleared stale caches', { itemCount: keysToRemove.length });
      }
    } catch (err) {
      debugService.warn('cache', 'Failed to clear old settings', { error: err });
    }
  }

  // Run cleanup on every startup
  clearOldSettings();

  // Validate storage integrity on startup so corruption is detected early.
  withErrorBoundary('storage_integrity_startup', async () => {
    const result = await validateStorageIntegrity();
    debugService.info('storage', 'Storage integrity check on startup', result);
    if (!result.healthy && result.repaired) {
      clearSemanticCache(); // Evict semantic cache on schema/repair so cached responses match new schema
      await chrome.storage.local.set({
        hyperagent_storage_recovered: {
          issues: result.issues,
          checkedAt: Date.now(),
        },
      });
    }
  });

  chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
      await chrome.storage.local.set({ hyperagent_show_onboarding: true });
    } else if (details.reason === 'update') {
      await chrome.storage.local.set({ hyperagent_show_changelog: true });
    }
    await withErrorBoundary('extension_installation', async () => {
      debugService.log(LogLevel.INFO, 'background', 'HyperAgent background initialized');
      // Check storage quota on startup
      const quotaCheck = await checkStorageQuota();
      if (!quotaCheck.ok || quotaCheck.message) {
        debugService.log(quotaCheck.ok ? LogLevel.WARN : LogLevel.ERROR, 'background', quotaCheck.message || 'Storage issue');
      }

      if (chrome.sidePanel?.setPanelBehavior) {
        try {
          await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
        } catch (e) {
          debugService.log(LogLevel.WARN, 'background', 'Could not set side panel behavior', { error: (e as Error)?.message });
        }
      }

      // Ensure context menus are cleared before re-creating to avoid "duplicate ID" errors
      try {
        chrome.contextMenus.removeAll(() => {
          try {
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
          } catch (error_) {
            debugService.log(LogLevel.WARN, 'background', 'Context menu creation failed', { error: (error_ as Error)?.message });
          }
        });
      } catch (error_) {
        debugService.log(LogLevel.WARN, 'background', 'Context menu removeAll failed', { error: (error_ as Error)?.message });
      }

      const settings = await loadSettings();

    if (!settings.apiKey) {
        try {
          await chrome.runtime.openOptionsPage();
        } catch (e) {
          debugService.log(LogLevel.WARN, 'background', 'Could not open options page (install flow)', { error: (e as Error)?.message });
        }
      }

      // Restore session on startup
      const existingSession = await withErrorBoundary('session_restoration', async () => {
        return await getActiveSession();
      });

      if (existingSession) {
        agentState.setCurrentSession(existingSession.id);
        debugService.log(LogLevel.INFO, 'session', 'Restored session', { sessionId: existingSession.id });
      }

      // Initialize security settings
      await withErrorBoundary('security_initialization', async () => {
        await initializeSecuritySettings();
      });
    });
  });

  // ─── Context menu handler ──────────────────────────────────────
  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    await withErrorBoundary('context_menu_handling', async () => {
      if (!tab?.id) {
        debugService.log(LogLevel.WARN, 'contextMenu', 'Context menu clicked without valid tab');
        return;
      }

      // Rate limiting check
      if (!rateLimiter.canAcceptMessage(`tab_${tab.id}`)) {
        debugService.log(LogLevel.WARN, 'rateLimiter', 'Rate limit exceeded for context menu');
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
        globalThis.setTimeout(() => {
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
  async function runAutonomousLoop(command: string, modelOverride?: string) {
    const correlationId = generateCorrelationId();
    // Prevent concurrent execution (Issue #14)
    if (agentState.isRunning) {
      sendToSidePanel({
        type: 'agentDone',
        finalSummary: 'Agent is already running. Please wait for the current task to complete.',
        success: false,
        stepsUsed: 0,
      });
      return;
    }
    // modelOverride is forwarded to LLM calls if provided
    void modelOverride; // used in callLLMAutonomous below if we wire it

    // Load metrics first to ensure current usage data (Issue #16)
    await usageTracker.loadMetrics();

    // Check autonomous mode access via billing
    const autoUsage = usageTracker.getCurrentUsage();
    const autoCheck = billingManager.isWithinLimits(autoUsage.actions, autoUsage.sessions);
    if (!autoCheck.allowed) {
      sendToSidePanel({
        type: 'agentDone',
        finalSummary: autoCheck.reason || 'Usage limit reached. Upgrade in the Subscription tab.',
        success: false,
        stepsUsed: 0,
      });
      return;
    }

    agentState.setRunning(true);
    agentState.setAborted(false);
    agentState.setCorrelationId(correlationId);

    const runId = trackAgentRunStart({ isAutonomous: true });
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
    agentState.setCurrentAgentTabId(tabId);
    const tab = await chrome.tabs.get(tabId);

    // Save original title (Issue #12)
    saveOriginalTabTitle(tabId, tab.title || 'HyperAgent');

    // Check domain blacklist for autonomous mode (Issue #29)
    const pageUrl = tab.url || '';
    if (pageUrl && isSiteBlacklisted(pageUrl, settings.siteBlacklist)) {
      sendToSidePanel({
        type: 'agentDone',
        finalSummary: 'Site blacklisted.',
        success: false,
        stepsUsed: 0,
      });
      agentState.setRunning(false);
      return;
    }
    const domainAllowed = await checkDomainAllowed(pageUrl);
    if (!domainAllowed) {
      sendToSidePanel({
        type: 'agentDone',
        finalSummary: 'Domain not allowed by privacy settings.',
        success: false,
        stepsUsed: 0,
      });
      agentState.setRunning(false);
      return;
    }

    try {
      autonomousIntelligence.setLLMClient(llmClient);

      debugService.log(LogLevel.INFO, 'autonomous', 'Starting autonomous reasoning for task', { command: redact(command) });
      sendToSidePanel({ type: 'agentProgress', status: 'Deep reasoning...', step: 'plan' });

      const pageCtx = await getPageContext(tabId);

      // Integrate memory/site strategies into autonomous planning (132)
      let domainKnowledge: Record<string, unknown> = {};
      let successPatterns: Array<{ pattern: string; context: string; successRate: number; lastUsed: number; confidence: number }> = [];
      try {
        const strategy = await getStrategiesForDomain(pageUrl);
        if (strategy) {
          domainKnowledge = {
            domain: strategy.domain,
            successfulLocatorsSummary: strategy.successfulLocators.slice(0, 10).map(s => `${s.actionType}:${String(s.locator).slice(0, 80)}`),
            failedLocatorsSummary: strategy.failedLocators.slice(0, 5).map(f => `${f.errorType}:${String(f.locator).slice(0, 80)}`),
          };
          successPatterns = strategy.successfulLocators
            .filter(s => s.successCount >= 2)
            .slice(0, 5)
            .map(s => ({ pattern: `${s.actionType} on ${String(s.locator).slice(0, 50)}`, context: strategy.domain, successRate: 1, lastUsed: strategy.lastUsed, confidence: 0.8 }));
        }
      } catch (e) {
        debugService.log(LogLevel.WARN, 'autonomous', 'Could not load site strategies for planning', { error: (e as Error)?.message });
      }

      const intelligenceContext = {
        taskDescription: command,
        availableTools: [
          'navigate', 'click', 'fill', 'extract', 'scroll',
          'wait', 'hover', 'focus', 'select',
        ],
        previousAttempts: [] as any[],
        environmentalData: {
          url: tab.url,
          html: pageCtx.bodyText.slice(0, 5000),
          screenshotBase64: settings.enableVision ? await captureScreenshot() : undefined,
        },
        userPreferences: {},
        domainKnowledge,
        successPatterns,
      };

      // Generate autonomous plan
      const plan = await autonomousIntelligence.understandAndPlan(command, intelligenceContext);

      debugService.log(LogLevel.INFO, 'autonomous', 'Autonomous plan generated', { planSteps: plan.steps.length });

      // Overview card: show planned steps and wait for user to Execute or Cancel (131)
      if (plan.steps.length > 0) {
        sendToSidePanel({
          type: 'autonomousPlanOverview',
          steps: plan.steps.map(s => ({ id: s.id, description: s.description })),
          reasoning: plan.reasoning || 'Autonomous plan',
        });
        const PLAN_CONFIRM_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
        const confirmed = await Promise.race<boolean>([
          new Promise<boolean>(resolve => {
            resolveAutonomousPlanConfirmation = resolve;
          }),
          new Promise<boolean>(resolve => {
            globalThis.setTimeout(() => {
              if (resolveAutonomousPlanConfirmation) {
                resolveAutonomousPlanConfirmation(false);
                resolveAutonomousPlanConfirmation = null;
              }
              resolve(false);
            }, PLAN_CONFIRM_TIMEOUT_MS);
          }),
        ]);
        resolveAutonomousPlanConfirmation = null;
        if (!confirmed) {
          sendToSidePanel({
            type: 'agentDone',
            finalSummary: 'Autonomous plan cancelled or timed out.',
            success: false,
            stepsUsed: 0,
          });
          agentState.setRunning(false);
          await trackAgentRunEnd(runId, false, Date.now() - sessionStart, { actionsCount: 0 });
          return;
        }
      }

      // Set callbacks including navigation guardrails (129)
      autonomousIntelligence.setCallbacks({
        onProgress: (status, step, summary) => {
          sendToSidePanel({ type: 'agentProgress', status, step: step as any, thinking: summary || undefined });
        },
        onAskUser: async question => {
          sendToSidePanel({ type: 'askUser', question });
          return await askUserForInfo(question);
        },
        onConfirmActions: async (actions, step, summary) => {
          return await askUserConfirmation(actions, step, summary);
        },
        confirmContinueAfterNavigations: async (currentCount, limit) => {
          sendToSidePanel({ type: 'askUser', question: `Autonomous run has reached ${limit} navigations. Continue with more? (yes/no)` });
          const reply = await askUserForInfo(`Autonomous run has reached ${limit} navigations. Continue with more? (yes/no)`);
          return /yes|continue|ok|sure/i.test(reply || '');
        },
        executeAction: async action => {
          usageTracker.trackAction(action.type);
          return await executeAction(tabId, action, settings.dryRun, settings.autoRetry, tab.url);
        },
        captureScreenshot: async () => {
          return await captureScreenshot();
        },
        onDone: (summary, success) => {
          sendToSidePanel({ type: 'agentDone', finalSummary: summary, success, stepsUsed: 0 });
        },
      });

      // 3. Execute with Adaptation
      const result = await autonomousIntelligence.executeWithAdaptation(plan);

      const finalSummary = result.success
        ? `Task completed successfully. Learnings: ${result.learnings.slice(0, 2).join('; ')}`
        : `Task failed: ${result.error}`;

      await trackAgentRunEnd(runId, result.success, Date.now() - sessionStart, { actionsCount: result.results?.length ?? 0 });
      sendToSidePanel({
        type: 'agentDone',
        finalSummary,
        success: result.success,
        stepsUsed: result.results?.length ?? 0,
      });
    } catch (err: any) {
      debugService.log(LogLevel.ERROR, 'autonomous', 'Autonomous loop failed', { error: err.message });
      await trackAgentRunEnd(runId, false, Date.now() - sessionStart, { actionsCount: 0 });
      sendToSidePanel({
        type: 'agentDone',
        finalSummary: `Autonomous Error: ${err.message}`,
        success: false,
        stepsUsed: 0,
      });
    } finally {
      // Restore tab title (Issue #12)
      const savedTitle = getOriginalTabTitle(tabId);
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          func: (title: string) => { document.title = title; },
          args: [savedTitle]
        });
      } catch (e) {
        debugService.log(LogLevel.WARN, 'tabManager', 'Restore title failed', { error: (e as Error)?.message });
      }
      clearOriginalTabTitle(tabId);

      agentState.setRunning(false);
      // Track session usage even on failure (Issue #17)
      const sessionDuration = Date.now() - sessionStart;
      usageTracker.trackAutonomousSession(sessionDuration);
    }
  }

  chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
    let responded = false;
    const safeSend = (response: unknown): void => {
      if (responded) return;
      responded = true;
      try {
        sendResponse(response);
      } catch (e) {
        debugService.log(LogLevel.ERROR, 'messageHandler', 'sendResponse failed (port closed or non-serializable)', { error: (e as Error)?.message });
      }
    };

    (async () => {
      try {
        await withErrorBoundary('message_processing', async () => {
          // Rate limiting - use better fallback key to reduce collisions
          let senderId: string;
          if (sender.tab?.id) {
            senderId = `tab_${sender.tab.id}`;
          } else if (sender.id) {
            // Use extension sender ID if available
            senderId = `ext_${sender.id}`;
          } else {
            // Fallback: use message type + timestamp to reduce collision
            const msgType = (message as unknown as { type?: string }).type || 'msg';
            senderId = `${msgType}_${Date.now() >> 12}`;
          }
          
          if (!rateLimiter.canAcceptMessage(senderId)) {
            debugService.log(LogLevel.WARN, 'rateLimiter', 'Message rate limited', { senderId });
            const waitSec = Math.ceil(rateLimiter.getTimeUntilReset(senderId) / 1000);
            safeSend({ ok: false, error: `Rate limit exceeded. Try again in ${waitSec} seconds.` });
            return;
          }

          // Input validation
          if (!validateExtensionMessage(message)) {
            debugService.log(LogLevel.WARN, 'messageHandler', 'Invalid message received', { message: redact(message), senderId });
            safeSend({ ok: false, error: 'Invalid message format' });
            return;
          }

          debugService.log(LogLevel.DEBUG, 'messageHandler', 'Processing message', { type: message.type, senderId });

          // Try extended handlers first
          const extendedResult = await handleExtendedMessage(message);
          if (extendedResult !== null) {
            safeSend(extendedResult);
            return;
          }

          // Route message
          const result = await handleExtensionMessage(message, sender);
          safeSend(result);
        });
      } catch (err: unknown) {
        debugService.log(LogLevel.ERROR, 'messageHandler', 'Message handler error', { error: err instanceof Error ? err.message : String(err) });
        safeSend({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' });
      }
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
    _sender: chrome.runtime.MessageSender
  ): Promise<any> {
    switch (message.type) {
      case 'executeCommand': {
        if (agentState.isRunning) {
          return { ok: false, error: 'Agent is already running' };
        }
        agentState.setScheduledRun(message.scheduled === true);

        // Extract optional model override from the UI model selector
        const modelOverride: string | undefined = (message as any).model || undefined;

        // Determine which loop to run
        const loopToRun = message.useAutonomous
          ? (cmd: string) => runAutonomousLoop(cmd, modelOverride)
          : (cmd: string) => runAgentLoop(cmd, modelOverride);

        // Start agent asynchronously
        loopToRun(message.command).catch(err => {
          debugService.log(LogLevel.ERROR, 'agentLoop', 'Agent loop error', { error: err });
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
        const stopTabId = agentState.currentAgentTabId;
        if (stopTabId) {
          const originalTitle = getOriginalTabTitle(stopTabId);
          try {
            await chrome.scripting.executeScript({
              target: { tabId: stopTabId },
              func: (title: string) => { document.title = title; },
              args: [originalTitle]
            });
            clearOriginalTabTitle(stopTabId);
          } catch (err) {
            debugService.log(LogLevel.WARN, 'tabManager', 'Failed to restore tab title on stop', { error: err });
          }
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
        const resolved = agentState.resolveReply((message as MsgUserReply).reply);
        return { ok: resolved };
      }

      case 'confirmAutonomousPlan': {
        const confirmed = (message as MsgConfirmAutonomousPlan).confirmed;
        if (resolveAutonomousPlanConfirmation) {
          resolveAutonomousPlanConfirmation(confirmed);
          resolveAutonomousPlanConfirmation = null;
        }
        return { ok: true };
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
        
        return { ok: true };
      }

      case 'getMetrics': {
        return {
          ok: true,
          metrics: {
            logs: debugService.getLogEntries(),
            recovery: agentState.getRecoveryStats(),
            rateLimitStatus: {
              canAccept: rateLimiter.canAcceptMessage('query'),
              timeUntilReset: rateLimiter.getTimeUntilReset('query'),
            },
          },
        };
      }

      case 'captureScreenshot': {
        const base64 = await captureScreenshot('base64');
        return { ok: true, dataUrl: base64 }; // dataUrl is raw base64; callers add data:image/jpeg;base64, prefix
      }

      case 'getUsage': {
        const usage = usageTracker.getCurrentUsage();
        // Use billingManager as authoritative source for tier-based limits
        const billingLimits = billingManager.getUsageLimit();
        const currentTier = billingManager.getTier();
        return {
          ok: true,
          usage,
          limits: {
            actions: billingLimits.actions,
            sessions: billingLimits.sessions,
            tier: currentTier,
          },
        };
      }

      case 'getMemoryStats': {
        const stats = await getMemoryStatsUtil();
        const [strategiesData, workflowRunsData] = await Promise.all([
          chrome.storage.local.get('hyperagent_site_strategies'),
          chrome.storage.local.get(STORAGE_KEYS.WORKFLOW_RUNS),
        ]);
        return {
          ok: true,
          strategies: strategiesData.hyperagent_site_strategies || {},
          totalActions: stats.totalActions || 0,
          totalSessions: stats.totalSessions || 0,
          domainsCount: stats.domainsCount ?? Object.keys(strategiesData.hyperagent_site_strategies || {}).length,
          oldestEntry: stats.oldestEntry ?? null,
          strategiesPerDomain: stats.strategiesPerDomain,
          largestDomains: stats.largestDomains,
          workflowRuns: (workflowRunsData[STORAGE_KEYS.WORKFLOW_RUNS] as Record<string, any[]>) || {},
        };
      }

      case 'testConnection': {
        try {
          const settings = await loadSettings();
          if (!settings.apiKey || !settings.apiKey.trim()) {
            return { ok: false, error: 'No API key configured' };
          }

          // Test with a simple API call to OpenRouter
          const baseUrl = `${normalizeOpenRouterBaseUrl(settings.baseUrl)}/models`;
          const response = await fetch(baseUrl, {
            headers: getOpenRouterHeadersWithEnv(settings.apiKey, settings.baseUrl),
          });

          if (response.ok) {
            return { ok: true };
          } else {
            return { ok: false, error: `HTTP ${response.status}` };
          }
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : 'Connection failed' };
        }
      }

      // Health check ping/pong - measures latency between sidepanel and background
      case 'ping': {
        return { 
          ok: true, 
          timestamp: Date.now(),
          version: '4.0',
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
        if (!msg.workflowId) return { ok: false, error: 'No workflowId provided' };

        try {
          // Track installed marketplace workflows
          const installed = await chrome.storage.local.get('hyperagent_installed_workflows');
          const list: string[] = installed.hyperagent_installed_workflows || [];
          if (!list.includes(msg.workflowId)) {
            list.push(msg.workflowId);
            await chrome.storage.local.set({ hyperagent_installed_workflows: list });
          }
          return { ok: true, workflowId: msg.workflowId };
        } catch (err: any) {
          return { ok: false, error: err.message };
        }
      }

      case 'getInstalledWorkflows': {
        try {
          const installed = await chrome.storage.local.get('hyperagent_installed_workflows');
          return { ok: true, workflows: installed.hyperagent_installed_workflows || [] };
        } catch {
          return { ok: true, workflows: [] };
        }
      }

      case 'getActiveTabId': {
        try {
          const tabId = await getActiveTabId();
          return { ok: true, tabId };
        } catch {
          return { ok: false, tabId: null };
        }
      }

      case 'getLastWorkflowRuns': {
        try {
          const data = await chrome.storage.local.get(STORAGE_KEYS.LAST_WORKFLOW_RUNS_LIST);
          const runs = (data[STORAGE_KEYS.LAST_WORKFLOW_RUNS_LIST] as any[]) || [];
          return { ok: true, runs };
        } catch {
          return { ok: true, runs: [] };
        }
      }

      case 'getWorkflowTemplates': {
        return { ok: true, templates: WORKFLOW_TEMPLATES };
      }

      case 'getWorkflowParamSuggestions': {
        const msg = message as { templateId: string };
        if (!msg.templateId) return { ok: false, suggestions: {} };
        const template = getWorkflowTemplateById(msg.templateId);
        if (!template) return { ok: false, suggestions: {} };
        try {
          const tabId = await getActiveTabId();
          const tab = await chrome.tabs.get(tabId);
          const url = tab?.url || '';
          const title = tab?.title || '';
          let bodySnippet = '';
          try {
            const pageCtx = await getPageContext(tabId);
            bodySnippet = (pageCtx.bodyText || '').slice(0, 500);
          } catch {
            // Non-fatal
          }
          const suggestions: Record<string, string> = {};
          for (const p of template.parameters) {
            const name = p.name.toLowerCase();
            if (name.includes('url') || name === 'searchurl' || name === 'formurl' || name === 'pageurl' || name === 'loginurl' || name === 'afterloginurl') {
              if (url) suggestions[p.name] = url;
            } else if ((name === 'query' || name === 'search') && (title || bodySnippet)) {
              suggestions[p.name] = title.slice(0, 200) || bodySnippet.slice(0, 100).replace(/\s+/g, ' ').trim();
            } else if (p.default) {
              suggestions[p.name] = p.default;
            }
          }
          return { ok: true, suggestions };
        } catch {
          return { ok: true, suggestions: {} };
        }
      }

      case 'runWorkflowFromTemplate': {
        const msg = message as { templateId: string; params: Record<string, string> };
        if (!msg.templateId || !msg.params || typeof msg.params !== 'object') {
          return { ok: false, error: 'Missing templateId or params' };
        }
        const knownIds = WORKFLOW_TEMPLATES.map(t => t.id);
        if (!knownIds.includes(msg.templateId)) {
          return { ok: false, error: 'Unknown template' };
        }
        const MAX_PARAM_VALUE = 2000;
        const params: Record<string, string> = {};
        for (const [k, v] of Object.entries(msg.params)) {
          params[k] = typeof v === 'string' ? v.slice(0, MAX_PARAM_VALUE) : String(v ?? '').slice(0, MAX_PARAM_VALUE);
        }
        const validation = validateTemplateParameters(msg.templateId, params);
        if (!validation.valid) {
          return { ok: false, error: validation.errors.join('; '), missing: validation.missing };
        }
        const workflow = instantiateTemplate(msg.templateId, params, `run_${Date.now()}`);
        if (!workflow) {
          return { ok: false, error: 'Unknown template or instantiation failed' };
        }
        try {
          await saveWorkflow(workflow);
        } catch (e) {
          return { ok: false, error: `Failed to save workflow: ${(e as Error).message}` };
        }
        try {
          const tabId = await getActiveTabId();
          const tab = await chrome.tabs.get(tabId);
          const runSettings = await loadSettings();
          const result = await executeAction(
            tabId,
            { type: 'runWorkflow', workflowId: workflow.id },
            runSettings.dryRun,
            runSettings.autoRetry,
            tab?.url
          );
          return { ok: result.success, error: result.error, extractedData: result.extractedData };
        } catch (e) {
          return { ok: false, error: (e as Error).message };
        }
      }

      case 'getSubscriptionState': {
        return {
          ok: true,
          state: billingManager.getState(),
          plans: billingManager.getAllPlans(),
        };
      }

      case 'activateLicenseKey': {
        const msg = message as any;
        if (!msg.key) return { ok: false, error: 'No key provided' };
        const result = await billingManager.activateWithLicenseKey(msg.key);
        if (result.success) {
          usageTracker.setSubscriptionTier(billingManager.getTierMapping());
        }
        return { ok: result.success, error: result.error };
      }

      case 'openCheckout': {
        const msg = message as any;
        const result = await billingManager.openCheckout(msg.tier || 'beta');
        if (result.success) {
          usageTracker.setSubscriptionTier(billingManager.getTierMapping());
        }
        return { ok: result.success, error: result.error };
      }

      case 'cancelSubscription': {
        await billingManager.cancelSubscription();
        usageTracker.setSubscriptionTier(billingManager.getTierMapping());
        return { ok: true };
      }

      case 'verifySubscription': {
        const valid = await billingManager.verifySubscription();
        usageTracker.setSubscriptionTier(billingManager.getTierMapping());
        return { ok: true, valid, state: billingManager.getState() };
      }

      default:
        return { ok: false, error: 'Unknown message type' };
    }
  }

  // ─── Extended Message Handlers ────────────────────────────────────────

  async function handleExtendedMessage(message: any): Promise<any> {
    switch (message.type) {
      case 'getToolStats': {
        return { ok: true, stats: toolRegistry.getStats() };
      }

      case 'getTools': {
        return { ok: true, tools: toolRegistry.getAll() };
      }

      case 'getSnapshot': {
        if (message.taskId) {
          const snapshot = await SnapshotManager.load(message.taskId);
          return { ok: true, snapshot };
        } else {
          const snapshot = await SnapshotManager.loadLastActive();
          return { ok: true, snapshot };
        }
      }

      case 'listSnapshots': {
        const snapshots = await SnapshotManager.listAll();
        return { ok: true, snapshots };
      }

      case 'clearSnapshot': {
        if (message.taskId) {
          await SnapshotManager.clear(message.taskId);
          return { ok: true };
        }
        // Clear ALL snapshots when no taskId provided
        const allSnapshots = await SnapshotManager.listAll();
        for (const snap of allSnapshots) {
          await SnapshotManager.clear(snap.taskId);
        }
        return { ok: true };
      }

      case 'resumeSnapshot': {
        if (agentState.isRunning) {
          return { ok: false, error: 'Agent is already running' };
        }
        const taskId = message.taskId;
        if (!taskId) {
          return { ok: false, error: 'No taskId provided' };
        }
        const snapshot = await SnapshotManager.load(taskId);
        if (!snapshot?.command) {
          return { ok: false, error: 'Snapshot not found or invalid' };
        }
        runAgentLoop(snapshot.command).catch(err => {
          debugService.log(LogLevel.ERROR, 'agentLoop', 'Resume agent loop error', { error: err });
          sendToSidePanel({
            type: 'agentDone',
            finalSummary: `Resume failed: ${err.message || String(err)}`,
            success: false,
            stepsUsed: 0,
          });
          agentState.setRunning(false);
        });
        return { ok: true };
      }

      case 'parseIntent': {
        if (message.command) {
          const intents = parseIntent(message.command);
          return { ok: true, intents };
        }
        return { ok: false, error: 'No command provided' };
      }

      case 'getIntentSuggestions': {
        if (message.command) {
          const suggestions = getSuggestions(message.command);
          return { ok: true, suggestions };
        }
        return { ok: true, suggestions: [] };
      }

      case 'getCacheStats': {
        const stats = generalCache.getStats();
        return { ok: true, stats };
      }

      case 'getAPICache': {
        if (message.endpoint) {
          const cached = await apiCache.getAPIResponse(message.endpoint, message.params);
          return { ok: true, cached };
        }
        return { ok: false, error: 'No endpoint provided' };
      }

      case 'setAPICache': {
        if (message.endpoint && message.response) {
          await apiCache.setAPIResponse(
            message.endpoint,
            message.params,
            message.response,
            message.ttl
          );
          return { ok: true };
        }
        return { ok: false, error: 'endpoint and response required' };
      }

      case 'invalidateCacheTag': {
        if (message.tag) {
          const count = await generalCache.invalidateByTag(message.tag);
          return { ok: true, invalidated: count };
        }
        return { ok: false, error: 'No tag provided' };
      }

      case 'getMemoryLeaks': {
        const leaks = memoryManager.getLeaks();
        return { ok: true, leaks };
      }

      case 'forceMemoryCleanup': {
        memoryManager.forceCleanup();
        return { ok: true };
      }

      case 'runMemoryHealthCheck': {
        const result = await validateStorageIntegrity();
        return { ok: true, result };
      }

      case 'clearDomainMemory': {
        if (!message.domain) {
          return { ok: false, error: 'Domain is required' };
        }
        await clearDomainMemory(`https://${message.domain}`);
        return { ok: true };
      }

      case 'resetPageSession': {
        // Clear active session and domain-specific memory for the current page only.
        try {
          const activeTabId = await getActiveTabId();
          const tab = await chrome.tabs.get(activeTabId);
          const pageUrl = tab.url || '';
          if (pageUrl) {
            await clearDomainMemory(pageUrl);
          }
          const activeSession = await getActiveSession();
          if (activeSession && activeSession.pageUrl === pageUrl) {
            await deleteSession(activeSession.id);
          }
        } catch (err) {
          debugService.warn('session', 'Failed to reset page session', { error: err });
          return { ok: false, error: 'Failed to reset page session' };
        }
        return { ok: true };
      }

      case 'sanitizeInput': {
        if (message.input !== undefined) {
          const result = inputSanitizer.sanitize(message.input, message.options);
          return { ok: true, result };
        }
        return { ok: false, error: 'No input provided' };
      }

      case 'sanitizeUrl': {
        if (message.url) {
          const result = inputSanitizer.sanitizeUrl(message.url);
          return { ok: true, result };
        }
        return { ok: false, error: 'No url provided' };
      }

      case 'sanitizeBatch': {
        if (message.inputs) {
          const results = inputSanitizer.sanitizeBatch(message.inputs, message.options);
          return { ok: true, results };
        }
        return { ok: false, error: 'No inputs provided' };
      }

      default:
        return null; // Not an extended message
    }
  }

  // ─── Helper functions ─────────────────────────────────────────────

  function sendToSidePanelRaw(msg: ExtensionMessage) {
    chrome.runtime.sendMessage(msg).catch(() => { });
  }

  // Debounce high-frequency agentProgress updates to avoid UI jank (max once per 300ms)
  let pendingAgentProgress: ExtensionMessage | null = null;
  const flushAgentProgress = () => {
    if (pendingAgentProgress) {
      sendToSidePanelRaw(pendingAgentProgress);
      pendingAgentProgress = null;
    }
  };
  const debouncedFlushProgress = debounce(flushAgentProgress, 300);

  function sendToSidePanel(msg: ExtensionMessage) {
    if (msg.type === 'agentProgress') {
      pendingAgentProgress = msg;
      debouncedFlushProgress();
    } else {
      flushAgentProgress(); // Send any pending progress before other message types
      sendToSidePanelRaw(msg);
    }
  }

  const LAST_AGENT_RESULT_KEY = 'hyperagent_last_agent_result';

  /** Resolver for autonomous plan overview confirmation (Execute/Cancel). */
  let resolveAutonomousPlanConfirmation: ((confirmed: boolean) => void) | null = null;

  function sendAgentDone(payload: {
    finalSummary: string;
    success: boolean;
    stepsUsed: number;
    toolUsageSummary?: Record<string, number>;
  }) {
    sendToSidePanel({
      type: 'agentDone',
      ...payload,
      ...(agentState.wasScheduledRun && { scheduled: true }),
      ...(agentState.currentCorrelationId && { correlationId: agentState.currentCorrelationId }),
    });
    // Persist for when panel was closed during task (Scenario 7)
    chrome.storage.local.set({
      [LAST_AGENT_RESULT_KEY]: {
        ...payload,
        timestamp: Date.now(),
      },
    }).catch(() => { });
    // Badge so user knows to check when panel was closed
    chrome.action.setBadgeText({ text: '1' }).catch(() => { });
    chrome.action.setBadgeBackgroundColor({ color: '#6366f1' }).catch(() => { });
  }

  async function getActiveTabId(): Promise<number> {
    // Try to get active tab first
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab?.id) {
        return activeTab.id;
      }
    } catch (err) {
      debugService.warn('tabManager', 'Failed to get active tab', { error: err });
    }

    // If no active tab, try to find any available tab
    try {
      const allTabs = await chrome.tabs.query({});
      const availableTab = allTabs.find(tab => tab.id && !tab.url?.startsWith('chrome://') && !tab.url?.startsWith('edge://'));
      if (availableTab?.id) {
        debugService.info('tabManager', 'Using available tab', { tabId: availableTab.id, url: availableTab.url });
        return availableTab.id;
      }
    } catch (err) {
      debugService.warn('tabManager', 'Failed to find available tab', { error: err });
    }

    // As a last resort, create a new tab
    try {
      const newTab = await chrome.tabs.create({ url: 'https://www.google.com', active: true });
      if (newTab?.id) {
        debugService.info('tabManager', 'Created new tab', { tabId: newTab.id });
        return newTab.id;
      }
    } catch (err) {
      debugService.error('tabManager', 'Failed to create new tab', { error: err });
    }

    throw new Error('No browser tab available');
  }

  async function getPageContext(tabId: number): Promise<PageContext> {
    // Try direct message first
    try {
      const response = await chrome.tabs.sendMessage(tabId, { type: 'getContext' });
      if (response?.context) return response.context;
    } catch (err: any) {
      // Check if this is a chrome:// URL error (expected behavior)
      if (err?.message?.includes('Cannot access a chrome:// URL')) {
        debugService.info('pageContext', 'Skipping chrome:// URL context extraction (expected behavior)');
      } else {
        debugService.warn('pageContext', 'Failed to get direct context', { error: err });
      }
    }

    // Inject content script (skip for chrome:// URLs)
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('edge://') || tab.url?.startsWith('about:')) {
        // Return minimal context for restricted pages - use actual tab title
        return {
          url: tab.url || '',
          title: tab.title || 'Browser Page',
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
      debugService.error('pageContext', 'Failed to inject/query content script', { error: err });
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

  /** Returns full data URL for display, or raw base64 for LLM/context (legacy). Use format: 'dataUrl' for img.src, 'base64' for context. */
  async function captureScreenshot(outputFormat: 'dataUrl' | 'base64' = 'base64', tabId?: number): Promise<string> {
    let previousActiveId: number | undefined;
    let targetTabId: number | undefined;
    let windowId: number | undefined;
    let needsFocus = false;
    
    try {
      targetTabId = tabId ?? agentState.currentAgentTabId ?? await getActiveTabId();
      const targetTab = await chrome.tabs.get(targetTabId).catch((err) => {
        debugService.error('screenshot', 'Failed to get target tab', { error: err });
        throw new Error(`Tab not found: ${targetTabId}`);
      });
      
      if (!targetTab.windowId) {
        throw new Error('Target tab has no windowId');
      }
      windowId = targetTab.windowId;

      const [previousActive] = await chrome.tabs.query({ active: true, windowId: targetTab.windowId }).catch(() => []);
      previousActiveId = previousActive?.id;
      needsFocus = previousActiveId !== targetTabId;

      if (needsFocus) {
        // Try to focus the tab
        try {
          await chrome.tabs.update(targetTabId, { active: true });
        } catch (err) {
          debugService.warn('screenshot', 'Failed to activate tab', { error: err });
        }
        
        try {
          await chrome.windows.update(windowId, { focused: true });
        } catch (err) {
          debugService.warn('screenshot', 'Failed to focus window', { error: err });
        }
        
        await waitForTabLoad(targetTabId).catch((err) => {
          debugService.warn('screenshot', 'Tab load wait failed', { error: err });
        });
        
        // Give Chrome a moment to paint the activated tab
        await delay(200);
      }

      const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
        format: 'jpeg',
        quality: 60,
      });

      // Restore previous tab if needed
      if (needsFocus && previousActiveId && previousActiveId !== targetTabId) {
        try {
          await chrome.tabs.update(previousActiveId, { active: true });
        } catch (err) {
          debugService.warn('screenshot', 'Failed to restore previous tab', { error: err });
        }
      }

      if (outputFormat === 'dataUrl') return dataUrl;
      return dataUrl.replace(/^data:image\/\w+;base64,/, '');
    } catch (err) {
      debugService.error('screenshot', 'Screenshot capture failed', { error: err });
      
      // Attempt to restore previous tab state on error
      if (needsFocus && previousActiveId && windowId) {
        try {
          await chrome.tabs.update(previousActiveId, { active: true });
        } catch {
          // Best effort restore
        }
      }
      
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

      // Store timeout ID so we can clear it when confirmation is resolved (Issue #70)
      const timeoutId = globalThis.setTimeout(() => {
        if (agentState.hasPendingConfirm) {
          agentState.resolveConfirm(false);
        }
      }, DEFAULTS.CONFIRM_TIMEOUT_MS);

      // Clear timeout if confirmation is resolved before timeout fires
      const originalResolver = agentState['state'].pendingConfirmResolve;
      agentState.setConfirmResolver((confirmed: boolean) => {
        globalThis.clearTimeout(timeoutId);
        if (originalResolver) originalResolver(confirmed);
      });
    });
  }

  function askUserForInfo(question: string): Promise<string> {
    return new Promise(resolve => {
      agentState.setReplyResolver(resolve);
      sendToSidePanel({ type: 'askUser', question });

      // Store timeout ID so we can clear it when reply is resolved (Issue #70)
      const timeoutId = globalThis.setTimeout(() => {
        if (agentState.hasPendingReply) {
          agentState.resolveReply('');
        }
      }, 120000); // 2 min timeout for user replies

      // Clear timeout if reply is resolved before timeout fires
      const originalResolver = agentState['state'].pendingUserReplyResolve;
      agentState.setReplyResolver((reply: string) => {
        globalThis.clearTimeout(timeoutId);
        if (originalResolver) originalResolver(reply);
      });
    });
  }

  function jitter(base: number, pct = 0.2): number {
    const delta = base * pct;
    return Math.max(0, base + (Math.random() * 2 - 1) * delta);
  }


  function _delayForErrorType(errorType?: string): number {
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

  // Helper functions to reduce cognitive complexity of executeAction
  function handleDryRun(action: Action, actionId: string, startTime: number, pageUrl?: string): ActionResult | null {
    if (action.type === 'wait') {
      return { success: true };
    }
    debugService.info('dryRun', 'Would execute', { action: JSON.stringify(action) });
    trackActionEnd(actionId, true, Date.now() - startTime, pageUrl);
    return { success: true };
  }

  async function validateActionPermissions(action: Action, pageUrl?: string): Promise<ActionResult | null> {
    const url = pageUrl || '';
    const rateCheck = await checkRateLimit(action.type);
    if (!rateCheck.allowed) {
      const waitSec = rateCheck.waitTimeMs ? Math.ceil(rateCheck.waitTimeMs / 1000) : 0;
      return {
        success: false,
        error: `Rate limit exceeded. Try again in ${waitSec}s.`,
        errorType: 'RATE_LIMIT' as ErrorType,
      };
    }
    const actionCheck = await checkActionAllowed(action, url);
    if (!actionCheck.allowed) {
      return {
        success: false,
        error: actionCheck.reason || 'Action not allowed by security policy.',
        errorType: 'SECURITY_POLICY' as ErrorType,
      };
    }
    return null;
  }

  // Validate URL for navigation (Issue #71)
  function isValidNavigationUrl(url: string): { valid: boolean; error?: string } {
    if (!url || typeof url !== 'string') {
      return { valid: false, error: 'URL is required' };
    }

    // Block dangerous protocols
    const blockedProtocols = ['file:', 'data:', 'javascript:', 'vbscript:', 'mailto:', 'tel:', 'sms:'];
    const allowedProtocols = ['http:', 'https:', 'chrome:', 'chrome-extension:', 'about:', 'edge:'];

    try {
      // Try to parse as absolute URL
      const parsed = new URL(url);
      
      // Check for blocked protocols
      if (blockedProtocols.some(p => parsed.protocol === p)) {
        return { valid: false, error: `Protocol "${parsed.protocol}" is not allowed for security reasons` };
      }
      
      if (!allowedProtocols.includes(parsed.protocol)) {
        return { valid: false, error: `Protocol "${parsed.protocol}" is not allowed for navigation` };
      }
      
      // Additional validation for about: URLs
      if (parsed.protocol === 'about:') {
        const allowedAbout = ['about:blank', 'about:newtab', 'about:settings', 'about:downloads'];
        if (!allowedAbout.includes(parsed.href)) {
          return { valid: false, error: 'This about: page is not allowed' };
        }
      }
      
      return { valid: true };
    } catch {
      // If it fails to parse, check if it's a relative URL or looks like a domain
      if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
        // parent Block directory traversal
        if (url.includes('..')) {
          return { valid: false, error: 'Directory traversal is not allowed' };
        }
        return { valid: true }; // Relative URLs are OK
      }
      // Check if it looks like a domain (no protocol, has dots or is localhost)
      if (/^[\w.-]+(:\d+)?(\/.*)?$/.test(url) || url === 'about:blank') {
        return { valid: true };
      }
      return { valid: false, error: 'Invalid URL format' };
    }
  }

  async function handleNavigationActions(action: Action, tabId: number): Promise<ActionResult | null> {
    switch (action.type) {
      case 'navigate': {
        // Validate URL before navigation (Issue #71)
        const urlValidation = isValidNavigationUrl(action.url);
        if (!urlValidation.valid) {
          return {
            success: false,
            error: `Invalid URL: ${urlValidation.error}`,
            errorType: 'NAVIGATION_ERROR' as ErrorType,
          };
        }
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
      case 'goBack':
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
      default:
        return null;
    }
  }

  async function handleTabActions(action: Action, tabId: number): Promise<ActionResult | null> {
    switch (action.type) {
      case 'openTab': {
        const result = await openTab(action.url, action.active);
        if (result.success && result.tabId) {
          return { success: true, extractedData: `Opened tab ${result.tabId}: ${action.url}` };
        }
        return { success: false, error: result.error || 'Failed to open tab' };
      }
      case 'closeTab': {
        const closeTargetTabId = action.tabId ?? tabId;
        const closeResult = await closeTab(closeTargetTabId);
        if (closeResult.success) {
          return { success: true, extractedData: `Closed tab ${closeTargetTabId}` };
        }
        return { success: false, error: closeResult.error || 'Failed to close tab' };
      }
      case 'switchTab': {
        let switchTargetTabId = action.tabId;
        if (!switchTargetTabId && action.urlPattern) {
          const findResult = await findTabByUrl(action.urlPattern);
          if (!findResult.success || !findResult.tabId) {
            return { success: false, error: findResult.error || 'Tab not found' };
          }
          switchTargetTabId = findResult.tabId;
        }
        if (!switchTargetTabId) {
          return { success: false, error: 'No tabId or urlPattern provided for switchTab' };
        }
        const switchResult = await switchToTab(switchTargetTabId);
        if (switchResult.success) {
          return { success: true, extractedData: `Switched to tab ${switchTargetTabId}` };
        }
        return { success: false, error: switchResult.error || 'Failed to switch tab' };
      }
      case 'getTabs': {
        const tabsResult = await getAllTabs();
        if (tabsResult.success && tabsResult.tabs) {
          return { success: true, extractedData: JSON.stringify(tabsResult.tabs) };
        }
        return { success: false, error: tabsResult.error || 'Failed to get tabs' };
      }
      default:
        return null;
    }
  }

  async function handleWorkflowActions(action: Action, tabId: number, dryRun: boolean, autoRetry: boolean): Promise<ActionResult | null> {
    switch (action.type) {
      case 'runMacro': {
        const macroAction = action as MacroAction;
        const macroResult = await executeMacro(macroAction.macroId, async (subAction: Action) => {
          return await executeAction(tabId, subAction, dryRun, autoRetry);
        });
        if (macroResult.success) {
          // Persist last successful macro for reuse across sessions.
          try {
            await chrome.storage.local.set({
              [STORAGE_KEYS.LAST_SUCCESSFUL_MACRO]: {
                id: macroAction.macroId,
                timestamp: Date.now(),
                resultsCount: macroResult.results.length,
              },
            });
          } catch {
            // Non-fatal.
          }
          // Track this macro run per domain for the Memory tab.
          try {
            const tab = await chrome.tabs.get(tabId);
            const domain = tab?.url ? extractDomain(tab.url || '') : null;
            if (domain) {
              const data = await chrome.storage.local.get(STORAGE_KEYS.WORKFLOW_RUNS);
              const all = (data[STORAGE_KEYS.WORKFLOW_RUNS] as Record<string, any[]>) || {};
              const runs = all[domain] || [];
              runs.push({
                type: 'macro',
                id: macroAction.macroId,
                timestamp: Date.now(),
                success: true,
              });
              all[domain] = runs.slice(-5);
              await chrome.storage.local.set({ [STORAGE_KEYS.WORKFLOW_RUNS]: all });
            }
          } catch {
            // Non-fatal.
          }
          // #region agent log
        debugService.info('agentLog', 'Recorded successful macro run', { macroId: macroAction.macroId });
          // #endregion
          return {
            success: true,
            extractedData: `Macro executed successfully with ${macroResult.results.length} actions`,
          };
        }
        return { success: false, error: macroResult.error || 'Macro execution failed' };
      }
      case 'runWorkflow': {
        const workflowAction = action as WorkflowAction;
        // Safety: require confirmation before running workflows with destructive steps (144)
        const workflow = await getWorkflowById(workflowAction.workflowId);
        if (workflow && hasDestructiveSteps(workflow)) {
          const runSettings = await loadSettings();
          if (runSettings.requireConfirm) {
            const destructiveActions = workflow.steps.filter(s => (s.action as any)?.destructive).map(s => s.action);
            const confirmed = await askUserConfirmation(destructiveActions, 0, 'This workflow contains destructive actions. Confirm to run?');
            if (!confirmed) {
              return { success: false, error: 'User declined to run destructive workflow.' };
            }
          }
        }
        const getContextFn = async (): Promise<PageContext> => {
          try {
            const response = await chrome.tabs.sendMessage(tabId, { type: 'getContext' });
            if (response?.context && typeof response.context === 'object') {
              return response.context as PageContext;
            }
          } catch {
            // Tab may be chrome:// or content script not loaded
          }
          return {
            url: '',
            title: '',
            bodyText: '',
            metaDescription: '',
            formCount: 0,
            semanticElements: [],
            timestamp: 0,
            scrollPosition: { x: 0, y: 0 },
            viewportSize: { width: 0, height: 0 },
            pageHeight: 0,
          };
        };
        const workflowResult = await executeWorkflow(
          workflowAction.workflowId,
          async (subAction: Action) => {
            return await executeAction(tabId, subAction, dryRun, autoRetry);
          },
          getContextFn
        );
        // Persist workflow run to "View last workflow runs" list (141, 142)
        try {
          const tab = await chrome.tabs.get(tabId);
          const domain = tab?.url ? extractDomain(tab.url || '') : null;
          const runEntry = {
            workflowId: workflowAction.workflowId,
            success: workflowResult.success,
            timestamp: Date.now(),
            stepsCount: workflowResult.results?.length ?? 0,
            error: workflowResult.error,
            domain: domain ?? undefined,
          };
          const listData = await chrome.storage.local.get(STORAGE_KEYS.LAST_WORKFLOW_RUNS_LIST);
          const list: typeof runEntry[] = (listData[STORAGE_KEYS.LAST_WORKFLOW_RUNS_LIST] as typeof runEntry[]) || [];
          list.push(runEntry);
          const trimmed = list.slice(-20);
          await chrome.storage.local.set({ [STORAGE_KEYS.LAST_WORKFLOW_RUNS_LIST]: trimmed });
        } catch {
          // Non-fatal.
        }
        if (workflowResult.success) {
          // Persist last successful workflow for reuse across sessions.
          try {
            await chrome.storage.local.set({
              [STORAGE_KEYS.LAST_SUCCESSFUL_WORKFLOW]: {
                id: workflowAction.workflowId,
                timestamp: Date.now(),
                steps: workflowResult.results?.length || 0,
              },
            });
          } catch {
            // Non-fatal.
          }
          // Track this workflow run per domain for the Memory tab.
          try {
            const tab = await chrome.tabs.get(tabId);
            const domain = tab?.url ? extractDomain(tab.url || '') : null;
            if (domain) {
              const data = await chrome.storage.local.get(STORAGE_KEYS.WORKFLOW_RUNS);
              const all = (data[STORAGE_KEYS.WORKFLOW_RUNS] as Record<string, any[]>) || {};
              const runs = all[domain] || [];
              runs.push({
                type: 'workflow',
                id: workflowAction.workflowId,
                timestamp: Date.now(),
                success: true,
              });
              all[domain] = runs.slice(-5);
              await chrome.storage.local.set({ [STORAGE_KEYS.WORKFLOW_RUNS]: all });
            }
          } catch {
            // Non-fatal.
          }
          // #region agent log
        debugService.info('agentLog', 'Recorded successful workflow run', { workflowId: workflowAction.workflowId });
          // #endregion
          return {
            success: true,
            extractedData: `Workflow executed successfully with ${workflowResult.results?.length || 0} steps`,
          };
        }
        return { success: false, error: workflowResult.error || 'Workflow execution failed' };
      }
      default:
        return null;
    }
  }

  // Higher-order function for the content script action to allow retries
  const attempt = async (tabId: number, action: Action): Promise<ActionResult> => {
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

  async function executeAction(
    tabId: number,
    action: Action,
    dryRun: boolean,
    autoRetry: boolean,
    pageUrl?: string
  ): Promise<ActionResult> {
    // Verify tab exists before executing (tab may have been closed)
    try {
      await chrome.tabs.get(tabId);
    } catch {
      return {
        success: false,
        error: 'Tab was closed or is no longer available.',
        errorType: 'NAVIGATION_ERROR' as ErrorType,
      };
    }

    const startTime = Date.now();
    const actionId = trackActionStart(action, pageUrl);

    // Handle dry run
    const dryRunResult = handleDryRun(action, actionId, startTime, pageUrl);
    if (dryRunResult) return dryRunResult;

    // Validate permissions
    const validationResult = await validateActionPermissions(action, pageUrl);
    if (validationResult !== null) return validationResult;

    // Handle navigation actions
    const navigationResult = await handleNavigationActions(action, tabId);
    if (navigationResult) return navigationResult;

    // Handle tab actions
    const tabResult = await handleTabActions(action, tabId);
    if (tabResult) return tabResult;

    // Handle workflow actions
    const workflowResult = await handleWorkflowActions(action, tabId, dryRun, autoRetry);
    if (workflowResult) return workflowResult;

    // Handle wait action (default ms when missing for workflow templates)
    if (action.type === 'wait') {
      const waitAction = action as { type: 'wait'; ms?: number };
      const ms = typeof waitAction.ms === 'number' && waitAction.ms >= 0 ? waitAction.ms : (DEFAULTS.DOM_WAIT_MS ?? 1500);
      await delay(ms);
      return { success: true };
    }

    // Execute content script action
    let result: ActionResult = await attempt(tabId, action);

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
      result = await handleAutoRetry(action, result, tabId, actionId, startTime, pageUrl);
    }

    // Track metrics for the action result
    trackActionEnd(actionId, result.success, Date.now() - startTime, pageUrl);

    // Track usage for billing
    if (result.success) {
      usageTracker.trackAction(action.type);
    }

    return result;
  }

  async function handleAutoRetry(
    action: Action,
    result: ActionResult,
    tabId: number,
    actionId: string,
    startTime: number,
    pageUrl?: string
  ): Promise<ActionResult> {
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

    // Use intelligent failure recovery system
    const failureAnalysis = failureRecovery.analyzeFailure(errorType, result.error || '', action);
    const recoveryStrategy = failureRecovery.getRecoveryStrategy(
      failureAnalysis,
      currentAttempt + 1
    );

    debugService.warn('recovery', `Action failed with error type: ${errorType}. Recovery attempt ${currentAttempt + 1}/${agentState.maxRecoveryAttempts} using ${recoveryStrategy.strategy}...`);

    // Check if recovery is possible
    if (!recoveryStrategy.success || !recoveryStrategy.strategy) {
      agentState.logRecoveryOutcome(action, errorType, 'no-strategy', 'failed');
      agentState.clearRecoveryAttempt(action);
      trackActionEnd(actionId, false, Date.now() - startTime, pageUrl);
      return result;
    }

    // Execute recovery strategy
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['/content-scripts/content.js'],
      });

      // Wait if specified by recovery strategy
      if (recoveryStrategy.waitMs) {
        await delay(recoveryStrategy.waitMs);
      }

      // Execute pre-recovery action if specified (e.g., scroll)
      if (recoveryStrategy.action) {
        await chrome.tabs.sendMessage(tabId, {
          type: 'executeActionOnPage',
          action: recoveryStrategy.action,
        });
        await delay(300);
      }

      // Increment recovery attempt counter (strategy is set; we guarded above)
      if (recoveryStrategy.strategy) {
        agentState.incrementRecoveryAttempt(action, recoveryStrategy.strategy);
      }

      result = await attempt(tabId, action);

      // If succeeded, log successful recovery
      if (result.success) {
        // Record successful recovery for learning
        failureRecovery.recordRecovery(
          {
            action,
            error: result.error || '',
            errorType,
            attempt: currentAttempt + 1,
            pageUrl: pageUrl || '',
            timestamp: Date.now(),
          },
          true
        );

        agentState.logRecoveryOutcome(
          action,
          errorType || 'UNKNOWN',
          recoveryStrategy.strategy,
          'recovered'
        );
        agentState.clearRecoveryAttempt(action);
      }
    } catch (err) {
      // Injection failed — log and return original error
      failureRecovery.recordRecovery(
        {
          action,
          error: String(err),
          errorType,
          attempt: currentAttempt + 1,
          pageUrl: pageUrl || '',
          timestamp: Date.now(),
        },
        false
      );

      agentState.logRecoveryOutcome(
        action,
        errorType || 'UNKNOWN',
        recoveryStrategy.strategy ?? 'injection-failed',
        'injection-failed'
      );
      agentState.clearRecoveryAttempt(action);
    }

    return result;
  }

  // ─── Main agent loop ──────────────────────────────────────────
  async function runAgentLoop(command: string, modelOverride?: string) {
    const correlationId = generateCorrelationId();
    // Prevent concurrent execution (Issue #14)
    if (agentState.isRunning) {
      sendToSidePanel({
        type: 'agentDone',
        finalSummary: 'Agent is already running. Please wait for the current task to complete.',
        success: false,
        stepsUsed: 0,
      });
      return;
    }

    // Initialize agent state
    agentState.setRunning(true);
    agentState.setAborted(false);
    agentState.setCorrelationId(correlationId);

    // Get current tab info before starting
    const currentTabId = await getActiveTabId();
    const currentTab = await chrome.tabs.get(currentTabId);
    const originalTitle = currentTab.title || 'HyperAgent';

    // Save original title for proper restoration (Issue #12)
    saveOriginalTabTitle(currentTabId, originalTitle);

    // Helper to restore tab title on any exit
    const restoreTabTitle = async () => {
      try {
        const savedTitle = getOriginalTabTitle(currentTabId);
        await chrome.scripting.executeScript({
          target: { tabId: currentTabId },
          func: (title: string) => { document.title = title; },
          args: [savedTitle]
        });
        clearOriginalTabTitle(currentTabId);
      } catch (error) {
        debugService.warn('tabManager', 'Failed to restore tab title', { error });
      }
    };

    // Await metrics load to ensure we have current usage data (Issue #16)
    await usageTracker.loadMetrics();

    // Validate API key before any LLM calls
    const settings = await loadSettings();
    if (!settings.apiKey) {
      await restoreTabTitle();
      sendToSidePanel({
        type: 'agentDone',
        finalSummary: 'API key not set. Open settings (gear icon) and add your API key.',
        success: false,
        stepsUsed: 0,
      });
      agentState.setRunning(false);
      return;
    }

    // Check usage limits before starting (billing-authoritative)
    const currentUsage = usageTracker.getCurrentUsage();
    const billingCheck = billingManager.isWithinLimits(currentUsage.actions, currentUsage.sessions);
    if (!billingCheck.allowed) {
      await restoreTabTitle();
      sendToSidePanel({
        type: 'agentDone',
        finalSummary: billingCheck.reason || 'Usage limit reached. Upgrade in the Subscription tab.',
        success: false,
        stepsUsed: 0,
      });
      agentState.setRunning(false);
      return;
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: currentTabId },
        func: () => { document.title = '⚡ HyperAgent'; }
      });
    } catch (error) {
      debugService.log(LogLevel.WARN, 'tabManager', 'Failed to change tab title', { error });
    }

    debugService.log(LogLevel.INFO, 'agentLoop', 'Starting agent loop', { command: redact(command) });

    const maxSteps = settings.maxSteps;
    agentState.setCurrentAgentTabId(currentTabId);

    const tab = await chrome.tabs.get(currentTabId);
    const pageUrl = tab.url || '';
    if (pageUrl && isSiteBlacklisted(pageUrl, settings.siteBlacklist)) {
      await restoreTabTitle();
      sendToSidePanel({
        type: 'agentDone',
        finalSummary: 'Site blacklisted.',
        success: false,
        stepsUsed: 0,
      });
      agentState.setRunning(false);
      return;
    }
    const domainAllowed = await checkDomainAllowed(pageUrl);
    if (!domainAllowed) {
      await restoreTabTitle();
      sendToSidePanel({
        type: 'agentDone',
        finalSummary: 'Domain not allowed by privacy settings.',
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

    // Derive a stable per-session goal from the first command if one
    // has not already been set.
    if (!session.context.goal) {
      try {
        const existingGoal = await getSessionGoal(session.id);
        if (!existingGoal) {
          const goal = command.slice(0, 280);
          await setSessionGoal(session.id, goal);
          session.context.goal = goal;
        } else {
          session.context.goal = existingGoal;
        }
      } catch {
        // Non-fatal: session goal is an optimization only.
      }
    }

    // Parse intents for this command and persist the top one into the
    // session context for downstream consumers.
    const parsedIntents = parseIntent(command);
    if (parsedIntents.length > 0) {
      try {
        await updateLastIntent(session.id, parsedIntents[0]);
        session.context.lastIntent = parsedIntents[0];
      } catch {
        // Non-fatal.
      }
    }

    const sessionMeta = {
      goal: session.context.goal,
      lastActions: session.actionHistory.slice(-5).map(a => {
        const desc = (a as any).description || '';
        return desc ? `${a.type}: ${desc}` : a.type;
      }),
      lastUserReplies: (session.context.userReplies || []).slice(-5).map(r => r.reply),
      intents: parsedIntents.map(i => ({ action: i.action })),
    };

    const history: HistoryEntry[] = [];
    let requestScreenshot = false;
    let consecutiveFailures = 0;
    let hasExecutedActionsInThisRun = false;
    const MAX_CONSECUTIVE_FAILURES = 3;
    const toolUsageCounts: Record<string, number> = {};
    const runId = trackAgentRunStart({ isAutonomous: false });
    const runStartTime = Date.now();
    let lastRunSuccess = false;
    // All early returns (aborted, consecutive failures, tool budget) happen inside try; finally always runs so trackAgentRunEnd is always called.

    try {
      // Save initial snapshot for resume capability
      await SnapshotManager.save({
        sessionId: session.id,
        taskId: session.id,
        command,
        currentStep: 0,
        totalSteps: maxSteps,
        plan: {},
        history: [],
        results: [],
        timestamp: Date.now(),
        status: 'running',
        url: tab.url || '',
      });

      // Step 0: Analyze command and ask questions if needed
      sendToSidePanel({
        type: 'agentProgress',
        status: 'Analyzing your request...',
        step: 'plan',
      });

      // Get initial context and call LLM once
      let context = await getPageContext(currentTabId);
      // modelOverride can be set by the UI model selector — pass it through
      let llmResponse = await llmClient.callLLM({
        command,
        history,
        context: {
          ...context,
          isInitialQuery: true
        },
        modelOverride,
        sessionMeta,
        intents: parsedIntents,
      });

      // Handle clarification: allow multi-turn Q&A (up to 5 rounds)
      const MAX_CLARIFICATION_ROUNDS = 5;
      let clarificationRound = 0;
      const askedClarifications = new Set(
        (session.context.clarificationQuestions || []).map(q => q.question)
      );
      while (
        clarificationRound < MAX_CLARIFICATION_ROUNDS &&
        (llmResponse.needsClarification && llmResponse.clarificationQuestion ||
          llmResponse.askUser)
      ) {
        clarificationRound++;
        const question = llmResponse.askUser || llmResponse.clarificationQuestion || '';

        // If we've already asked this exact clarification in this session,
        // skip to avoid repeating the same question.
        if (askedClarifications.has(question)) {
          break;
        }
        askedClarifications.add(question);
        try {
          await addClarificationQuestion(session.id, question);
        } catch {
          // Non-fatal.
        }

        // Show thinking if present
        if (llmResponse.thinking) {
          sendToSidePanel({
            type: 'agentProgress',
            status: 'Thinking...',
            step: 'plan',
            thinking: llmResponse.thinking,
          });
        }
        // Show the summary/response to user before asking
        if (llmResponse.summary) {
          sendToSidePanel({
            type: 'agentProgress',
            status: llmResponse.summary,
            step: 'plan',
            summary: llmResponse.summary,
          });
        }

        const reply = await askUserForInfo(question);
        if (!reply || agentState.isAborted) {
          sendToSidePanel({
            type: 'agentDone',
            finalSummary: 'Cancelled.',
            success: false,
            stepsUsed: 0,
          });
          agentState.setRunning(false);
          return;
        }

        // Persist user reply into the session timeline and memory.
        try {
          await addUserReply(session.id, reply);
        } catch {
          // Non-fatal.
        }
        // #region agent log
        debugService.info('agent', 'Saved user reply after clarification loop', { sessionId: session.id, replyLength: reply.length });
        // #endregion

        // Add the LLM's response and user's reply to history
        history.push({ role: 'assistant', response: llmResponse });
        history.push({ role: 'user', userReply: reply, context });

        // Re-call LLM with updated history
        llmResponse = await llmClient.callLLM({
          command,
          history,
          context: { ...context, isInitialQuery: true },
          modelOverride,
          sessionMeta,
          intents: parsedIntents,
        });
      }

      // Check if we need to navigate first
      if (llmResponse.needsNavigation && llmResponse.targetUrl) {
        sendToSidePanel({
          type: 'agentProgress',
          status: `Navigating to ${llmResponse.targetUrl}...`,
          step: 'act',
        });
        await navigateTabAndWait(currentTabId, llmResponse.targetUrl);
        // Refresh context after navigation
        context = await getPageContext(currentTabId);
      }

      for (let step = 1; step <= maxSteps; step++) {
        if (agentState.isAborted) {
          await SnapshotManager.save({
            sessionId: session.id,
            taskId: session.id,
            command,
            currentStep: step - 1,
            totalSteps: maxSteps,
            plan: {},
            history,
            results: [],
            timestamp: Date.now(),
            status: 'aborted',
            url: tab.url || '',
          });
          lastRunSuccess = false;
          sendToSidePanel({
            type: 'agentDone',
            finalSummary: 'Stopped.',
            success: false,
            stepsUsed: step - 1,
            toolUsageSummary: Object.keys(toolUsageCounts).length ? { ...toolUsageCounts } : undefined,
          });
          return;
        }

        // Check for too many consecutive failures
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          lastRunSuccess = false;
          sendToSidePanel({
            type: 'agentDone',
            finalSummary: `Stopped after ${MAX_CONSECUTIVE_FAILURES} consecutive failures. The page may not be responding as expected.`,
            success: false,
            stepsUsed: step - 1,
            toolUsageSummary: Object.keys(toolUsageCounts).length ? { ...toolUsageCounts } : undefined,
          });
          return;
        }

        // ── Step 1: Observe ──
        // Scenario 8: Verify tab still exists before each step (user may have closed it)
        try {
          await chrome.tabs.get(currentTabId);
        } catch {
          sendAgentDone({
            finalSummary: 'Tab was closed. Task stopped.',
            success: false,
            stepsUsed: step - 1,
          });
          return;
        }
        sendToSidePanel({
          type: 'agentProgress',
          status: `Step ${step}/${maxSteps}: Analyzing page...`,
          step: 'observe',
        });
        context = await getPageContext(currentTabId);
        chrome.tabs.sendMessage(currentTabId, { type: 'showGlowingFrame' }).catch(() => { });

        if (requestScreenshot || (step === 1 && settings.enableVision && context.needsScreenshot === true)) {
          const screenshotDataUrl = await captureScreenshot('dataUrl');
          if (screenshotDataUrl) {
            const base64 = screenshotDataUrl.replace(/^data:image\/\w+;base64,/, '');
            context = { ...context, screenshotBase64: base64 };
            sendToSidePanel({ type: 'visionUpdate', screenshot: screenshotDataUrl });
          }
          requestScreenshot = false;
        }

        // ── Step 2: Plan ──
        sendToSidePanel({ type: 'agentProgress', status: 'Planning...', step: 'plan' });
        debugService.log(LogLevel.INFO, 'llm', 'Calling LLM with command', { command: redact(command), historyCount: history.length, });
        const signal = agentState.getSignal();
        const llmCallPromise = llmClient.callLLM(
          { command, history, context, modelOverride, sessionMeta, intents: parsedIntents, correlationId },
          signal
        );
        const llmTimeoutMs = DEFAULTS.LLM_TIMEOUT_MS ?? 45000;
        const timeoutPromise = new Promise((_, reject) =>
          globalThis.setTimeout(() => reject(new Error(`LLM call timed out after ${llmTimeoutMs / 1000} seconds`)), llmTimeoutMs)
        );
        try {
          llmResponse = await Promise.race([llmCallPromise, timeoutPromise]) as typeof llmResponse;
          if (agentState.isAborted) {
            sendToSidePanel({
              type: 'agentDone',
              finalSummary: 'Agent stopped by user.',
              success: false,
              stepsUsed: history.length,
            });
            return;
          }
          debugService.log(LogLevel.INFO, 'llm', 'LLM response received', {
            summary: llmResponse?.summary,
            actionsCount: llmResponse?.actions?.length,
            done: llmResponse?.done,
            askUser: llmResponse?.askUser,
          });
        } catch (err: any) {
          if (err?.name === 'AbortError' || agentState.isAborted) {
            sendToSidePanel({
              type: 'agentDone',
              finalSummary: 'Agent stopped by user.',
              success: false,
              stepsUsed: history.length,
            });
            return;
          }
          debugService.log(LogLevel.ERROR, 'llm', 'LLM call failed or timed out', {
            error: err?.message || String(err),
          });
          const classified = classifyError(err);
          sendToSidePanel({
            type: 'agentError',
            error: classified.userMessage,
            errorType: classified.type,
            retryable: classified.retryable,
            retryAfter: classified.retryAfter,
          });
          agentState.setRunning(false);
          return;
        }

        if (llmResponse.askUser) {
          // Show only internal thinking in collapsed bubble; reply comes after user answers
          if (llmResponse.thinking) {
            sendToSidePanel({
              type: 'agentProgress',
              status: 'Thinking...',
              step: 'plan',
              thinking: llmResponse.thinking,
            });
          } else {
            sendToSidePanel({
              type: 'agentProgress',
              status: 'Thinking...',
              step: 'plan',
            });
          }

          // Avoid asking the exact same clarification question repeatedly
          // within this session.
          const question = llmResponse.askUser;
          if (question && session.context.clarificationQuestions?.some(q => q.question === question)) {
            // We've already asked this question before; continue the loop
            // without re-asking to prevent user annoyance.
            continue;
          }
          if (question) {
            try {
              await addClarificationQuestion(session.id, question);
              if (!session.context.clarificationQuestions) {
                session.context.clarificationQuestions = [];
              }
              session.context.clarificationQuestions.push({ question, timestamp: Date.now() });
            } catch {
              // Non-fatal.
            }
          }

          sendToSidePanel({ type: 'askUser', question });
          const reply = await askUserForInfo(question);
          if (!reply || agentState.isAborted) {
            sendAgentDone({
              finalSummary: reply === '' ? 'Cancelled. Please provide more information when ready.' : 'Stopped.',
              success: false,
              stepsUsed: step,
            });
            return;
          }
          // Persist user reply into session context so it can be surfaced
          // back to the LLM as part of the session summary.
          try {
            await addUserReply(session.id, reply);
          } catch {
            // Non-fatal.
          }
          // #region agent log
          debugService.info('agent', 'Saved user reply after askUser branch', { sessionId: session.id, replyLength: reply.length });
          // #endregion
          history.push({ role: 'user', userReply: reply });
          continue;
        }

        // Show only internal thinking (collapsed); summary is shown once in agentDone
        if (llmResponse.thinking) {
          sendToSidePanel({
            type: 'agentProgress',
            status: 'Thinking...',
            step: 'plan',
            thinking: llmResponse.thinking,
          });
        } else {
          sendToSidePanel({
            type: 'agentProgress',
            status: 'Thinking...',
            step: 'plan',
          });
        }

        // Check if this is just a conversation (no actions, done=true)
        if (llmResponse.actions.length === 0 && llmResponse.done) {
          // Conversation mode - show thinking (collapsed) then the response
          sendAgentDone({
            finalSummary: llmResponse.summary || 'Done',
            success: true,
            stepsUsed: step,
          });
          return;
        }

        // If no actions but not done, and no askUser - show summary and continue conversation
        if (llmResponse.actions.length === 0 && !llmResponse.done) {
          sendAgentDone({
            finalSummary: llmResponse.summary || 'I understood. What would you like me to do next?',
            success: true,
            stepsUsed: step,
          });
          return;
        }

        // Ready-to-control: ask before first browser action in this run
        if (!hasExecutedActionsInThisRun) {
          const confirmed = await askUserConfirmation(
            llmResponse.actions,
            step,
            `Ready for me to take control of your browser? I'll navigate, click, and type on your behalf.`
          );
          if (!confirmed || agentState.isAborted) return;
          hasExecutedActionsInThisRun = true;
        }

        // Destructive path: only when requireConfirm is enabled
        const hasDestructive = llmResponse.actions.some(isDestructive);
        if (hasDestructive && settings.requireConfirm) {
          const confirmed = await askUserConfirmation(
            llmResponse.actions,
            step,
            llmResponse.summary || 'Confirm these actions?'
          );
          if (!confirmed || agentState.isAborted) return;
        }

        // ── Step 4: Act ──
        const actionDescs = llmResponse.actions
          .filter((a: any) => a?.description)
          .map((a: any) => a.description);
        sendToSidePanel({
          type: 'agentProgress',
          status: `Step ${step}/${maxSteps}: Executing ${llmResponse.actions.length} action(s)...`,
          step: 'act',
          actionDescriptions: actionDescs,
        });

        const actionResults = [];
        let stepHadFailure = false;

        for (const action of llmResponse.actions) {
          if (agentState.isAborted) break;

          if (!action || typeof action !== 'object' || !action.type) {
            debugService.log(LogLevel.WARN, 'agentLoop', 'Invalid action structure', { action });
            continue;
          }

          const result = await executeAction(
            currentTabId,
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
              const vScreenshotDataUrl = await captureScreenshot('dataUrl');
              if (vScreenshotDataUrl) {
                sendToSidePanel({ type: 'visionUpdate', screenshot: vScreenshotDataUrl });
                const vScreenshotBase64 = vScreenshotDataUrl.replace(/^data:image\/\w+;base64,/, '');
                try {
                  const isVerified = await verifyActionWithVision(action, vScreenshotBase64);
                  if (isVerified && !isVerified.success) {
                    result.success = false;
                    result.error = `Visual Failure: ${isVerified.reason || 'Verification failed'}`;
                  }
                } catch (error_: any) {
                  debugService.log(LogLevel.WARN, 'vision', 'Vision verification error', { error: error_.message });
                }
              }
            } catch (error_: any) {
              debugService.log(LogLevel.WARN, 'vision', 'Screenshot capture failed', { error: error_.message });
            }
          }

          if (result) {
            actionResults.push({ action, ...result });
            if (!result.success) stepHadFailure = true;
            toolUsageCounts[action.type] = (toolUsageCounts[action.type] || 0) + 1;
          }
          const totalActions = Object.values(toolUsageCounts).reduce((a, b) => a + b, 0);
          if (totalActions >= (DEFAULTS.MAX_ACTIONS_PER_RUN ?? 100)) {
            lastRunSuccess = false;
            sendAgentDone({
              finalSummary: 'Tool usage budget reached for this run.',
              success: false,
              stepsUsed: step,
              toolUsageSummary: { ...toolUsageCounts },
            });
            return;
          }
          await delay(DEFAULTS.ACTION_DELAY_MS);
        }

        // Track consecutive failures for circuit-breaking
        if (stepHadFailure) {
          consecutiveFailures++;
        } else {
          consecutiveFailures = 0;
        }

        // Compact history if it gets too large to reduce token usage
        const COMPACT_AFTER_STEPS = 5;
        const MIN_COMPACTED_ENTRIES = 2;
        if (history.length >= COMPACT_AFTER_STEPS * 2) {
          const compactedHistory: HistoryEntry[] = [];
          for (let i = 0; i < history.length; i += 2) {
            const userEntry = history[i];
            const assistantEntry = history[i + 1];
            if (i < MIN_COMPACTED_ENTRIES * 2) {
              compactedHistory.push(userEntry, assistantEntry);
            } else if (userEntry && assistantEntry) {
              compactedHistory.push({
                role: 'assistant',
                response: {
                  summary: (assistantEntry as any).response?.summary || 'Step completed',
                  actions: []
                },
                actionsExecuted: (assistantEntry as any).actionsExecuted || []
              });
            }
          }
          history.length = 0;
          history.push(...compactedHistory);
        }

        // Clone context before pushing to avoid mutations affecting history
        const contextClone = { ...context };
        history.push({ role: 'user', context: contextClone, command });
        history.push({ role: 'assistant', response: llmResponse, actionsExecuted: actionResults });

        // Save snapshot after each step for resume
        const stepResults: ActionResult[] = actionResults.map((r: any) => ({
          success: r.success,
          error: r.error,
          errorType: r.errorType,
          extractedData: r.extractedData,
          recovered: r.recovered,
        }));
        await SnapshotManager.save({
          sessionId: session.id,
          taskId: session.id,
          command,
          currentStep: step,
          totalSteps: maxSteps,
          plan: { summary: llmResponse?.summary, actions: llmResponse?.actions },
          history,
          results: stepResults,
          timestamp: Date.now(),
          status: 'running',
          url: tab.url || '',
        }).catch((err) => {
          debugService.log(LogLevel.WARN, 'snapshot', 'Snapshot save failed', { error: err?.message });
          sendToSidePanel({
            type: 'agentProgress',
            status: 'Warning: Could not save progress (storage may be full)',
          });
        });

        if (llmResponse.done || llmResponse.actions.length === 0) {
          await SnapshotManager.save({
            sessionId: session.id,
            taskId: session.id,
            command,
            currentStep: step,
            totalSteps: maxSteps,
            plan: { summary: llmResponse?.summary, actions: llmResponse?.actions },
            history,
            results: stepResults,
            timestamp: Date.now(),
            status: 'completed',
            url: tab.url || '',
          }).catch(() => { });

          lastRunSuccess = true;
          sendAgentDone({
            finalSummary: llmResponse.summary || 'Done',
            success: true,
            stepsUsed: step,
            toolUsageSummary: Object.keys(toolUsageCounts).length ? { ...toolUsageCounts } : undefined,
          });
          return;
        }
        await delay(350);
      }
      lastRunSuccess = false;
      sendAgentDone({
        finalSummary: 'Max steps reached.',
        success: false,
        stepsUsed: maxSteps,
        toolUsageSummary: Object.keys(toolUsageCounts).length ? { ...toolUsageCounts } : undefined,
      });
    } catch (err: any) {
      lastRunSuccess = false;
      sendAgentDone({
        finalSummary: `Agent error: ${err?.message || String(err)}`,
        success: false,
        stepsUsed: history.length,
        toolUsageSummary: Object.keys(toolUsageCounts).length ? { ...toolUsageCounts } : undefined,
      });
    } finally {
      const totalActions = Object.values(toolUsageCounts).reduce((a, b) => a + b, 0);
      trackAgentRunEnd(runId, lastRunSuccess, Date.now() - runStartTime, { actionsCount: totalActions });
      await restoreTabTitle();
      chrome.tabs.sendMessage(currentTabId, { type: 'hideGlowingFrame' }).catch(() => { });
      chrome.tabs.sendMessage(currentTabId, { type: 'hideVisualCursor' }).catch(() => { });
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

  async function navigateTabAndWait(tabId: number, url: string): Promise<void> {
    await chrome.tabs.update(tabId, { url });
    await waitForTabLoad(tabId);
    await delay(1500);
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
      const tab = await chrome.tabs.update(tabId, { active: true });
      if (tab?.windowId) {
        await chrome.windows.update(tab.windowId, { focused: true }).catch(() => { });
      }
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
        tabs: tabs
          .filter((tab): tab is chrome.tabs.Tab & { id: number } => typeof tab.id === 'number')
          .map(tab => ({
            id: tab.id,
            url: tab.url || '',
            title: tab.title || '',
            active: tab.active,
          })),
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async function waitForTabLoad(tabId: number): Promise<void> {
    return new Promise(resolve => {
      let resolved = false;
      const timeout = globalThis.setTimeout(() => {
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
            globalThis.clearTimeout(timeout);
            chrome.tabs.onUpdated.removeListener(listener);
            globalThis.setTimeout(resolve, 600);
          }
        }
      }

      chrome.tabs.onUpdated.addListener(listener);
    });
  }

  function delay(ms: number): Promise<void> {
    return new Promise(resolve => globalThis.setTimeout(resolve, ms));
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
      debugService.warn('reflex', 'Verification failed', { error: err });
      return { success: false, reason: 'Verification parse error' };
    }
  }

  // ─── Fallback planner (intentionally unimplemented) ─────────────────
  /** Stub: no automatic fallback when LLM fails. buildIntelligentFallback is used for recovery. */

  function _buildFallbackPlan(
    _command: string,
    _context: PageContext
  ): { summary: string; actions: Action[] } | null {
    return null;
  }

  // ─── Scheduler Integration ─────────────────────────────────────
  // Note: schedulerEngine.initialize() sets up its own alarm listener internally,
  // so we do NOT add a duplicate chrome.alarms.onAlarm listener here.
  schedulerEngine.initialize().catch((err: any) => {
    debugService.error('scheduler', 'Scheduler initialization failed', { error: err });
  });
});
