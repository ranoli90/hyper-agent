import { loadSettings, saveSettings, DEFAULTS } from '../../shared/config';
import type { Settings } from '../../shared/config';
import { getAllSiteConfigs, setSiteConfig, deleteSiteConfig } from '../../shared/siteConfig';
import type { SiteConfig } from '../../shared/types';
import { debounce } from '../../shared/utils';
import { billingManager } from '../../shared/billing';

type SubscriptionTier = 'free' | 'premium' | 'unlimited';

const PAYMENT_SUCCESS_KEY = 'hyperagent_payment_success';

async function handleStripePaymentReturn(): Promise<void> {
  const hash = globalThis.location.hash;
  const params = new URLSearchParams(globalThis.location.search);

  if (hash.includes('payment_success') || params.has('payment_success')) {
    const tier = (params.get('tier') || /tier=([^&]+)/.exec(hash)?.[1]) as SubscriptionTier | null;
    const customerId = params.get('customerId') || /customerId=([^&]+)/.exec(hash)?.[1];
    const subscriptionId = params.get('subscriptionId') || /subscriptionId=([^&]+)/.exec(hash)?.[1];

    if (tier && (tier === 'premium' || tier === 'unlimited')) {
      await chrome.storage.local.set({
        [PAYMENT_SUCCESS_KEY]: {
          type: 'stripe',
          customerId: customerId || undefined,
          subscriptionId: subscriptionId || undefined,
        },
      });
      await billingManager.initialize();
      globalThis.history.replaceState({}, '', globalThis.location.pathname);
      showNotification(`Payment successful! Your ${tier} subscription is now active.`, 'success');
    }
  }
}

// ─── DOM references ─────────────────────────────────────────────
const apiProviderInput = document.getElementById('api-provider') as HTMLSelectElement;
const apiKeyInput = document.getElementById('api-key') as HTMLInputElement;
const maxStepsInput = document.getElementById('max-steps') as HTMLInputElement;
const maxStepsValue = document.getElementById('max-steps-value')!;
const requireConfirmInput = document.getElementById('require-confirm') as HTMLInputElement;
const dryRunInput = document.getElementById('dry-run') as HTMLInputElement;
const enableVisionInput = document.getElementById('enable-vision') as HTMLInputElement;
const autoRetryInput = document.getElementById('auto-retry') as HTMLInputElement;
const siteBlacklistInput = document.getElementById('site-blacklist') as HTMLTextAreaElement;
const enableSwarmInput = document.getElementById('enable-swarm') as HTMLInputElement;
const enableAutonomousInput = document.getElementById('enable-autonomous') as HTMLInputElement;
const enableLearningInput = document.getElementById('enable-learning') as HTMLInputElement;
const modelSelectInput = document.getElementById('model-select') as HTMLSelectElement;
const btnSave = document.getElementById('btn-save') as HTMLButtonElement;
const saveStatus = document.getElementById('save-status')!;
const resetSettings = document.getElementById('reset-settings') as HTMLButtonElement;
const clearCache = document.getElementById('clear-cache') as HTMLButtonElement;
const toastContainer = document.getElementById('toast-container') as HTMLDivElement | null;

// Status indicators
const apiStatusDot = document.getElementById('api-status')!;
const apiStatusText = document.getElementById('api-status-text')!;
const modelStatusText = document.getElementById('model-status-text')!;

// ─── Toast helper ─────────────────────────────────────────────────
function showNotification(message: string, variant: 'info' | 'success' | 'error' = 'info') {
  if (!toastContainer) {
    alert(message);
    return;
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${variant}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('visible');
  });

  const removeToast = () => {
    toast.classList.remove('visible');
    toast.addEventListener(
      'transitionend',
      () => {
        toast.remove();
      },
      { once: true }
    );
  };

  setTimeout(removeToast, 3500);
  toast.addEventListener('click', removeToast, { once: true });
}

const DEFAULT_SITE_MAX_RETRIES = 2;
const DEFAULT_SITE_WAIT_MS = 400;
let dangerZoneHandlersAttached = false;
let _cachedSettings: Settings | null = null;

