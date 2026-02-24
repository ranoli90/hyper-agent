/**
 * @fileoverview HyperAgent side panel UI.
 * Chat, commands, tabs (Swarm, Vision, Tasks, Memory, Marketplace, Subscription).
 */

import type { ExtensionMessage } from '../../shared/types';
import { billingManager } from '../../shared/billing';
import { validateAndFilterImportData, STORAGE_KEYS } from '../../shared/config';
import { inputSanitizer } from '../../shared/input-sanitization';
import { debounce } from '../../shared/utils';

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
  usageTier: safeGetElement<HTMLElement>('usage-tier')!,
  marketplaceList: safeGetElement<HTMLElement>('marketplace-list')!,
  btnUpgradePremium: safeGetElement<HTMLButtonElement>('btn-upgrade-premium')!,
  btnPayCard: safeGetElement<HTMLButtonElement>('btn-pay-card', true)!,
  btnPayCrypto: safeGetElement<HTMLButtonElement>('btn-pay-crypto', true)!,
  cryptoPaymentInfo: safeGetElement<HTMLElement>('crypto-payment-info', true)!,
  cryptoAddress: safeGetElement<HTMLElement>('crypto-address', true)!,
  cryptoChainSelect: safeGetElement<HTMLSelectElement>('crypto-chain-select', true)!,
  btnConfirmCrypto: safeGetElement<HTMLButtonElement>('btn-confirm-crypto', true)!,
  btnCancelSubscription: safeGetElement<HTMLButtonElement>('btn-cancel-subscription')!,

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
  cleanupFocusTrap: null as (() => void) | null,
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
    const isSelected = (btn as HTMLElement).dataset.tab === tabId;
    btn.classList.toggle('active', isSelected);
    btn.setAttribute('aria-selected', String(isSelected));
  });
  components.panes.forEach(pane => {
    pane.classList.toggle('active', pane.id === `tab-${tabId}`);
  });

  // Update tab indicator
  const tabIndicator = document.getElementById('tab-indicator');
  const selectedButton = document.querySelector(`.tab-btn[data-tab="${tabId}"]`) as HTMLElement;
  if (tabIndicator && selectedButton) {
    const buttonRect = selectedButton.getBoundingClientRect();
    const navRect = document.getElementById('tabs-nav')?.getBoundingClientRect();
    
    if (navRect) {
      tabIndicator.style.width = `${buttonRect.width}px`;
      tabIndicator.style.left = `${buttonRect.left - navRect.left}px`;
    }
  }

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

