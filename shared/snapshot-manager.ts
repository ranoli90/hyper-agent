/**
 * @fileoverview Task state persistence.
 * Saves agent snapshots for resume after browser restart or crash.
 */

import { Action, ActionResult } from './types';

export interface AgentSnapshot {
    sessionId: string;
    taskId: string;
    command: string;
    currentStep: number;
    totalSteps: number;
    plan: any; // PlanningEngine.Plan - optional for backward compat
    history: any[]; // HistoryEntry[]
    results: ActionResult[];
    status: string;
    timestamp: number;
    url?: string; // Optional for backward compat
}

/**
 * SnapshotManager
 * 
 * Handles state persistence for long-running autonomous tasks.
 * Ensures the agent can resume after browser restarts or failures.
 */
export class SnapshotManager {
    private static STORAGE_KEY_PREFIX = 'agent_snapshot_';

    /**
     * Serializes and persists a task snapshot to local storage.
     * 
     * @param snapshot - The state object containing the mission progress, plan, and history.
     */
    static async save(snapshot: AgentSnapshot): Promise<void> {
        const key = `${this.STORAGE_KEY_PREFIX}${snapshot.taskId}`;
        await chrome.storage.local.set({ [key]: snapshot });

        // Also update the "Last Active" index for mission recovery on startup
        await chrome.storage.local.set({ 'last_active_task_id': snapshot.taskId });
        console.log(`[Snapshot] Saved state for task ${snapshot.taskId} at step ${snapshot.currentStep}`);
    }

    static async load(taskId: string): Promise<AgentSnapshot | null> {
        const key = `${this.STORAGE_KEY_PREFIX}${taskId}`;
        const result = await chrome.storage.local.get(key);
        return result[key] || null;
    }

    static async loadLastActive(): Promise<AgentSnapshot | null> {
        const result = await chrome.storage.local.get('last_active_task_id');
        if (!result.last_active_task_id) return null;
        return this.load(result.last_active_task_id);
    }

    static async clear(taskId: string): Promise<void> {
        const key = `${this.STORAGE_KEY_PREFIX}${taskId}`;
        const result = await chrome.storage.local.get('last_active_task_id');
        const keysToRemove = [key];
        if (result.last_active_task_id === taskId) {
            keysToRemove.push('last_active_task_id');
        }
        await chrome.storage.local.remove(keysToRemove);
    }

    /**
     * Lists all pending/saved snapshots.
     */
    static async listAll(): Promise<AgentSnapshot[]> {
        const all = await chrome.storage.local.get(null);
        return Object.keys(all)
            .filter(k => k.startsWith(this.STORAGE_KEY_PREFIX))
            .map(k => all[k]);
    }
}
