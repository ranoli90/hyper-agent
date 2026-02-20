/**
 * @fileoverview HyperAgent side panel UI.
 * Chat, commands, tabs (Swarm, Vision, Tasks, Memory, Marketplace, Subscription).
 */

import type {
  ExtensionMessage,
  Action,
  MsgAgentProgress,
  MsgConfirmActions,
  MsgAgentDone,
  MsgAskUser,
} from '../../shared/types';
import { billingManager, PRICING_PLANS } from '../../shared/billing';
import { validateAndFilterImportData } from '../../shared/config';
import { inputSanitizer } from '../../shared/input-sanitization';

function debounce<T extends (...args: any[]) => any>(fn: T, ms: number): T {
  let timeout: ReturnType<typeof setTimeout>;
  return ((...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), ms);
  }) as T;
}

// ─── DOM Elements ───────────────────────────────────────────────
const safeGetElement = <T extends HTMLElement>(id: string, optional = false): T | null => {
  const el = document.getElementById(id);
  if (!el && !optional) {
    console.error(`[HyperAgent] Critical DOM element missing: #${id}`);
    return null;
  }
  return el as T;
};

const components = {
  chatHistory: safeGetElement<HTMLElement>('chat-history')!,
  commandInput: safeGetElement<HTMLTextAreaElement>('command-input')!,
  btnExecute: safeGetElement<HTMLButtonElement>('btn-execute')!,
  btnStop: safeGetElement<HTMLButtonElement>('btn-stop')!,
  btnSettings: safeGetElement<HTMLButtonElement>('btn-settings')!,
  statusBar: safeGetElement<HTMLElement>('status-bar')!,
  statusText: safeGetElement<HTMLElement>('status-text')!,
  suggestions: safeGetElement<HTMLElement>('suggestions-container')!,
  charCounter: safeGetElement<HTMLElement>('char-counter')!,
  btnMic: safeGetElement<HTMLButtonElement>('btn-mic')!,

  // Tabs
  tabs: document.querySelectorAll('.tab-btn'),
  panes: document.querySelectorAll('.tab-pane'),

  usageActions: safeGetElement<HTMLElement>('usage-actions')!,
  usageSessions: safeGetElement<HTMLElement>('usage-sessions')!,
  usageTier: safeGetElement<HTMLElement>('usage-tier')!,
  marketplaceList: safeGetElement<HTMLElement>('marketplace-list')!,
  btnUpgradePremium: safeGetElement<HTMLButtonElement>('btn-upgrade-premium')!,
  btnUpgradeUnlimited: safeGetElement<HTMLButtonElement>('btn-upgrade-unlimited')!,

  subscriptionBadge: safeGetElement<HTMLElement>('subscription-badge')!,
  toastContainer: safeGetElement<HTMLElement>('toast-container')!,

  // Vision
  visionSnapshot: safeGetElement<HTMLImageElement>('vision-snapshot', true)!, // Optional if vision disabled
  visionPlaceholder: safeGetElement<HTMLElement>('vision-placeholder')!,

  // Modals
  confirmModal: safeGetElement<HTMLElement>('confirm-modal')!,
  confirmSummary: safeGetElement<HTMLElement>('confirm-summary')!,
  confirmList: safeGetElement<HTMLElement>('confirm-actions-list')!,
  btnConfirm: safeGetElement<HTMLButtonElement>('btn-confirm')!,
  btnCancel: safeGetElement<HTMLButtonElement>('btn-cancel')!,

  askModal: safeGetElement<HTMLElement>('ask-modal')!,
  askQuestion: safeGetElement<HTMLElement>('ask-question')!,
  askReply: safeGetElement<HTMLTextAreaElement>('ask-reply')!,
  btnAskReply: safeGetElement<HTMLButtonElement>('btn-ask-reply')!,
  btnAskCancel: safeGetElement<HTMLButtonElement>('btn-ask-cancel')!,

  // Stepper
  steps: document.querySelectorAll('.step'),
};

// Validate critical components
try {
  const required = [
    components.chatHistory,
    components.commandInput,
    components.btnExecute,
    components.btnStop,
    components.statusBar,
    components.statusText,
    components.suggestions,
    components.charCounter,
  ];
  if (required.some(el => !el)) {
    throw new Error('Critical UI components missing from DOM');
  }
} catch (err: any) {
  console.error('[HyperAgent] Fatal UI Init Error:', err);
  document.body.innerHTML = `<div style="padding:20px;color:red;">
    <h3>Fatal Error</h3>
    <p>Failed to initialize UI components.</p>
    <pre>${err?.message || 'Unknown error'}</pre>
  </div>`;
  throw err;
}

// ─── State ──────────────────────────────────────────────────────
const state = {
  isRunning: false,
  confirmResolve: null as ((confirmed: boolean) => void) | null,
  askResolve: null as ((reply: string) => void) | null,
  activeTab: 'chat',
  lastCommandTime: 0,
  commandHistory: [] as string[],
  historyIndex: -1,
};

const MAX_COMMAND_LENGTH = 2000;
const COMMAND_RATE_LIMIT_MS = 1000; // 1 second between commands

function updateCharCounter(value: string) {
  if (!components.charCounter) return;
  const length = value.length;
  components.charCounter.textContent = `${length} / ${MAX_COMMAND_LENGTH}`;
  components.charCounter.classList.toggle('warn', length > MAX_COMMAND_LENGTH * 0.9);
}

// ─── Tab Logic ──────────────────────────────────────────────────
function switchTab(tabId: string) {
  state.activeTab = tabId;
  components.tabs.forEach(btn => {
    btn.classList.toggle('active', (btn as HTMLElement).dataset.tab === tabId);
  });
  components.panes.forEach(pane => {
    pane.classList.toggle('active', pane.id === `tab-${tabId}`);
  });

  // Load tab-specific content
  if (tabId === 'marketplace') {
    loadMarketplace();
  } else if (tabId === 'subscription') {
    updateUsageDisplay();
  } else if (tabId === 'memory') {
    loadMemoryTab();
  } else if (tabId === 'tasks') {
    loadTasksTab();
  } else if (tabId === 'vision') {
    loadVisionTab();
  } else if (tabId === 'swarm') {
    loadSwarmTab();
  }
}

components.tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const target = (tab as HTMLElement).dataset.tab;
    if (target) switchTab(target);
  });
});

// Confirm / cancel modal actions
components.btnConfirm.addEventListener('click', () => {
  components.confirmModal.classList.add('hidden');
  if (state.confirmResolve) {
    state.confirmResolve(true);
    state.confirmResolve = null;
  }
});

components.btnCancel.addEventListener('click', () => {
  components.confirmModal.classList.add('hidden');
  if (state.confirmResolve) {
    state.confirmResolve(false);
    state.confirmResolve = null;
  }
});

// Modal backdrop close
components.confirmModal.addEventListener('click', e => {
  if (e.target === components.confirmModal) {
    components.confirmModal.classList.add('hidden');
    if (state.confirmResolve) {
      state.confirmResolve(false);
      state.confirmResolve = null;
    }
  }
});

components.askModal.addEventListener('click', e => {
  if (e.target === components.askModal) {
    components.askModal.classList.add('hidden');
    components.askReply.value = '';
    chrome.runtime.sendMessage({ type: 'userReply', reply: '' });
  }
});

