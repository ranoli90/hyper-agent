import { STORAGE_KEYS } from './config';
import type { Session, ContextSnapshot, Action, ActionResult, CommandIntent } from './types';

// Constants for session management
const MAX_SESSIONS = 10;
const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours

// Mutex to prevent concurrent load-mutate-save race conditions
let sessionMutex: Promise<void> = Promise.resolve();
function withMutex<T>(fn: () => Promise<T>): Promise<T> {
  const next = sessionMutex.then(() => fn());
  sessionMutex = next.then(() => {}, () => {});
  return next;
}

// ─── Helper: Generate unique session ID ────────────────────────────────
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ─── Load all sessions ───────────────────────────────────────────────
async function loadSessions(): Promise<Record<string, Session>> {
  const data = await chrome.storage.local.get(STORAGE_KEYS.SESSIONS);
  return data[STORAGE_KEYS.SESSIONS] || {};
}

// ─── Save all sessions ────────────────────────────────────────────────
async function saveSessions(sessions: Record<string, Session>): Promise<void> {
  // Clean up old sessions
  const cutoff = Date.now() - SESSION_TIMEOUT_MS;
  const cleaned: Record<string, Session> = {};
  
  for (const [id, session] of Object.entries(sessions)) {
    if (session.lastActive > cutoff) {
      cleaned[id] = session;
    }
  }
  
  // Limit to MAX_SESSIONS most recent
  const sorted = Object.values(cleaned).sort((a, b) => b.lastActive - a.lastActive);
  const limited: Record<string, Session> = {};
  for (const session of sorted.slice(0, MAX_SESSIONS)) {
    limited[session.id] = session;
  }
  
  await chrome.storage.local.set({
    [STORAGE_KEYS.SESSIONS]: limited,
  });
}

// ─── Create a new session ────────────────────────────────────────────
export async function createSession(
  pageUrl: string,
  pageTitle: string
): Promise<Session> {
  const session: Session = {
    id: generateSessionId(),
    createdAt: Date.now(),
    lastActive: Date.now(),
    pageUrl,
    pageTitle,
    context: {
      extractedData: {},
      lastIntent: null,
      lastAction: null,
      pendingActions: [],
    },
    actionHistory: [],
    results: [],
  };
  
  const sessions = await loadSessions();
  sessions[session.id] = session;
  await saveSessions(sessions);
  
  // Set as active session
  await chrome.storage.local.set({
    [STORAGE_KEYS.ACTIVE_SESSION]: session.id,
  });
  
  return session;
}

// ─── Save session ────────────────────────────────────────────────────
export async function saveSession(session: Session): Promise<void> {
  session.lastActive = Date.now();
  const sessions = await loadSessions();
  sessions[session.id] = session;
  await saveSessions(sessions);
}

// ─── Load session by ID ──────────────────────────────────────────────
export async function loadSession(id: string): Promise<Session | null> {
  const sessions = await loadSessions();
  return sessions[id] || null;
}

// ─── Get active session ────────────────────────────────────────────────
export async function getActiveSession(): Promise<Session | null> {
  const data = await chrome.storage.local.get(STORAGE_KEYS.ACTIVE_SESSION);
  const activeId = data[STORAGE_KEYS.ACTIVE_SESSION];
  
  if (!activeId) return null;
  
  const sessions = await loadSessions();
  return sessions[activeId] || null;
}

// ─── Set active session ───────────────────────────────────────────────
export async function setActiveSession(id: string): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.ACTIVE_SESSION]: id,
  });
}

// ─── Get all active sessions ─────────────────────────────────────────
export async function getActiveSessions(): Promise<Session[]> {
  const sessions = await loadSessions();
  const cutoff = Date.now() - SESSION_TIMEOUT_MS;
  
  return Object.values(sessions)
    .filter(s => s.lastActive > cutoff)
    .sort((a, b) => b.lastActive - a.lastActive);
}

// ─── Update session context ──────────────────────────────────────────
export async function updateSessionContext(
  sessionId: string,
  updates: Partial<ContextSnapshot>
): Promise<void> {
  const session = await loadSession(sessionId);
  if (!session) return;
  
  session.context = { ...session.context, ...updates };
  await saveSession(session);
}

// ─── Add action to session ───────────────────────────────────────────
export async function addActionToSession(
  sessionId: string,
  action: Action
): Promise<void> {
  await withMutex(async () => {
    const session = await loadSession(sessionId);
    if (!session) return;

    session.actionHistory.push(action);
    session.context.lastAction = action;

    // Keep only last 100 actions
    if (session.actionHistory.length > 100) {
      session.actionHistory = session.actionHistory.slice(-100);
    }

    await saveSession(session);
  });
}

// ─── Add result to session ───────────────────────────────────────────
export async function addResultToSession(
  sessionId: string,
  result: ActionResult
): Promise<void> {
  await withMutex(async () => {
    const session = await loadSession(sessionId);
    if (!session) return;

    session.results.push(result);

    // Keep only last 100 results
    if (session.results.length > 100) {
      session.results = session.results.slice(-100);
    }

    await saveSession(session);
  });
}

// ─── Update session page info ────────────────────────────────────────
export async function updateSessionPageInfo(
  sessionId: string,
  pageUrl: string,
  pageTitle: string
): Promise<void> {
  const session = await loadSession(sessionId);
  if (!session) return;
  
  session.pageUrl = pageUrl;
  session.pageTitle = pageTitle;
  await saveSession(session);
}

// ─── Update extracted data ───────────────────────────────────────────
export async function updateExtractedData(
  sessionId: string,
  data: Record<string, unknown>
): Promise<void> {
  const session = await loadSession(sessionId);
  if (!session) return;
  
  session.context.extractedData = { ...session.context.extractedData, ...data };
  await saveSession(session);
}

// ─── Update last intent ──────────────────────────────────────────────
export async function updateLastIntent(
  sessionId: string,
  intent: CommandIntent
): Promise<void> {
  const session = await loadSession(sessionId);
  if (!session) return;
  
  session.context.lastIntent = intent;
  await saveSession(session);
}

// ─── Delete session ──────────────────────────────────────────────────
export async function deleteSession(id: string): Promise<void> {
  const sessions = await loadSessions();
  delete sessions[id];
  await saveSessions(sessions);
  
  // Clear active session if it was deleted
  const activeData = await chrome.storage.local.get(STORAGE_KEYS.ACTIVE_SESSION);
  if (activeData[STORAGE_KEYS.ACTIVE_SESSION] === id) {
    await chrome.storage.local.remove(STORAGE_KEYS.ACTIVE_SESSION);
  }
}

// ─── Clear all sessions ──────────────────────────────────────────────
export async function clearAllSessions(): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.SESSIONS]: {},
    [STORAGE_KEYS.ACTIVE_SESSION]: null,
  });
}

// ─── Get session stats ───────────────────────────────────────────────
export async function getSessionStats(): Promise<{
  totalSessions: number;
  oldestSession: number | null;
  newestSession: number | null;
}> {
  const sessions = await loadSessions();
  const sessionList = Object.values(sessions);
  
  if (sessionList.length === 0) {
    return {
      totalSessions: 0,
      oldestSession: null,
      newestSession: null,
    };
  }
  
  return {
    totalSessions: sessionList.length,
    oldestSession: Math.min(...sessionList.map(s => s.createdAt)),
    newestSession: Math.max(...sessionList.map(s => s.createdAt)),
  };
}
