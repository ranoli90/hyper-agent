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
  // Payment Configuration
  PAYMENT_CONFIG: 'hyperagent_payment_config',
  PENDING_CRYPTO_PAYMENT: 'hyperagent_pending_crypto',
  // Ollama / Local AI
  OLLAMA_ENABLED: 'hyperagent_ollama_enabled',
  OLLAMA_HOST: 'hyperagent_ollama_host',
  OLLAMA_MODEL: 'hyperagent_ollama_model',
  USE_LOCAL_AI: 'hyperagent_use_local_ai',
  // Workflows & Macros metadata
  LAST_SUCCESSFUL_WORKFLOW: 'hyperagent_last_successful_workflow',
  LAST_SUCCESSFUL_MACRO: 'hyperagent_last_successful_macro',
  WORKFLOW_RUNS: 'hyperagent_workflow_runs',
  /** Last N workflow runs (full result summary) for "View last workflow runs" UI. */
  LAST_WORKFLOW_RUNS_LIST: 'hyperagent_last_workflow_runs_list',
  // Debugging
  DEBUG_MODE: 'hyperagent_debug_mode',
  LOG_LEVEL: 'hyperagent_log_level',
} as const;

export enum LogLevel {
  NONE = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
  VERBOSE = 5,
}


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
  DEFAULT_API_KEY: '',
  MODEL_NAME: 'openrouter/auto',
  BACKUP_MODEL: 'openrouter/auto',
  VISION_MODEL: 'openrouter/auto',
  PROVIDER: 'openrouter', // All API calls go through OpenRouter
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
  LLM_TIMEOUT_MS: 45000,         // LLM API call timeout (configurable via VALIDATION.TIMEOUTS)
  ERROR_REPORTING_ENABLED: false, // Disabled by default - enable in production
  ACTION_DELAY_MS: 350,          // Delay between sequential actions
  BODY_TEXT_LIMIT: 15000,        // Max body text to extract
  MAX_SEMANTIC_ELEMENTS: 250,    // Max semantic elements to index
  // Token and cost management
  COST_WARNING_THRESHOLD: 5.00,  // Warn when session cost exceeds $5
  MAX_TOKENS_PER_SESSION: 100000, // Max tokens per session (approx $0.10-$0.50)
  MAX_ACTIONS_PER_DOMAIN: 50, // Max actions per domain to prevent runaway automation
  /** Max tool/action invocations per run to avoid infinite loops. */
  MAX_ACTIONS_PER_RUN: 100,
  /** Autonomous mode: max navigations per run before requiring user reconfirmation. */
  MAX_NAVIGATIONS_PER_AUTONOMOUS_RUN: 5,
  // Local AI (Ollama)
  OLLAMA_ENABLED: false,  // Auto-detected, user can override
  OLLAMA_HOST: 'http://localhost:11434',
  OLLAMA_MODEL: 'llama3.2:3b',
  USE_LOCAL_AI: false,  // Default to cloud AI unless Ollama is available
  // Debugging
  DEBUG_MODE: false,
  LOG_LEVEL: LogLevel.INFO,
} as const;


// ─── Centralized Model List ──────────────────────────────────────────
// Single source of truth for all available models.
// NOTE: HyperAgent uses OpenRouter's smart router exclusively. The user does
// not choose individual underlying models – OpenRouter dynamically selects
// them. We still expose a single entry here so existing UI can render a
// label, but all requests use `openrouter/auto` under the hood.
export const AVAILABLE_MODELS = [
  { value: DEFAULTS.MODEL_NAME, label: 'Auto (OpenRouter smart router)' },
] as const;

// ─── Payment Configuration ───────────────────────────────────────────
export const PAYMENT_CONFIG = {
  BETA_PRICE_USD: 5,
  // Stripe Configuration - configurable via settings
  STRIPE_PUBLISHABLE_KEY: '',
  STRIPE_PAYMENT_LINK_BETA: '',
  STRIPE_PRICE_ID_BETA: '',
  STRIPE_PRODUCT_ID: '',
  // Crypto Configuration - must be configured in settings
  CRYPTO_RECIPIENT_ADDRESS: '', // Configure in Settings > Payment
  SUPPORTED_CHAINS: [
    { chainId: 1, name: 'Ethereum', currency: 'ETH' },
    { chainId: 8453, name: 'Base', currency: 'ETH' },
    { chainId: 137, name: 'Polygon', currency: 'MATIC' },
  ],
  CHAIN_EXPLORERS: {
    1: 'https://etherscan.io',
    8453: 'https://basescan.org',
    137: 'https://polygonscan.com',
  } as Record<number, string>,
} as const;