// Ask user modal actions
components.btnAskReply.addEventListener('click', () => {
  const reply = components.askReply.value.trim();
  components.askModal.classList.add('hidden');
  components.askReply.value = '';
  chrome.runtime.sendMessage({ type: 'userReply', reply });
});

components.btnAskCancel.addEventListener('click', () => {
  components.askModal.classList.add('hidden');
  components.askReply.value = '';
  chrome.runtime.sendMessage({ type: 'userReply', reply: '' });
});

// ─── Slash Commands ─────────────────────────────────────────────
const SLASH_COMMANDS = {
  '/clear': () => {
    components.chatHistory.innerHTML = '';
    saveHistory();
    addMessage('Chat history cleared.', 'status');
  },
  '/reset': () => {
    chrome.runtime.sendMessage({ type: 'stopAgent' });
    location.reload();
  },
  '/memory': () => {
    switchTab('memory');
    addMessage('Analyzing memory patterns...', 'status');
  },
  '/schedule': () => {
    switchTab('tasks');
  },
  '/tools': () => {
    addMessage(
      `
**Active Tools:**
- **Email**: Draft or send emails
- **Calendar**: Manage meetings
- **File**: Process downloads
- **Calculator**: Math operations
- **Time**: Current world time
    `,
      'agent'
    );
  },
  '/think': () => {
    const fullInput = sanitizeInput(components.commandInput.value).trim();
    const cmd = fullInput.replace(/^\/think\s*/, '').trim();
    if (!cmd) {
      addMessage('Usage: /think [advanced task description]', 'status');
      return;
    }
    executeAutonomousCommand(cmd);
  },
  '/help': () => {
    addMessage(
      `
**Hyper-Commands:**
- \`/think\`: Advanced autonomous reasoning
- \`/memory\`: View stored knowledge
- \`/schedule\`: Manage background tasks
- \`/tools\`: List agent capabilities
- \`/clear\`: Clear chat history
- \`/shortcuts\`: Show keyboard shortcuts
- \`/export\`: Export settings
- \`/import\`: Import settings
- \`/help\`: Show this message

**Keyboard Shortcuts:**
- \`Enter\`: Send command
- \`Shift+Enter\`: New line
- \`Arrow Up/Down\`: Navigate history
- \`Escape\`: Close modals/suggestions
    `,
      'agent'
    );
  },
  '/shortcuts': () => {
    addMessage(
      `
**Keyboard Shortcuts:**
- \`Enter\`: Send command
- \`Shift+Enter\`: New line in input
- \`Arrow Up\`: Previous command in history
- \`Arrow Down\`: Next command in history
- \`Escape\`: Close modals/suggestions
- \`Ctrl/Cmd+L\`: Clear chat
- \`Ctrl/Cmd+S\`: Open settings
    `,
      'agent'
    );
  },
  '/export': () => {
    exportSettings();
  },
  '/import': () => {
    importSettings();
  },
};

const SUGGESTIONS = [
  { command: '/memory', description: 'Search stored knowledge' },
  { command: '/schedule', description: 'Manage background tasks' },
  { command: '/tools', description: 'List available agent tools' },
  { command: '/clear', description: 'Clear chat history' },
  { command: '/help', description: 'Help & documentation' },
];