function storageGet(keys?: string[] | null): Promise<Record<string, any>> {
  return new Promise(resolve => {
    chrome.storage.local.get(keys ?? null, resolve);
  });
}

function storageRemove(keys: string[]): Promise<void> {
  if (!keys.length) return Promise.resolve();
  return new Promise(resolve => {
    chrome.storage.local.remove(keys, () => resolve());
  });
}

function storageClear(): Promise<void> {
  return new Promise(resolve => {
    chrome.storage.local.clear(() => resolve());
  });
}

// ─── API Provider URLs ───────────────────────────────────────────
const PROVIDER_URLS = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta',
  openrouter: 'https://openrouter.ai/api/v1',
  custom: ''
} as const;

// Provider model options
const PROVIDER_MODELS: Record<string, { value: string; label: string }[]> = {
  openai: [
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (Fast)' },
    { value: 'gpt-4o', label: 'GPT-4o (Vision)' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  ],
  anthropic: [
    { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku (Fast)' },
    { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet (Vision)' },
    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus (Best)' },
  ],
  google: [
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (FREE)' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
  ],
  openrouter: [
    { value: 'openai/gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  ],
  custom: [
    { value: 'gpt-3.5-turbo', label: 'Default' },
  ],
};

// Key hints for each provider
const PROVIDER_KEY_HINTS: Record<string, string> = {
  openai: 'OpenAI keys start with sk-',
  anthropic: 'Anthropic keys start with sk-ant-',
  google: 'Google AI Studio keys start with AIza',
  openrouter: 'OpenRouter keys start with sk-or-',
  custom: 'Enter your API key',
};

// ─── Site Config DOM references ──────────────────────────────────
const siteConfigDomainInput = document.getElementById('site-config-domain') as HTMLInputElement;
const siteConfigDescInput = document.getElementById('site-config-description') as HTMLInputElement;
const siteConfigMaxRetriesInput = document.getElementById('site-config-max-retries') as HTMLInputElement;
const siteConfigRetriesValue = document.getElementById('site-config-retries-value')!;
const siteConfigScrollInput = document.getElementById('site-config-scroll') as HTMLInputElement;
const siteConfigWaitInput = document.getElementById('site-config-wait') as HTMLInputElement;
const siteConfigWaitValue = document.getElementById('site-config-wait-value')!;
const siteConfigSelectorsInput = document.getElementById('site-config-selectors') as HTMLTextAreaElement;
const btnAddSiteConfig = document.getElementById('btn-add-site-config') as HTMLButtonElement;
const btnDeleteSiteConfig = document.getElementById('btn-delete-site-config') as HTMLButtonElement;
const siteConfigsList = document.getElementById('site-configs-list')!;

// ─── Load current settings ──────────────────────────────────────
async function loadCurrentSettings() {
  const settings = await loadSettings();
  _cachedSettings = settings;

  // Detect API provider from key or base URL
  let provider = detectProviderFromKey(settings.apiKey) || detectProviderFromUrl(settings.baseUrl);
  apiProviderInput.value = provider;
  updateModelOptions(provider);
  updateKeyHint(provider);

  // Handle API key display
  const usingDefaultKey = settings.apiKey === DEFAULTS.DEFAULT_API_KEY;
  const hasCustomKey = Boolean(settings.apiKey && !usingDefaultKey);
  apiKeyInput.value = hasCustomKey ? settings.apiKey : '';
  apiKeyInput.placeholder = hasCustomKey ? 'Enter your API key...' : 'Enter your API key...';

  updateApiUiState({
    status: hasCustomKey ? 'custom' : 'missing',
  });

  modelSelectInput.value = settings.modelName || PROVIDER_MODELS[provider]?.[0]?.value || 'gpt-3.5-turbo';
  modelStatusText.textContent = `Model: ${modelSelectInput.options[modelSelectInput.selectedIndex]?.text || 'Default'}`;
  updateTipsBanner(modelSelectInput.value);
  maxStepsInput.value = String(settings.maxSteps);
  maxStepsValue.textContent = String(settings.maxSteps);
  requireConfirmInput.checked = settings.requireConfirm;
  dryRunInput.checked = settings.dryRun;
  enableVisionInput.checked = settings.enableVision;
  autoRetryInput.checked = settings.autoRetry;
  siteBlacklistInput.value = settings.siteBlacklist;
  enableSwarmInput.checked = settings.enableSwarmIntelligence;
  enableAutonomousInput.checked = settings.enableAutonomousMode;
  enableLearningInput.checked = settings.learningEnabled;
}

function detectProviderFromKey(apiKey: string): string {
  if (!apiKey) return '';
  if (apiKey.startsWith('sk-ant-')) return 'anthropic';
  if (apiKey.startsWith('AIza')) return 'google';
  if (apiKey.startsWith('sk-or-')) return 'openrouter';
  if (apiKey.startsWith('sk-')) return 'openai';
  return '';
}

function detectProviderFromUrl(url: string): string {
  if (url.includes('openrouter.ai')) return 'openrouter';
  if (url.includes('openai.com')) return 'openai';
  if (url.includes('anthropic.com')) return 'anthropic';
  if (url.includes('googleapis.com')) return 'google';
  return 'openai';
}

function updateModelOptions(provider: string) {
  const models = PROVIDER_MODELS[provider] || PROVIDER_MODELS.openai;
  modelSelectInput.innerHTML = models.map(m => `<option value="${m.value}">${m.label}</option>`).join('');
}

function updateKeyHint(provider: string) {
  const hint = document.getElementById('key-hint');
  if (hint) {
    hint.textContent = PROVIDER_KEY_HINTS[provider] || 'Enter your API key';
  }
}

// Handle provider change
apiProviderInput.addEventListener('change', () => {
  const provider = apiProviderInput.value;
  updateModelOptions(provider);
  updateKeyHint(provider);
  modelSelectInput.value = PROVIDER_MODELS[provider]?.[0]?.value || 'gpt-3.5-turbo';
  modelStatusText.textContent = `Model: ${PROVIDER_MODELS[provider]?.[0]?.label || 'Default'}`;
});

maxStepsInput.addEventListener('input', () => {
  maxStepsValue.textContent = maxStepsInput.value;
});

function updateTipsBanner(modelName: string) {
  const tipsInfo = document.getElementById('tips-model-info');
  if (!tipsInfo) return;

  const modelDescriptions: Record<string, string> = {
    'gpt-3.5-turbo': 'GPT-3.5 Turbo - Fast and affordable for most tasks.',
    'gpt-4o': 'GPT-4o - Advanced model with vision support.',
    'gpt-4-turbo': 'GPT-4 Turbo - Powerful reasoning capabilities.',
    'claude-3-haiku-20240307': 'Claude 3 Haiku - Fast and efficient.',
    'claude-3-sonnet-20240229': 'Claude 3 Sonnet - Balanced performance with vision.',
    'claude-3-opus-20240229': 'Claude 3 Opus - Most capable Claude model.',
    'gemini-2.0-flash': 'Gemini 2.0 Flash - FREE via Google AI Studio!',
    'gemini-1.5-pro': 'Gemini 1.5 Pro - Advanced Google model.',
  };

  tipsInfo.textContent = modelDescriptions[modelName] || `Using ${modelName}.`;
}

let _saveInProgress = false;
btnSave.addEventListener('click', async () => {
  if (_saveInProgress) return;
  _saveInProgress = true;
  try {
    const apiKeyValue = apiKeyInput.value.trim() || DEFAULTS.DEFAULT_API_KEY;
    const modelNameValue = modelSelectInput.value;
    const provider = apiProviderInput.value;

    await saveSettings({
      apiKey: apiKeyValue,
      baseUrl: PROVIDER_URLS[provider as keyof typeof PROVIDER_URLS] || DEFAULTS.BASE_URL,
      modelName: modelNameValue,
      backupModel: modelNameValue,
      maxSteps: Number.parseInt(maxStepsInput.value, 10) || DEFAULTS.MAX_STEPS,
      requireConfirm: requireConfirmInput.checked,
      dryRun: dryRunInput.checked,
      enableVision: enableVisionInput.checked,
      autoRetry: autoRetryInput.checked,
      siteBlacklist: siteBlacklistInput.value,
      enableSwarmIntelligence: enableSwarmInput.checked,
      enableAutonomousMode: enableAutonomousInput.checked,
      learningEnabled: enableLearningInput.checked,
      ollamaEnabled: false,
      ollamaHost: DEFAULTS.OLLAMA_HOST,
      ollamaModel: DEFAULTS.OLLAMA_MODEL,
      useLocalAI: false,
    });

    saveStatus.classList.remove('hidden');
    setTimeout(() => saveStatus.classList.add('hidden'), 2000);
    showNotification('Settings saved successfully', 'success');
  } finally {
    _saveInProgress = false;
  }
});

// ─── API Key Validation ─────────────────────────────────────────

let _validationTimeout: NodeJS.Timeout | null = null;

async function validateApiKey(key: string, baseUrl: string): Promise<{ valid: boolean; error?: string }> {
  if (!key || key === DEFAULTS.DEFAULT_API_KEY) {
    return { valid: false, error: 'No API key provided' };
  }

  // Detect provider from key
  const provider = detectProviderFromKey(key);
  
  try {
    // Google uses different validation
    if (provider === 'google' || key.startsWith('AIza')) {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });
      
      if (response.ok) {
        return { valid: true };
      }
      
      const errorText = await response.text();
      console.error('[API Validation Error]', errorText);
      return { valid: false, error: 'Invalid Google API key' };
    }
    
    // Anthropic uses different validation
    if (provider === 'anthropic' || key.startsWith('sk-ant-')) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
        signal: AbortSignal.timeout(15000),
      });
      
      if (response.ok || response.status === 400) {
        // 400 might mean the request was processed but input was invalid
        return { valid: true };
      }
      
      const errorText = await response.text();
      console.error('[API Validation Error]', errorText);
      try {
        const errorJson = JSON.parse(errorText);
        return { valid: false, error: errorJson.error?.message || 'Invalid Anthropic API key' };
      } catch {
        return { valid: false, error: 'Invalid Anthropic API key' };
      }
    }
    
    // OpenAI and OpenRouter use similar API
    const response = await fetch(`${baseUrl}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${key}`,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      return { valid: true };
    }

    // If models endpoint fails, try a minimal chat completion
    if (response.status === 404) {
      const model = provider === 'openrouter' ? 'openai/gpt-3.5-turbo' : 'gpt-3.5-turbo';
      const chatResponse = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 1,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (chatResponse.ok) {
        return { valid: true };
      }

      const errorText = await chatResponse.text();
      console.error('[API Validation Error]', errorText);

      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          return { valid: false, error: errorJson.error.message };
        }
      } catch { }

      return { valid: false, error: `API Error: ${chatResponse.status}` };
    }

    const errorText = await response.text();
    console.error('[API Validation Error]', errorText);

    // Parse error message
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.error?.message) {
        if (errorJson.error.message.includes('Authentication')) {
          return { valid: false, error: 'Invalid API key' };
        }
        return { valid: false, error: errorJson.error.message };
      }
    } catch { }

    return { valid: false, error: `API Error: ${response.status}` };
  } catch (error) {
    console.error('[API Validation Error]', error);
    if ((error as Error).name === 'TimeoutError' || (error as Error).message?.includes('abort')) {
      return { valid: false, error: 'Connection timeout' };
    }
    return { valid: false, error: `Connection error: ${(error as Error).message}` };
  }
}