// Payment settings that can be configured by the user
export interface PaymentSettings {
  stripePublishableKey: string;
  stripePaymentLinkBeta: string;
  cryptoRecipientAddress: string;
}

// ─── Ollama Configuration ──────────────────────────────────────────────
export const OLLAMA_CONFIG = {
  DEFAULT_HOST: 'http://localhost:11434',
  CHECK_INTERVAL_MS: 30000,
  TIMEOUT_MS: 120000,
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
  // Local AI (Ollama)
  ollamaEnabled: boolean;
  ollamaHost: string;
  ollamaModel: string;
  useLocalAI: boolean;
  // Debugging
  debugMode: boolean;
  logLevel: LogLevel;
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

// ─── In-memory cache of last settings read (reduce chrome.storage calls) ─
const SETTINGS_CACHE_TTL_MS = 5000;
let settingsCache: { settings: Settings; at: number } | null = null;

export function invalidateSettingsCache(): void {
  settingsCache = null;
}

// ─── Storage helpers with error handling ────────────────────────────
export async function loadSettings(): Promise<Settings> {
  try {
    if (settingsCache && Date.now() - settingsCache.at < SETTINGS_CACHE_TTL_MS) {
      return settingsCache.settings;
    }
  } catch {
    settingsCache = null;
  }

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
        ollamaEnabled: DEFAULTS.OLLAMA_ENABLED,
        ollamaHost: DEFAULTS.OLLAMA_HOST,
        ollamaModel: DEFAULTS.OLLAMA_MODEL,
        useLocalAI: DEFAULTS.USE_LOCAL_AI,
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
      STORAGE_KEYS.DEBUG_MODE,
      STORAGE_KEYS.LOG_LEVEL,
    ]);

    const rawBaseUrl = data[STORAGE_KEYS.BASE_URL];
    const normalizedBaseUrl =
      typeof rawBaseUrl === 'string' && rawBaseUrl.trim().length > 0
        ? DEFAULTS.BASE_URL
        : DEFAULTS.BASE_URL;

    const settings: Settings = {
      apiKey: data[STORAGE_KEYS.API_KEY] || '',
      baseUrl: normalizedBaseUrl,
      // Enforce OpenRouter smart router for all calls – ignore any stale custom
      // model names that may be present from previous versions.
      modelName: DEFAULTS.MODEL_NAME,
      backupModel: DEFAULTS.BACKUP_MODEL,
      maxSteps: data[STORAGE_KEYS.MAX_STEPS] ?? DEFAULTS.MAX_STEPS,
      requireConfirm: data[STORAGE_KEYS.REQUIRE_CONFIRM] ?? DEFAULTS.REQUIRE_CONFIRM,
      dryRun: data[STORAGE_KEYS.DRY_RUN] ?? DEFAULTS.DRY_RUN,
      enableVision: data[STORAGE_KEYS.ENABLE_VISION] ?? DEFAULTS.ENABLE_VISION,
      autoRetry: data[STORAGE_KEYS.AUTO_RETRY] ?? DEFAULTS.AUTO_RETRY,
      siteBlacklist: data[STORAGE_KEYS.SITE_BLACKLIST] ?? '',
      enableSwarmIntelligence: data[STORAGE_KEYS.ENABLE_SWARM_INTELLIGENCE] ?? DEFAULTS.ENABLE_SWARM_INTELLIGENCE,
      enableAutonomousMode: data[STORAGE_KEYS.ENABLE_AUTONOMOUS_MODE] ?? DEFAULTS.ENABLE_AUTONOMOUS_MODE,
      learningEnabled: data[STORAGE_KEYS.LEARNING_ENABLED] ?? DEFAULTS.LEARNING_ENABLED,
      ollamaEnabled: data[STORAGE_KEYS.OLLAMA_ENABLED] ?? DEFAULTS.OLLAMA_ENABLED,
      ollamaHost: data[STORAGE_KEYS.OLLAMA_HOST] ?? DEFAULTS.OLLAMA_HOST,
      ollamaModel: data[STORAGE_KEYS.OLLAMA_MODEL] ?? DEFAULTS.OLLAMA_MODEL,
      useLocalAI: data[STORAGE_KEYS.USE_LOCAL_AI] ?? DEFAULTS.USE_LOCAL_AI,
      debugMode: data[STORAGE_KEYS.DEBUG_MODE] ?? DEFAULTS.DEBUG_MODE,
      logLevel: data[STORAGE_KEYS.LOG_LEVEL] ?? DEFAULTS.LOG_LEVEL,
    };

    // Validate loaded settings
    const validation = validateSettings(settings);
    if (!validation.valid) {
      console.warn('[Config] Invalid settings loaded:', validation.errors);
    }

    // Note: Only openrouter/auto is supported. The smart router automatically
    // selects the best model for each task.

    settingsCache = { settings, at: Date.now() };
    return settings;
  } catch (error) {
    console.error('[Config] Failed to load settings:', error);
    settingsCache = null;
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
      ollamaEnabled: DEFAULTS.OLLAMA_ENABLED,
      ollamaHost: DEFAULTS.OLLAMA_HOST,
      ollamaModel: DEFAULTS.OLLAMA_MODEL,
      useLocalAI: DEFAULTS.USE_LOCAL_AI,
      debugMode: DEFAULTS.DEBUG_MODE,
      logLevel: DEFAULTS.LOG_LEVEL,
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
      [STORAGE_KEYS.OLLAMA_ENABLED]: settings.ollamaEnabled,
      [STORAGE_KEYS.OLLAMA_HOST]: settings.ollamaHost,
      [STORAGE_KEYS.OLLAMA_MODEL]: settings.ollamaModel,
      [STORAGE_KEYS.USE_LOCAL_AI]: settings.useLocalAI,
      [STORAGE_KEYS.DEBUG_MODE]: settings.debugMode,
      [STORAGE_KEYS.LOG_LEVEL]: settings.logLevel,
    });

    invalidateSettingsCache();
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
    const n = typeof v === 'number' ? v : Number.parseInt(String(v), 10);
    if (Number.isNaN(n) || n < VALIDATION.MAX_STEPS.MIN || n > VALIDATION.MAX_STEPS.MAX) {
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
  // chat_history_backup: string, max 2MB
  if ('chat_history_backup' in filtered) {
    const v = filtered['chat_history_backup'];
    if (v !== undefined && typeof v !== 'string') {
      errors.push('chat_history_backup must be a string');
      delete filtered['chat_history_backup'];
    } else if (typeof v === 'string' && v.length > 2 * 1024 * 1024) {
      errors.push('chat_history_backup exceeds 2MB limit');
      delete filtered['chat_history_backup'];
    }
  }
  // command_history: array of strings, max 50 items, each max 2000 chars
  if ('command_history' in filtered) {
    const v = filtered['command_history'];
    if (v !== undefined && !Array.isArray(v)) {
      errors.push('command_history must be an array');
      delete filtered['command_history'];
    } else if (Array.isArray(v)) {
      const arr = v
        .filter((item): item is string => typeof item === 'string')
        .map(s => String(s).slice(0, 2000))
        .slice(0, 50);
      filtered['command_history'] = arr;
    }
  }
  // dark_mode: boolean only
  if ('dark_mode' in filtered) {
    const v = filtered['dark_mode'];
    if (v !== undefined && typeof v !== 'boolean') {
      delete filtered['dark_mode'];
    }
  }
  return {
    valid: errors.length === 0 || Object.keys(filtered).length > 0,
    filtered,
    errors,
  };
}