function sanitizeInput(text: string): string {
  // Basic sanitization - remove null bytes, control characters except newlines
  return text.replace(/\x00/g, '').replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

function showSuggestions(query: string) {
  try {
    const container = components.suggestions;
    if (!container) return;

    const sanitizedQuery = sanitizeInput(query).toLowerCase();
    if (sanitizedQuery.length === 0) {
      container.classList.add('hidden');
      return;
    }

    const matches = SUGGESTIONS.filter(
      s =>
        s.command.toLowerCase().startsWith(sanitizedQuery) ||
        s.description.toLowerCase().includes(sanitizedQuery)
    );

    if (matches.length === 0) {
      container.classList.add('hidden');
      return;
    }

    container.innerHTML = '';
    matches.slice(0, 5).forEach(s => {
      // Limit to 5 suggestions for performance
      try {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.innerHTML = `
          <span class="command">${escapeHtml(s.command)}</span>
          <span class="desc">${escapeHtml(s.description)}</span>
        `;
        div.addEventListener('click', () => {
          components.commandInput.value = s.command + ' ';
          components.commandInput.focus();
          container.classList.add('hidden');

          // Auto-resize after selection
          components.commandInput.dispatchEvent(new Event('input'));
        });
        container.appendChild(div);
      } catch (err) {
        console.warn('[HyperAgent] Failed to create suggestion item:', err);
      }
    });

    container.classList.remove('hidden');
  } catch (err) {
    console.warn('[HyperAgent] showSuggestions failed:', err);
    if (components.suggestions) {
      components.suggestions.classList.add('hidden');
    }
  }
}

// ─── Chat Interface ─────────────────────────────────────────────
function addMessage(content: string, type: 'user' | 'agent' | 'error' | 'status' | 'thinking') {
  if (!components.chatHistory) return null;
  const div = document.createElement('div');
  div.className = `chat-msg ${type}`;

  if (type === 'agent') {
    div.innerHTML = renderMarkdown(content);
  } else {
    div.textContent = content;
  }

  components.chatHistory.appendChild(div);
  scrollToBottom();
  saveHistory(); // Persist
  return div;
}

function renderMarkdown(text: string): string {
  try {
    let html = text.replace(/```(\w*)([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre><code class="language-${escapeHtml(lang)}">${escapeHtml(code.trim())}</code></pre>`;
    });
    html = html.replace(/`([^`]+)`/g, (_, code) => `<code>${escapeHtml(code)}</code>`);
    html = html.replace(/\*\*([^*]+)\*\*/g, (_, t) => `<strong>${escapeHtml(t)}</strong>`);
    html = html.replace(/\*([^*]+)\*/g, (_, t) => `<em>${escapeHtml(t)}</em>`);
    html = html.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (_, linkText, href) => {
        const safeHref = /^https?:\/\//i.test(href) ? escapeHtml(href) : '#';
        return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${escapeHtml(linkText)}</a>`;
      }
    );

    html = html
      .split('\n\n')
      .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
      .join('');
    return html;
  } catch (err) {
    console.warn('[HyperAgent] renderMarkdown failed', err);
    return escapeHtml(text);
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function scrollToBottom() {
  components.chatHistory.scrollTop = components.chatHistory.scrollHeight;
}

function updateStatus(text: string, stateClass: string = 'active') {
  components.statusBar.classList.remove('hidden');
  components.statusText.textContent = text;
  if (stateClass === 'hidden') components.statusBar.classList.add('hidden');
}

function updateStepper(stepId: string) {
  components.steps.forEach(s => {
    s.classList.toggle('active', (s as HTMLElement).dataset.step === stepId);
  });
}

function handleCommand(text: string) {
  const cmd = sanitizeInput(text).trim();

  // Match slash commands — exact match first, then prefix match for commands with args
  const slashKey = Object.keys(SLASH_COMMANDS).find(
    k => cmd === k || cmd.startsWith(k + ' ')
  ) as keyof typeof SLASH_COMMANDS | undefined;

  if (slashKey) {
    SLASH_COMMANDS[slashKey]();
    components.commandInput.value = '';
    return;
  }

  // Rate limiting check
  const now = Date.now();
  if (now - state.lastCommandTime < COMMAND_RATE_LIMIT_MS) {
    addMessage('Please wait before sending another command.', 'status');
    return;
  }

  if (state.isRunning) return;

  state.lastCommandTime = now;
  saveCommandToHistory(cmd);
  state.historyIndex = -1;
  addMessage(cmd, 'user');
  components.commandInput.value = '';
  components.commandInput.style.height = '';
  setRunning(true);
  switchTab('chat');
  updateStatus('Orchestrating AI...', 'active');

  chrome.runtime.sendMessage({ type: 'executeCommand', command: cmd } as ExtensionMessage);
}

function executeAutonomousCommand(cmd: string) {
  if (state.isRunning) return;
  addMessage(cmd, 'user');
  components.commandInput.value = '';
  components.commandInput.style.height = '';
  setRunning(true);
  switchTab('chat');
  updateStatus('Analyzing with Swarm...', 'active');
  updateStepper('plan');

  chrome.runtime.sendMessage({
    type: 'executeCommand',
    command: cmd,
    useAutonomous: true,
  } as any);
}

function setRunning(running: boolean) {
  state.isRunning = running;
  components.btnExecute.classList.toggle('hidden', running);
  components.btnStop.classList.toggle('hidden', !running);
  components.commandInput.disabled = running;

  if (running) {
    showLoading('Processing your command...');
  } else {
    hideLoading();
    updateStatus('Ready', 'success');
    updateStepper('');
    setTimeout(() => updateStatus('', 'hidden'), 3000);
  }
}

// ─── Persistence ────────────────────────────────────────────────
async function saveHistoryImmediate() {
  try {
    const historyHTML = components.chatHistory.innerHTML;
    await chrome.storage.local.set({ chat_history_backup: historyHTML });
  } catch (err) {
    console.warn('[HyperAgent] Failed to save chat history:', err);
  }
}
const saveHistory = debounce(saveHistoryImmediate, 500);

// Flush pending save on close/hide to prevent data loss (single handler)
const flushHistoryOnHide = () => {
  if (document.visibilityState === 'hidden') saveHistoryImmediate();
};
document.addEventListener('visibilitychange', flushHistoryOnHide);
window.addEventListener('beforeunload', () => saveHistoryImmediate());

async function loadHistory() {
  try {
    const data = await chrome.storage.local.get('chat_history_backup');
    if (data.chat_history_backup && typeof data.chat_history_backup === 'string') {
      const result = inputSanitizer.sanitize(data.chat_history_backup, {
        allowHtml: true,
        allowedTags: ['p', 'br', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li', 'a', 'div', 'span'],
        allowedAttributes: ['href', 'class', 'target', 'rel', 'title', 'alt'],
      });
      components.chatHistory.innerHTML = result.sanitizedValue;
      scrollToBottom();
    }
  } catch (err) {
    console.warn('[HyperAgent] Failed to load chat history:', err);
  }
}

// (visibilitychange handled above via flushHistoryOnHide)

// ─── Command History ──────────────────────────────────────────────
async function loadCommandHistory() {
  const data = await chrome.storage.local.get('command_history');
  if (data.command_history && Array.isArray(data.command_history)) {
    state.commandHistory = data.command_history;
  }
}

async function saveCommandToHistory(command: string) {
  if (!command.trim()) return;

  // Avoid duplicates - remove if exists, then add to front
  state.commandHistory = state.commandHistory.filter(c => c !== command);
  state.commandHistory.unshift(command);

  // Keep only last 50 commands
  state.commandHistory = state.commandHistory.slice(0, 50);

  await chrome.storage.local.set({ command_history: state.commandHistory });
}

function navigateHistory(direction: 'up' | 'down'): string | null {
  if (state.commandHistory.length === 0) return null;

  if (direction === 'up') {
    state.historyIndex = Math.min(state.historyIndex + 1, state.commandHistory.length - 1);
  } else {
    state.historyIndex = Math.max(state.historyIndex - 1, -1);
    if (state.historyIndex === -1) return '';
  }

  return state.commandHistory[state.historyIndex] || null;
}

let selectedBillingInterval: 'month' | 'year' = 'month';

async function updateUsageDisplay() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'getUsage' });
    if (!response?.usage) return;
    const { actions, sessions } = response.usage;
    const { actions: limitActions, sessions: limitSessions, tier } = response.limits;

    // Update text
    const actionsLabel = limitActions === -1 ? `${actions} / ∞` : `${actions} / ${limitActions}`;
    const sessionsLabel = limitSessions === -1 ? `${sessions} / ∞` : `${sessions} / ${limitSessions}`;
    components.usageActions.textContent = actionsLabel;
    components.usageSessions.textContent = sessionsLabel;
    components.usageTier.textContent = tier.charAt(0).toUpperCase() + tier.slice(1);

    // Update progress bars
    const actionsProgress = document.getElementById('actions-progress');
    const sessionsProgress = document.getElementById('sessions-progress');
    if (actionsProgress) {
      const pct = limitActions === -1 ? 0 : Math.min(100, (actions / limitActions) * 100);
      actionsProgress.style.width = `${pct}%`;
      actionsProgress.className = `progress-bar-fill${pct > 90 ? ' danger' : pct > 70 ? ' warning' : ''}`;
    }
    if (sessionsProgress) {
      const pct = limitSessions === -1 ? 0 : Math.min(100, (sessions / limitSessions) * 100);
      sessionsProgress.style.width = `${pct}%`;
      sessionsProgress.className = `progress-bar-fill${pct > 90 ? ' danger' : pct > 70 ? ' warning' : ''}`;
    }

    // Update banner
    const banner = document.getElementById('current-plan-banner');
    const bannerTier = document.getElementById('banner-tier');
    const bannerBadge = document.getElementById('banner-badge');
    if (banner) {
      banner.className = `plan-banner ${tier}`;
    }
    if (bannerTier) {
      bannerTier.textContent = `${tier.charAt(0).toUpperCase() + tier.slice(1)} Plan`;
    }
    if (bannerBadge) {
      bannerBadge.textContent = 'Active';
    }

    // Update plan card buttons based on current tier
    const freePlanBtn = document.getElementById('btn-plan-free') as HTMLButtonElement;
    const premiumBtn = document.getElementById('btn-upgrade-premium') as HTMLButtonElement;
    const unlimitedBtn = document.getElementById('btn-upgrade-unlimited') as HTMLButtonElement;
    const cancelBtn = document.getElementById('btn-cancel-subscription');

    if (freePlanBtn) {
      if (tier === 'free') {
        freePlanBtn.textContent = 'Current Plan';
        freePlanBtn.className = 'plan-btn current';
        freePlanBtn.disabled = true;
      } else {
        freePlanBtn.textContent = 'Downgrade';
        freePlanBtn.className = 'plan-btn manage';
        freePlanBtn.disabled = false;
      }
    }
    if (premiumBtn) {
      if (tier === 'premium') {
        premiumBtn.textContent = 'Current Plan';
        premiumBtn.className = 'plan-btn current';
        premiumBtn.disabled = true;
      } else if (tier === 'unlimited') {
        premiumBtn.textContent = 'Downgrade';
        premiumBtn.className = 'plan-btn manage';
        premiumBtn.disabled = false;
      } else {
        premiumBtn.textContent = 'Upgrade to Premium';
        premiumBtn.className = 'plan-btn upgrade';
        premiumBtn.disabled = false;
      }
    }
    if (unlimitedBtn) {
      if (tier === 'unlimited') {
        unlimitedBtn.textContent = 'Current Plan';
        unlimitedBtn.className = 'plan-btn current';
        unlimitedBtn.disabled = true;
      } else {
        unlimitedBtn.textContent = 'Upgrade to Unlimited';
        unlimitedBtn.className = 'plan-btn upgrade';
        unlimitedBtn.disabled = false;
      }
    }
    if (cancelBtn) {
      cancelBtn.classList.toggle('hidden', tier === 'free');
    }
  } catch (err) {
    console.warn('[HyperAgent] Failed to update usage display:', err);
  }
}