type ApiStatusState = 'custom' | 'missing' | 'error' | 'connecting';

function updateApiUiState({ status, error }: { status: ApiStatusState; error?: string }) {
  switch (status) {
    case 'custom':
      apiStatusDot.className = 'status-dot connected';
      apiStatusText.textContent = 'API:  Configured';
      apiKeyInput.style.borderColor = '#10b981';
      break;
    case 'connecting':
      apiStatusDot.className = 'status-dot connecting';
      apiStatusText.textContent = 'API:  Connecting...';
      apiKeyInput.style.borderColor = '#f59e0b';
      break;
    case 'error':
      apiStatusDot.className = 'status-dot disconnected';
      apiStatusText.textContent = error ? `API:  ${error}` : 'API:  Connection failed';
      apiKeyInput.style.borderColor = '#ef4444';
      break;
    case 'missing':
    default:
      apiStatusDot.className = 'status-dot disconnected';
      apiStatusText.textContent = 'API:  Not configured';
      apiKeyInput.style.borderColor = '';
      break;
  }
}

function updateApiStatus(valid: boolean, error?: string) {
  if (valid) {
    updateApiUiState({ status: 'custom' });
  } else {
    updateApiUiState({ status: error ? 'error' : 'missing', error });
  }
}

async function validateCurrentSettings() {
  const settings = await loadSettings();
  if (!settings.apiKey) {
    updateApiUiState({ status: 'missing' });
    return;
  }

  if (settings.apiKey === DEFAULTS.DEFAULT_API_KEY || !settings.apiKey.trim()) {
    updateApiUiState({ status: 'missing' });
    return;
  }

  // Show connecting state
  updateApiUiState({ status: 'connecting' });

  const result = await validateApiKey(settings.apiKey, settings.baseUrl);
  updateApiStatus(result.valid, result.error);
}

