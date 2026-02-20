import { loadSettings, saveSettings, DEFAULTS } from '../../shared/config';
import type { Settings } from '../../shared/config';
import { getAllSiteConfigs, setSiteConfig, deleteSiteConfig, getUserSiteConfigs } from '../../shared/siteConfig';
import type { SiteConfig } from '../../shared/types';

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
let cachedSettings: Settings | null = null;

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
  openrouter: 'https://openrouter.ai/api/v1',
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
  google: 'https://generativelanguage.googleapis.com',
  custom: ''
} as const;

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
  cachedSettings = settings;

  // Detect API provider from base URL
  const provider = detectProviderFromUrl(settings.baseUrl);
  apiProviderInput.value = provider;

  // Handle API key display
  const usingDefaultKey = settings.apiKey === DEFAULTS.DEFAULT_API_KEY;
  const hasCustomKey = Boolean(settings.apiKey && !usingDefaultKey);
  apiKeyInput.value = hasCustomKey ? settings.apiKey : '';
  apiKeyInput.placeholder = usingDefaultKey ? 'Using built-in OpenRouter key (auto-managed)' : 'sk-or-v1-...';

  updateApiUiState({
    status: hasCustomKey ? 'custom' : usingDefaultKey ? 'builtin' : 'missing',
  });

  // Model is fixed to google/gemini-2.5-flash
  modelStatusText.textContent = 'Model: google/gemini-2.5-flash';
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

// ─── Detect provider from URL ───────────────────────────────────
function detectProviderFromUrl(url: string): string {
  if (url.includes('openrouter.ai')) return 'openrouter';
  if (url.includes('openai.com')) return 'openai';
  if (url.includes('anthropic.com')) return 'anthropic';
  if (url.includes('googleapis.com')) return 'google';
  return 'custom';
}

// ─── Max steps slider ───────────────────────────────────────────
maxStepsInput.addEventListener('input', () => {
  maxStepsValue.textContent = maxStepsInput.value;
});

// ─── Save settings ──────────────────────────────────────────────
btnSave.addEventListener('click', async () => {
  const apiKeyValue = apiKeyInput.value.trim() || DEFAULTS.DEFAULT_API_KEY;
  const current = cachedSettings;

  await saveSettings({
    apiKey: apiKeyValue,
    baseUrl: PROVIDER_URLS[apiProviderInput.value as keyof typeof PROVIDER_URLS] || DEFAULTS.BASE_URL,
    modelName: 'google/gemini-2.5-flash',
    backupModel: 'google/gemini-2.5-flash',
    maxSteps: parseInt(maxStepsInput.value, 10) || DEFAULTS.MAX_STEPS,
    requireConfirm: requireConfirmInput.checked,
    dryRun: dryRunInput.checked,
    enableVision: enableVisionInput.checked,
    autoRetry: autoRetryInput.checked,
    siteBlacklist: siteBlacklistInput.value,
    enableSwarmIntelligence: enableSwarmInput.checked,
    enableAutonomousMode: enableAutonomousInput.checked,
    learningEnabled: enableLearningInput.checked,
  });

  saveStatus.classList.remove('hidden');
  setTimeout(() => saveStatus.classList.add('hidden'), 2000);
  showNotification('Settings saved successfully', 'success');
});

// ─── API Key Validation ─────────────────────────────────────────
let validationTimeout: NodeJS.Timeout | null = null;

async function validateApiKey(key: string, baseUrl: string): Promise<{ valid: boolean; error?: string }> {
  if (!key || key === DEFAULTS.DEFAULT_API_KEY) {
    return { valid: false, error: 'No API key provided' };
  }

  try {
    // Test with minimax model which should be available
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
        'HTTP-Referer': 'https://hyperagent.ai',
        'X-Title': 'HyperAgent',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: 'Test' }],
        temperature: 0,
        max_tokens: 1,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (response.ok) {
      return { valid: true };
    } else {
      const errorText = await response.text();
      console.error('[API Validation Error]', errorText);
      return { valid: false, error: `API Error: ${response.status}` };
    }
  } catch (error) {
    console.error('[API Validation Error]', error);
    return { valid: false, error: `Connection error: ${(error as Error).message}` };
  }
}

type ApiStatusState = 'custom' | 'builtin' | 'missing' | 'error' | 'connecting';

function updateApiUiState({ status, error }: { status: ApiStatusState; error?: string }) {
  switch (status) {
    case 'custom':
      apiStatusDot.className = 'status-dot connected';
      apiStatusText.textContent = 'API: ✅ Custom key detected';
      apiKeyInput.style.borderColor = '#10b981';
      break;
    case 'builtin':
      apiStatusDot.className = 'status-dot connected';
      apiStatusText.textContent = 'API: ✅ Using built-in key';
      apiKeyInput.style.borderColor = '#10b981';
      break;
    case 'connecting':
      apiStatusDot.className = 'status-dot connecting';
      apiStatusText.textContent = 'API: 🔄 Connecting...';
      apiKeyInput.style.borderColor = '#f59e0b';
      break;
    case 'error':
      apiStatusDot.className = 'status-dot disconnected';
      apiStatusText.textContent = error ? `API: ❌ ${error}` : 'API: ❌ Connection failed';
      apiKeyInput.style.borderColor = '#ef4444';
      break;
    case 'missing':
    default:
      apiStatusDot.className = 'status-dot disconnected';
      apiStatusText.textContent = 'API: ❌ Not configured';
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

  if (settings.apiKey === DEFAULTS.DEFAULT_API_KEY) {
    updateApiUiState({ status: 'builtin' });
    return;
  }

  // Show connecting state
  updateApiUiState({ status: 'connecting' });

  const result = await validateApiKey(settings.apiKey, settings.baseUrl);
  updateApiStatus(result.valid, result.error);
}

// Debounced validation
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
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
  apiStatusText.textContent = 'API: 🔄 Validating...';
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
  apiStatusText.textContent = 'API: 🔄 Reconnecting...';
  apiKeyInput.style.borderColor = '#f59e0b'; // Orange

  const result = await validateApiKey(key, baseUrl);
  updateApiStatus(result.valid, result.error);
});

// ─── Initialize ─────────────────────────────────────────────────
loadCurrentSettings();
validateCurrentSettings();
loadSiteConfigs();
attachDangerZoneHandlers();

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
    <div class="site-config-item" data-domain="${config.domain}">
      <div class="site-config-header">
        <strong>${config.domain}</strong>
        <button class="btn-edit" data-domain="${config.domain}">Edit</button>
      </div>
      <div class="site-config-details">
        ${config.description ? `<span>${config.description}</span>` : ''}
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
    maxRetries: parseInt(siteConfigMaxRetriesInput.value, 10),
    scrollBeforeLocate: siteConfigScrollInput.checked,
    waitAfterAction: parseInt(siteConfigWaitInput.value, 10),
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
    if (!confirm('Reset all settings to defaults? This will clear your API key and preferences.')) return;
    await storageClear();
    cachedSettings = null;
    await loadCurrentSettings();
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
      .filter(([, value]) => typeof value === 'string' && /anthropic|claude/i.test(value as string))
      .map(([key]) => key);

    if (keysToDelete.length) {
      await storageRemove(keysToDelete);
    }

    await loadCurrentSettings();
    showNotification('Cache cleared successfully', 'success');
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
      toggleAdvancedBtn.textContent = panel.classList.contains('hidden') ? '⚙️ Site Overrides' : '🔽 Hide Overrides';
    }
  });
}