interface MarketplaceWorkflow {
  id: string;
  name: string;
  description: string;
  price: string;
  category: string;
  tier: 'free' | 'premium' | 'unlimited';
  rating: number;
  installs: string;
  icon: string;
}

const MARKETPLACE_WORKFLOWS: MarketplaceWorkflow[] = [
  { id: 'web-scraper', name: 'Web Scraper Pro', description: 'Extract structured data from any webpage with CSS selectors and pagination support', price: 'Free', category: 'data', tier: 'free', rating: 4.8, installs: '12.3k', icon: '🔍' },
  { id: 'form-filler', name: 'Smart Form Filler', description: 'Auto-fill forms using stored profiles with intelligent field matching', price: 'Free', category: 'productivity', tier: 'free', rating: 4.6, installs: '8.7k', icon: '📝' },
  { id: 'price-tracker', name: 'Price Tracker', description: 'Monitor product prices across e-commerce sites and alert on drops', price: 'Free', category: 'data', tier: 'free', rating: 4.7, installs: '15.1k', icon: '💰' },
  { id: 'email-automation', name: 'Email Outreach', description: 'Send personalized emails in bulk with templates and tracking', price: 'Premium', category: 'communication', tier: 'premium', rating: 4.5, installs: '5.2k', icon: '✉️' },
  { id: 'social-media-poster', name: 'Social Publisher', description: 'Schedule and post content to Twitter, LinkedIn, and Facebook', price: 'Premium', category: 'marketing', tier: 'premium', rating: 4.4, installs: '3.8k', icon: '📱' },
  { id: 'invoice-processor', name: 'Invoice Extractor', description: 'Extract line items, totals, and dates from invoice PDFs', price: 'Premium', category: 'business', tier: 'premium', rating: 4.9, installs: '6.4k', icon: '🧾' },
  { id: 'seo-auditor', name: 'SEO Auditor', description: 'Comprehensive on-page SEO analysis with actionable recommendations', price: 'Premium', category: 'marketing', tier: 'premium', rating: 4.3, installs: '4.1k', icon: '📊' },
  { id: 'lead-generator', name: 'Lead Generator', description: 'Extract business contacts from directories and social profiles', price: 'Premium', category: 'business', tier: 'premium', rating: 4.6, installs: '7.9k', icon: '🎯' },
  { id: 'competitor-monitor', name: 'Competitor Monitor', description: 'Track competitor pricing, content changes, and new features', price: 'Unlimited', category: 'business', tier: 'unlimited', rating: 4.7, installs: '2.1k', icon: '👁️' },
  { id: 'data-pipeline', name: 'Data Pipeline', description: 'ETL workflows: extract, transform, and load data across platforms', price: 'Unlimited', category: 'data', tier: 'unlimited', rating: 4.8, installs: '1.5k', icon: '🔄' },
  { id: 'report-generator', name: 'Report Generator', description: 'Auto-generate weekly reports from multiple data sources', price: 'Premium', category: 'productivity', tier: 'premium', rating: 4.5, installs: '3.3k', icon: '📈' },
  { id: 'tab-organizer', name: 'Tab Organizer', description: 'Automatically group, sort, and manage browser tabs by project', price: 'Free', category: 'productivity', tier: 'free', rating: 4.2, installs: '9.4k', icon: '🗂️' },
];

let activeCategory = 'all';
let searchQuery = '';
let marketplaceListenersAttached = false;
let installedWorkflowIds: Set<string> = new Set();

async function loadMarketplace() {
  // Load installed workflows from background
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'getInstalledWorkflows' });
    if (resp?.ok && Array.isArray(resp.workflows)) {
      installedWorkflowIds = new Set(resp.workflows);
    }
  } catch {}

  renderMarketplaceWorkflows();

  if (marketplaceListenersAttached) return;
  marketplaceListenersAttached = true;

  const searchInput = document.getElementById('marketplace-search-input') as HTMLInputElement;
  if (searchInput) {
    searchInput.addEventListener('input', debounce(() => {
      searchQuery = searchInput.value.toLowerCase().trim();
      renderMarketplaceWorkflows();
    }, 200));
  }

  document.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = (btn as HTMLElement).dataset.category || 'all';
      renderMarketplaceWorkflows();
    });
  });
}

function renderMarketplaceWorkflows() {
  let filtered = MARKETPLACE_WORKFLOWS;

  if (activeCategory !== 'all') {
    filtered = filtered.filter(w => w.category === activeCategory);
  }
  if (searchQuery) {
    filtered = filtered.filter(w =>
      w.name.toLowerCase().includes(searchQuery) ||
      w.description.toLowerCase().includes(searchQuery)
    );
  }

  components.marketplaceList.innerHTML = '';

  if (filtered.length === 0) {
    components.marketplaceList.innerHTML = '<p class="empty-state">No workflows found matching your criteria.</p>';
    return;
  }

  filtered.forEach(workflow => {
    const currentTier = billingManager.getTier();
    const tierOrder = { free: 0, premium: 1, unlimited: 2 };
    const canInstall = tierOrder[currentTier] >= tierOrder[workflow.tier];
    const isInstalled = installedWorkflowIds.has(workflow.id);
    const stars = '★'.repeat(Math.floor(workflow.rating)) + (workflow.rating % 1 >= 0.5 ? '½' : '');

    let btnLabel: string;
    let btnClass: string;
    let btnDisabled = '';
    if (isInstalled) {
      btnLabel = '✓ Installed';
      btnClass = 'install-btn installed';
      btnDisabled = 'disabled';
    } else if (!canInstall) {
      btnLabel = '🔒 Upgrade to ' + workflow.tier.charAt(0).toUpperCase() + workflow.tier.slice(1);
      btnClass = 'install-btn locked';
    } else {
      btnLabel = 'Install';
      btnClass = 'install-btn';
    }

    const card = document.createElement('div');
    card.className = `workflow-card${!canInstall && !isInstalled ? ' locked' : ''}`;
    card.innerHTML = `
      <div class="workflow-card-header">
        <span class="workflow-icon">${workflow.icon}</span>
        <div class="workflow-title-group">
          <h4>${escapeHtml(workflow.name)}</h4>
          <span class="workflow-tier-badge ${workflow.tier}">${workflow.price}</span>
        </div>
      </div>
      <p class="workflow-desc">${escapeHtml(workflow.description)}</p>
      <div class="workflow-meta">
        <span class="workflow-rating" title="${workflow.rating}/5">${stars} ${workflow.rating}</span>
        <span class="workflow-installs">${workflow.installs} installs</span>
      </div>
      <button class="${btnClass}" data-workflow-id="${workflow.id}" ${btnDisabled}>
        ${btnLabel}
      </button>
    `;
    components.marketplaceList.appendChild(card);
  });

  components.marketplaceList.querySelectorAll('.install-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const target = e.target as HTMLElement;
      const workflowId = target.dataset.workflowId;
      if (!workflowId) return;

      if (target.classList.contains('locked')) {
        switchTab('subscription');
        showToast('Upgrade required for this workflow', 'warning');
        return;
      }

      installWorkflow(workflowId);
    });
  });
}