const tabsNav = document.getElementById('tabs-nav');
if (tabsNav) {
  tabsNav.addEventListener('keydown', (e) => {
    const tabs = Array.from(tabsNav.querySelectorAll('.tab-btn'));
    const currentIndex = tabs.findIndex(tab => tab.getAttribute('aria-selected') === 'true');

    let newIndex = currentIndex;

    switch (e.key) {
      case 'ArrowLeft':
        newIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
        break;
      case 'ArrowRight':
        newIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
        break;
      case 'Home':
        newIndex = 0;
        break;
      case 'End':
        newIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    e.preventDefault();
    const newTab = tabs[newIndex] as HTMLElement;
    newTab.click();
    newTab.focus();
  });
}

// Confirm / cancel modal actions
components.btnConfirm.addEventListener('click', () => {
  components.confirmModal.classList.add('hidden');
    if (state.cleanupFocusTrap) { state.cleanupFocusTrap(); state.cleanupFocusTrap = null; }
  if (state.confirmResolve) {
    state.confirmResolve(true);
    state.confirmResolve = null;
  }
});

components.btnCancel.addEventListener('click', () => {
  components.confirmModal.classList.add('hidden');
    if (state.cleanupFocusTrap) { state.cleanupFocusTrap(); state.cleanupFocusTrap = null; }
  if (state.confirmResolve) {
    state.confirmResolve(false);
    state.confirmResolve = null;
  }
});

// Modal backdrop close
components.confirmModal.addEventListener('click', e => {
  if (e.target === components.confirmModal) {
    components.confirmModal.classList.add('hidden');
    if (state.cleanupFocusTrap) { state.cleanupFocusTrap(); state.cleanupFocusTrap = null; }
    if (state.confirmResolve) {
      state.confirmResolve(false);
      state.confirmResolve = null;
    }
  }
});

components.askModal.addEventListener('click', e => {
  if (e.target === components.askModal) {
    components.askModal.classList.add('hidden');
    if (state.cleanupFocusTrap) { state.cleanupFocusTrap(); state.cleanupFocusTrap = null; }
    components.askReply.value = '';
    if (state.askResolve) {
      state.askResolve('');
      state.askResolve = null;
    }
    chrome.runtime.sendMessage({ type: 'userReply', reply: '' });
  }
});

// Ask user modal actions
components.btnAskReply.addEventListener('click', () => {
  const reply = components.askReply.value.trim();
  components.askModal.classList.add('hidden');
    if (state.cleanupFocusTrap) { state.cleanupFocusTrap(); state.cleanupFocusTrap = null; }
  components.askReply.value = '';
  chrome.runtime.sendMessage({ type: 'userReply', reply });
});

components.btnAskCancel.addEventListener('click', () => {
  components.askModal.classList.add('hidden');
    if (state.cleanupFocusTrap) { state.cleanupFocusTrap(); state.cleanupFocusTrap = null; }
  components.askReply.value = '';
  chrome.runtime.sendMessage({ type: 'userReply', reply: '' });
});

// ─── Slash Commands ─────────────────────────────────────────────
const SLASH_COMMANDS = {
  '/clear': () => {
    components.chatHistory.innerHTML = '';
    saveHistory();
    addMessage('Chat history cleared.', 'status');
    showExampleCommandsIfNeeded();
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
- \`/export\`: Export data (settings/chat/full)
- \`/export-all\`: Full GDPR data export
- \`/delete-data\`: Delete all data (GDPR erasure)
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
- \`Ctrl/Cmd+K\`: Focus command input
- \`Ctrl/Cmd+L\`: Clear chat
- \`Ctrl/Cmd+S\`: Open settings
    `,
      'agent'
    );
  },
'/export': () => {
    showExportOptions();
  },
  '/export-all': () => {
    exportAllUserData();
  },
  '/export-chat': () => {
    exportChatHistory();
  },
  '/delete-data': () => {
    deleteAllUserData();
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
  { command: '/export', description: 'Export data (options menu)' },
  { command: '/export-all', description: 'Full GDPR data export' },
  { command: '/delete-data', description: 'Delete all data (GDPR erasure)' },
  { command: '/help', description: 'Help & documentation' },
];

function sanitizeInput(text: string): string {
  // Basic sanitization - remove null bytes, control characters except newlines
  return text.replaceAll(/\x00/g, '').replaceAll(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
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
  if (!components.chatHistory) {
    console.error('[HyperAgent] Chat history component not found');
    return null;
  }
  
  clearExampleCommands();
  
  // Validate content
  if (!content || typeof content !== 'string') {
    content = 'Empty message';
  }
  
  const div = document.createElement('div');
  div.className = `chat-msg ${type}`;

  try {
    if (type === 'agent') {
      div.innerHTML = renderMarkdown(content);
    } else {
      div.textContent = content;
    }
  } catch (err) {
    console.error('[HyperAgent] Error rendering message:', err);
    div.textContent = 'Error rendering message';
  }

  try {
    components.chatHistory.appendChild(div);
    scrollToBottom();
    saveHistory(); // Persist
  } catch (appendErr) {
    console.error('[HyperAgent] Error adding message to chat history:', appendErr);
  }
  
  return div;
}

function renderMarkdown(text: string): string {
  try {
    let html = text.replaceAll(/```(\w*)([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre><code class="language-${escapeHtml(lang)}">${escapeHtml(code.trim())}</code></pre>`;
    });
    html = html.replaceAll(/`([^`]+)`/g, (_, code) => `<code>${escapeHtml(code)}</code>`);
    html = html.replaceAll(/\*\*([^*]+)\*\*/g, (_, t) => `<strong>${escapeHtml(t)}</strong>`);
    html = html.replaceAll(/\*([^*]+)\*/g, (_, t) => `<em>${escapeHtml(t)}</em>`);
    html = html.replaceAll(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (_, linkText, href) => {
        const safeHref = /^https?:\/\//i.test(href) ? escapeHtml(href) : '#';
        return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${escapeHtml(linkText)}</a>`;
      }
    );

    html = html
      .split('\n\n')
      .map(p => `<p>${escapeHtml(p).replaceAll(/\n/g, '<br>')}</p>`)
      .join('');
    return html;
  } catch (err) {
    console.warn('[HyperAgent] renderMarkdown failed', err);
    return escapeHtml(text);
  }
}