// ─── GDPR / Data Export Helpers ────────────────────────────────────────────

export interface GdprExportOptions {
  billingTier?: string;
  billingStatus?: string;
}

/**
 * Build a structured snapshot of user data for GDPR-style export.
 * IMPORTANT: This helper never includes raw API keys or secrets.
 */
export function buildGdprExportSnapshot(
  allData: Record<string, unknown>,
  options: GdprExportOptions = {},
) {
  const subscription = allData[STORAGE_KEYS.SUBSCRIPTION] as any | undefined;
  const billingTier = options.billingTier ?? subscription?.tier ?? 'unknown';
  const billingStatus = options.billingStatus ?? subscription?.status ?? 'unknown';

  return {
    exportDate: new Date().toISOString(),
    version: '4.0.1',
    data: {
      settings: {
        darkMode: allData.dark_mode ?? allData[STORAGE_KEYS.DARK_MODE],
        apiKeyConfigured: Boolean(allData[STORAGE_KEYS.API_KEY]),
        baseUrl: allData[STORAGE_KEYS.BASE_URL],
        modelName: allData[STORAGE_KEYS.MODEL_NAME],
        maxSteps: allData[STORAGE_KEYS.MAX_STEPS],
        requireConfirm: allData[STORAGE_KEYS.REQUIRE_CONFIRM],
        dryRun: allData[STORAGE_KEYS.DRY_RUN],
        enableVision: allData[STORAGE_KEYS.ENABLE_VISION],
        autoRetry: allData[STORAGE_KEYS.AUTO_RETRY],
        debugMode: allData[STORAGE_KEYS.DEBUG_MODE],
        logLevel: allData[STORAGE_KEYS.LOG_LEVEL],
        enableSwarmIntelligence: allData[STORAGE_KEYS.ENABLE_SWARM_INTELLIGENCE],
        enableAutonomousMode: allData[STORAGE_KEYS.ENABLE_AUTONOMOUS_MODE],
        learningEnabled: allData[STORAGE_KEYS.LEARNING_ENABLED],
        siteBlacklist: allData[STORAGE_KEYS.SITE_BLACKLIST],
      },
      chatHistory: allData.chat_history_backup || allData[STORAGE_KEYS.CHAT_HISTORY] || '',
      commandHistory: allData.command_history || allData[STORAGE_KEYS.COMMAND_HISTORY] || [],
      workflows: Object.fromEntries(
        Object.entries(allData).filter(([key]) =>
          key.startsWith('workflow_') ||
          key === STORAGE_KEYS.WORKFLOWS ||
          key === STORAGE_KEYS.INSTALLED_WORKFLOWS,
        ),
      ),
      scheduledTasks: allData[STORAGE_KEYS.SCHEDULED_TASKS] || [],
      siteConfigs: allData[STORAGE_KEYS.SITE_CONFIGS] || [],
      siteStrategies: allData[STORAGE_KEYS.SITE_STRATEGIES] || {},
      memory: {
        actionHistory: allData[STORAGE_KEYS.ACTION_HISTORY] || [],
        sessions: allData[STORAGE_KEYS.SESSIONS] || [],
        neuroplasticity: (allData as any).hyperagent_neuroplasticity || {},
      },
      snapshots: Object.fromEntries(
        Object.entries(allData).filter(([key]) => key.startsWith('snapshot_')),
      ),
      metrics: allData[STORAGE_KEYS.USAGE_METRICS] || {},
      billing: {
        tier: billingTier,
        status: billingStatus,
      },
      privacy: allData[STORAGE_KEYS.PRIVACY_SETTINGS] || {},
      security: allData[STORAGE_KEYS.SECURITY_POLICY] || {},
    },
    gdpr: {
      rightToAccess: true,
      rightToRectification: true,
      rightToErasure: true,
      rightToPortability: true,
      dataController: 'HyperAgent',
      dataLocation: 'Local browser storage only',
      retention: 'User-controlled',
      contact: 'privacy@hyperagent.ai',
      note:
        'API keys are NOT exported for security. Chat history and settings may contain sensitive information - handle exports with care.',
    },
  };
}