async function installWorkflow(workflowId: string) {
  addMessage(`Installing workflow: ${workflowId}...`, 'status');

  try {
    const response = await chrome.runtime.sendMessage({ type: 'installWorkflow', workflowId });
    if (response?.ok) {
      installedWorkflowIds.add(workflowId);
      addMessage(`Workflow "${escapeHtml(workflowId)}" installed successfully!`, 'agent');
      showToast('Workflow installed', 'success');
      renderMarketplaceWorkflows();
    } else {
      addMessage(`Failed to install workflow: ${escapeHtml(response?.error || 'Unknown error')}`, 'error');
    }
  } catch (err) {
    addMessage('Failed to install workflow: connection error', 'error');
  }
}

// ─── Memory Tab ────────────────────────────────────────────────
async function loadMemoryTab() {
  const memoryList = document.getElementById('memory-list');
  const memoryStats = document.getElementById('memory-stats');

  if (!memoryList || !memoryStats) return;

  try {
    const response = await chrome.runtime.sendMessage({ type: 'getMemoryStats' });

    if (response) {
      memoryStats.textContent = `${response.domainsCount || 0} domains tracked, ${response.totalActions || 0} actions logged`;

      if (response.strategies && Object.keys(response.strategies).length > 0) {
        memoryList.innerHTML = '';

        for (const [domain, strategy] of Object.entries(response.strategies)) {
          const card = document.createElement('div');
          card.className = 'memory-card';
          const s = strategy as any;
          const successCount = Number(s.successfulLocators?.length) || 0;
          const failedCount = Number(s.failedLocators?.length) || 0;
          const lastUsedStr = s.lastUsed ? new Date(s.lastUsed).toLocaleDateString() : 'Never';
          card.innerHTML = `
            <div class="memory-domain">${escapeHtml(domain)}</div>
            <div class="memory-stats-row">
              <span>Success: ${successCount}</span>
              <span>Failed: ${failedCount}</span>
            </div>
            <div class="memory-last-used">Last used: ${escapeHtml(lastUsedStr)}</div>
          `;
          memoryList.appendChild(card);
        }
      } else {
        memoryList.innerHTML =
          '<p class="empty-state">No memory data yet. The agent learns from your interactions.</p>';
      }
    }
  } catch (err) {
    memoryList.innerHTML = '<p class="error-state">Failed to load memory data</p>';
  }
}

// ─── Tasks Tab ────────────────────────────────────────────────
let tasksListenersAttached = false;
async function loadTasksTab() {
  const tasksList = document.getElementById('tasks-list');
  if (!tasksList) return;

  const addTaskBtn = document.getElementById('btn-add-task-ui');
  if (addTaskBtn && !tasksListenersAttached) {
    tasksListenersAttached = true;
    addTaskBtn.addEventListener('click', () => {
      switchTab('chat');
      components.commandInput.value = '';
      components.commandInput.placeholder = 'e.g. schedule daily search for news';
      components.commandInput.focus();
    });
  }

  try {
    const response = await chrome.runtime.sendMessage({ type: 'getScheduledTasks' });

    if (response?.tasks && response.tasks.length > 0) {
      tasksList.innerHTML = '';

      response.tasks.forEach((task: any) => {
        const item = document.createElement('div');
        item.className = 'task-item';
        const safeId = escapeHtml(String(task.id || ''));
        item.innerHTML = `
          <div class="task-header">
            <span class="task-name">${escapeHtml(task.name || 'Unnamed')}</span>
            <span class="task-status ${task.enabled ? 'enabled' : 'disabled'}">${task.enabled ? 'Active' : 'Paused'}</span>
          </div>
          <div class="task-command">${escapeHtml(task.command || '')}</div>
          <div class="task-schedule">${escapeHtml(formatSchedule(task.schedule))}</div>
          <div class="task-next-run">Next: ${task.nextRun ? escapeHtml(new Date(task.nextRun).toLocaleString()) : 'Not scheduled'}</div>
          <div class="task-actions">
            <button class="btn-small" data-task-id="${safeId}" data-action="toggle">${task.enabled ? 'Pause' : 'Enable'}</button>
            <button class="btn-small btn-danger" data-task-id="${safeId}" data-action="delete">Delete</button>
          </div>
        `;
        tasksList.appendChild(item);
      });

      tasksList.querySelectorAll('.btn-small').forEach(btn => {
        btn.addEventListener('click', e => {
          const target = e.target as HTMLButtonElement;
          const taskId = target.dataset.taskId;
          const action = target.dataset.action;
          handleTaskAction(taskId, action);
        });
      });
    } else {
      tasksList.innerHTML = `
        <p class="empty-state">No scheduled tasks.</p>
        <p class="hint">Use commands like "schedule daily search for news" to create tasks.</p>
      `;
    }
  } catch (err) {
    tasksList.innerHTML = '<p class="error-state">Failed to load tasks</p>';
  }
}

function formatSchedule(schedule: any): string {
  if (!schedule) return 'Unknown';

  switch (schedule.type) {
    case 'once':
      return `Once at ${new Date(schedule.time).toLocaleString()}`;
    case 'interval':
      return `Every ${schedule.intervalMinutes} minutes`;
    case 'daily':
      return 'Daily';
    case 'weekly':
      return `Weekly on ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][schedule.dayOfWeek || 0]}`;
    default:
      return 'Custom schedule';
  }
}

async function handleTaskAction(taskId: string | undefined, action: string | undefined) {
  if (!taskId || !action) return;

  if (action === 'toggle') {
    await chrome.runtime.sendMessage({ type: 'toggleScheduledTask', taskId });
    loadTasksTab();
  } else if (action === 'delete') {
    await chrome.runtime.sendMessage({ type: 'deleteScheduledTask', taskId });
    loadTasksTab();
  }
}

// ─── Vision Tab ────────────────────────────────────────────────
let visionListenersAttached = false;
function loadVisionTab() {
  const visionContainer = document.getElementById('vision-container');
  const visionOverlays = document.getElementById('vision-overlays');

  if (!visionContainer || !visionOverlays) return;

  if (components.visionSnapshot.src && components.visionSnapshot.src !== '') {
    components.visionSnapshot.classList.remove('hidden');
    components.visionPlaceholder.classList.add('hidden');
  }

  visionOverlays.innerHTML = `
    <div class="vision-controls">
      <button id="btn-capture-vision" class="btn-secondary">Capture Screenshot</button>
      <button id="btn-analyze-vision" class="btn-secondary">Analyze Page</button>
    </div>
    <div class="vision-info">
      <p>Vision mode captures screenshots for AI analysis when DOM extraction fails.</p>
      <p>Enable in settings for automatic fallback on sparse pages.</p>
    </div>
  `;

  if (visionListenersAttached) return;
  visionListenersAttached = true;

  const captureBtn = document.getElementById('btn-capture-vision');
  if (captureBtn) {
    captureBtn.addEventListener('click', async () => {
      try {
        const response = await chrome.runtime.sendMessage({ type: 'captureScreenshot' });
        if (response?.dataUrl && components.visionSnapshot) {
          components.visionSnapshot.src = `data:image/jpeg;base64,${response.dataUrl}`;
          components.visionSnapshot.classList.remove('hidden');
          components.visionPlaceholder.classList.add('hidden');
          addMessage('Screenshot captured for analysis.', 'status');
        }
      } catch (err) {
        addMessage('Failed to capture screenshot.', 'error');
      }
    });
  }
  const analyzeBtn = document.getElementById('btn-analyze-vision');
  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', () => {
      switchTab('chat');
      components.commandInput.value = 'Analyze this page and describe what you see.';
      components.commandInput.focus();
    });
  }
}

