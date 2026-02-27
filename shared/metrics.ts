/**
 * @fileoverview Performance metrics.
 * Tracks action counts, success rates, and domain-level stats.
 */

import { extractDomain } from './url-utils';

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

export interface ActionTrackingEntry {
  id: string;
  actionType: string;
  startTime: number;
  endTime?: number;
  success?: boolean;
  durationMs?: number;
  domain?: string;
}

export interface AgentRunTrackingEntry {
  id: string;
  startTime: number;
  endTime?: number;
  success?: boolean;
  durationMs?: number;
  /** True when run was autonomous (multi-step planning); false for manual/traditional loop. */
  isAutonomous?: boolean;
  /** Number of actions executed in this run (when available). */
  actionsCount?: number;
}

export interface RateLimitTrackingEntry {
  timestamp: number;
  model: string;
  source: 'OpenRouter' | 'Hyperagent';
  retryAfter: number;
}

// ─── Storage Keys ─────────────────────────────────────────────────────────
const _METRICS_STORAGE_KEY = 'hyperagent_metrics';
const ACTION_TRACKING_KEY = 'hyperagent_action_tracking';
const AGENT_RUN_TRACKING_KEY = 'hyperagent_agent_run_tracking';
const RATE_LIMIT_TRACKING_KEY = 'hyperagent_rate_limit_tracking'; // New storage key
const MAX_TRACKING_ENTRIES = 1000;

// ─── Action Tracking State ───────────────────────────────────────────────
const activeActions = new Map<string, ActionTrackingEntry>();

// ─── Helper: Save to chrome.storage.local ───────────────────────────────
async function saveToStorage(key: string, data: unknown): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: data }, () => resolve());
  });
}

// ─── Helper: Load from chrome.storage.local ─────────────────────────────
async function loadFromStorage<T>(key: string): Promise<T | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => {
      resolve((result[key] as T) ?? null);
    });
  });
}

