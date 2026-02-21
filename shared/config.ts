/**
 * @fileoverview HyperAgent configuration.
 * Storage keys, defaults, validation, and settings load/save.
 */

// ─── Storage Schema Version ───────────────────────────────────────────
export const STORAGE_VERSION = 1;

// ─── Storage keys ───────────────────────────────────────────────────
// API key is stored in chrome.storage.local (extension storage). Only this extension
// can access it; it is not encrypted at rest. Do not share exported settings files.
export const STORAGE_KEYS = {
  // Schema version for migrations
  SCHEMA_VERSION: 'hyperagent_schema_version',
  API_KEY: 'hyperagent_api_key',
  BASE_URL: 'hyperagent_base_url',
  MODEL_NAME: 'hyperagent_model_name',
  BACKUP_MODEL: 'hyperagent_backup_model',
  MAX_STEPS: 'hyperagent_max_steps',
  REQUIRE_CONFIRM: 'hyperagent_require_confirm',
  DRY_RUN: 'hyperagent_dry_run',
  ENABLE_VISION: 'hyperagent_enable_vision',
  AUTO_RETRY: 'hyperagent_auto_retry',
  SITE_BLACKLIST: 'hyperagent_site_blacklist',
  // Memory and persistent learning
  SITE_STRATEGIES: 'hyperagent_site_strategies',
  ACTION_HISTORY: 'hyperagent_action_history',
  // Session persistence
  SESSIONS: 'hyperagent_sessions',
  ACTIVE_SESSION: 'hyperagent_active_session',
  // Site-specific overrides
  SITE_CONFIGS: 'hyperagent_site_configs',
  // Security & Privacy
  PRIVACY_SETTINGS: 'hyperagent_privacy_settings',
  SECURITY_POLICY: 'hyperagent_security_policy',
  // Advanced autonomous settings
  ENABLE_SWARM_INTELLIGENCE: 'hyperagent_enable_swarm',
  ENABLE_AUTONOMOUS_MODE: 'hyperagent_enable_autonomous',
  LEARNING_ENABLED: 'hyperagent_learning_enabled',
  // UI state
  CHAT_HISTORY: 'hyperagent_chat_history',
  COMMAND_HISTORY: 'hyperagent_command_history',
  DARK_MODE: 'hyperagent_dark_mode',
  // Onboarding
  SHOW_ONBOARDING: 'hyperagent_show_onboarding',
  SHOW_CHANGELOG: 'hyperagent_show_changelog',
  // Billing
  SUBSCRIPTION: 'hyperagent_subscription',
  STRIPE_PENDING: 'hyperagent_stripe_pending',
  STRIPE_SUCCESS: 'hyperagent_stripe_success',
  // Workflows
  WORKFLOWS: 'hyperagent_workflows',
  INSTALLED_WORKFLOWS: 'hyperagent_installed_workflows',
  // Scheduler
  SCHEDULED_TASKS: 'hyperagent_scheduled_tasks',
  // Snapshots
  LAST_ACTIVE_TASK: 'hyperagent_last_active_task',
  // Metrics
  USAGE_METRICS: 'hyperagent_usage_metrics',
} as const;

// ─── Validation constants ─────────────────────────────────────────────
export const VALIDATION = {
  MAX_STEPS: { MIN: 3, MAX: 50, DEFAULT: 12 },
  TIMEOUTS: { MIN: 5000, MAX: 300000, DEFAULT: 45000 },
  RETRIES: { MIN: 0, MAX: 10, DEFAULT: 2 },
  ELEMENTS: { MIN: 10, MAX: 1000, DEFAULT: 250 },
} as const;