// ─── Swarm Tab ───────────────────────────────────────────────────
let swarmListenersAttached = false;
async function loadSwarmTab() {
  const swarmState = document.getElementById('swarm-state');
  const missionsCompleted = document.getElementById('missions-completed');
  const swarmSuccessRate = document.getElementById('swarm-success-rate');
  const activeMissions = document.getElementById('active-missions');
  const recoveredTasks = document.getElementById('recovered-tasks');
  const snapshotsList = document.getElementById('snapshots-list');

  try {
    // Get swarm status
    const swarmResponse = await chrome.runtime.sendMessage({ type: 'getSwarmStatus' });
    if (swarmResponse?.ok && swarmState) {
      swarmState.textContent = swarmResponse.status?.initialized ? 'Active' : 'Initializing...';
    }

    // Get global learning stats
    const statsResponse = await chrome.runtime.sendMessage({ type: 'getGlobalLearningStats' });
    if (statsResponse?.ok && statsResponse.stats) {
      const stats = statsResponse.stats;
      if (missionsCompleted) missionsCompleted.textContent = stats.totalPatterns || '0';
      if (swarmSuccessRate)
        swarmSuccessRate.textContent = `${Math.round((stats.avgSuccessRate || 0) * 100)}%`;
    }

    // Get snapshots
    const snapshotsResponse = await chrome.runtime.sendMessage({ type: 'listSnapshots' });
    if (snapshotsResponse?.ok && snapshotsResponse.snapshots && snapshotsList) {
      if (snapshotsResponse.snapshots.length > 0) {
        snapshotsList.innerHTML = '';
        snapshotsResponse.snapshots.slice(0, 5).forEach((snapshot: any) => {
          const item = document.createElement('div');
          item.className = 'snapshot-item';
          const safeTaskId = escapeHtml(String(snapshot.taskId || ''));
          const safeCmd = escapeHtml((snapshot.command || 'Unknown mission').substring(0, 50));
          const step = Number(snapshot.currentStep) || 0;
          const total = Number(snapshot.totalSteps) || 0;
          const timeStr = snapshot.timestamp ? new Date(snapshot.timestamp).toLocaleString() : '';
          item.innerHTML = `
            <div class="snapshot-command">${safeCmd}...</div>
            <div class="snapshot-meta">
              <span>Step ${step}/${total}</span>
              <span>${escapeHtml(timeStr)}</span>
            </div>
            <div class="snapshot-actions">
              <button class="btn-small btn-resume" data-task-id="${safeTaskId}">Resume</button>
              <button class="btn-small btn-danger btn-delete-snapshot" data-task-id="${safeTaskId}">Delete</button>
            </div>
          `;
          snapshotsList.appendChild(item);
        });

        // Attach click handlers for Resume and Delete
        snapshotsList.querySelectorAll('.btn-resume').forEach(btn => {
          btn.addEventListener('click', async () => {
            const taskId = (btn as HTMLButtonElement).dataset.taskId;
            if (taskId) {
              const resp = await chrome.runtime.sendMessage({ type: 'resumeSnapshot', taskId });
              if (resp?.ok) {
                showToast('Resuming mission...', 'success');
                loadSwarmTab();
              } else {
                showToast(resp?.error || 'Failed to resume', 'error');
              }
            }
          });
        });
        snapshotsList.querySelectorAll('.btn-delete-snapshot').forEach(btn => {
          btn.addEventListener('click', async () => {
            const taskId = (btn as HTMLButtonElement).dataset.taskId;
            if (taskId) {
              const resp = await chrome.runtime.sendMessage({ type: 'clearSnapshot', taskId });
              if (resp?.ok) {
                showToast('Mission deleted', 'success');
                loadSwarmTab();
              } else {
                showToast(resp?.error || 'Failed to delete', 'error');
              }
            }
          });
        });

        // Count recovered tasks
        if (recoveredTasks) {
          recoveredTasks.textContent = snapshotsResponse.snapshots.length;
        }
      } else {
        snapshotsList.innerHTML = '<p class="empty-state">No saved missions.</p>';
      }
    }

    // Active missions (from agent status)
    const agentResponse = await chrome.runtime.sendMessage({ type: 'getAgentStatus' });
    if (agentResponse?.ok && activeMissions) {
      activeMissions.textContent = agentResponse.status?.isRunning ? '1' : '0';
    }
  } catch (err) {
    console.warn('[HyperAgent] Failed to load swarm tab:', err);
  }

  if (swarmListenersAttached) return;
  swarmListenersAttached = true;

  const clearBtn = document.getElementById('btn-clear-snapshots');
  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      const confirmed = confirm('Clear all saved missions?');
      if (confirmed) {
        const response = await chrome.runtime.sendMessage({ type: 'clearSnapshot' });
        if (response?.ok) {
          showToast('All missions cleared', 'success');
          loadSwarmTab();
        }
      }
    });
  }
}

// ─── Event Listeners ────────────────────────────────────────────
components.btnExecute.addEventListener('click', () => {
  const text = components.commandInput.value;
  if (text.trim()) handleCommand(text);
});

components.btnStop.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'stopAgent' });
  addMessage('Stopping...', 'status');
  setRunning(false);
});

components.commandInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const text = components.commandInput.value;
    if (text.trim()) handleCommand(text);
  }
});

const handleInput = debounce((e: Event) => {
  const target = e.target as HTMLTextAreaElement;

  // Enforce max length
  if (target.value.length > MAX_COMMAND_LENGTH) {
    target.value = target.value.slice(0, MAX_COMMAND_LENGTH);
  }

  // Auto-resize with max-height
  target.style.height = 'auto';
  const newHeight = Math.min(target.scrollHeight, 200); // Cap at 200px
  target.style.height = newHeight + 'px';
  target.style.overflowY = target.scrollHeight > 200 ? 'auto' : 'hidden';

  updateCharCounter(target.value);

  const val = target.value;
  if (val.startsWith('/')) showSuggestions(val);
  else components.suggestions.classList.add('hidden');
}, 100);

components.commandInput.addEventListener('input', e => {
  // Immediate resize for better feel, logic in debounce handles suggestions
  const target = e.target as HTMLTextAreaElement;
  if (target.value.length > MAX_COMMAND_LENGTH) {
    target.value = target.value.slice(0, MAX_COMMAND_LENGTH);
  }

  target.style.height = 'auto';
  const newHeight = Math.min(target.scrollHeight, 200);
  target.style.height = newHeight + 'px';
  target.style.overflowY = target.scrollHeight > 200 ? 'auto' : 'hidden';

  updateCharCounter(target.value);

  handleInput(e);
});