function escapeHtml(text: string): string {
  return text
    .replaceAll(/&/g, '&amp;')
    .replaceAll(/</g, '&lt;')
    .replaceAll(/>/g, '&gt;')
    .replaceAll(/"/g, '&quot;')
    .replaceAll(/'/g, '&#x27;');
}

// Focus trap for modals (accessibility)
function trapFocus(modal: HTMLElement): () => void {
  const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  const focusableElements = modal.querySelectorAll<HTMLElement>(focusableSelectors);
  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    if (focusableElements.length === 0) return;

    if (e.shiftKey) {
      if (document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable.focus();
      }
    } else {
      if (document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable.focus();
      }
    }
  };

  modal.addEventListener('keydown', handleKeyDown);
  firstFocusable?.focus();

  return () => modal.removeEventListener('keydown', handleKeyDown);
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
    const waitMs = COMMAND_RATE_LIMIT_MS - (now - state.lastCommandTime);
    addMessage(`Please wait ${Math.ceil(waitMs / 1000)} seconds before sending another command.`, 'status');
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
globalThis.addEventListener('beforeunload', () => saveHistoryImmediate());

async function loadHistory() {
  try {
    const data = await chrome.storage.local.get('chat_history_backup');
    if (data.chat_history_backup && typeof data.chat_history_backup === 'string') {
      // Sanitize HTML before inserting to prevent XSS (Issue #81)
      // We only allow a limited set of tags that our renderMarkdown function produces
      const result = inputSanitizer.sanitize(data.chat_history_backup, {
        allowHtml: true,
        allowedTags: ['p', 'br', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li', 'a', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote'],
        allowedAttributes: ['href', 'class', 'target', 'rel', 'title', 'alt'],
      });
      components.chatHistory.innerHTML = result.sanitizedValue;
      scrollToBottom();
    }
    showExampleCommandsIfNeeded();
  } catch (err) {
    console.warn('[HyperAgent] Failed to load chat history:', err);
    showExampleCommandsIfNeeded();
  }
}

function showExampleCommandsIfNeeded() {
  const chatHistory = components.chatHistory;
  if (!chatHistory) return;
  
  const hasRealContent = chatHistory.querySelector('.chat-msg');
  if (hasRealContent) return;

  const examples = [
    "Go to amazon.com and search for wireless headphones",
    "Extract all email addresses from this page",
    "Fill out this form with my contact information",
    "Click the 'Add to Cart' button",
  ];

  const examplesContainer = document.createElement('div');
  examplesContainer.className = 'example-commands';
  examplesContainer.style.cssText = 'padding: 24px; text-align: center;';
  
  const title = document.createElement('p');
  title.style.cssText = 'color: var(--text-tertiary); margin-bottom: 16px; font-size: 0.875rem; font-weight: 500;';
  title.textContent = 'Try one of these commands:';
  examplesContainer.appendChild(title);

  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = 'display: flex; flex-direction: column; gap: 8px; max-width: 320px; margin: 0 auto;';

  examples.forEach(cmd => {
    const btn = document.createElement('button');
    btn.className = 'example-cmd';
    btn.dataset.cmd = cmd;
    btn.textContent = cmd;
    btn.style.cssText = `background: var(--surface-secondary); border: 1px solid var(--surface-glass-border); 
                         border-radius: 12px; padding: 14px 16px; cursor: pointer; text-align: left;
                         font-size: 0.875rem; color: var(--text-primary); transition: all 0.2s; font-family: inherit;
                         box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);`;
    
    btn.addEventListener('click', () => {
      components.commandInput.value = cmd;
      components.commandInput.focus();
      components.commandInput.dispatchEvent(new Event('input'));
    });

    btn.addEventListener('mouseenter', () => {
      btn.style.borderColor = 'var(--accent)';
      btn.style.background = 'var(--surface-accent)';
      btn.style.transform = 'translateY(-1px)';
      btn.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.borderColor = 'var(--surface-glass-border)';
      btn.style.background = 'var(--surface-secondary)';
      btn.style.transform = 'translateY(0)';
      btn.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
    });

    buttonContainer.appendChild(btn);
  });

  examplesContainer.appendChild(buttonContainer);

  const hint = document.createElement('p');
  hint.style.cssText = 'color: var(--text-quaternary); margin-top: 16px; font-size: 0.75rem;';
  hint.textContent = 'Or type your own command below';
  examplesContainer.appendChild(hint);

  chatHistory.appendChild(examplesContainer);
}

function clearExampleCommands() {
  const exampleCommands = components.chatHistory.querySelector('.example-commands');
  if (exampleCommands) {
    exampleCommands.remove();
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

let _selectedBillingInterval: 'month' | 'year' = 'month';

async function updateUsageDisplay() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'getUsage' });
    if (!response?.usage) return;
    const { actions, sessions: _sessions } = response.usage;
    const { actions: limitActions, sessions: _limitSessions, tier } = response.limits;

    // Update text
    const actionsLabel = limitActions === -1 ? `${actions} / ∞` : `${actions} / ${limitActions}`;
    components.usageActions.textContent = actionsLabel;
    components.usageTier.textContent = tier.charAt(0).toUpperCase() + tier.slice(1);

    // Update progress bars
    const actionsProgress = document.getElementById('actions-progress');
    if (actionsProgress) {
      const pct = limitActions === -1 ? 0 : Math.min(100, (actions / limitActions) * 100);
      actionsProgress.style.width = `${pct}%`;
      
      let progressClass = 'progress-bar-fill';
      if (pct > 90) {
        progressClass += ' danger';
      } else if (pct > 70) {
        progressClass += ' warning';
      }
      actionsProgress.className = progressClass;
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
  // Reset flag to re-attach listeners when switching back to marketplace
  // (DOM nodes are replaced on tab switch, so stale listeners must be rebound)
  marketplaceListenersAttached = false;

  // Load installed workflows from background
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'getInstalledWorkflows' });
    if (resp?.ok && Array.isArray(resp.workflows)) {
      installedWorkflowIds = new Set(resp.workflows);
    }
  } catch (e) {
    console.warn('[HyperAgent] Failed to load installed workflows', e);
  }

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

  const freeFilter = document.getElementById('filter-free') as HTMLInputElement;
  if (freeFilter) {
    freeFilter.addEventListener('change', renderMarketplaceWorkflows);
  }
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

  // Filter by price (free) if requested
  const isFreeFilter = document.getElementById('filter-free') as HTMLInputElement;
  if (isFreeFilter && isFreeFilter.checked) {
    filtered = filtered.filter(w => w.price === 'Free');
  }

  components.marketplaceList.innerHTML = '';

  if (filtered.length === 0) {
    components.marketplaceList.innerHTML = '<p class="empty-state">No workflows found matching your criteria.</p>';
    return;
  }

  filtered.forEach(workflow => {
    const currentTier = billingManager.getTier();
    // Map new tier names to legacy for comparison
    const tierOrder = { community: 0, beta: 1, free: 0, premium: 1, unlimited: 2 };
    const currentTierLevel = tierOrder[currentTier] || 0;
    const workflowTierLevel = tierOrder[workflow.tier] || 0;
    const canInstall = currentTierLevel >= workflowTierLevel;
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
  } catch {
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
  } catch {
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
        const lastErrorHtml = task.lastError
          ? `<div class="task-error">Error: ${escapeHtml(task.lastError)}</div>`
          : '';
        item.innerHTML = `
          <div class="task-header">
            <span class="task-name">${escapeHtml(task.name || 'Unnamed')}</span>
            <span class="task-status ${task.enabled ? 'enabled' : 'disabled'}">${task.enabled ? 'Active' : 'Paused'}</span>
          </div>
          <div class="task-command">${escapeHtml(task.command || '')}</div>
          <div class="task-schedule">${escapeHtml(formatSchedule(task.schedule))}</div>
          <div class="task-next-run">Next: ${task.nextRun ? escapeHtml(new Date(task.nextRun).toLocaleString()) : 'Not scheduled'}</div>
          ${lastErrorHtml}
          <div class="task-actions">
            <button class="btn-small" data-task-id="${safeId}" data-action="toggle" data-enabled="${task.enabled}">${task.enabled ? 'Pause' : 'Enable'}</button>
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
          const currentEnabled = action === 'toggle' ? target.dataset.enabled === 'true' : undefined;
          handleTaskAction(taskId, action, currentEnabled);
        });
      });
    } else {
      tasksList.innerHTML = `
        <p class="empty-state">No scheduled tasks.</p>
        <p class="hint">Use commands like "schedule daily search for news" to create tasks.</p>
      `;
    }
  } catch {
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

async function handleTaskAction(taskId: string | undefined, action: string | undefined, currentEnabled?: boolean) {
  if (!taskId || !action) return;

  if (action === 'toggle') {
    // Toggle: pass opposite of current state (Pause = disable, Enable = enable)
    const enabled = currentEnabled !== undefined ? !currentEnabled : true;
    await chrome.runtime.sendMessage({ type: 'toggleScheduledTask', taskId, enabled });
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

  if (components.visionSnapshot?.src && components.visionSnapshot.src !== '') {
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
      } catch {
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
let _swarmListenersAttached = false;
// ─── Swarm Tab ───────────────────────────────────────────────────
async function loadSwarmTab() {
  const agentList = document.getElementById('agent-list');
  const activeMissions = document.getElementById('active-missions');
  const activeMissionsList = document.getElementById('active-missions-list');
  const missionHistoryList = document.getElementById('mission-history-list');
  const snapshotsList = document.getElementById('snapshots-list');

  if (!agentList || !activeMissions || !activeMissionsList || !missionHistoryList || !snapshotsList) {
    return;
  }

  try {
    // Load agent status from background
    const swarmStatus = await chrome.runtime.sendMessage({ type: 'getSwarmStatus' });
    if (swarmStatus?.ok && swarmStatus.status?.agents) {
      agentList.innerHTML = swarmStatus.status.agents.map((agent: any) => `
        <div class="flex items-center justify-between p-3 card-base bg-zinc-50/50 dark:bg-zinc-900/50 rounded-lg">
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full ${agent.status === 'Active' ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}"></div>
            <span class="text-sm font-medium text-zinc-900 dark:text-zinc-100">${agent.displayName}</span>
          </div>
          <span class="text-xs text-zinc-500 dark:text-zinc-400">${agent.status}</span>
        </div>
      `).join('');
    } else {
      agentList.innerHTML = '<p class="empty-state">Swarm intelligence not available</p>';
    }

    // Load saved snapshots
    const snapshots = await chrome.runtime.sendMessage({ type: 'listSnapshots' });
    if (snapshots?.ok && snapshots.snapshots?.length > 0) {
      snapshotsList.innerHTML = snapshots.snapshots.map((snap: any) => `
        <div class="flex items-center justify-between p-3 card-base bg-zinc-50/50 dark:bg-zinc-900/50 rounded-lg">
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full bg-blue-500"></div>
            <span class="text-sm font-medium text-zinc-900 dark:text-zinc-100">${escapeHtml(snap.command.slice(0, 30))}...</span>
          </div>
          <div class="flex items-center gap-2">
            <button class="btn-small" data-task-id="${snap.taskId}" data-action="resume">Resume</button>
            <button class="btn-small btn-danger" data-task-id="${snap.taskId}" data-action="delete">Delete</button>
          </div>
        </div>
      `).join('');

      snapshotsList.querySelectorAll('.btn-small').forEach(btn => {
        btn.addEventListener('click', async () => {
          const taskId = (btn as HTMLButtonElement).dataset.taskId;
          const action = (btn as HTMLButtonElement).dataset.action;
          if (taskId && action === 'resume') {
            const resp = await chrome.runtime.sendMessage({ type: 'resumeSnapshot', taskId });
            if (resp?.ok) {
              showToast('Resuming mission...', 'info');
            } else {
              showToast(resp?.error || 'Failed to resume', 'error');
            }
          } else if (taskId && action === 'delete') {
            const resp = await chrome.runtime.sendMessage({ type: 'clearSnapshot', taskId });
            if (resp?.ok) {
              showToast('Snapshot deleted', 'success');
              loadSwarmTab();
            } else {
              showToast(resp?.error || 'Failed to delete', 'error');
            }
          }
        });
      });
    } else {
      snapshotsList.innerHTML = `
        <p class="empty-state">No saved missions.</p>
        <p class="hint">Use commands like "extract data from website" to create snapshots.</p>
      `;
    }

    // Load active missions (from real data)
    const activeMissionsData: Array<{ name: string; progress: number }> = []; // Replace with real data from background
    activeMissionsList.innerHTML = activeMissionsData.map(mission => `
      <div class="flex items-center justify-between p-3 card-base bg-zinc-50/50 dark:bg-zinc-900/50 rounded-lg">
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span class="text-sm font-medium text-zinc-900 dark:text-zinc-100">${mission.name}</span>
        </div>
        <div class="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <span>${mission.progress}%</span>
          <div class="w-24 h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div class="h-full bg-emerald-500 rounded-full" style="width: ${mission.progress}%"></div>
          </div>
        </div>
      </div>
    `).join('');

    if (activeMissions) activeMissions.textContent = activeMissionsData.length.toString();

    // Load mission history (from real data)
    const missionHistoryData: Array<{ name: string; status: string; time: string }> = []; // Replace with real data from background
    missionHistoryList.innerHTML = missionHistoryData.map(mission => `
      <div class="flex items-center justify-between p-3 card-base bg-zinc-50/50 dark:bg-zinc-900/50 rounded-lg">
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 rounded-full ${mission.status === 'Completed' ? 'bg-emerald-500' : 'bg-red-500'}"></div>
          <span class="text-sm font-medium text-zinc-900 dark:text-zinc-100">${mission.name}</span>
        </div>
        <div class="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <span>${mission.status}</span>
          <span>${mission.time}</span>
        </div>
      </div>
    `).join('');

    if (missionHistoryData.length === 0) {
      missionHistoryList.innerHTML = `
        <p class="empty-state">No mission history.</p>
        <p class="hint">Complete missions to see history.</p>
      `;
    }

    _swarmListenersAttached = true;

  } catch (err) {
    console.error('[HyperAgent] Failed to load swarm tab:', err);
    // Show error state
    if (agentList) {
      agentList.innerHTML = '<p class="empty-state">Failed to load swarm status. Check your connection.</p>';
    }
  }
}

// ─── Event Listeners ────────────────────────────────────────────
components.btnExecute.addEventListener('click', () => {
  if (!navigator.onLine) {
    showToast('You are offline. Check your internet connection.', 'error');
    return;
  }
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

// Offline indicator
globalThis.addEventListener('offline', () => {
  showToast('You are offline. Some features may not work.', 'warning');
});
globalThis.addEventListener('online', () => {
  showToast('Back online!', 'success');
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
requestIdleCallback(() => loadHistory(), { timeout: 100 });
loadCommandHistory();

// Show changelog on update
chrome.storage.local.get('hyperagent_show_changelog').then((data) => {
  if (data.hyperagent_show_changelog) {
    chrome.storage.local.remove('hyperagent_show_changelog');
    showToast('HyperAgent updated! Check the repository for release notes.', 'info');
  }
});

// Show onboarding for new installs
chrome.storage.local.get('hyperagent_show_onboarding').then((data) => {
  if (data.hyperagent_show_onboarding) {
    chrome.storage.local.remove('hyperagent_show_onboarding');
    const modal = document.getElementById('onboarding-modal');
    if (modal) {
      modal.classList.remove('hidden');
      if (state.cleanupFocusTrap) state.cleanupFocusTrap();
      state.cleanupFocusTrap = trapFocus(modal);
    }
  }
});

// Onboarding modal handlers
document.getElementById('btn-onboarding-close')?.addEventListener('click', () => {
  const modal = document.getElementById('onboarding-modal');
  modal?.classList.add('hidden');
  if (state.cleanupFocusTrap) { state.cleanupFocusTrap(); state.cleanupFocusTrap = null; }
});
document.getElementById('btn-onboarding-settings')?.addEventListener('click', () => {
  const modal = document.getElementById('onboarding-modal');
  modal?.classList.add('hidden');
  if (state.cleanupFocusTrap) { state.cleanupFocusTrap(); state.cleanupFocusTrap = null; }
  openOptionsPageSafe();
});

components.btnSettings.addEventListener('click', () => {
  openOptionsPageSafe();
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
    openOptionsPageSafe();
  }
  // Ctrl/Cmd + K: Focus command input
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    switchTab('chat');
    components.commandInput.focus();
  }
  // Escape: Close modals and suggestions
  if (e.key === 'Escape') {
    components.confirmModal.classList.add('hidden');
    components.askModal.classList.add('hidden');
    components.suggestions.classList.add('hidden');
    
    // Close onboarding modal and persist dismissal (Issue #39)
    const onboardingModal = document.getElementById('onboarding-modal');
    if (onboardingModal && !onboardingModal.classList.contains('hidden')) {
      onboardingModal.classList.add('hidden');
      chrome.storage.local.remove('hyperagent_show_onboarding').catch(() => {});
    }
    
    // Always cleanup focus trap - don't check if modal is open first
    if (state.cleanupFocusTrap) {
      state.cleanupFocusTrap();
      state.cleanupFocusTrap = null;
    }
    if (state.confirmResolve) {
      state.confirmResolve(false);
      state.confirmResolve = null;
    }
    if (state.askResolve) {
      state.askResolve('');
      state.askResolve = null;
      chrome.runtime.sendMessage({ type: 'userReply', reply: '' });
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
          const pct = (Number.parseInt(stepMatch[1], 10) / Number.parseInt(stepMatch[2], 10)) * 100;
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
      if (state.cleanupFocusTrap) state.cleanupFocusTrap();
      components.askModal.classList.remove('hidden');
      state.cleanupFocusTrap = trapFocus(components.askModal);
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
            const desc = action.description ?? `${action.type} action`;
            li.textContent = typeof desc === 'string' ? desc : 'Unknown action';
            components.confirmList.appendChild(li);
          }
        });
      }

      if (state.cleanupFocusTrap) state.cleanupFocusTrap();
      components.confirmModal.classList.remove('hidden');
      state.cleanupFocusTrap = trapFocus(components.confirmModal);

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
    if (state.cleanupFocusTrap) { state.cleanupFocusTrap(); state.cleanupFocusTrap = null; }
        })
        .catch(err => {
          console.error('Confirmation error:', err);
          components.confirmModal.classList.add('hidden');
    if (state.cleanupFocusTrap) { state.cleanupFocusTrap(); state.cleanupFocusTrap = null; }
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

// Voice interface disabled for MVP
// Mic button toggle - show disabled message for now
components.btnMic.addEventListener('click', () => {
  showToast('Voice input coming in v4.2', 'info');
});

components.btnUpgradePremium.addEventListener('click', async () => {
  const result = await billingManager.openCheckout('beta');
  if (result.success) {
    addMessage('Redirecting to checkout...', 'status');
    showToast('Opening checkout...', 'info');
  } else {
    showToast(result.error || 'Checkout not available', 'error');
  }
});

// Payment method buttons
if (components.btnPayCard) {
  components.btnPayCard.addEventListener('click', async () => {
    const result = await billingManager.openCheckout('beta');
    if (result.success) {
      showToast('Opening Stripe checkout...', 'info');
    } else {
      showToast(result.error || 'Card payment not configured', 'error');
    }
  });
}

if (components.btnPayCrypto) {
  components.btnPayCrypto.addEventListener('click', () => {
    if (components.cryptoPaymentInfo) {
      components.cryptoPaymentInfo.classList.toggle('hidden');
      
      // Update crypto address if visible
      if (!components.cryptoPaymentInfo.classList.contains('hidden')) {
        const config = billingManager.getPaymentConfig();
        const addr = config.cryptoRecipientAddress;
        const isReal = addr && addr.length === 42 && addr.toLowerCase() !== '0x0000000000000000000000000000000000000000';
        if (components.cryptoAddress) {
          components.cryptoAddress.textContent = isReal ? addr : 'Configure wallet in settings';
        }
      }
    }
  });
}

if (components.btnConfirmCrypto) {
  components.btnConfirmCrypto.addEventListener('click', async () => {
    const txHash = prompt('Enter your transaction hash:');
    if (!txHash) return;
    
    const chainId = components.cryptoChainSelect ? Number.parseInt(components.cryptoChainSelect.value) : 1;
    const result = await billingManager.confirmCryptoPayment(txHash, 'user', chainId);
    
    if (result.success) {
      showToast('Payment confirmed! Upgrading to Beta...', 'success');
      updateSubscriptionBadge();
    } else {
      showToast(result.error || 'Payment verification failed', 'error');
    }
  });
}

if (components.btnCancelSubscription) {
  components.btnCancelSubscription.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to cancel? You\'ll keep Beta until the end of your billing period.')) {
      return;
    }
    await billingManager.cancelSubscription();
    showToast('Subscription will cancel at end of period', 'info');
    updateSubscriptionBadge();
  });
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
// Note: Don't add initial message here - loadHistory() will handle it
// or showExampleCommandsIfNeeded() will show examples if empty
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

    badge.textContent = status.plan.charAt(0).toUpperCase() + status.plan.slice(1);
    badge.className = `subscription-badge ${status.plan}`;

    if (status.plan === 'community') {
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

function openOptionsPageSafe(): void {
  try {
    // Directly open options.html instead of relying on chrome.runtime.openOptionsPage()
    const optionsUrl = chrome.runtime.getURL('options.html');
    chrome.tabs.create({ url: optionsUrl });
  } catch (e) {
    console.warn('[HyperAgent] Failed to open options page', e);
    showToast('Could not open settings', 'error');
  }
}

// ─── Dark Mode ────────────────────────────────────────────────────
async function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark-mode');
  await chrome.storage.local.set({ dark_mode: isDark });
  showToast(`${isDark ? 'Dark' : 'Light'} mode enabled`, 'info');
}

async function initDarkMode() {
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
  const warned = confirm(
    'Export includes chat history and preferences. Do not share this file if it contains sensitive data. Continue?'
  );
  if (!warned) return;
  try {
    const data = await chrome.storage.local.get(null) as Record<string, unknown>;
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
        throw new Error(errors.length > 0 ? errors[0] : 'No valid settings to import');
      }
      if (errors.length > 0) {
        console.warn('[HyperAgent] Import validation warnings:', errors);
        showToast(`Imported with warnings: ${errors.join('; ')}`, 'warning');
      }
      // Sanitize chat_history_backup on import to prevent XSS from malicious import files
      if (typeof filtered.chat_history_backup === 'string') {
        const result = inputSanitizer.sanitize(filtered.chat_history_backup, {
          allowHtml: true,
          allowedTags: ['p', 'br', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li', 'a', 'div', 'span'],
          allowedAttributes: ['href', 'class', 'target', 'rel', 'title', 'alt'],
        });
        filtered.chat_history_backup = result.sanitizedValue;
      }
      await chrome.storage.local.set(filtered);
      showToast('Settings imported successfully!', 'success');

      setTimeout(() => location.reload(), 1000);
    } catch (err) {
      showToast('Failed to import settings: Invalid file', 'error');
      console.error('[HyperAgent] Import error:', err);
    }
  };

  input.click();
}

async function exportChatHistory() {
  try {
    const data = await chrome.storage.local.get('chat_history_backup') as Record<string, unknown>;
    if (!data.chat_history_backup) {
      showToast('No chat history to export', 'info');
      return;
    }
    
    const exportData = {
      version: '1.0',
      timestamp: Date.now(),
      type: 'chat_history',
      history: data.chat_history_backup,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hyperagent-chat-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('Chat history exported!', 'success');
  } catch {
    showToast('Failed to export chat history', 'error');
  }
}

async function exportAllUserData(): Promise<void> {
  try {
    const allData = await chrome.storage.local.get(null) as Record<string, unknown>;
    
    const exportData = {
      exportDate: new Date().toISOString(),
      version: '3.1.0',
      data: {
        settings: {
          darkMode: allData.dark_mode ?? allData[STORAGE_KEYS.DARK_MODE],
          apiKeyConfigured: !!(allData[STORAGE_KEYS.API_KEY]),
          baseUrl: allData[STORAGE_KEYS.BASE_URL],
          modelName: allData[STORAGE_KEYS.MODEL_NAME],
          maxSteps: allData[STORAGE_KEYS.MAX_STEPS],
          requireConfirm: allData[STORAGE_KEYS.REQUIRE_CONFIRM],
          dryRun: allData[STORAGE_KEYS.DRY_RUN],
          enableVision: allData[STORAGE_KEYS.ENABLE_VISION],
          enableSwarmIntelligence: allData[STORAGE_KEYS.ENABLE_SWARM_INTELLIGENCE],
          enableAutonomousMode: allData[STORAGE_KEYS.ENABLE_AUTONOMOUS_MODE],
          learningEnabled: allData[STORAGE_KEYS.LEARNING_ENABLED],
          siteBlacklist: allData[STORAGE_KEYS.SITE_BLACKLIST],
        },
        chatHistory: allData.chat_history_backup || allData[STORAGE_KEYS.CHAT_HISTORY] || '',
        commandHistory: allData.command_history || allData[STORAGE_KEYS.COMMAND_HISTORY] || [],
        workflows: Object.fromEntries(
          Object.entries(allData).filter(([key]) => 
            key.startsWith('workflow_') || key === STORAGE_KEYS.WORKFLOWS || key === STORAGE_KEYS.INSTALLED_WORKFLOWS
          )
        ),
        scheduledTasks: allData[STORAGE_KEYS.SCHEDULED_TASKS] || [],
        siteConfigs: allData[STORAGE_KEYS.SITE_CONFIGS] || [],
        siteStrategies: allData[STORAGE_KEYS.SITE_STRATEGIES] || {},
        memory: {
          actionHistory: allData[STORAGE_KEYS.ACTION_HISTORY] || [],
          sessions: allData[STORAGE_KEYS.SESSIONS] || [],
          neuroplasticity: allData.hyperagent_neuroplasticity || {},
        },
        snapshots: Object.fromEntries(
          Object.entries(allData).filter(([key]) => key.startsWith('snapshot_'))
        ),
        metrics: allData[STORAGE_KEYS.USAGE_METRICS] || {},
        billing: {
          tier: (allData[STORAGE_KEYS.SUBSCRIPTION] as any)?.tier || billingManager.getTier(),
          status: (allData[STORAGE_KEYS.SUBSCRIPTION] as any)?.status || 'active',
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
        note: 'API keys are NOT exported for security. Chat history may contain sensitive information - handle with care.',
      },
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hyperagent-gdpr-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('Full data exported successfully', 'success');
    addMessage('GDPR data export complete. The file contains all your stored data. Keep it secure.', 'agent');
  } catch (error) {
    console.error('[Export] Failed:', error);
    showToast('Export failed: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error');
  }
}

async function deleteAllUserData(): Promise<void> {
  if (!confirm('This will permanently delete ALL your data. This cannot be undone. Continue?')) {
    return;
  }
  
  if (!confirm('Are you REALLY sure? This includes your API key, chat history, workflows, and all settings.')) {
    return;
  }

  const confirmation = prompt('Type "DELETE" to confirm permanent data erasure:');
  if (confirmation !== 'DELETE') {
    showToast('Data deletion cancelled', 'info');
    return;
  }

  try {
    await chrome.storage.local.clear();
    showToast('All data deleted. The extension will reload.', 'success');
    setTimeout(() => chrome.runtime.reload(), 1500);
  } catch (error) {
    showToast('Delete failed: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error');
  }
}

function showExportOptions(): void {
  const choice = prompt(
    'Export Options:\n' +
    '1 - Settings only (preferences, no history)\n' +
    '2 - Chat history only\n' +
    '3 - Full GDPR export (all data)\n\n' +
    'Enter 1, 2, or 3:'
  );

  switch (choice) {
    case '1':
      exportSettings();
      break;
    case '2':
      exportChatHistory();
      break;
    case '3':
      exportAllUserData();
      break;
    default:
      showToast('Export cancelled', 'info');
  }
}
