// ─── Security & Privacy Module ──────────────────────────────────────────
// Iteration 15: Enhanced Security & Privacy

import type { Action } from './types';

// ─── Storage Keys ───────────────────────────────────────────────────────
export const SECURITY_STORAGE_KEYS = {
  PRIVACY_SETTINGS: 'hyperagent_privacy_settings',
  SECURITY_POLICY: 'hyperagent_security_policy',
  ACTION_RATE_LIMITS: 'hyperagent_action_rate_limits',
} as const;

// ─── Privacy Settings ───────────────────────────────────────────────────
export interface PrivacySettings {
  allowScreenshots: boolean;
  storeActionHistory: boolean;
  shareUsageData: boolean;
  allowedDomains: string[];
  blockedDomains: string[];
}

// ─── Security Policy ───────────────────────────────────────────────────
export interface SecurityPolicy {
  maxActionsPerMinute: number;
  requireConfirmationFor: ('fill' | 'click' | 'navigate')[];
  allowExternalUrls: boolean;
}

// ─── Rate Limit Entry ─────────────────────────────────────────────────
interface RateLimitEntry {
  count: number;
  windowStart: number;
}

// ─── Default Settings ──────────────────────────────────────────────────
const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  allowScreenshots: true,
  storeActionHistory: true,
  shareUsageData: false,
  allowedDomains: [],  // Empty means all allowed
  blockedDomains: [],
};

const DEFAULT_SECURITY_POLICY: SecurityPolicy = {
  maxActionsPerMinute: 30,
  requireConfirmationFor: ['fill', 'navigate'],
  allowExternalUrls: true,
};

// ─── Helper: Extract hostname from URL ────────────────────────────────
function extractHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

// ─── Helper: Check if domain matches pattern (exact or subdomain) ─────
function domainMatches(hostname: string, pattern: string): boolean {
  if (!hostname || !pattern) return false;
  const host = hostname.toLowerCase();
  const normalized = pattern.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/^\*\./, '');
  if (!normalized) return false;
  return host === normalized || host.endsWith(`.${normalized}`);
}

// ─── Get Privacy Settings ───────────────────────────────────────────────
export async function getPrivacySettings(): Promise<PrivacySettings> {
  const data = await chrome.storage.local.get(SECURITY_STORAGE_KEYS.PRIVACY_SETTINGS);
  const stored = data[SECURITY_STORAGE_KEYS.PRIVACY_SETTINGS];

  if (stored) {
    return {
      ...DEFAULT_PRIVACY_SETTINGS,
      ...stored,
    };
  }

  return DEFAULT_PRIVACY_SETTINGS;
}

// ─── Set Privacy Settings ───────────────────────────────────────────────
export async function setPrivacySettings(settings: Partial<PrivacySettings>): Promise<void> {
  const current = await getPrivacySettings();
  const updated = { ...current, ...settings };

  await chrome.storage.local.set({
    [SECURITY_STORAGE_KEYS.PRIVACY_SETTINGS]: updated,
  });
}

// ─── Get Security Policy ───────────────────────────────────────────────
export async function getSecurityPolicy(): Promise<SecurityPolicy> {
  const data = await chrome.storage.local.get(SECURITY_STORAGE_KEYS.SECURITY_POLICY);
  const stored = data[SECURITY_STORAGE_KEYS.SECURITY_POLICY];

  if (stored) {
    return {
      ...DEFAULT_SECURITY_POLICY,
      ...stored,
    };
  }

  return DEFAULT_SECURITY_POLICY;
}

// ─── Set Security Policy ───────────────────────────────────────────────
export async function setSecurityPolicy(policy: Partial<SecurityPolicy>): Promise<void> {
  const current = await getSecurityPolicy();
  const updated = { ...current, ...policy };

  await chrome.storage.local.set({
    [SECURITY_STORAGE_KEYS.SECURITY_POLICY]: updated,
  });
}

// ─── Check Domain Allowed ───────────────────────────────────────────────
export async function checkDomainAllowed(url: string): Promise<boolean> {
  const settings = await getPrivacySettings();
  const hostname = extractHostname(url);

  if (!hostname) return false;

  // Check blocked domains first
  for (const blocked of settings.blockedDomains) {
    if (domainMatches(hostname, blocked)) {
      return false;
    }
  }

  // If allowedDomains is not empty, check against it
  if (settings.allowedDomains.length > 0) {
    for (const allowed of settings.allowedDomains) {
      if (domainMatches(hostname, allowed)) {
        return true;
      }
    }
    return false;
  }

  return true;
}

