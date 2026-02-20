import type { Action, ActionResult, ErrorType } from './types';

export enum TestPhase {
  IDLE = 'idle',
  SETUP = 'setup',
  EXECUTING = 'executing',
  VERIFYING = 'verifying',
  TEARDOWN = 'teardown',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RECOVERING = 'recovering',
}

export interface TestLifecycleState {
  id: string;
  phase: TestPhase;
  startTime: number;
  endTime?: number;
  currentAction?: Action;
  completedActions: { action: Action; result: ActionResult; duration: number }[];
  pendingActions: Action[];
  errors: { error: string; errorType: ErrorType; timestamp: number; action?: Action }[];
  snapshots: EnvironmentSnapshot[];
  metadata: Record<string, any>;
}

export interface EnvironmentSnapshot {
  id: string;
  timestamp: number;
  url: string;
  title: string;
  scrollPosition: { x: number; y: number };
  formData: Record<string, string>;
  cookies: Record<string, string>;
  phase: TestPhase;
}

export interface StateTransition {
  from: TestPhase;
  to: TestPhase;
  timestamp: number;
  trigger: string;
  metadata?: Record<string, any>;
}

type StateChangeListener = (state: TestLifecycleState, transition: StateTransition) => void;

const STORAGE_KEY = 'hyperagent_test_states';

const VALID_TRANSITIONS: Record<TestPhase, TestPhase[]> = {
  [TestPhase.IDLE]: [TestPhase.SETUP],
  [TestPhase.SETUP]: [TestPhase.EXECUTING, TestPhase.FAILED],
  [TestPhase.EXECUTING]: [TestPhase.VERIFYING, TestPhase.FAILED, TestPhase.RECOVERING],
  [TestPhase.VERIFYING]: [TestPhase.EXECUTING, TestPhase.COMPLETED, TestPhase.FAILED],
  [TestPhase.TEARDOWN]: [TestPhase.COMPLETED, TestPhase.FAILED],
  [TestPhase.COMPLETED]: [TestPhase.IDLE],
  [TestPhase.FAILED]: [TestPhase.RECOVERING, TestPhase.IDLE],
  [TestPhase.RECOVERING]: [TestPhase.EXECUTING, TestPhase.FAILED],
};

export class AdvancedTestStateManager {
  private states: Map<string, TestLifecycleState> = new Map();
  private transitions: Map<string, StateTransition[]> = new Map();
  private listeners: StateChangeListener[] = [];
  private maxSnapshotsPerTest = 20;
  private maxTransitionsPerTest = 200;

  createState(id: string, initialActions: Action[] = []): TestLifecycleState {
    const state: TestLifecycleState = {
      id,
      phase: TestPhase.IDLE,
      startTime: Date.now(),
      completedActions: [],
      pendingActions: [...initialActions],
      errors: [],
      snapshots: [],
      metadata: {},
    };
    this.states.set(id, state);
    this.transitions.set(id, []);
    return state;
  }

  getState(id: string): TestLifecycleState | undefined {
    return this.states.get(id);
  }

  getAllStates(): TestLifecycleState[] {
    return Array.from(this.states.values());
  }

  transition(id: string, toPhase: TestPhase, trigger: string, metadata?: Record<string, any>): boolean {
    const state = this.states.get(id);
    if (!state) return false;

    const allowed = VALID_TRANSITIONS[state.phase];
    if (!allowed || !allowed.includes(toPhase)) {
      console.warn(`[StateManager] Invalid transition: ${state.phase} -> ${toPhase} for test ${id}`);
      return false;
    }

    const transition: StateTransition = {
      from: state.phase,
      to: toPhase,
      timestamp: Date.now(),
      trigger,
      metadata,
    };

    state.phase = toPhase;

    if (toPhase === TestPhase.COMPLETED || toPhase === TestPhase.FAILED) {
      state.endTime = Date.now();
    }

    const transitions = this.transitions.get(id) || [];
    transitions.push(transition);
    if (transitions.length > this.maxTransitionsPerTest) {
      transitions.shift();
    }
    this.transitions.set(id, transitions);

    for (const listener of this.listeners) {
      try {
        listener(state, transition);
      } catch (err) {
        console.error('[StateManager] Listener error:', err);
      }
    }

    return true;
  }

  recordActionStart(id: string, action: Action): void {
    const state = this.states.get(id);
    if (!state) return;
    state.currentAction = action;
  }

