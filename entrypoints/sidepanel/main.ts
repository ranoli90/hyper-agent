/**
 * @fileoverview HyperAgent side panel UI.
 * Chat, commands, tabs (Memory, Subscription).
 */

import type { ExtensionMessage } from '../../shared/types';
import { validateAndFilterImportData, STORAGE_KEYS } from '../../shared/config';
import { inputSanitizer } from '../../shared/input-sanitization';
import { debounce } from '../../shared/utils';
import { billingManager } from '../../shared/billing';

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
  btnUpgradePremium: safeGetElement<HTMLButtonElement>('btn-upgrade-premium')!,
  btnPayCard: safeGetElement<HTMLButtonElement>('btn-pay-card', true)!,
  btnPayCrypto: safeGetElement<HTMLButtonElement>('btn-pay-crypto', true)!,
  cryptoPaymentInfo: safeGetElement<HTMLElement>('crypto-payment-info', true)!,
  cryptoAddress: safeGetElement<HTMLElement>('crypto-address', true)!,
  cryptoChainSelect: safeGetElement<HTMLSelectElement>('crypto-chain-select', true)!,
  btnConfirmCrypto: safeGetElement<HTMLButtonElement>('btn-confirm-crypto', true)!,
  btnCancelSubscription: safeGetElement<HTMLButtonElement>('btn-cancel-subscription')!,

  subscriptionBadge: safeGetElement<HTMLElement>('subscription-badge')!,

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
  confirmTimeoutId: null as ReturnType<typeof setTimeout> | null,
  askResolve: null as ((reply: string) => void) | null,
  askTimeoutId: null as ReturnType<typeof setTimeout> | null,
  activeTab: 'chat',
  lastCommandTime: 0,
  commandHistory: [] as string[],
  historyIndex: -1,
  cleanupFocusTrap: null as (() => void) | null,
};

const MAX_COMMAND_LENGTH = 2000;
const COMMAND_RATE_LIMIT_MS = 1000; // 1 second between commands
let selectedSuggestionIndex = -1;

function updateCharCounter(value: string) {
  if (!components.charCounter) return;
  const length = value.length;
  components.charCounter.textContent = `${length} / ${MAX_COMMAND_LENGTH}`;
  components.charCounter.classList.toggle('warn', length > MAX_COMMAND_LENGTH * 0.9);
}

// ─── Tab Logic ──────────────────────────────────────────────────
function switchTab(tabId: string) {
  state.activeTab = tabId;

  // Update tab buttons
  components.tabs.forEach(btn => {
    const isSelected = (btn as HTMLElement).dataset.tab === tabId;
    btn.classList.toggle('active', isSelected);
    btn.setAttribute('aria-selected', String(isSelected));
  });

  // Update tab panes
  components.panes.forEach(pane => {
    pane.classList.toggle('active', pane.id === `tab-${tabId}`);
  });

  // Update tab indicator with improved positioning
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
  if (tabId === 'subscription') {
    updateUsageDisplay();
  } else if (tabId === 'memory') {
    // Load memory stats inline (function was removed during cleanup)
    (async () => {
      try {
        const resp = await chrome.runtime.sendMessage({ type: 'getMemoryStats' });
        if (resp?.ok) {
          const statsEl = document.getElementById('memory-stats');
          if (statsEl) {
            const strategies = resp.strategies ? Object.keys(resp.strategies).length : 0;
            statsEl.innerHTML = `
              <div style="padding:16px;color:var(--text-secondary);font-size:0.875rem;">
                <p><strong>Site Strategies:</strong> ${strategies}</p>
                <p><strong>Action History:</strong> ${resp.totalActions || 0} actions logged</p>
                <p><strong>Sessions:</strong> ${resp.totalSessions || 0}</p>
              </div>`;
          }
        }
      } catch (err) {
        console.warn('[HyperAgent] Failed to load memory stats:', err);
      }
    })();
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
    if (state.confirmTimeoutId) {
      clearTimeout(state.confirmTimeoutId);
      state.confirmTimeoutId = null;
    }
    state.confirmResolve(true);
    state.confirmResolve = null;
  }
});