// ─── Track Action Start ─────────────────────────────────────────────────
export function trackActionStart(action: { type: string; locator?: unknown }, pageUrl?: string): string {
  const actionId = `action_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const entry: ActionTrackingEntry = {
    id: actionId,
    actionType: action.type,
    startTime: Date.now(),
    domain: pageUrl ? extractDomain(pageUrl) : undefined,
  };
  activeActions.set(actionId, entry);
  return actionId;
}

// ─── Track Action End ───────────────────────────────────────────────────
export function trackActionEnd(
  actionId: string,
  success: boolean,
  durationMs: number,
  pageUrl?: string
): void {
  const entry = activeActions.get(actionId);
  if (!entry) {
    console.warn(`[Metrics] No tracking entry found for actionId: ${actionId}`);
    return;
  }

  entry.endTime = Date.now();
  entry.success = success;
  entry.durationMs = durationMs;
  
  if (!entry.domain && pageUrl) {
    entry.domain = extractDomain(pageUrl);
  }

  // Save to storage for persistence
  saveTrackingEntry(entry);
  
  activeActions.delete(actionId);
}

// ─── Agent Run Tracking ──────────────────────────────────────────────────
const activeAgentRuns = new Map<string, AgentRunTrackingEntry>();

export function trackAgentRunStart(options?: { isAutonomous?: boolean }): string {
  const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const entry: AgentRunTrackingEntry = {
    id: runId,
    startTime: Date.now(),
    isAutonomous: options?.isAutonomous ?? false,
  };
  activeAgentRuns.set(runId, entry);
  return runId;
}

export async function trackAgentRunEnd(
  runId: string,
  success: boolean,
  durationMs: number,
  options?: { actionsCount?: number }
): Promise<void> {
  const entry = activeAgentRuns.get(runId);
  if (!entry) {
    console.warn(`[Metrics] No tracking entry found for agentRunId: ${runId}`);
    return;
  }

  entry.endTime = Date.now();
  entry.success = success;
  entry.durationMs = durationMs;
  if (options?.actionsCount !== undefined) entry.actionsCount = options.actionsCount;

  try {
    const entries = await loadFromStorage<AgentRunTrackingEntry[]>(AGENT_RUN_TRACKING_KEY);
    const trackingEntries: AgentRunTrackingEntry[] = entries || [];

    trackingEntries.push(entry);

    // Keep only last MAX_TRACKING_ENTRIES
    while (trackingEntries.length > MAX_TRACKING_ENTRIES) {
      trackingEntries.shift();
    }

    await saveToStorage(AGENT_RUN_TRACKING_KEY, trackingEntries);
  } catch (err) {
    console.error('[Metrics] Failed to save agent run tracking entry:', err);
  }

  activeAgentRuns.delete(runId);
}

export async function getDailyAgentRunCounts(): Promise<Record<string, number>> {
  const trackingEntries = await loadFromStorage<AgentRunTrackingEntry[]>(AGENT_RUN_TRACKING_KEY);
  if (!trackingEntries) {
    return {};
  }

  const dailyCounts: Record<string, number> = {};
  for (const entry of trackingEntries) {
    if (entry.startTime) {
      const date = new Date(entry.startTime);
      const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD
      dailyCounts[dateString] = (dailyCounts[dateString] || 0) + 1;
    }
  }
  return dailyCounts;
}

/** Counts of autonomous vs manual runs and actions (for analytics). */
export interface AutonomousVsManualStats {
  autonomousRuns: number;
  manualRuns: number;
  autonomousActionsTotal: number;
  manualActionsTotal: number;
}

export async function getAutonomousVsManualStats(): Promise<AutonomousVsManualStats> {
  const trackingEntries = await loadFromStorage<AgentRunTrackingEntry[]>(AGENT_RUN_TRACKING_KEY);
  if (!trackingEntries) {
    return { autonomousRuns: 0, manualRuns: 0, autonomousActionsTotal: 0, manualActionsTotal: 0 };
  }
  let autonomousRuns = 0;
  let manualRuns = 0;
  let autonomousActionsTotal = 0;
  let manualActionsTotal = 0;
  for (const entry of trackingEntries) {
    if (entry.isAutonomous) {
      autonomousRuns++;
      autonomousActionsTotal += entry.actionsCount ?? 0;
    } else {
      manualRuns++;
      manualActionsTotal += entry.actionsCount ?? 0;
    }
  }
  return { autonomousRuns, manualRuns, autonomousActionsTotal, manualActionsTotal };
}

export async function getDailyActionCounts(): Promise<Record<string, number>> {
  const trackingEntries = await loadFromStorage<ActionTrackingEntry[]>(ACTION_TRACKING_KEY);
  if (!trackingEntries) {
    return {};
  }

  const dailyCounts: Record<string, number> = {};
  for (const entry of trackingEntries) {
    if (entry.startTime) {
      const date = new Date(entry.startTime);
      const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD
      dailyCounts[dateString] = (dailyCounts[dateString] || 0) + 1;
    }
  }
  return dailyCounts;
}

// ─── Save tracking entry to storage ──────────────────────────────────────
async function saveTrackingEntry(entry: ActionTrackingEntry): Promise<void> {
  try {
    const entries = await loadFromStorage<ActionTrackingEntry[]>(ACTION_TRACKING_KEY);
    const trackingEntries: ActionTrackingEntry[] = entries || [];
    
    trackingEntries.push(entry);
    
    // Keep only last MAX_TRACKING_ENTRIES
    while (trackingEntries.length > MAX_TRACKING_ENTRIES) {
      trackingEntries.shift();
    }
    
    await saveToStorage(ACTION_TRACKING_KEY, trackingEntries);
  } catch (err) {
    console.error('[Metrics] Failed to save tracking entry:', err);
  }
}

// ─── Track Rate Limit Event ──────────────────────────────────────────
export async function trackRateLimitEvent(entry: RateLimitTrackingEntry): Promise<void> {
  try {
    const entries = await loadFromStorage<RateLimitTrackingEntry[]>(RATE_LIMIT_TRACKING_KEY);
    const trackingEntries: RateLimitTrackingEntry[] = entries || [];

    trackingEntries.push(entry);

    // Keep only last MAX_TRACKING_ENTRIES
    while (trackingEntries.length > MAX_TRACKING_ENTRIES) {
      trackingEntries.shift();
    }

    await saveToStorage(RATE_LIMIT_TRACKING_KEY, trackingEntries);
  } catch (err) {
    console.error('[Metrics] Failed to save rate limit tracking entry:', err);
  }
}

// ─── Get Daily Rate Limit Counts ──────────────────────────────────────────
export async function getDailyRateLimitCounts(): Promise<Record<string, Record<string, number>>> {
  const trackingEntries = await loadFromStorage<RateLimitTrackingEntry[]>(RATE_LIMIT_TRACKING_KEY);
  if (!trackingEntries) {
    return {};
  }

  const dailyCounts: Record<string, Record<string, number>> = {};
  for (const entry of trackingEntries) {
    const date = new Date(entry.timestamp);
    const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD

    if (!dailyCounts[dateString]) {
      dailyCounts[dateString] = {};
    }
    const key = `${entry.model}_${entry.source}`;
    dailyCounts[dateString][key] = (dailyCounts[dateString][key] || 0) + 1;
  }
  return dailyCounts;
}

// ─── Get All Metrics ────────────────────────────────────────────────────
export async function getMetrics(): Promise<PerformanceMetric[]> {
  const trackingEntries = await loadFromStorage<ActionTrackingEntry[]>(ACTION_TRACKING_KEY);
  if (!trackingEntries) return [];

  const metrics: PerformanceMetric[] = [];
  const now = Date.now();

  // Calculate aggregate metrics
  const totalActions = trackingEntries.length;
  const successfulActions = trackingEntries.filter(e => e.success).length;
  const _failedActions = totalActions - successfulActions;
  
  // Overall success rate
  const overallSuccessRate = totalActions > 0 ? (successfulActions / totalActions) * 100 : 0;
  metrics.push({
    name: 'overall_success_rate',
    value: overallSuccessRate,
    timestamp: now,
  });

  // Average duration
  const completedEntries = trackingEntries.filter(e => e.durationMs !== undefined);
  const totalDuration = completedEntries.reduce((sum, e) => sum + (e.durationMs || 0), 0);
  const avgDuration = completedEntries.length > 0 ? totalDuration / completedEntries.length : 0;
  metrics.push({
    name: 'average_action_duration_ms',
    value: avgDuration,
    timestamp: now,
  });

  // Total actions
  metrics.push({
    name: 'total_actions',
    value: totalActions,
    timestamp: now,
  });

  return metrics;
}

// ─── Get Monthly Action Counts ────────────────────────────────────────────
export async function getMonthlyActionCounts(): Promise<{ totalActions: number; monthlyActions: number }> {
  const trackingEntries = await loadFromStorage<ActionTrackingEntry[]>(ACTION_TRACKING_KEY);
  if (!trackingEntries) {
    return { totalActions: 0, monthlyActions: 0 };
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  let monthlyActions = 0;
  for (const entry of trackingEntries) {
    if (entry.startTime && entry.startTime >= startOfMonth) {
      monthlyActions++;
    }
  }

  return { totalActions: trackingEntries.length, monthlyActions };
}

// ─── Get Action Metrics by Type ───────────────────────────────────────────
export async function getActionMetrics(): Promise<ActionMetrics[]> {
  const trackingEntries = await loadFromStorage<ActionTrackingEntry[]>(ACTION_TRACKING_KEY);
  if (!trackingEntries) return [];

  // Group by action type
  const actionTypeMap = new Map<string, ActionTrackingEntry[]>();
  
  for (const entry of trackingEntries) {
    const existing = actionTypeMap.get(entry.actionType) || [];
    existing.push(entry);
    actionTypeMap.set(entry.actionType, existing);
  }

  const actionMetrics: ActionMetrics[] = [];

  for (const [actionType, entries] of actionTypeMap) {
    const totalAttempts = entries.length;
    const successfulAttempts = entries.filter(e => e.success).length;
    const failedAttempts = totalAttempts - successfulAttempts;
    
    const completedEntries = entries.filter(e => e.durationMs !== undefined);
    const totalDuration = completedEntries.reduce((sum, e) => sum + (e.durationMs || 0), 0);
    const averageDurationMs = completedEntries.length > 0 ? totalDuration / completedEntries.length : 0;
    
    const successRate = totalAttempts > 0 ? (successfulAttempts / totalAttempts) * 100 : 0;

    actionMetrics.push({
      actionType,
      totalAttempts,
      successfulAttempts,
      failedAttempts,
      averageDurationMs,
      successRate,
    });
  }

  // Sort by total attempts (descending)
  actionMetrics.sort((a, b) => b.totalAttempts - a.totalAttempts);

  return actionMetrics;
}

// ─── Get Success Rate by Domain ─────────────────────────────────────────
export async function getSuccessRateByDomain(): Promise<Record<string, number>> {
  const trackingEntries = await loadFromStorage<ActionTrackingEntry[]>(ACTION_TRACKING_KEY);
  if (!trackingEntries) return {};

  // Group by domain
  const domainMap = new Map<string, { total: number; successful: number }>();
  
  for (const entry of trackingEntries) {
    const domain = entry.domain || 'unknown';
    const existing = domainMap.get(domain) || { total: 0, successful: 0 };
    existing.total += 1;
    if (entry.success) {
      existing.successful += 1;
    }
    domainMap.set(domain, existing);
  }

  // Calculate success rates
  const successRates: Record<string, number> = {};
  for (const [domain, stats] of domainMap) {
    successRates[domain] = stats.total > 0 ? (stats.successful / stats.total) * 100 : 0;
  }

  return successRates;
}

// ─── Clear All Metrics (for testing) ──────────────────────────────────────
export async function clearMetrics(): Promise<void> {
  await saveToStorage(ACTION_TRACKING_KEY, []);
  activeActions.clear();
}

// ─── Get Recent Actions ──────────────────────────────────────────────────
export async function getRecentActions(limit: number = 50): Promise<ActionTrackingEntry[]> {
  const trackingEntries = await loadFromStorage<ActionTrackingEntry[]>(ACTION_TRACKING_KEY);
  if (!trackingEntries) return [];

  // Return most recent entries
  return trackingEntries.slice(-limit).reverse();
}