// Real-time validation on input
apiKeyInput.addEventListener('input', debounce(async () => {
  const key = apiKeyInput.value.trim();
  const baseUrl = PROVIDER_URLS[apiProviderInput.value as keyof typeof PROVIDER_URLS] || DEFAULTS.BASE_URL;

  if (!key) {
    updateApiStatus(false);
    return;
  }

  apiStatusDot.className = 'status-dot connecting';
  apiStatusText.textContent = 'API:  Validating...';
  apiKeyInput.style.borderColor = '#f59e0b'; // Orange

  const result = await validateApiKey(key, baseUrl);
  updateApiStatus(result.valid, result.error);
}, 1000));

// Validate on provider change
apiProviderInput.addEventListener('change', async () => {
  const key = apiKeyInput.value.trim();
  if (!key || key === DEFAULTS.DEFAULT_API_KEY) {
    updateApiStatus(false);
    return;
  }

  const baseUrl = PROVIDER_URLS[apiProviderInput.value as keyof typeof PROVIDER_URLS] || DEFAULTS.BASE_URL;

  apiStatusDot.className = 'status-dot connecting';
  apiStatusText.textContent = 'API:  Reconnecting...';
  apiKeyInput.style.borderColor = '#f59e0b'; // Orange

  const result = await validateApiKey(key, baseUrl);
  updateApiStatus(result.valid, result.error);
});