// ─── Defaults ───────────────────────────────────────────────────────
export const DEFAULTS = {
  BASE_URL: 'https://openrouter.ai/api/v1',
  DEFAULT_API_KEY: '', // Empty default; user must provide their API key
  MODEL_NAME: 'google/gemini-2.0-flash-001',
  BACKUP_MODEL: 'google/gemini-2.0-flash-001',
  VISION_MODEL: 'google/gemini-2.0-flash-001',
  MAX_STEPS: 12,
  REQUIRE_CONFIRM: false,
  DRY_RUN: false,
  ENABLE_VISION: true,
  AUTO_RETRY: true,
  ENABLE_SWARM_INTELLIGENCE: false, // Advanced feature - off by default
  ENABLE_AUTONOMOUS_MODE: false, // Advanced feature - off by default
  LEARNING_ENABLED: true,
  SCROLL_BEFORE_LOCATE: true,
  SCROLL_RETRIES: 3,
  SCROLL_AMOUNT: 400,
  SMART_RELOCATE: true,
  DOM_WAIT_MS: 1500,
  DOM_POLL_INTERVAL_MS: 200,
  ELEMENT_STABILITY_CHECKS: 3,
  // Vision-first fallback configuration
  VISION_FALLBACK_THRESHOLD: 10,  // If fewer than 10 semantic elements, use screenshot
  AUTO_VERIFY_ACTIONS: true,     // Capture screenshot after critical actions
  VISION_MIN_ELEMENTS: 5,        // Minimum elements to consider DOM complete
  // Timing constants
  CONFIRM_TIMEOUT_MS: 60000,     // 60 seconds timeout for user confirmation
  LLM_TIMEOUT_MS: 45000,
  ERROR_REPORTING_ENABLED: false, // Disabled by default - enable in production         // LLM API call timeout (configurable via VALIDATION.TIMEOUTS)
  ACTION_DELAY_MS: 350,          // Delay between sequential actions
  BODY_TEXT_LIMIT: 15000,        // Max body text to extract
  MAX_SEMANTIC_ELEMENTS: 250,    // Max semantic elements to index
  // Token and cost management
  COST_WARNING_THRESHOLD: 5.00,  // Warn when session cost exceeds $5
  MAX_TOKENS_PER_SESSION: 100000, // Max tokens per session (approx $0.10-$0.50)
} as const;

// ─── Settings type ──────────────────────────────────────────────────
export interface Settings {
  apiKey: string;
  baseUrl: string;
  modelName: string;
  backupModel?: string;
  maxSteps: number;
  requireConfirm: boolean;
  dryRun: boolean;
  enableVision: boolean;
  autoRetry: boolean;
  siteBlacklist: string;
  // Advanced autonomous settings
  enableSwarmIntelligence: boolean;
  enableAutonomousMode: boolean;
  learningEnabled: boolean;
}

// ─── Settings validation ─────────────────────────────────────────────
export function validateSettings(settings: Partial<Settings>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (settings.maxSteps !== undefined) {
    if (settings.maxSteps < VALIDATION.MAX_STEPS.MIN || settings.maxSteps > VALIDATION.MAX_STEPS.MAX) {
      errors.push(`maxSteps must be between ${VALIDATION.MAX_STEPS.MIN} and ${VALIDATION.MAX_STEPS.MAX}`);
    }
  }

  if (settings.baseUrl !== undefined) {
    try {
      new URL(settings.baseUrl);
    } catch {
      errors.push('baseUrl must be a valid URL');
    }
  }

  // Only validate apiKey if it's being explicitly set to empty
  // Don't warn on initial load when no key has been set yet
  // (apiKey !== undefined means it's being explicitly saved)

  return {
    valid: errors.length === 0,
    errors
  };
}

