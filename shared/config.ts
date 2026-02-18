// ─── Storage keys ───────────────────────────────────────────────────
export const STORAGE_KEYS = {
  API_KEY: 'hyperagent_api_key',
  BASE_URL: 'hyperagent_base_url',
  MODEL_NAME: 'hyperagent_model_name',
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
  // Security & Privacy (Iteration 15)
  PRIVACY_SETTINGS: 'hyperagent_privacy_settings',
  SECURITY_POLICY: 'hyperagent_security_policy',
} as const;

// ─── Defaults ───────────────────────────────────────────────────────
export const DEFAULTS = {
  BASE_URL: 'https://api.openai.com/v1',
  MODEL_NAME: 'gpt-4o',
  MAX_STEPS: 12,
  REQUIRE_CONFIRM: true,
  DRY_RUN: false,
  ENABLE_VISION: true,
  AUTO_RETRY: true,
  BODY_TEXT_LIMIT: 10000,
  MAX_SEMANTIC_ELEMENTS: 250,
  ACTION_DELAY_MS: 400,
  MAX_RETRIES_PER_ACTION: 2,
  CONFIRM_TIMEOUT_MS: 90000,
  LLM_TIMEOUT_MS: 45000,
  // Self-healing configuration
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
} as const;

// ─── Settings type ──────────────────────────────────────────────────
export interface Settings {
  apiKey: string;
  baseUrl: string;
  modelName: string;
  maxSteps: number;
  requireConfirm: boolean;
  dryRun: boolean;
  enableVision: boolean;
  autoRetry: boolean;
  siteBlacklist: string;
}

// ─── Storage helpers ────────────────────────────────────────────────
export async function loadSettings(): Promise<Settings> {
  const data = await chrome.storage.local.get([
    STORAGE_KEYS.API_KEY,
    STORAGE_KEYS.BASE_URL,
    STORAGE_KEYS.MODEL_NAME,
    STORAGE_KEYS.MAX_STEPS,
    STORAGE_KEYS.REQUIRE_CONFIRM,
    STORAGE_KEYS.DRY_RUN,
    STORAGE_KEYS.ENABLE_VISION,
    STORAGE_KEYS.AUTO_RETRY,
    STORAGE_KEYS.SITE_BLACKLIST,
  ]);
  return {
    apiKey: data[STORAGE_KEYS.API_KEY] ?? '',
    baseUrl: data[STORAGE_KEYS.BASE_URL] ?? DEFAULTS.BASE_URL,
    modelName: data[STORAGE_KEYS.MODEL_NAME] ?? DEFAULTS.MODEL_NAME,
    maxSteps: data[STORAGE_KEYS.MAX_STEPS] ?? DEFAULTS.MAX_STEPS,
    requireConfirm: data[STORAGE_KEYS.REQUIRE_CONFIRM] ?? DEFAULTS.REQUIRE_CONFIRM,
    dryRun: data[STORAGE_KEYS.DRY_RUN] ?? DEFAULTS.DRY_RUN,
    enableVision: data[STORAGE_KEYS.ENABLE_VISION] ?? DEFAULTS.ENABLE_VISION,
    autoRetry: data[STORAGE_KEYS.AUTO_RETRY] ?? DEFAULTS.AUTO_RETRY,
    siteBlacklist: data[STORAGE_KEYS.SITE_BLACKLIST] ?? '',
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.API_KEY]: settings.apiKey,
    [STORAGE_KEYS.BASE_URL]: settings.baseUrl,
    [STORAGE_KEYS.MODEL_NAME]: settings.modelName,
    [STORAGE_KEYS.MAX_STEPS]: settings.maxSteps,
    [STORAGE_KEYS.REQUIRE_CONFIRM]: settings.requireConfirm,
    [STORAGE_KEYS.DRY_RUN]: settings.dryRun,
    [STORAGE_KEYS.ENABLE_VISION]: settings.enableVision,
    [STORAGE_KEYS.AUTO_RETRY]: settings.autoRetry,
    [STORAGE_KEYS.SITE_BLACKLIST]: settings.siteBlacklist,
  });
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