components.btnCancel.addEventListener('click', () => {
  components.confirmModal.classList.add('hidden');
  if (state.cleanupFocusTrap) { state.cleanupFocusTrap(); state.cleanupFocusTrap = null; }
  if (state.confirmResolve) {
    if (state.confirmTimeoutId) {
      clearTimeout(state.confirmTimeoutId);
      state.confirmTimeoutId = null;
    }
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
      if (state.confirmTimeoutId) {
        clearTimeout(state.confirmTimeoutId);
        state.confirmTimeoutId = null;
      }
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
    matches.slice(0, 5).forEach((s, index) => {
      // Limit to 5 suggestions for performance
      try {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.setAttribute('data-index', String(index));
        div.setAttribute('role', 'option');
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
        // Skip failed suggestion item
      }
    });

    container.classList.remove('hidden');
    // Reset selection
    selectedSuggestionIndex = -1;
  } catch (err) {
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

  // Validate and sanitize content (strip control chars; prevent injection)
  if (!content || typeof content !== 'string') {
    content = 'Empty message';
  } else {
    content = content.replaceAll(/\x00/g, '').replaceAll(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }

  const div = document.createElement('div');
  div.className = `chat-msg ${type}`;

  try {
    if (type === 'thinking') {
      // Create collapsible thinking message
      div.classList.add('thinking-msg');

      // Header with animated dots
      const header = document.createElement('div');
      header.className = 'thinking-header';
      header.innerHTML = `
        <svg class="thinking-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 6v6l4 2"/>
        </svg>
        <span class="thinking-label">Thinking</span>
        <span class="thinking-dots"><span>.</span><span>.</span><span>.</span></span>
        <svg class="thinking-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      `;

      // Content container (hidden by default)
      const contentDiv = document.createElement('div');
      contentDiv.className = 'thinking-content';
      contentDiv.innerHTML = renderMarkdown(content);
      contentDiv.style.display = 'none';

      // Click to toggle
      header.addEventListener('click', () => {
        const isExpanded = contentDiv.style.display !== 'none';
        contentDiv.style.display = isExpanded ? 'none' : 'block';
        header.classList.toggle('expanded', !isExpanded);
        div.classList.toggle('expanded', !isExpanded);
      });

      div.appendChild(header);
      div.appendChild(contentDiv);
    } else if (type === 'agent') {
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
    updateChatSearchVisibility();
  } catch (appendErr) {
    console.error('[HyperAgent] Error adding message to chat history:', appendErr);
  }

  return div;
}

function updateChatSearchVisibility() {
  const bar = document.getElementById('chat-search-bar');
  const msgs = components.chatHistory?.querySelectorAll('.chat-msg');
  const hasMessages = msgs && msgs.length > 0;
  if (bar) bar.style.display = hasMessages ? 'block' : 'none';
}

function filterChatBySearch(query: string) {
  const msgs = components.chatHistory?.querySelectorAll('.chat-msg');
  const hint = document.getElementById('chat-search-hint');
  if (!msgs) return;

  const q = query.trim().toLowerCase();
  if (!q) {
    msgs.forEach(el => {
      (el as HTMLElement).style.display = '';
      (el as HTMLElement).classList.remove('search-highlight');
    });
    if (hint) { hint.style.display = 'none'; hint.textContent = ''; }
    return;
  }

  let matchCount = 0;
  msgs.forEach(el => {
    const html = el as HTMLElement;
    const text = html.textContent || '';
    const matches = text.toLowerCase().includes(q);
    html.style.display = matches ? '' : 'none';
    if (matches) matchCount++;
    html.classList.toggle('search-highlight', matches);
  });
  if (hint) {
    hint.style.display = 'block';
    hint.textContent = matchCount > 0 ? `${matchCount} message${matchCount === 1 ? '' : 's'} match` : 'No matches';
  }
}

function renderMarkdown(text: string): string {
  try {
    // First escape all HTML to prevent XSS
    let html = escapeHtml(text);

    // Then apply markdown transformations (order matters - code blocks first)
    // Code blocks - lang in attribute; code from escaped text (escapeHtml applied first above)
    html = html.replaceAll(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre><code class="language-${escapeHtml(lang)}">${code.trim()}</code></pre>`;
    });

    // Inline code
    html = html.replaceAll(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);

    // Bold and italic (captured groups are from escaped text)
    html = html.replaceAll(/\*\*([^*]+)\*\*/g, (_, t) => `<strong>${t}</strong>`);
    html = html.replaceAll(/\*([^*]+)\*/g, (_, t) => `<em>${t}</em>`);

    // Links - validate href is safe (http/https only; captured text already escaped)
    html = html.replaceAll(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (_, linkText, href) => {
        const safeHref = /^https?:\/\//i.test(href) ? href : '#';
        return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
      }
    );

    // Paragraphs - split by double newline
    html = html
      .split('\n\n')
      .map(p => `<p>${p.replaceAll(/\n/g, '<br>')}</p>`)
      .join('');

    return html;
  } catch {
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
  if (!components.statusBar || !components.statusText) return;
  components.statusBar.classList.remove('hidden');
  components.statusText.textContent = text;
  if (stateClass === 'hidden') components.statusBar.classList.add('hidden');
}

function updateStepper(stepId: string) {
  components.steps.forEach(s => {
    s.classList.toggle('active', (s as HTMLElement).dataset.step === stepId);
  });
}

async function handleCommand(text: string) {
  const cmd = sanitizeInput(text).trim();

  // API key required for AI commands (skip for slash commands)
  const { [STORAGE_KEYS.API_KEY]: apiKey } = await chrome.storage.local.get(STORAGE_KEYS.API_KEY);
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
    addMessage('Please add your API key in Settings to run commands.', 'status');
    showToast('Open Settings to add your API key', 'warning');
    components.btnSettings?.focus();
    return;
  }

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

  // Pass the currently selected model from the UI dropdown
  const modelSelector = document.getElementById('model-selector') as HTMLSelectElement | null;
  const selectedModel = modelSelector?.value || undefined;
  chrome.runtime.sendMessage({ type: 'executeCommand', command: cmd, model: selectedModel } as ExtensionMessage);
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
  components.commandInput.disabled = running || !navigator.onLine;

  if (running) {
    showLoading('Processing your command...');
  } else {
    hideLoading();
    updateStatus('Ready', 'success');
    updateStepper('');
    setTimeout(() => updateStatus('', 'hidden'), 3000);
  }
}

// Max chat history size to avoid storage limit (~5MB for chrome.storage.local)
const MAX_CHAT_HISTORY_BYTES = 1024 * 1024; // 1MB

// ─── Persistence ────────────────────────────────────────────────
async function saveHistoryImmediate() {
  try {
    let historyHTML = components.chatHistory.innerHTML;
    let bytes = new TextEncoder().encode(historyHTML).length;
    if (bytes > MAX_CHAT_HISTORY_BYTES) {
      const container = components.chatHistory;
      const messages = Array.from(container.querySelectorAll('.chat-msg'));
      for (let i = 0; i < messages.length - 5 && bytes > MAX_CHAT_HISTORY_BYTES; i++) {
        messages[i]?.remove();
        historyHTML = container.innerHTML;
        bytes = new TextEncoder().encode(historyHTML).length;
      }
    }
    await chrome.storage.local.set({ chat_history_backup: historyHTML });
  } catch (err) {
    // Removed console.warn
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
      const savedHtml = data.chat_history_backup;

      // Check if the saved HTML is corrupted (missing angle brackets)
      // Corrupted HTML looks like: div class="chat-msg" instead of <div class="chat-msg">
      const hasCorruptedHtml =
        // Pattern 1: div or span tags without opening angle bracket
        /(^|[^<])div class=/.test(savedHtml) ||
        /(^|[^<])span class=/.test(savedHtml) ||
        // Pattern 2: closing tags without angle bracket
        /div\s*$/.test(savedHtml) ||
        /\/div/.test(savedHtml) && !/<\/div>/.test(savedHtml) ||
        // Pattern 3: any HTML tag pattern missing angle brackets
        /[a-z]+\s+(class|id|style)=["'][^"']*["']/.test(savedHtml) &&
        !/<[a-z]+\s+(class|id|style)=["']/.test(savedHtml);

      if (hasCorruptedHtml) {
        // Clear corrupted history and start fresh
        await chrome.storage.local.remove('chat_history_backup');
        console.log('[HyperAgent] Cleared corrupted chat history - missing angle brackets detected');
        showExampleCommandsIfNeeded();
        return;
      }

      // The saved HTML was already processed by renderMarkdown and addMessage.
      // We use alreadySafeHtml to skip XSS protection which incorrectly 
      // strips angle brackets from valid HTML tags.
      // We only do basic tag filtering to ensure only safe HTML tags remain.
      const result = inputSanitizer.sanitize(savedHtml, {
        allowHtml: true,
        alreadySafeHtml: true, // Skip XSS protection - this HTML is already safe
        allowedTags: ['p', 'br', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li', 'a', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote'],
        allowedAttributes: ['href', 'class', 'target', 'rel', 'title', 'alt'],
      });
      components.chatHistory.innerHTML = result.sanitizedValue;
      scrollToBottom();
    }
    updateChatSearchVisibility();
    showExampleCommandsIfNeeded();
  } catch (err) {
    // Removed console.warn
    showExampleCommandsIfNeeded();
  }
  updateChatSearchVisibility();
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

// billingInterval unused in MVP; kept as placeholder for future billing cycle toggle
// let _selectedBillingInterval: 'month' | 'year' = 'month';

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
    // Removed console.warn
  }
}

// ─── Event Listeners ────────────────────────────────────────────
components.btnExecute.addEventListener('click', () => {
  if (!navigator.onLine) {
    showToast('You are offline. Check your internet connection.', 'error');
    return;
  }
  const text = components.commandInput.value;
  if (text.trim()) void handleCommand(text);
});

components.btnStop.addEventListener('click', async () => {
  if (!state.isRunning) return;

  try {
    components.btnStop.disabled = true;
    addMessage('Stopping...', 'status');

    const response = await chrome.runtime.sendMessage({ type: 'stopAgent' });

    if (response?.ok) {
      setRunning(false);
      updateStatus('Agent stopped', 'hidden');
    } else {
      showToast('Failed to stop agent. Please try again.', 'error');
    }
  } catch (error) {
    showToast('Error stopping agent. Please try again.', 'error');
  } finally {
    components.btnStop.disabled = false;
  }
});

components.commandInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!navigator.onLine) {
      showToast('You are offline. Check your connection.', 'error');
      return;
    }
    const text = components.commandInput.value;
    if (text.trim()) void handleCommand(text);
  }
});

// Offline handling: banner, disable input, block commands
function updateOfflineState() {
  const offline = !navigator.onLine;
  const banner = document.getElementById('offline-banner');
  if (banner) banner.classList.toggle('hidden', !offline);
  components.commandInput.disabled = offline || state.isRunning;
  components.btnExecute.disabled = offline;
}

updateOfflineState(); // Initial state
globalThis.addEventListener('offline', () => {
  updateOfflineState();
  showToast('You are offline. Some features may not work.', 'warning');
});
globalThis.addEventListener('online', () => {
  updateOfflineState();
  showToast('Back online!', 'success');
});
const handleInput = debounce((e: Event) => {
  const target = e.target as HTMLTextAreaElement;

  // Enforce max length (toast shown in immediate input handler)
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
    showToast(`Command truncated to ${MAX_COMMAND_LENGTH} characters`, 'warning');
  }

  target.style.height = 'auto';
  const newHeight = Math.min(target.scrollHeight, 200);
  target.style.height = newHeight + 'px';
  target.style.overflowY = target.scrollHeight > 200 ? 'auto' : 'hidden';

  updateCharCounter(target.value);

  handleInput(e);
});

// Keyboard navigation for command history and suggestions
components.commandInput.addEventListener('keydown', e => {
  const suggestionsVisible = !components.suggestions.classList.contains('hidden');
  const suggestionItems = components.suggestions.querySelectorAll('.suggestion-item');

  // Handle suggestion navigation
  if (suggestionsVisible && suggestionItems.length > 0) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, suggestionItems.length - 1);
      highlightSuggestion(suggestionItems, selectedSuggestionIndex);
      return;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (selectedSuggestionIndex <= 0) {
        // Go back to input
        selectedSuggestionIndex = -1;
        suggestionItems.forEach(item => item.classList.remove('selected'));
        components.commandInput.focus();
      } else {
        selectedSuggestionIndex--;
        highlightSuggestion(suggestionItems, selectedSuggestionIndex);
      }
      return;
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (selectedSuggestionIndex >= 0) {
        e.preventDefault();
        const selected = suggestionItems[selectedSuggestionIndex] as HTMLElement;
        selected.click();
        return;
      }
    } else if (e.key === 'Escape') {
      components.suggestions.classList.add('hidden');
      selectedSuggestionIndex = -1;
      return;
    }
  }

  // Handle command history navigation
  if (e.key === 'ArrowUp' && !suggestionsVisible) {
    e.preventDefault();
    const historyCmd = navigateHistory('up');
    if (historyCmd !== null) {
      components.commandInput.value = historyCmd;
      updateCharCounter(historyCmd);
    }
  } else if (e.key === 'ArrowDown' && !suggestionsVisible) {
    e.preventDefault();
    const historyCmd = navigateHistory('down');
    if (historyCmd !== null) {
      components.commandInput.value = historyCmd;
      updateCharCounter(historyCmd);
    }
  }
});

function highlightSuggestion(items: NodeListOf<Element>, index: number) {
  items.forEach((item, i) => {
    item.classList.toggle('selected', i === index);
  });
}

// Load history on start, then check for missed result (panel closed during task - Scenario 7)
async function initChat() {
  // Clear completion badge when panel opens (user can now see results)
  try {
    chrome.action?.setBadgeText?.({ text: '' });
  } catch {
    /* action API may be unavailable in some contexts */
  }
  await loadHistory();
  loadCommandHistory();
  const data = await chrome.storage.local.get([
    'hyperagent_last_agent_result',
    'hyperagent_show_changelog',
    'hyperagent_agent_interrupted_by_update',
  ]);
  if (data.hyperagent_agent_interrupted_by_update) {
    await chrome.storage.local.remove('hyperagent_agent_interrupted_by_update');
    addMessage('Your previous task was interrupted by an extension update. You can run it again.', 'status');
  }
  const result = data.hyperagent_last_agent_result;
  if (result && typeof result === 'object') {
    const age = Date.now() - (result.timestamp || 0);
    if (age <= 60 * 1000) {
      addMessage(result.finalSummary || 'Task completed', result.success ? 'agent' : 'error');
      showToast('Previous task completed while panel was closed', 'info');
      await chrome.storage.local.remove('hyperagent_last_agent_result');
    }
  }
  if (data.hyperagent_show_changelog) {
    await chrome.storage.local.remove('hyperagent_show_changelog');
    showToast('HyperAgent updated! Check the repository for release notes.', 'info');
  }
}
if (typeof requestIdleCallback === 'function') {
  requestIdleCallback(() => initChat(), { timeout: 100 });
} else {
  setTimeout(() => initChat(), 0);
}

// Changelog and update-interrupt shown from initChat after history loads

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
  openSettingsModal();
});

// Settings button listener is handled in the settings modal section below

// Dark mode toggle
const btnDarkMode = document.getElementById('btn-dark-mode');
if (btnDarkMode) {
  btnDarkMode.addEventListener('click', () => {
    toggleDarkMode();
    btnDarkMode.textContent = document.body.classList.contains('dark-mode') ? '️' : '';
  });
  // Set initial icon
  if (document.body.classList.contains('dark-mode')) {
    btnDarkMode.textContent = '️';
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
    openSettingsModal();
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
      chrome.storage.local.remove('hyperagent_show_onboarding').catch(() => { });
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
      // Show only internal thinking (collapsed); never show summary here to avoid duplicate reply
      if (typeof message.thinking === 'string' && message.thinking.trim()) {
        addMessage(message.thinking.trim(), 'thinking');
      }

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
          // Use 'agent' type so markdown renders (bold for the header, bullets for actions)
          addMessage(`**Executing actions:**\n${trace}`, 'agent');
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
        // Removed console.warn
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
        if (state.confirmTimeoutId) {
          clearTimeout(state.confirmTimeoutId);
          state.confirmTimeoutId = null;
        }
        state.confirmResolve(false);
        state.confirmResolve = null;
      }

      new Promise<boolean>(resolve => {
        state.confirmResolve = (val: boolean) => {
          if (state.confirmTimeoutId) {
            clearTimeout(state.confirmTimeoutId);
            state.confirmTimeoutId = null;
          }
          resolve(val);
          state.confirmResolve = null;
        };
        // Auto-reject after 60s
        state.confirmTimeoutId = setTimeout(() => {
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
        .catch(() => {
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
      updateProgress(success ? 100 : 0);
      // For scheduled tasks, also show a toast so user notices even if panel is collapsed
      if (message.scheduled) {
        showToast(
          success
            ? `✅ Scheduled task completed: ${summary.slice(0, 60)}${summary.length > 60 ? '…' : ''}`
            : `❌ Scheduled task failed: ${summary.slice(0, 60)}${summary.length > 60 ? '…' : ''}`,
          success ? 'success' : 'error'
        );
      }
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
    const txHash = prompt('Enter your transaction hash (0x...):');
    if (!txHash?.trim()) return;

    const walletAddr = prompt('Enter your wallet address (optional, for records):');
    const fromAddress = (walletAddr?.trim() && /^0x[a-fA-F0-9]{40}$/.test(walletAddr.trim()))
      ? walletAddr.trim()
      : 'unknown';

    const chainId = components.cryptoChainSelect ? Number.parseInt(components.cryptoChainSelect.value) : 1;
    const result = await billingManager.confirmCryptoPayment(txHash.trim(), fromAddress, chainId);

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
        setTimeout(() => {
          updateUsageDisplay();
          updateSubscriptionBadge();
        }, 500);
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

// Chat search
const chatSearchInput = document.getElementById('chat-search-input') as HTMLInputElement | null;
if (chatSearchInput) {
  chatSearchInput.addEventListener('input', () => filterChatBySearch(chatSearchInput.value));
  chatSearchInput.addEventListener('search', () => filterChatBySearch(chatSearchInput.value));
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
    // Removed console.warn
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

// ─── Settings Modal ────────────────────────────────────────────────────
const PROVIDER_URLS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta',
};

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
};

const PROVIDER_KEY_HINTS: Record<string, string> = {
  openai: 'OpenAI keys start with sk-',
  anthropic: 'Anthropic keys start with sk-ant-',
  google: 'Google AI Studio keys start with AIza',
};

function detectProviderFromKey(apiKey: string): string {
  if (!apiKey) return 'openai';
  if (apiKey.startsWith('sk-ant-')) return 'anthropic';
  if (apiKey.startsWith('AIza')) return 'google';
  if (apiKey.startsWith('sk-or-')) return 'openrouter';
  if (apiKey.startsWith('sk-')) return 'openai';
  return 'openai';
}

function updateModelOptions(provider: string): void {
  const modelSelect = document.getElementById('settings-model') as HTMLSelectElement;
  if (!modelSelect) return;
  
  const models = PROVIDER_MODELS[provider] || PROVIDER_MODELS.openai;
  modelSelect.innerHTML = models.map(m => `<option value="${m.value}">${m.label}</option>`).join('');
}

function updateProviderHint(provider: string): void {
  const hint = document.getElementById('settings-provider-hint');
  if (hint) {
    hint.textContent = PROVIDER_KEY_HINTS[provider] || 'Enter your API key';
  }
}

async function loadSettingsToModal(): Promise<void> {
  const data = await chrome.storage.local.get([
    'hyperagent_api_key',
    'hyperagent_base_url',
    'hyperagent_model_name',
    'hyperagent_max_steps',
    'hyperagent_require_confirm',
    'hyperagent_enable_vision',
  ]);
  
  const apiKey = data['hyperagent_api_key'] || '';
  const provider = detectProviderFromKey(apiKey);
  
  const providerSelect = document.getElementById('settings-provider') as HTMLSelectElement;
  const apiKeyInput = document.getElementById('settings-api-key') as HTMLInputElement;
  const modelSelect = document.getElementById('settings-model') as HTMLSelectElement;
  const visionCheckbox = document.getElementById('settings-vision') as HTMLInputElement;
  const confirmCheckbox = document.getElementById('settings-confirm') as HTMLInputElement;
  const maxStepsInput = document.getElementById('settings-max-steps') as HTMLInputElement;
  const maxStepsValue = document.getElementById('settings-max-steps-value');
  const keyStatus = document.getElementById('settings-key-status');
  
  if (providerSelect) {
    providerSelect.value = provider;
    updateModelOptions(provider);
    updateProviderHint(provider);
  }
  
  if (apiKeyInput) {
    apiKeyInput.value = apiKey;
    if (keyStatus) {
      keyStatus.textContent = apiKey ? '✓ API key configured' : '';
      keyStatus.className = `text-xs mt-1.5 ${apiKey ? 'text-emerald-500' : ''}`;
    }
  }
  
  if (modelSelect) {
    modelSelect.value = data['hyperagent_model_name'] || PROVIDER_MODELS[provider]?.[0]?.value || 'gpt-3.5-turbo';
  }
  
  if (visionCheckbox) visionCheckbox.checked = data['hyperagent_enable_vision'] !== false;
  if (confirmCheckbox) confirmCheckbox.checked = data['hyperagent_require_confirm'] === true;
  if (maxStepsInput) {
    maxStepsInput.value = String(data['hyperagent_max_steps'] || 12);
    if (maxStepsValue) maxStepsValue.textContent = maxStepsInput.value;
  }
}

async function saveSettingsFromModal(): Promise<void> {
  const providerSelect = document.getElementById('settings-provider') as HTMLSelectElement;
  const apiKeyInput = document.getElementById('settings-api-key') as HTMLInputElement;
  const modelSelect = document.getElementById('settings-model') as HTMLSelectElement;
  const visionCheckbox = document.getElementById('settings-vision') as HTMLInputElement;
  const confirmCheckbox = document.getElementById('settings-confirm') as HTMLInputElement;
  const maxStepsInput = document.getElementById('settings-max-steps') as HTMLInputElement;
  
  const provider = providerSelect?.value || 'openai';
  const apiKey = apiKeyInput?.value.trim() || '';
  const model = modelSelect?.value || 'gpt-3.5-turbo';
  const baseUrl = PROVIDER_URLS[provider] || PROVIDER_URLS.openai;
  
  await chrome.storage.local.set({
    hyperagent_api_key: apiKey,
    hyperagent_base_url: baseUrl,
    hyperagent_model_name: model,
    hyperagent_backup_model: model,
    hyperagent_enable_vision: visionCheckbox?.checked !== false,
    hyperagent_require_confirm: confirmCheckbox?.checked === true,
    hyperagent_max_steps: parseInt(maxStepsInput?.value || '12', 10),
  });
  
  // Update status display
  const keyStatus = document.getElementById('settings-key-status');
  if (keyStatus) {
    keyStatus.textContent = '✓ Settings saved!';
    keyStatus.className = 'text-xs mt-1.5 text-emerald-500';
    setTimeout(() => { keyStatus.textContent = ''; }, 2000);
  }
  
  // Update the provider status display
  await updateProviderStatus();
  
  showToast('Settings saved!', 'success');
  closeSettingsModal();
}

function openSettingsModal(): void {
  const modal = document.getElementById('settings-modal');
  if (modal) {
    modal.classList.remove('hidden');
    loadSettingsToModal();
  }
}

function closeSettingsModal(): void {
  const modal = document.getElementById('settings-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

// Update the provider status display in the UI
async function updateProviderStatus(): Promise<void> {
  const STORAGE_KEY_MODEL = 'hyperagent_model_name';
  const STORAGE_KEY_API = 'hyperagent_api_key';
  
  const data = await chrome.storage.local.get([STORAGE_KEY_API, STORAGE_KEY_MODEL]);
  const apiKey = data[STORAGE_KEY_API] || '';
  const model = data[STORAGE_KEY_MODEL] || '';
  
  const providerIndicator = document.getElementById('provider-indicator');
  const providerName = document.getElementById('provider-name');
  
  if (!apiKey) {
    if (providerIndicator) providerIndicator.className = 'w-1.5 h-1.5 rounded-full bg-red-500';
    if (providerName) providerName.textContent = 'No API key';
    return;
  }
  
  const provider = detectProviderFromKey(apiKey);
  const providerNames: Record<string, string> = {
    openai: 'OpenAI',
    anthropic: 'Claude',
    google: 'Gemini',
    openrouter: 'OpenRouter',
  };
  
  const modelNames: Record<string, string> = {
    'gpt-3.5-turbo': 'GPT-3.5',
    'gpt-4o': 'GPT-4o',
    'gpt-4-turbo': 'GPT-4',
    'claude-3-haiku-20240307': 'Claude Haiku',
    'claude-3-sonnet-20240229': 'Claude Sonnet',
    'claude-3-opus-20240229': 'Claude Opus',
    'gemini-2.0-flash': 'Gemini 2.0',
    'gemini-1.5-pro': 'Gemini 1.5',
  };
  
  const displayName = modelNames[model] || providerNames[provider] || provider;
  
  if (providerIndicator) providerIndicator.className = 'w-1.5 h-1.5 rounded-full bg-emerald-500';
  if (providerName) providerName.textContent = displayName;
}

// Call updateProviderStatus on load and after settings changes
updateProviderStatus();

// Settings modal event listeners
const settingsModal = document.getElementById('settings-modal');
const btnSettingsClose = document.getElementById('btn-settings-close');
const btnSettingsSave = document.getElementById('btn-settings-save');
const settingsProvider = document.getElementById('settings-provider');
const settingsApiKey = document.getElementById('settings-api-key');
const settingsMaxSteps = document.getElementById('settings-max-steps');
const btnToggleKeyVisibility = document.getElementById('btn-toggle-key-visibility');

if (btnSettingsClose) {
  btnSettingsClose.addEventListener('click', closeSettingsModal);
}

if (btnSettingsSave) {
  btnSettingsSave.addEventListener('click', saveSettingsFromModal);
}

if (settingsProvider) {
  settingsProvider.addEventListener('change', () => {
    const provider = (settingsProvider as HTMLSelectElement).value;
    updateModelOptions(provider);
    updateProviderHint(provider);
  });
}

if (settingsMaxSteps) {
  settingsMaxSteps.addEventListener('input', () => {
    const value = document.getElementById('settings-max-steps-value');
    if (value) value.textContent = (settingsMaxSteps as HTMLInputElement).value;
  });
}

if (btnToggleKeyVisibility && settingsApiKey) {
  btnToggleKeyVisibility.addEventListener('click', () => {
    const input = settingsApiKey as HTMLInputElement;
    input.type = input.type === 'password' ? 'text' : 'password';
  });
}

// Close modal when clicking outside
if (settingsModal) {
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      closeSettingsModal();
    }
  });
}

components.btnSettings.addEventListener('click', openSettingsModal);

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
    if (btn) btn.textContent = '️';
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
        // Removed console.warn
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