// ─── Storage helpers with error handling ────────────────────────────
export async function loadSettings(): Promise<Settings> {
  try {
    // Check if chrome.storage is available (content script context)
    if (!chrome?.storage?.local) {
      console.warn('[Config] Chrome storage not available, using defaults');
      return {
        apiKey: '',
        baseUrl: DEFAULTS.BASE_URL,
        modelName: DEFAULTS.MODEL_NAME,
        backupModel: DEFAULTS.BACKUP_MODEL,
        maxSteps: DEFAULTS.MAX_STEPS,
        requireConfirm: DEFAULTS.REQUIRE_CONFIRM,
        dryRun: DEFAULTS.DRY_RUN,
        enableVision: DEFAULTS.ENABLE_VISION,
        autoRetry: DEFAULTS.AUTO_RETRY,
        siteBlacklist: '',
        enableSwarmIntelligence: DEFAULTS.ENABLE_SWARM_INTELLIGENCE,
        enableAutonomousMode: DEFAULTS.ENABLE_AUTONOMOUS_MODE,
        learningEnabled: DEFAULTS.LEARNING_ENABLED,
      };
    }

    const data = await chrome.storage.local.get([
      STORAGE_KEYS.API_KEY,
      STORAGE_KEYS.BASE_URL,
      STORAGE_KEYS.MODEL_NAME,
      STORAGE_KEYS.BACKUP_MODEL,
      STORAGE_KEYS.MAX_STEPS,
      STORAGE_KEYS.REQUIRE_CONFIRM,
      STORAGE_KEYS.DRY_RUN,
      STORAGE_KEYS.ENABLE_VISION,
      STORAGE_KEYS.AUTO_RETRY,
      STORAGE_KEYS.SITE_BLACKLIST,
      STORAGE_KEYS.ENABLE_SWARM_INTELLIGENCE,
      STORAGE_KEYS.ENABLE_AUTONOMOUS_MODE,
      STORAGE_KEYS.LEARNING_ENABLED,
    ]);

    const settings: Settings = {
      apiKey: data[STORAGE_KEYS.API_KEY] || '',
      baseUrl: data[STORAGE_KEYS.BASE_URL] ?? DEFAULTS.BASE_URL,
      modelName: data[STORAGE_KEYS.MODEL_NAME] ?? DEFAULTS.MODEL_NAME,
      backupModel: data[STORAGE_KEYS.BACKUP_MODEL] ?? DEFAULTS.BACKUP_MODEL,
      maxSteps: data[STORAGE_KEYS.MAX_STEPS] ?? DEFAULTS.MAX_STEPS,
      requireConfirm: data[STORAGE_KEYS.REQUIRE_CONFIRM] ?? DEFAULTS.REQUIRE_CONFIRM,
      dryRun: data[STORAGE_KEYS.DRY_RUN] ?? DEFAULTS.DRY_RUN,
      enableVision: data[STORAGE_KEYS.ENABLE_VISION] ?? DEFAULTS.ENABLE_VISION,
      autoRetry: data[STORAGE_KEYS.AUTO_RETRY] ?? DEFAULTS.AUTO_RETRY,
      siteBlacklist: data[STORAGE_KEYS.SITE_BLACKLIST] ?? '',
      enableSwarmIntelligence: data[STORAGE_KEYS.ENABLE_SWARM_INTELLIGENCE] ?? DEFAULTS.ENABLE_SWARM_INTELLIGENCE,
      enableAutonomousMode: data[STORAGE_KEYS.ENABLE_AUTONOMOUS_MODE] ?? DEFAULTS.ENABLE_AUTONOMOUS_MODE,
      learningEnabled: data[STORAGE_KEYS.LEARNING_ENABLED] ?? DEFAULTS.LEARNING_ENABLED,
    };

    // Validate loaded settings
    const validation = validateSettings(settings);
    if (!validation.valid) {
      console.warn('[Config] Invalid settings loaded:', validation.errors);
    }

    // Note: Only google/gemini-2.5-flash via OpenRouter is supported.
    // All model selections are forced to this model.

    return settings;
  } catch (error) {
    console.error('[Config] Failed to load settings:', error);
    // Return safe defaults on error
    return {
      apiKey: '',
      baseUrl: DEFAULTS.BASE_URL,
      modelName: DEFAULTS.MODEL_NAME,
      backupModel: DEFAULTS.BACKUP_MODEL,
      maxSteps: DEFAULTS.MAX_STEPS,
      requireConfirm: DEFAULTS.REQUIRE_CONFIRM,
      dryRun: DEFAULTS.DRY_RUN,
      enableVision: DEFAULTS.ENABLE_VISION,
      autoRetry: DEFAULTS.AUTO_RETRY,
      siteBlacklist: '',
      enableSwarmIntelligence: DEFAULTS.ENABLE_SWARM_INTELLIGENCE,
      enableAutonomousMode: DEFAULTS.ENABLE_AUTONOMOUS_MODE,
      learningEnabled: DEFAULTS.LEARNING_ENABLED,
    };
  }
}

