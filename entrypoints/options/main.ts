import { loadSettings, saveSettings, DEFAULTS } from '../../shared/config';
import { getAllSiteConfigs, setSiteConfig, deleteSiteConfig, getUserSiteConfigs } from '../../shared/siteConfig';
import type { SiteConfig } from '../../shared/types';

// ─── DOM references ─────────────────────────────────────────────
const apiProviderInput = document.getElementById('api-provider') as HTMLSelectElement;
const apiKeyInput = document.getElementById('api-key') as HTMLInputElement;
const modelNameInput = document.getElementById('model-name') as HTMLSelectElement;
const backupModelInput = document.getElementById('backup-model') as HTMLSelectElement;
const maxStepsInput = document.getElementById('max-steps') as HTMLInputElement;
const maxStepsValue = document.getElementById('max-steps-value')!;
const requireConfirmInput = document.getElementById('require-confirm') as HTMLInputElement;
const dryRunInput = document.getElementById('dry-run') as HTMLInputElement;
const enableVisionInput = document.getElementById('enable-vision') as HTMLInputElement;
const autoRetryInput = document.getElementById('auto-retry') as HTMLInputElement;
const siteBlacklistInput = document.getElementById('site-blacklist') as HTMLTextAreaElement;
const btnSave = document.getElementById('btn-save') as HTMLButtonElement;
const saveStatus = document.getElementById('save-status')!;

// Status indicators
const apiStatusDot = document.getElementById('api-status')!;
const apiStatusText = document.getElementById('api-status-text')!;
const modelStatusText = document.getElementById('model-status-text')!;

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

  // Detect API provider from base URL
  const provider = detectProviderFromUrl(settings.baseUrl);
  apiProviderInput.value = provider;

  // Handle API key display
  const hasApiKey = settings.apiKey && settings.apiKey !== DEFAULTS.DEFAULT_API_KEY;
  apiKeyInput.value = hasApiKey ? settings.apiKey : '';

  // Show indicator if using default key
  if (settings.apiKey === DEFAULTS.DEFAULT_API_KEY) {
    apiKeyInput.placeholder = "Using pre-configured OpenRouter key (secure)";
    apiKeyInput.style.borderColor = "#10b981"; // Green border for default
    apiStatusDot.className = 'status-dot connected';
    apiStatusText.textContent = 'API: ✅ Connected';
  } else if (hasApiKey) {
    apiKeyInput.placeholder = "sk-or-v1-...";
    apiKeyInput.style.borderColor = "#10b981"; // Green for custom key
    apiStatusDot.className = 'status-dot connected';
    apiStatusText.textContent = 'API: ✅ Connected';
  } else {
    apiKeyInput.placeholder = "sk-or-v1-...";
    apiKeyInput.style.borderColor = ""; // Reset border
    apiStatusDot.className = 'status-dot disconnected';
    apiStatusText.textContent = 'API: ❌ Not configured';
  }

  modelNameInput.value = settings.modelName;
  modelStatusText.textContent = settings.modelName === 'auto' ? 'Model: 🤖 Auto' : `Model: ${settings.modelName}`;
  backupModelInput.value = settings.backupModel || DEFAULTS.BACKUP_MODEL;
  maxStepsInput.value = String(settings.maxSteps);
  maxStepsValue.textContent = String(settings.maxSteps);
  requireConfirmInput.checked = settings.requireConfirm;
  dryRunInput.checked = settings.dryRun;
  enableVisionInput.checked = settings.enableVision;
  autoRetryInput.checked = settings.autoRetry;
  siteBlacklistInput.value = settings.siteBlacklist;
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

  await saveSettings({
    apiKey: apiKeyValue,
    baseUrl: PROVIDER_URLS[apiProviderInput.value as keyof typeof PROVIDER_URLS] || DEFAULTS.BASE_URL,
    modelName: modelNameInput.value.trim() || DEFAULTS.MODEL_NAME,
    backupModel: backupModelInput.value.trim() || DEFAULTS.BACKUP_MODEL,
    maxSteps: parseInt(maxStepsInput.value, 10) || DEFAULTS.MAX_STEPS,
    requireConfirm: requireConfirmInput.checked,
    dryRun: dryRunInput.checked,
    enableVision: enableVisionInput.checked,
    autoRetry: autoRetryInput.checked,
    siteBlacklist: siteBlacklistInput.value,
  });

  saveStatus.classList.remove('hidden');
  setTimeout(() => saveStatus.classList.add('hidden'), 2000);
});

// ─── API Provider change handler ────────────────────────────────
apiProviderInput.addEventListener('change', () => {
  // Provider change doesn't need to update base URL since it's handled automatically
  console.log('Provider changed to:', apiProviderInput.value);
});

// ─── Initialize ─────────────────────────────────────────────────
loadCurrentSettings();
loadSiteConfigs();

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
        <span>Max retries: ${config.maxRetries ?? DEFAULTS.MAX_RETRIES_PER_ACTION}</span>
        <span>Scroll: ${config.scrollBeforeLocate ? 'On' : 'Off'}</span>
        <span>Wait: ${config.waitAfterAction ?? DEFAULTS.ACTION_DELAY_MS}ms</span>
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
  siteConfigMaxRetriesInput.value = String(config.maxRetries ?? DEFAULTS.MAX_RETRIES_PER_ACTION);
  siteConfigRetriesValue.textContent = siteConfigMaxRetriesInput.value;
  siteConfigScrollInput.checked = config.scrollBeforeLocate ?? true;
  siteConfigWaitInput.value = String(config.waitAfterAction ?? DEFAULTS.ACTION_DELAY_MS);
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