  recordActionComplete(id: string, action: Action, result: ActionResult, duration: number): void {
    const state = this.states.get(id);
    if (!state) return;

    state.completedActions.push({ action, result, duration });
    state.currentAction = undefined;

    const idx = state.pendingActions.findIndex(
      a => a.type === action.type && JSON.stringify(a) === JSON.stringify(action)
    );
    if (idx >= 0) {
      state.pendingActions.splice(idx, 1);
    }

    if (!result.success && result.errorType) {
      state.errors.push({
        error: result.error || 'Unknown error',
        errorType: result.errorType,
        timestamp: Date.now(),
        action,
      });
    }
  }

  addPendingActions(id: string, actions: Action[]): void {
    const state = this.states.get(id);
    if (!state) return;
    state.pendingActions.push(...actions);
  }

  takeSnapshot(id: string, env: Omit<EnvironmentSnapshot, 'id' | 'timestamp' | 'phase'>): EnvironmentSnapshot | null {
    const state = this.states.get(id);
    if (!state) return null;

    const snapshot: EnvironmentSnapshot = {
      id: `snap_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: Date.now(),
      phase: state.phase,
      ...env,
    };

    state.snapshots.push(snapshot);
    if (state.snapshots.length > this.maxSnapshotsPerTest) {
      state.snapshots.shift();
    }

    return snapshot;
  }

  getLatestSnapshot(id: string): EnvironmentSnapshot | null {
    const state = this.states.get(id);
    if (!state || state.snapshots.length === 0) return null;
    return state.snapshots[state.snapshots.length - 1];
  }

  getTransitions(id: string): StateTransition[] {
    return this.transitions.get(id) || [];
  }

  setMetadata(id: string, key: string, value: any): void {
    const state = this.states.get(id);
    if (!state) return;
    state.metadata[key] = value;
  }

  onStateChange(listener: StateChangeListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  getStats(id: string): {
    totalActions: number;
    completed: number;
    pending: number;
    errors: number;
    successRate: number;
    duration: number;
    averageActionDuration: number;
  } | null {
    const state = this.states.get(id);
    if (!state) return null;

    const successfulActions = state.completedActions.filter(a => a.result.success).length;
    const totalCompleted = state.completedActions.length;
    const totalDuration = state.completedActions.reduce((sum, a) => sum + a.duration, 0);

    return {
      totalActions: totalCompleted + state.pendingActions.length,
      completed: totalCompleted,
      pending: state.pendingActions.length,
      errors: state.errors.length,
      successRate: totalCompleted > 0 ? successfulActions / totalCompleted : 0,
      duration: (state.endTime || Date.now()) - state.startTime,
      averageActionDuration: totalCompleted > 0 ? totalDuration / totalCompleted : 0,
    };
  }

  removeState(id: string): boolean {
    this.transitions.delete(id);
    return this.states.delete(id);
  }

  async persist(): Promise<void> {
    try {
      if (!chrome?.storage?.local) return;
      const serializable = Array.from(this.states.entries()).map(([id, state]) => ({
        id,
        state: {
          ...state,
          currentAction: undefined,
        },
        transitions: this.transitions.get(id) || [],
      }));
      await chrome.storage.local.set({ [STORAGE_KEY]: serializable });
    } catch (err) {
      console.error('[StateManager] Persist failed:', err);
    }
  }

  async restore(): Promise<void> {
    try {
      if (!chrome?.storage?.local) return;
      const data = await chrome.storage.local.get(STORAGE_KEY);
      const entries = data[STORAGE_KEY];
      if (!Array.isArray(entries)) return;

      for (const entry of entries) {
        if (entry.id && entry.state) {
          this.states.set(entry.id, entry.state);
          this.transitions.set(entry.id, entry.transitions || []);
        }
      }
    } catch (err) {
      console.error('[StateManager] Restore failed:', err);
    }
  }

  cleanup(maxAge: number = 24 * 60 * 60 * 1000): number {
    const cutoff = Date.now() - maxAge;
    let removed = 0;

    for (const [id, state] of this.states) {
      const endTime = state.endTime || state.startTime;
      if (endTime < cutoff && (state.phase === TestPhase.COMPLETED || state.phase === TestPhase.FAILED)) {
        this.states.delete(id);
        this.transitions.delete(id);
        removed++;
      }
    }

    return removed;
  }
}

export const testStateManager = new AdvancedTestStateManager();