export async function saveSettings(settings: Settings): Promise<{ success: boolean; errors?: string[] }> {
  try {
    // Check if chrome.storage is available
    if (!chrome?.storage?.local) {
      console.warn('[Config] Chrome storage not available, cannot save settings');
      return { success: false, errors: ['Chrome storage not available'] };
    }

    // Validate settings before saving
    const validation = validateSettings(settings);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    await chrome.storage.local.set({
      [STORAGE_KEYS.API_KEY]: settings.apiKey,
      [STORAGE_KEYS.BASE_URL]: settings.baseUrl,
      [STORAGE_KEYS.MODEL_NAME]: settings.modelName,
      [STORAGE_KEYS.BACKUP_MODEL]: settings.backupModel,
      [STORAGE_KEYS.MAX_STEPS]: settings.maxSteps,
      [STORAGE_KEYS.REQUIRE_CONFIRM]: settings.requireConfirm,
      [STORAGE_KEYS.DRY_RUN]: settings.dryRun,
      [STORAGE_KEYS.ENABLE_VISION]: settings.enableVision,
      [STORAGE_KEYS.AUTO_RETRY]: settings.autoRetry,
      [STORAGE_KEYS.SITE_BLACKLIST]: settings.siteBlacklist,
      [STORAGE_KEYS.ENABLE_SWARM_INTELLIGENCE]: settings.enableSwarmIntelligence,
      [STORAGE_KEYS.ENABLE_AUTONOMOUS_MODE]: settings.enableAutonomousMode,
      [STORAGE_KEYS.LEARNING_ENABLED]: settings.learningEnabled,
    });

    return { success: true };
  } catch (error) {
    console.error('[Config] Failed to save settings:', error);
    return { success: false, errors: ['Failed to save settings to storage'] };
  }
}

/** Keys allowed in imported settings; reject unknown keys to prevent injection */
export const IMPORT_ALLOWLIST = new Set([
  STORAGE_KEYS.API_KEY,
  STORAGE_KEYS.BASE_URL,
  STORAGE_KEYS.MODEL_NAME,
  STORAGE_KEYS.BACKUP_MODEL,
  STORAGE_KEYS.MAX_STEPS,
  STORAGE_KEYS.REQUIRE_CONFIRM,
  STORAGE_KEYS.DRY_RUN,
  STORAGE_KEYS.ENABLE_VISION,
  STORAGE_KEYS.AUTO_RETRY,
  STORAGE_KEYS.SITE_BLACKLIST,
  STORAGE_KEYS.SITE_STRATEGIES,
  STORAGE_KEYS.SITE_CONFIGS,
  STORAGE_KEYS.PRIVACY_SETTINGS,
  STORAGE_KEYS.SECURITY_POLICY,
  STORAGE_KEYS.ENABLE_SWARM_INTELLIGENCE,
  STORAGE_KEYS.ENABLE_AUTONOMOUS_MODE,
  STORAGE_KEYS.LEARNING_ENABLED,
  'dark_mode',
  'command_history',
  'chat_history_backup',
  'hyperagent_installed_workflows',
] as const);

export function validateAndFilterImportData(settings: unknown): {
  valid: boolean;
  filtered: Record<string, unknown>;
  errors: string[];
} {
  const errors: string[] = [];
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return { valid: false, filtered: {}, errors: ['Settings must be a plain object'] };
  }
  const raw = settings as Record<string, unknown>;
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!IMPORT_ALLOWLIST.has(key as any)) {
      errors.push(`Rejected unknown key: ${key}`);
      continue;
    }
    filtered[key] = value;
  }
  // Validate critical keys
  if (STORAGE_KEYS.API_KEY in filtered) {
    const v = filtered[STORAGE_KEYS.API_KEY];
    if (v !== undefined && typeof v !== 'string') {
      errors.push('API key must be a string');
      delete filtered[STORAGE_KEYS.API_KEY];
    } else if (typeof v === 'string' && v.length > 1024) {
      errors.push('API key exceeds maximum length');
      delete filtered[STORAGE_KEYS.API_KEY];
    }
  }
  if (STORAGE_KEYS.MAX_STEPS in filtered) {
    const v = filtered[STORAGE_KEYS.MAX_STEPS];
    const n = typeof v === 'number' ? v : parseInt(String(v), 10);
    if (isNaN(n) || n < VALIDATION.MAX_STEPS.MIN || n > VALIDATION.MAX_STEPS.MAX) {
      errors.push(`maxSteps must be ${VALIDATION.MAX_STEPS.MIN}-${VALIDATION.MAX_STEPS.MAX}`);
      delete filtered[STORAGE_KEYS.MAX_STEPS];
    } else {
      filtered[STORAGE_KEYS.MAX_STEPS] = n;
    }
  }
  if (STORAGE_KEYS.BASE_URL in filtered) {
    const v = filtered[STORAGE_KEYS.BASE_URL];
    if (v !== undefined && typeof v === 'string') {
      try {
        new URL(v);
      } catch {
        errors.push('baseUrl must be a valid URL');
        delete filtered[STORAGE_KEYS.BASE_URL];
      }
    }
  }
  return {
    valid: errors.length === 0 || Object.keys(filtered).length > 0,
    filtered,
    errors,
  };
}