// ─── Initialize ─────────────────────────────────────────────────
loadCurrentSettings();
validateCurrentSettings();
loadSiteConfigs();
attachDangerZoneHandlers();
handleStripePaymentReturn();

// ─── Site Config Functions ────────────────────────────────────────

// Slider event listeners
siteConfigMaxRetriesInput.addEventListener('input', () => {
  siteConfigRetriesValue.textContent = siteConfigMaxRetriesInput.value;
});

siteConfigWaitInput.addEventListener('input', () => {
  siteConfigWaitValue.textContent = siteConfigWaitInput.value;
});

// Load and display site configs
async function loadSiteConfigs() {
  const configs = await getAllSiteConfigs();
  renderSiteConfigs(configs);
}

function renderSiteConfigs(configs: SiteConfig[]) {
  // Separate default and user configs
  const userConfigs = configs.filter(c => !isDefaultConfig(c.domain));

  if (userConfigs.length === 0) {
    siteConfigsList.innerHTML = '<p class="empty-message">No custom site configs. Default configs are applied automatically.</p>';
    return;
  }

  siteConfigsList.innerHTML = userConfigs.map(config => `
    <div class="site-config-item" data-domain="${escapeHtml(config.domain)}">
      <div class="site-config-header">
        <strong>${escapeHtml(config.domain)}</strong>
        <button class="btn-edit" data-domain="${escapeHtml(config.domain)}">Edit</button>
      </div>
      <div class="site-config-details">
        ${config.description ? `<span>${escapeHtml(config.description)}</span>` : ''}
        <span>Max retries: ${config.maxRetries ?? DEFAULT_SITE_MAX_RETRIES}</span>
        <span>Scroll: ${config.scrollBeforeLocate ? 'On' : 'Off'}</span>
        <span>Wait: ${config.waitAfterAction ?? DEFAULT_SITE_WAIT_MS}ms</span>
        ${config.customSelectors ? `<span>Custom selectors: ${config.customSelectors.length}</span>` : ''}
      </div>
    </div>
  `).join('');

  // Add edit button listeners
  siteConfigsList.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const domain = (e.target as HTMLButtonElement).dataset.domain;
      if (domain) {
        loadConfigToForm(domain, configs);
      }
    });
  });

}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replaceAll(/&/g, '&amp;')
    .replaceAll(/</g, '&lt;')
    .replaceAll(/>/g, '&gt;')
    .replaceAll(/"/g, '&quot;')
    .replaceAll(/'/g, '&#039;');
}

function isDefaultConfig(domain: string): boolean {
  const defaults = [
    'amazon.com', 'www.amazon.com', 'google.com', 'www.google.com',
    'facebook.com', 'www.facebook.com', 'twitter.com', 'x.com', 'www.x.com',
    'github.com', 'www.github.com', 'reddit.com', 'www.reddit.com',
    'linkedin.com', 'www.linkedin.com', 'youtube.com', 'www.youtube.com',
    'gmail.com', 'mail.google.com', 'shopify.com', '*.shopify.com'
  ];
  return defaults.includes(domain);
}

async function loadConfigToForm(domain: string, configs: SiteConfig[]) {
  const config = configs.find(c => c.domain === domain);
  if (!config) return;

  siteConfigDomainInput.value = config.domain;
  siteConfigDescInput.value = config.description || '';
  siteConfigMaxRetriesInput.value = String(config.maxRetries ?? DEFAULT_SITE_MAX_RETRIES);
  siteConfigRetriesValue.textContent = siteConfigMaxRetriesInput.value;
  siteConfigScrollInput.checked = config.scrollBeforeLocate ?? true;
  siteConfigWaitInput.value = String(config.waitAfterAction ?? DEFAULT_SITE_WAIT_MS);
  siteConfigWaitValue.textContent = siteConfigWaitInput.value;
  siteConfigSelectorsInput.value = config.customSelectors?.join(', ') || '';
}

// Add new site config
btnAddSiteConfig.addEventListener('click', async () => {
  const domain = siteConfigDomainInput.value.trim();
  if (!domain) {
    alert('Please enter a domain');
    return;
  }

  const config: SiteConfig = {
    domain,
    description: siteConfigDescInput.value.trim() || undefined,
    maxRetries: Number.parseInt(siteConfigMaxRetriesInput.value, 10),
    scrollBeforeLocate: siteConfigScrollInput.checked,
    waitAfterAction: Number.parseInt(siteConfigWaitInput.value, 10),
    customSelectors: siteConfigSelectorsInput.value.trim()
      ? siteConfigSelectorsInput.value.split(',').map(s => s.trim()).filter(Boolean)
      : undefined,
  };

  await setSiteConfig(config);
  await loadSiteConfigs();
  clearSiteConfigForm();
});

// Delete site config
btnDeleteSiteConfig.addEventListener('click', async () => {
  const domain = siteConfigDomainInput.value.trim();
  if (!domain) {
    alert('Please enter a domain to delete');
    return;
  }

  if (!confirm(`Delete custom config for "${domain}"?`)) {
    return;
  }

  await deleteSiteConfig(domain);
  await loadSiteConfigs();
  clearSiteConfigForm();
});

function clearSiteConfigForm() {
  siteConfigDomainInput.value = '';
  siteConfigDescInput.value = '';
  siteConfigMaxRetriesInput.value = '2';
  siteConfigRetriesValue.textContent = '2';
  siteConfigScrollInput.checked = true;
  siteConfigWaitInput.value = '400';
  siteConfigWaitValue.textContent = '400';
  siteConfigSelectorsInput.value = '';
}

function attachDangerZoneHandlers() {
  if (dangerZoneHandlersAttached) return;
  dangerZoneHandlersAttached = true;

  resetSettings?.addEventListener('click', async () => {
    if (!confirm('Reset all settings to defaults? This will permanently clear your API key, chat history, sessions, snapshots, and all preferences. This cannot be undone.')) return;
    await storageClear();
    _cachedSettings = null;
    await loadCurrentSettings();
    validateCurrentSettings();
    showNotification('Settings reset to defaults', 'success');
  });

  clearCache?.addEventListener('click', async () => {
    const keysToRemove = [
      'hyperagent_model_name',
      'hyperagent_backup_model',
      'hyperagent_vision_model',
      'modelName',
      'backupModel',
      'visionModel'
    ];

    await storageRemove(keysToRemove);
    const allItems = await storageGet(null);
    const keysToDelete = Object.entries(allItems)
      .filter(([, value]) => typeof value === 'string' && /anthropic|claude/i.test(value))
      .map(([key]) => key);

    if (keysToDelete.length) {
      await storageRemove(keysToDelete);
    }

    await loadCurrentSettings();
    showNotification('Cache cleared successfully', 'success');
  });

  const btnExportAll = document.getElementById('btn-export-all') as HTMLButtonElement;
  btnExportAll?.addEventListener('click', async () => {
    try {
      const allData = await storageGet(null);
      const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        source: 'HyperAgent GDPR Export',
        data: allData,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hyperagent-gdpr-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      showNotification('All data exported successfully', 'success');
    } catch (err) {
      showNotification('Failed to export data', 'error');
      console.error('[HyperAgent] Export error:', err);
    }
  });

  const btnDeleteAllData = document.getElementById('btn-delete-all-data') as HTMLButtonElement;
  btnDeleteAllData?.addEventListener('click', async () => {
    const confirmed = confirm(
      'This will permanently delete ALL your data including:\n\n' +
      '• API key and settings\n' +
      '• Chat history\n' +
      '• Scheduled tasks\n' +
      '• Snapshots and sessions\n' +
      '• Learning data\n\n' +
      'This action cannot be undone. Continue?'
    );

    if (!confirmed) return;

    const doubleConfirm = confirm(
      'Are you absolutely sure? Type "DELETE" in the next prompt to confirm.'
    );

    if (!doubleConfirm) return;

    const confirmation = prompt('Type DELETE to confirm permanent data deletion:');
    if (confirmation !== 'DELETE') {
      showNotification('Deletion cancelled', 'info');
      return;
    }

    try {
      await storageClear();
      _cachedSettings = null;
      await loadCurrentSettings();
      showNotification('All data has been permanently deleted', 'success');
    } catch (err) {
      showNotification('Failed to delete data', 'error');
      console.error('[HyperAgent] Deletion error:', err);
    }
  });
}

// ─── UI Event Listeners ──────────────────────────────────────────

// Toggle advanced settings
const toggleAdvancedBtn = document.getElementById('toggle-advanced');
if (toggleAdvancedBtn) {
  toggleAdvancedBtn.addEventListener('click', function () {
    const panel = document.getElementById('advanced-panel');
    if (panel) {
      panel.classList.toggle('hidden');
      toggleAdvancedBtn.textContent = panel.classList.contains('hidden') ? '️ Site Overrides' : ' Hide Overrides';
    }
  });
}