export function isSiteBlacklisted(url: string, blacklist: string): boolean {
  if (!blacklist.trim()) return false;
  const patterns = blacklist.split('\n').map((s) => s.trim()).filter(Boolean);
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (!hostname) return false;

    return patterns.some((raw) => {
      const isWildcard = raw.startsWith('*.');
      const pattern = isWildcard ? raw.substring(2).toLowerCase() : raw.toLowerCase();

      if (!pattern) return false;

      if (isWildcard) {
        // For *.domain.com, match sub.domain.com but not domain.com
        return hostname.endsWith(`.${pattern}`);
      } else {
        // For domain.com, match domain.com and sub.domain.com
        return hostname === pattern || hostname.endsWith(`.${pattern}`);
      }
    });
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

    // Additional integrity checks for memory-related keys. If these are
    // structurally invalid, drop them so the next run can rebuild cleanly.
    const siteStrategies = allData[STORAGE_KEYS.SITE_STRATEGIES];
    if (siteStrategies !== undefined && (typeof siteStrategies !== 'object' || siteStrategies === null || Array.isArray(siteStrategies))) {
      issues.push(`Key ${STORAGE_KEYS.SITE_STRATEGIES} is corrupted (expected object)`);
      await chrome.storage.local.remove(STORAGE_KEYS.SITE_STRATEGIES);
      repaired = true;
    }

    const actionHistory = allData[STORAGE_KEYS.ACTION_HISTORY];
    if (actionHistory !== undefined && !Array.isArray(actionHistory)) {
      issues.push(`Key ${STORAGE_KEYS.ACTION_HISTORY} is corrupted (expected array)`);
      await chrome.storage.local.remove(STORAGE_KEYS.ACTION_HISTORY);
      repaired = true;
    }

    const sessions = allData[STORAGE_KEYS.SESSIONS];
    if (sessions !== undefined && (typeof sessions !== 'object' || sessions === null || Array.isArray(sessions))) {
      issues.push(`Key ${STORAGE_KEYS.SESSIONS} is corrupted (expected object)`);
      await chrome.storage.local.remove(STORAGE_KEYS.SESSIONS);
      repaired = true;
    }

    const chatHistory = allData.chat_history_backup ?? allData[STORAGE_KEYS.CHAT_HISTORY];
    if (chatHistory !== undefined && typeof chatHistory !== 'string') {
      issues.push('chat_history_backup / CHAT_HISTORY is corrupted (expected string)');
      await chrome.storage.local.remove(STORAGE_KEYS.CHAT_HISTORY);
      await chrome.storage.local.remove('chat_history_backup');
      repaired = true;
    }

    const commandHistory = allData[STORAGE_KEYS.COMMAND_HISTORY];
    if (commandHistory !== undefined && !Array.isArray(commandHistory)) {
      issues.push(`Key ${STORAGE_KEYS.COMMAND_HISTORY} is corrupted (expected array)`);
      await chrome.storage.local.remove(STORAGE_KEYS.COMMAND_HISTORY);
      repaired = true;
    }

    const workflows = allData[STORAGE_KEYS.WORKFLOWS];
    if (workflows !== undefined && !Array.isArray(workflows)) {
      issues.push(`Key ${STORAGE_KEYS.WORKFLOWS} is corrupted (expected array)`);
      await chrome.storage.local.remove(STORAGE_KEYS.WORKFLOWS);
      repaired = true;
    }

    const installedWorkflows = allData[STORAGE_KEYS.INSTALLED_WORKFLOWS];
    if (installedWorkflows !== undefined && !Array.isArray(installedWorkflows)) {
      issues.push(`Key ${STORAGE_KEYS.INSTALLED_WORKFLOWS} is corrupted (expected array)`);
      await chrome.storage.local.remove(STORAGE_KEYS.INSTALLED_WORKFLOWS);
      repaired = true;
    }

    const usageMetrics = allData[STORAGE_KEYS.USAGE_METRICS];
    if (usageMetrics !== undefined && (typeof usageMetrics !== 'object' || usageMetrics === null || Array.isArray(usageMetrics))) {
      issues.push(`Key ${STORAGE_KEYS.USAGE_METRICS} is corrupted (expected object)`);
      await chrome.storage.local.remove(STORAGE_KEYS.USAGE_METRICS);
      repaired = true;
    }

    const lastWorkflowRuns = allData[STORAGE_KEYS.LAST_WORKFLOW_RUNS_LIST];
    if (lastWorkflowRuns !== undefined && !Array.isArray(lastWorkflowRuns)) {
      issues.push(`Key ${STORAGE_KEYS.LAST_WORKFLOW_RUNS_LIST} is corrupted (expected array)`);
      await chrome.storage.local.remove(STORAGE_KEYS.LAST_WORKFLOW_RUNS_LIST);
      repaired = true;
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