// Keyboard navigation for command history
components.commandInput.addEventListener('keydown', e => {
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    const historyCmd = navigateHistory('up');
    if (historyCmd !== null) {
      components.commandInput.value = historyCmd;
      updateCharCounter(historyCmd);
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    const historyCmd = navigateHistory('down');
    if (historyCmd !== null) {
      components.commandInput.value = historyCmd;
      updateCharCounter(historyCmd);
    }
  }
});

// Load history on start
loadHistory();
loadCommandHistory();

components.btnSettings.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// Dark mode toggle
const btnDarkMode = document.getElementById('btn-dark-mode');
if (btnDarkMode) {
  btnDarkMode.addEventListener('click', () => {
    toggleDarkMode();
    btnDarkMode.textContent = document.body.classList.contains('dark-mode') ? '☀️' : '🌙';
  });
  // Set initial icon
  if (document.body.classList.contains('dark-mode')) {
    btnDarkMode.textContent = '☀️';
  }
}

// Global keyboard shortcuts
document.addEventListener('keydown', e => {
  // Ctrl/Cmd + L: Clear chat
  if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
    e.preventDefault();
    SLASH_COMMANDS['/clear']();
  }
  // Ctrl/Cmd + S: Open settings
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  }
  // Escape: Close modals and suggestions
  if (e.key === 'Escape') {
    components.confirmModal.classList.add('hidden');
    components.askModal.classList.add('hidden');
    components.suggestions.classList.add('hidden');
    if (state.confirmResolve) {
      state.confirmResolve(false);
      state.confirmResolve = null;
    }
  }
});

// ─── Message Handler ────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message: any) => {
  // Validate message structure
  if (!message || typeof message !== 'object' || !message.type) return;

  switch (message.type) {
    case 'agentProgress': {
      if (typeof message.status === 'string') {
        updateStatus(message.status, 'active');
        setLoadingText(message.status);
      }
      if (typeof message.step === 'string') updateStepper(message.step);
      if (typeof message.summary === 'string') addMessage(message.summary, 'thinking');

      // Compute progress from status text "Step N/M" pattern, or use explicit progress
      if (typeof message.progress === 'number') {
        updateProgress(message.progress);
      } else if (typeof message.status === 'string') {
        const stepMatch = message.status.match(/Step\s+(\d+)\s*\/\s*(\d+)/i);
        if (stepMatch) {
          const pct = (parseInt(stepMatch[1], 10) / parseInt(stepMatch[2], 10)) * 100;
          updateProgress(Math.min(95, pct));
        }
      }

      // Live Trace: Display the physical actions the agent is taking
      if (Array.isArray(message.actionDescriptions) && message.actionDescriptions.length > 0) {
        const validDescriptions = message.actionDescriptions.filter(
          (d: any) => typeof d === 'string'
        );
        if (validDescriptions.length > 0) {
          const trace = validDescriptions.map((d: string) => `• ${d}`).join('\n');
          addMessage(`*Executing actions:* \n${trace}`, 'status');
        }
      }
      break;
    }
    case 'visionUpdate': {
      if (typeof message.screenshot === 'string' && message.screenshot.length > 0 && components.visionSnapshot) {
        const s = message.screenshot;
        components.visionSnapshot.src = s.startsWith('data:') ? s : `data:image/jpeg;base64,${s}`;
        components.visionSnapshot.classList.remove('hidden');
        components.visionPlaceholder.classList.add('hidden');
      }
      break;
    }
    case 'askUser': {
      const question =
        typeof message.question === 'string' ? message.question : 'Agent needs more information.';
      components.askQuestion.textContent = question;
      components.askModal.classList.remove('hidden');
      components.askReply.focus();
      break;
    }
    case 'confirmActions': {
      if (typeof message.summary !== 'string' || !Array.isArray(message.actions)) {
        console.warn('[HyperAgent] Invalid confirmActions message:', message);
        break;
      }

      components.confirmSummary.textContent = message.summary;

      // Build actions list
      if (message.actions.length > 0) {
        components.confirmList.innerHTML = '';
        message.actions.forEach((action: any) => {
          if (action && typeof action === 'object') {
            const li = document.createElement('li');
            const desc = (action as any).description || `${action.type} action`;
            li.textContent = typeof desc === 'string' ? desc : 'Unknown action';
            components.confirmList.appendChild(li);
          }
        });
      }

      components.confirmModal.classList.remove('hidden');

      // Resolve any orphaned previous confirmation before creating a new one
      if (state.confirmResolve) {
        state.confirmResolve(false);
        state.confirmResolve = null;
      }

      new Promise<boolean>(resolve => {
        state.confirmResolve = (val: boolean) => {
          resolve(val);
          state.confirmResolve = null;
        };
        // Auto-reject after 60s
        setTimeout(() => {
          if (state.confirmResolve) {
            state.confirmResolve(false);
          }
        }, 60000);
      })
        .then(confirmed => {
          // Ensure confirmed is boolean
          chrome.runtime.sendMessage({ type: 'confirmResponse', confirmed: !!confirmed });
          components.confirmModal.classList.add('hidden');
        })
        .catch(err => {
          console.error('Confirmation error:', err);
          components.confirmModal.classList.add('hidden');
        });
      break;
    }
    case 'agentDone': {
      const summary =
        typeof message.finalSummary === 'string' ? message.finalSummary : 'Task completed';
      const success = Boolean(message.success);
      addMessage(summary, success ? 'agent' : 'error');
      setRunning(false);
      break;
    }
    case 'contextMenuCommand': {
      if (typeof message.command === 'string') {
        components.commandInput.value = message.command;
        switchTab('chat');
        addMessage('Command received from context menu. Press Enter to run.', 'status');
        components.commandInput.focus();
        components.commandInput.dispatchEvent(new Event('input'));
      }
      break;
    }
    case 'agentError': {
      const error = typeof message.error === 'string' ? message.error : 'Unknown error';
      addMessage(error, 'error');
      setRunning(false);
      break;
    }
    default:
      break;
  }
});

// ─── Voice Interface ────────────────────────────────────────────
import { VoiceInterface } from '../../shared/voice-interface';
let lastFinalVoiceText = '';
let voiceInterface = new VoiceInterface({
  onStart: () => {
    lastFinalVoiceText = '';
    components.btnMic.classList.add('active');
    components.commandInput.placeholder = 'Listening...';
  },
  onEnd: () => {
    components.btnMic.classList.remove('active');
    components.commandInput.placeholder = 'Type a command...';
    // Only execute if we received a final transcription (avoids partial/interim text)
    const text = lastFinalVoiceText.trim();
    if (text) handleCommand(text);
  },
  onResult: (text, isFinal) => {
    components.commandInput.value = text;
    if (isFinal) {
      lastFinalVoiceText = text;
      updateCharCounter(text);
    }
  },
});

// Mic button toggle
components.btnMic.addEventListener('click', () => {
  try {
    if (voiceInterface.isListening) {
      voiceInterface.stopListening();
    } else {
      voiceInterface.startListening();
    }
  } catch (err) {
    console.warn('[HyperAgent] Voice interface error:', err);
    showToast('Voice input not available in this browser', 'error');
  }
});