// ─── Check Action Allowed ───────────────────────────────────────────────
export async function checkActionAllowed(action: Action, url: string): Promise<{
  allowed: boolean;
  requiresConfirmation: boolean;
  reason?: string;
}> {
  const policy = await getSecurityPolicy();
  const hostname = extractHostname(url);

  // Check if action type requires confirmation
  const requiresConfirmation = policy.requireConfirmationFor.includes(action.type as any);

  // Check for navigate action and external URLs
  if (action.type === 'navigate' && !policy.allowExternalUrls) {
    const navUrl = (action as any).url;
    if (navUrl) {
      const navHostname = extractHostname(navUrl);
      if (navHostname && navHostname !== hostname) {
        return {
          allowed: false,
          requiresConfirmation: false,
          reason: 'External URLs are not allowed by security policy',
        };
      }
    }
  }

  return {
    allowed: true,
    requiresConfirmation,
  };
}

// ─── Rate Limiting ─────────────────────────────────────────────────────
const actionRateLimits = new Map<string, RateLimitEntry>();

export async function checkRateLimit(actionType: string): Promise<{
  allowed: boolean;
  waitTimeMs?: number;
}> {
  const policy = await getSecurityPolicy();
  const maxPerMinute = policy.maxActionsPerMinute;
  const now = Date.now();
  const windowMs = 60000; // 1 minute window

  const key = actionType;
  const entry = actionRateLimits.get(key);

  if (!entry) {
    actionRateLimits.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }

  // Check if we're in the same window
  if (now - entry.windowStart < windowMs) {
    if (entry.count >= maxPerMinute) {
      const waitTime = windowMs - (now - entry.windowStart);
      return { allowed: false, waitTimeMs: waitTime };
    }
    entry.count++;
    return { allowed: true };
  }

  // Reset window
  actionRateLimits.set(key, { count: 1, windowStart: now });
  return { allowed: true };
}

// ─── Clear Rate Limits ─────────────────────────────────────────────────
export function clearRateLimits(): void {
  actionRateLimits.clear();
}

// ─── Initialize Default Security Settings ──────────────────────────────
export async function initializeSecuritySettings(): Promise<void> {
  // Set defaults if not already set
  const privacy = await getPrivacySettings();
  const policy = await getSecurityPolicy();

  // Ensure defaults are persisted
  await chrome.storage.local.set({
    [SECURITY_STORAGE_KEYS.PRIVACY_SETTINGS]: privacy,
    [SECURITY_STORAGE_KEYS.SECURITY_POLICY]: policy,
  });
}
// ─── Data Redaction & Sanitization ─────────────────────────────────────
export function redact(value: any): string {
  const s = typeof value === 'string' ? value : JSON.stringify(value ?? '', (_k, v) => v, 2);
  const REDACTION_TOKEN = '***REDACTED***';
  const patterns: RegExp[] = [
    // OpenRouter API keys (sk-or-v1-...)
    /sk-or-v1-[a-zA-Z0-9_-]{20,}/g,
    // OpenRouter/OpenAI-style API keys
    /sk-[a-zA-Z0-9]{20,}/g,
    // Anthropic API keys
    /sk-ant-[a-zA-Z0-9-]{20,}/g,
    // Google AI keys
    /AIza[a-zA-Z0-9_-]{35}/g,
    // Stripe keys
    /(sk_live|sk_test|pk_live|pk_test)_[a-zA-Z0-9]{24,}/g,
    // AWS keys
    /AKIA[A-Z0-9]{16}/g,
    /([a-zA-Z0-9_.+-]+)@([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)/g, // email
    /\b(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g, // phone (simple)
    /\b(?:\d[ -]*?){13,19}\b/g, // cc-like numbers
    /\b(?:sk|pk|eyJ|ya29)\w{16,}\b/gi, // tokens
    /\b[A-Fa-f0-9]{32,}\b/g, // long hex ids
    /\b(?:session|auth|token|secret|password|apikey|api_key)\s*[:=]\s*['"][^'"\n]+['"]/gi,
  ];
  return patterns.reduce((acc, re) => acc.replace(re, REDACTION_TOKEN), s).slice(0, 20000);
}

export function sanitizeMessages(messages: any[]): any[] {
  return (messages || []).map((m) => {
    if (Array.isArray(m.content)) {
      return {
        ...m,
        content: m.content.map((c: any) => {
          if (c?.type === 'text' && typeof c.text === 'string') {
            return { ...c, text: redact(c.text) };
          }
          return c;
        })
      };
    }
    if (typeof m.content === 'string') {
      return { ...m, content: redact(m.content) };
    }
    return m;
  });
}