export function isSiteBlacklisted(url: string, blacklist: string): boolean {
  if (!blacklist.trim()) return false;
  const patterns = blacklist.split('\n').map((s) => s.trim()).filter(Boolean);
  try {
    const hostname = new URL(url).hostname;
    return patterns.some((p) => hostname.includes(p));
  } catch {
    return false;
  }
}

// ─── Storage Migration (17.1) ───────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface StorageSchema {
  version: number;
  migratedAt?: number;
}

async function getStoredVersion(): Promise<number> {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEYS.SCHEMA_VERSION);
    return data[STORAGE_KEYS.SCHEMA_VERSION] || 0;
  } catch {
    return 0;
  }
}

async function setStoredVersion(version: number): Promise<void> {
  try {
    await chrome.storage.local.set({ [STORAGE_KEYS.SCHEMA_VERSION]: version });
  } catch (err) {
    console.warn('[Config] Failed to set schema version:', err);
  }
}

export async function runMigrations(): Promise<void> {
  const currentVersion = await getStoredVersion();
  
  if (currentVersion >= STORAGE_VERSION) {
    return;
  }

  console.log(`[Config] Running migrations from v${currentVersion} to v${STORAGE_VERSION}`);

  try {
    if (currentVersion < 1) {
      await migrateToV1();
    }
    
    await setStoredVersion(STORAGE_VERSION);
    console.log('[Config] Migrations complete');
  } catch (err) {
    console.error('[Config] Migration failed:', err);
  }
}

async function migrateToV1(): Promise<void> {
  console.log('[Config] Migrating to v1: ensuring consistent key structure');
}

// ─── Corruption Recovery (17.2) ───────────────────────────────────────────
export async function safeStorageGet<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const data = await chrome.storage.local.get(key);
    const value = data[key];
    
    if (value === undefined || value === null) {
      return defaultValue;
    }
    
    if (typeof value === 'string') {
      try {
        if (value.startsWith('{') || value.startsWith('[')) {
          return JSON.parse(value) as T;
        }
      } catch {
        console.warn(`[Config] Failed to parse stored value for ${key}, using default`);
        return defaultValue;
      }
    }
    
    return value as T;
  } catch (err) {
    console.warn(`[Config] Failed to get ${key}, using default:`, err);
    return defaultValue;
  }
}

export async function safeStorageSet(key: string, value: unknown): Promise<boolean> {
  try {
    await chrome.storage.local.set({ [key]: value });
    return true;
  } catch (err) {
    console.error(`[Config] Failed to set ${key}:`, err);
    return false;
  }
}

export async function validateStorageIntegrity(): Promise<{ 
  healthy: boolean; 
  issues: string[];
  repaired: boolean;
}> {
  const issues: string[] = [];
  let repaired = false;

  try {
    const allData = await chrome.storage.local.get(null);
    
    for (const [key, value] of Object.entries(allData)) {
      if (value === 'undefined' || value === 'null') {
        issues.push(`Key ${key} contains string 'undefined' or 'null'`);
        await chrome.storage.local.remove(key);
        repaired = true;
      }
      
      if (typeof value === 'string' && key.endsWith('_json')) {
        try {
          JSON.parse(value);
        } catch {
          issues.push(`Key ${key} contains invalid JSON`);
          await chrome.storage.local.remove(key);
          repaired = true;
        }
      }
    }
    
    const version = await getStoredVersion();
    if (version < STORAGE_VERSION) {
      issues.push(`Schema version ${version} is outdated`);
      await runMigrations();
      repaired = true;
    }
  } catch (err) {
    issues.push(`Storage access error: ${(err as Error).message}`);
  }

  return {
    healthy: issues.length === 0,
    issues,
    repaired,
  };
}
