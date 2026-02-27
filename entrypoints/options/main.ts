import { loadSettings, saveSettings, DEFAULTS, AVAILABLE_MODELS, STORAGE_KEYS, buildGdprExportSnapshot } from '../../shared/config';
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

// Confirm modal references
const confirmModal = document.getElementById('confirm-modal') as HTMLDivElement;
const confirmMessage = document.getElementById('confirm-message') as HTMLParagraphElement;
const btnConfirm = document.getElementById('btn-confirm') as HTMLButtonElement;
const btnCancel = document.getElementById('btn-cancel') as HTMLButtonElement;

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

// Helper function to show confirm modal
function showConfirmModal(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!confirmModal || !confirmMessage || !btnConfirm || !btnCancel) {
      resolve(confirm(message));
      return;
    }
    
    confirmMessage.textContent = message;
    confirmModal.classList.remove('hidden');
    btnConfirm.focus();
    
    const cleanup = () => {
      confirmModal.classList.add('hidden');
      btnConfirm.removeEventListener('click', onConfirm);
      btnCancel.removeEventListener('click', onCancel);
    };
    
    const onConfirm = () => {
      cleanup();
      resolve(true);
    };
    
    const onCancel = () => {
      cleanup();
      resolve(false);
    };
    
    btnConfirm.addEventListener('click', onConfirm);
    btnCancel.addEventListener('click', onCancel);
    
    // Close on Escape
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cleanup();
        resolve(false);
      }
    };
    document.addEventListener('keydown', onKeydown);
    
    // Clean up keydown listener after modal closes
    const observer = new MutationObserver(() => {
      if (confirmModal.classList.contains('hidden')) {
        document.removeEventListener('keydown', onKeydown);
        observer.disconnect();
      }
    });
    observer.observe(confirmModal, { attributes: true, attributeFilter: ['class'] });
  });
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

// ─── API Provider URL (OpenRouter only) ────────────────────────────
const PROVIDER_URLS = {
  openrouter: 'https://openrouter.ai/api/v1',
} as const;

// Model options available via OpenRouter (from centralized list). HyperAgent
// always uses OpenRouter's smart router (`openrouter/auto`); the UI exposes a
// single fixed option rather than a user-selectable list.
const PROVIDER_MODELS: Record<string, { value: string; label: string }[]> = {
  openrouter: [...AVAILABLE_MODELS],
};

// Key hint for OpenRouter
const PROVIDER_KEY_HINTS: Record<string, string> = {
  openrouter: 'Get your key at openrouter.ai/keys',
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

  // Always use OpenRouter
  const provider = 'openrouter';
  apiProviderInput.value = provider;
  updateModelOptions(provider);
  updateKeyHint(provider);

  // Handle API key display
  const usingDefaultKey = settings.apiKey === DEFAULTS.DEFAULT_API_KEY;
  const hasCustomKey = Boolean(settings.apiKey && !usingDefaultKey);
  apiKeyInput.value = hasCustomKey ? settings.apiKey : '';
  apiKeyInput.placeholder = 'Enter your OpenRouter API key...';

  updateApiUiState({
    status: hasCustomKey ? 'custom' : 'missing',
  });

  modelSelectInput.value = PROVIDER_MODELS.openrouter[0].value;
  modelSelectInput.disabled = true;
  modelStatusText.textContent = `Model: ${PROVIDER_MODELS.openrouter[0].label}`;
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

// All calls route through OpenRouter
function detectProviderFromKey(_apiKey: string): string {
  return 'openrouter';
}

// All calls route through OpenRouter
function detectProviderFromUrl(_url: string): string {
  return 'openrouter';
}

function updateModelOptions(_provider: string) {
  const models = PROVIDER_MODELS.openrouter;
  modelSelectInput.innerHTML = models.map(m => `<option value="${m.value}">${m.label}</option>`).join('');
  if (models.length > 0) {
    modelSelectInput.value = models[0].value;
    modelSelectInput.disabled = true;
  }
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
  modelSelectInput.value = PROVIDER_MODELS.openrouter[0].value;
  modelSelectInput.disabled = true;
  modelStatusText.textContent = `Model: ${PROVIDER_MODELS.openrouter[0].label}`;
});

maxStepsInput.addEventListener('input', () => {
  maxStepsValue.textContent = maxStepsInput.value;
});

function updateTipsBanner(modelName: string) {
  const tipsInfo = document.getElementById('tips-model-info');
  if (!tipsInfo) return;

  const modelDescriptions: Record<string, string> = {
    [DEFAULTS.MODEL_NAME]: 'OpenRouter Auto — Smart router that automatically selects the best model for each task.',
  };

  tipsInfo.textContent = modelDescriptions[modelName] || 'OpenRouter Auto — Smart router selects models automatically.';
}