components.btnUpgradePremium.addEventListener('click', async () => {
  await billingManager.openCheckout('premium', selectedBillingInterval);
  addMessage(`Redirecting to Stripe checkout for Premium (${selectedBillingInterval}ly)...`, 'status');
  showToast('Opening Stripe checkout...', 'info');
});

components.btnUpgradeUnlimited.addEventListener('click', async () => {
  await billingManager.openCheckout('unlimited', selectedBillingInterval);
  addMessage(`Redirecting to Stripe checkout for Unlimited (${selectedBillingInterval}ly)...`, 'status');
  showToast('Opening Stripe checkout...', 'info');
});

// Billing interval toggle
document.querySelectorAll('.interval-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.interval-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedBillingInterval = (btn as HTMLElement).dataset.interval as 'month' | 'year';
    updatePricingDisplay();
  });
});

function updatePricingDisplay() {
  const premiumPrice = document.getElementById('premium-price');
  const premiumPeriod = document.getElementById('premium-period');
  const unlimitedPrice = document.getElementById('unlimited-price');
  const unlimitedPeriod = document.getElementById('unlimited-period');

  if (selectedBillingInterval === 'year') {
    if (premiumPrice) premiumPrice.textContent = '$190';
    if (premiumPeriod) premiumPeriod.textContent = '/year';
    if (unlimitedPrice) unlimitedPrice.textContent = '$490';
    if (unlimitedPeriod) unlimitedPeriod.textContent = '/year';
  } else {
    if (premiumPrice) premiumPrice.textContent = '$19';
    if (premiumPeriod) premiumPeriod.textContent = '/month';
    if (unlimitedPrice) unlimitedPrice.textContent = '$49';
    if (unlimitedPeriod) unlimitedPeriod.textContent = '/month';
  }
}

// License key activation
const licenseInput = document.getElementById('license-key-input') as HTMLInputElement;
const licenseBtn = document.getElementById('btn-activate-license');
const licenseStatus = document.getElementById('license-status');

if (licenseBtn && licenseInput) {
  licenseBtn.addEventListener('click', async () => {
    const key = licenseInput.value.trim();
    if (!key) {
      if (licenseStatus) {
        licenseStatus.textContent = 'Please enter a license key';
        licenseStatus.className = 'license-status error';
        licenseStatus.classList.remove('hidden');
      }
      return;
    }

    const result = await billingManager.activateWithLicenseKey(key);
    if (licenseStatus) {
      if (result.success) {
        licenseStatus.textContent = 'License activated successfully! Refreshing...';
        licenseStatus.className = 'license-status success';
        showToast('License activated!', 'success');
        setTimeout(() => updateUsageDisplay(), 500);
      } else {
        licenseStatus.textContent = result.error || 'Activation failed';
        licenseStatus.className = 'license-status error';
      }
      licenseStatus.classList.remove('hidden');
    }
  });
}

// Cancel subscription
const cancelSubBtn = document.getElementById('btn-cancel-subscription');
if (cancelSubBtn) {
  cancelSubBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to cancel? You will keep access until the end of your billing period.')) {
      await billingManager.cancelSubscription();
      showToast('Subscription will be canceled at end of period', 'info');
      updateUsageDisplay();
    }
  });
}

// Init
addMessage('**HyperAgent Dashboard Initialized.** Ready for commands.', 'agent');
switchTab('chat');
updateCharCounter(components.commandInput.value || '');
updateSubscriptionBadge();

// ─── Subscription Badge ───────────────────────────────────────────
async function updateSubscriptionBadge() {
  try {
    await billingManager.initialize();
    const status = billingManager.getState();
    const badge = components.subscriptionBadge;
    if (!badge) return;

    badge.textContent = status.tier.charAt(0).toUpperCase() + status.tier.slice(1);
    badge.className = `subscription-badge ${status.tier}`;

    if (status.tier === 'free') {
      badge.classList.add('free');
    }
  } catch (err) {
    console.warn('[HyperAgent] Failed to update subscription badge:', err);
  }
}

// ─── Toast Notifications ──────────────────────────────────────────
function showToast(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') {
  if (!components.toastContainer) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-message">${escapeHtml(message)}</span>
    <button class="toast-close">&times;</button>
  `;

  components.toastContainer.appendChild(toast);

  const closeBtn = toast.querySelector('.toast-close');
  closeBtn?.addEventListener('click', () => {
    toast.remove();
  });

  setTimeout(() => {
    toast.classList.add('toast-fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

// ─── Dark Mode ────────────────────────────────────────────────────
async function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark-mode');
  await chrome.storage.local.set({ dark_mode: isDark });
  showToast(`${isDark ? 'Dark' : 'Light'} mode enabled`, 'info');
}

async function initDarkMode() {
  const data = await chrome.storage.local.get('dark_mode');
  if (data.dark_mode) {
    document.body.classList.add('dark-mode');
    const btn = document.getElementById('btn-dark-mode');
    if (btn) btn.textContent = '☀️';
  }
}

initDarkMode();

// ─── Loading Overlay ──────────────────────────────────────────────
const loadingOverlay = document.getElementById('loading-overlay');
const progressFill = document.getElementById('progress-fill');
const progressPercent = document.getElementById('progress-percent');
const loadingText = document.querySelector('.loading-text');

function showLoading(text: string = 'Processing...') {
  if (loadingOverlay) {
    loadingOverlay.classList.remove('hidden');
    if (loadingText) loadingText.textContent = text;
    updateProgress(0);
  }
}

function hideLoading() {
  if (loadingOverlay) {
    loadingOverlay.classList.add('hidden');
  }
}

function updateProgress(percent: number) {
  const clampedPercent = Math.min(100, Math.max(0, percent));
  if (progressFill) {
    progressFill.style.width = `${clampedPercent}%`;
  }
  if (progressPercent) {
    progressPercent.textContent = `${Math.round(clampedPercent)}%`;
  }
}

function setLoadingText(text: string) {
  if (loadingText) loadingText.textContent = text;
}

// ─── Export/Import Settings ─────────────────────────────────────────
async function exportSettings() {
  try {
    const data = await chrome.storage.local.get(null);
    const exportData = {
      version: '1.0',
      timestamp: Date.now(),
      settings: {
        dark_mode: data.dark_mode,
        command_history: data.command_history,
        chat_history_backup: data.chat_history_backup,
        hyperagent_site_strategies: data.hyperagent_site_strategies,
      },
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hyperagent-settings-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('Settings exported successfully!', 'success');
  } catch (err) {
    showToast('Failed to export settings', 'error');
    console.error('[HyperAgent] Export error:', err);
  }
}

async function importSettings() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';

  input.onchange = async e => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.version || !data.settings) {
        throw new Error('Invalid settings file format');
      }

      const { filtered, errors } = validateAndFilterImportData(data.settings);
      if (Object.keys(filtered).length === 0) {
        throw new Error('No valid settings to import');
      }
      if (errors.length > 0) {
        console.warn('[HyperAgent] Import validation warnings:', errors);
      }
      await chrome.storage.local.set(filtered);
      showToast('Settings imported successfully!', 'success');

      // Reload to apply imported settings
      setTimeout(() => location.reload(), 1000);
    } catch (err) {
      showToast('Failed to import settings: Invalid file', 'error');
      console.error('[HyperAgent] Import error:', err);
    }
  };

  input.click();
}