let _saveInProgress = false;
btnSave.addEventListener('click', async () => {
  if (_saveInProgress) return;
  _saveInProgress = true;
  try {
    const apiKeyValue = apiKeyInput.value.trim() || DEFAULTS.DEFAULT_API_KEY;
    const modelNameValue = DEFAULTS.MODEL_NAME;
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

  try {
    // All validation goes through OpenRouter's models endpoint
    const validationUrl = baseUrl || PROVIDER_URLS.openrouter;
    const response = await fetch(`${validationUrl}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${key}`,
        'HTTP-Referer': 'https://hyperagent.ai',
        'X-Title': 'HyperAgent',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      return { valid: true };
    }

    // If models endpoint fails, try a minimal chat completion
    if (response.status === 404) {
      const chatResponse = await fetch(`${validationUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
          'HTTP-Referer': 'https://hyperagent.ai',
          'X-Title': 'HyperAgent',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
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

      // Improved error parsing - try JSON first, then provide friendly fallback
      const friendlyError = parseApiError(chatResponse.status, errorText);
      return { valid: false, error: friendlyError };
    }

    const errorText = await response.text();
    console.error('[API Validation Error]', errorText);

    // Improved error parsing - try JSON first, then provide friendly fallback
    const friendlyError = parseApiError(response.status, errorText);
    return { valid: false, error: friendlyError };
  } catch (error) {
    console.error('[API Validation Error]', error);
    if ((error as Error).name === 'TimeoutError' || (error as Error).message?.includes('abort')) {
      return { valid: false, error: 'Connection timeout - check your internet' };
    }
    return { valid: false, error: `Connection failed: ${(error as Error).message}` };
  }
}

// Helper to parse API errors into user-friendly messages
function parseApiError(status: number, errorText: string): string {
  // Try to parse JSON response first
  let errorJson: Record<string, unknown> | null = null;
  
  try {
    errorJson = JSON.parse(errorText);
  } catch {
    // Not JSON - will use fallback below
  }

  if (errorJson && typeof errorJson === 'object') {
    const errorObj = errorJson as Record<string, unknown>;
    const errorMsg = (errorObj.error as Record<string, unknown>)?.message as string | undefined;
    
    if (errorMsg && typeof errorMsg === 'string') {
      const msg = errorMsg.toLowerCase();
      // Map specific error messages to friendly ones
      if (msg.includes('authentication') || msg.includes('invalid') || msg.includes('unauthorized')) {
        return 'Invalid API key - please check your key in Settings';
      }
      if (msg.includes('insufficient') || msg.includes('quota') || msg.includes('credit')) {
        return 'Insufficient credits - please add funds to your OpenRouter account';
      }
      if (msg.includes('rate limit')) {
        return 'Rate limit exceeded - please try again later';
      }
      // Return original message if no specific mapping
      return errorMsg;
    }
  }

  // Provide user-friendly messages for common status codes
  switch (status) {
    case 400:
      return 'Invalid request - please check your API key format';
    case 401:
    case 403:
      return 'Invalid API key - please check your key in Settings';
    case 404:
      return 'API endpoint not found - please check your settings';
    case 429:
      return 'Rate limit exceeded - please try again later';
    case 500:
    case 502:
    case 503:
      return 'Service temporarily unavailable - please try again';
    default:
      // Log raw error for debugging
      console.warn('[API Error] Status:', status, 'Raw:', errorText.substring(0, 200));
      return `API Error (${status}) - please check your settings`;
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
// Wrap setting loaders in try-catch so danger zone / export buttons
// remain functional even if storage is corrupted.
try {
  loadCurrentSettings();
  validateCurrentSettings();
  loadSiteConfigs();
} catch (err) {
  showNotification('Failed to load some settings — you can still reset or export data below.', 'error');
}
attachDangerZoneHandlers();
handleStripePaymentReturn();

// ─── Dark Mode Sync ─────────────────────────────────────────────
async function initOptionsDarkMode() {
  const data = await chrome.storage.local.get('dark_mode');
  let useDark: boolean;
  if (data.dark_mode === true) {
    useDark = true;
  } else if (data.dark_mode === false) {
    useDark = false;
  } else {
    useDark = typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
  }
  if (useDark) {
    document.documentElement.classList.add('dark');
    document.body.classList.add('dark-mode');
  } else {
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark-mode');
  }
}
initOptionsDarkMode();

// Listen for dark mode changes from sidepanel
chrome.storage.onChanged.addListener((changes) => {
  if (changes.dark_mode) {
    const isDark = changes.dark_mode.newValue === true;
    document.documentElement.classList.toggle('dark', isDark);
    document.body.classList.toggle('dark-mode', isDark);
  }
});

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
    showNotification('Please enter a domain', 'error');
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
    showNotification('Please enter a domain to delete', 'error');
    return;
  }

  const confirmed = await showConfirmModal(`Delete custom config for "${domain}"?`);
  if (!confirmed) return;

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
    // First prompt to export data before resetting
    const exportFirst = await showConfirmModal('Would you like to export your data before resetting? Click OK to export, or Cancel to reset without exporting.');
    
    if (exportFirst) {
      // Trigger export before reset
      const btnExportAll = document.getElementById('btn-export-all');
      if (btnExportAll) {
        btnExportAll.click();
        // Wait for export to complete, then confirm reset
        const proceedWithReset = await showConfirmModal('Data exported. Click OK to now reset all settings, or Cancel to keep your data.');
        if (!proceedWithReset) return;
      }
    }
    
    const confirmed = await showConfirmModal('Reset all settings to defaults? This will permanently clear your API key, chat history, sessions, snapshots, and all preferences. This cannot be undone.');
    if (!confirmed) return;
    
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
      .filter(([, value]) => typeof value === 'string' && /generativelanguage|anthropic|claude/i.test(value))
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
      const subscription = allData[STORAGE_KEYS.SUBSCRIPTION] as any | undefined;
      const exportData = buildGdprExportSnapshot(allData, {
        billingTier: subscription?.tier,
        billingStatus: subscription?.status,
      });

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hyperagent-gdpr-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      showNotification('All data exported successfully (API keys are not included).', 'success');
    } catch (err) {
      showNotification('Failed to export data', 'error');
      console.error('[HyperAgent] Export error:', err);
    }
  });

  const btnDeleteAllData = document.getElementById('btn-delete-all-data') as HTMLButtonElement;
  btnDeleteAllData?.addEventListener('click', async () => {
    const deleteModal = document.getElementById('delete-modal');
    const deleteInput = document.getElementById('delete-confirm-input') as HTMLInputElement;
    const deleteConfirmBtn = document.getElementById('btn-delete-confirm') as HTMLButtonElement;
    const deleteCancelBtn = document.getElementById('btn-delete-cancel') as HTMLButtonElement;

    if (!deleteModal || !deleteInput || !deleteConfirmBtn || !deleteCancelBtn) {
      showNotification('Modal not found', 'error');
      return;
    }

    deleteModal.classList.remove('hidden');
    deleteInput.value = '';
    deleteConfirmBtn.disabled = true;
    deleteInput.focus();

    const cleanup = () => {
      deleteModal.classList.add('hidden');
      deleteInput.value = '';
    };

    const inputHandler = () => {
      deleteConfirmBtn.disabled = deleteInput.value.trim() !== 'DELETE';
    };

    const confirmHandler = async () => {
      if (deleteInput.value.trim() !== 'DELETE') {
        showNotification('Deletion cancelled', 'info');
        cleanup();
        return;
      }

      cleanup();
      deleteInput.removeEventListener('input', inputHandler);
      deleteConfirmBtn.removeEventListener('click', confirmHandler);
      deleteCancelBtn.removeEventListener('click', cancelHandler);

      try {
        await storageClear();
        _cachedSettings = null;
        await loadCurrentSettings();
        showNotification('All data has been permanently deleted', 'success');
      } catch (err) {
        showNotification('Failed to delete data', 'error');
        console.error('[HyperAgent] Deletion error:', err);
      }
    };

    const cancelHandler = () => {
      cleanup();
      deleteInput.removeEventListener('input', inputHandler);
      deleteConfirmBtn.removeEventListener('click', confirmHandler);
      deleteCancelBtn.removeEventListener('click', cancelHandler);
    };

    deleteInput.addEventListener('input', inputHandler);
    deleteConfirmBtn.addEventListener('click', confirmHandler);
    deleteCancelBtn.addEventListener('click', cancelHandler);

    deleteInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        cancelHandler();
      } else if (e.key === 'Enter' && deleteInput.value.trim() === 'DELETE') {
        confirmHandler();
      }
    });
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

// ─── Back to Side Panel ──────────────────────────────────────────
const btnBackToPanel = document.getElementById('btn-back-to-panel');
if (btnBackToPanel) {
  btnBackToPanel.addEventListener('click', async () => {
    try {
      // Open the side panel on the current window
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await (chrome.sidePanel as any).open({ tabId: tab.id });
      }
    } catch {
      // Fallback: just show a helpful message
      showNotification('Open the side panel by clicking the HyperAgent icon in your toolbar.', 'info');
    }
  });
}
