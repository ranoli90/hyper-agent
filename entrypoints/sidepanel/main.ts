/**
 * @fileoverview HyperAgent side panel UI.
 * Chat, commands, tabs (Memory, Subscription).
 */

import type { ExtensionMessage } from '../../shared/types';
import { validateAndFilterImportData, STORAGE_KEYS, AVAILABLE_MODELS, DEFAULTS, buildGdprExportSnapshot } from '../../shared/config';
import { inputSanitizer } from '../../shared/input-sanitization';
import { debounce } from '../../shared/utils';
import { billingManager } from '../../shared/billing';
import { createConfirmModalController } from './confirm-modal';
import { trapFocus } from './focus-trap';

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

  // Toast container
  toastContainer: document.getElementById('toast-container') as HTMLDivElement | null,
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

const { showConfirm } = createConfirmModalController();

const MAX_COMMAND_LENGTH = 2000;
const COMMAND_RATE_LIMIT_MS = 1000; // 1 second between commands
let selectedSuggestionIndex = -1;

function updateCharCounter(value: string) {
  if (!components.charCounter) return;
  const length = value.length;
  const percentage = (length / MAX_COMMAND_LENGTH) * 100;
  
  components.charCounter.textContent = `${length} / ${MAX_COMMAND_LENGTH}`;
  components.charCounter.classList.toggle('warn', percentage >= 90);
  components.charCounter.classList.toggle('danger', percentage >= 100);
  
  // Show inline warning when approaching limit
  if (percentage >= 90 && percentage < 100) {
    components.charCounter.title = `Approaching limit: ${Math.round(percentage)}% used`;
  } else if (percentage >= 100) {
    components.charCounter.title = `Limit exceeded: ${length - MAX_COMMAND_LENGTH} characters over limit`;
  } else {
    components.charCounter.title = '';
  }
}

// ─── Tab Logic ──────────────────────────────────────────────────
function switchTab(tabId: string) {
  state.activeTab = tabId;

  // Update tab buttons (aria-selected + roving tabindex)
  components.tabs.forEach(btn => {
    const isSelected = (btn as HTMLElement).dataset.tab === tabId;
    btn.classList.toggle('active', isSelected);
    btn.setAttribute('aria-selected', String(isSelected));
    btn.setAttribute('tabindex', isSelected ? '0' : '-1');
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
    // Load memory stats and per-domain strategies
    (async () => {
      try {
        const resp = await chrome.runtime.sendMessage({ type: 'getMemoryStats' });
        if (!resp?.ok) return;

        const statsEl = document.getElementById('memory-stats');
        const listEl = document.getElementById('memory-list');

        const strategies = resp.strategies || {};
        const domainKeys = Object.keys(strategies);

        if (statsEl) {
          statsEl.innerHTML = `
            <div class="flex flex-col gap-2 p-4 text-sm text-zinc-500 dark:text-zinc-400">
              <p><strong class="text-zinc-700 dark:text-zinc-200">Domains:</strong> ${domainKeys.length}</p>
              <p><strong class="text-zinc-700 dark:text-zinc-200">Action History:</strong> ${resp.totalActions || 0} actions logged</p>
              <p><strong class="text-zinc-700 dark:text-zinc-200">Sessions:</strong> ${resp.totalSessions || 0}</p>
            </div>`;
        }

        if (listEl) {
          if (domainKeys.length === 0) {
            listEl.innerHTML = '<p class="text-xs text-zinc-500">No site strategies learned yet.</p>';
            return;
          }

          const fragments: string[] = [];
          for (const domain of domainKeys) {
            const strategy = strategies[domain] || {};
            const successes = Array.isArray(strategy.successfulLocators) ? strategy.successfulLocators.length : 0;
            const failures = Array.isArray(strategy.failedLocators) ? strategy.failedLocators.length : 0;
            const lastUsed = strategy.lastUsed ? new Date(strategy.lastUsed).toLocaleString() : 'N/A';
            const summary = strategy.summary || 'No summary available yet.';

            const runs = (resp.workflowRuns && resp.workflowRuns[domain]) || [];
            const runsHtml = Array.isArray(runs) && runs.length
              ? `<ul class="mt-1 space-y-0.5">
                  ${runs
                    .slice()
                    .reverse()
                    .map((run: any) => {
                      const when = run.timestamp ? new Date(run.timestamp).toLocaleTimeString() : '';
                      const kind = run.type === 'macro' ? 'Macro' : 'Workflow';
                      const label = run.id || 'Unknown';
                      return `<li class="flex items-center justify-between text-[11px]">
                                <span class="text-zinc-500 dark:text-zinc-400">${kind}: <code class="font-mono text-[10px]">${label}</code></span>
                                <span class="text-zinc-400">${when}</span>
                              </li>`;
                    })
                    .join('')}
                 </ul>`
              : '<p class="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">No recent workflows or macros for this site.</p>';

            fragments.push(`
              <div class="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 flex flex-col gap-1">
                <div class="flex items-center justify-between gap-2">
                  <div class="flex flex-col">
                    <span class="text-sm font-medium text-zinc-900 dark:text-zinc-100">${domain}</span>
                    <span class="text-[11px] text-zinc-500 dark:text-zinc-400">Last used: ${lastUsed}</span>
                  </div>
                  <button
                    class="text-[11px] px-2 py-1 rounded border border-red-200 dark:border-red-700 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                    data-domain="${domain}"
                    type="button"
                  >
                    Forget this site
                  </button>
                </div>
                <div class="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                  <span>Successful locators: ${successes}</span>
                  <span class="mx-2">•</span>
                  <span>Failed locators: ${failures}</span>
                </div>
                <p class="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 leading-snug">
                  ${summary}
                </p>
                <div class="mt-1 border-t border-dashed border-zinc-200 dark:border-zinc-800 pt-1.5">
                  <p class="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 mb-0.5">Recent workflows & macros</p>
                  ${runsHtml}
                </div>
              </div>
            `);
          }

          listEl.innerHTML = fragments.join('');

          // Wire up "Forget this site" buttons
          listEl.querySelectorAll('button[data-domain]').forEach(btn => {
            btn.addEventListener('click', async () => {
              const domain = (btn as HTMLButtonElement).dataset.domain;
              if (!domain) return;
              try {
                const result = await chrome.runtime.sendMessage({ type: 'clearDomainMemory', domain });
                if (result?.ok) {
                  showToast(`Forgot site memory for ${domain}`, 'success');
                  switchTab('memory'); // reload memory view
                } else {
                  showToast(`Failed to clear memory for ${domain}`, 'error');
                }
              } catch {
                showToast(`Failed to clear memory for ${domain}`, 'error');
              }
            });
          });
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

// Confirm / cancel modal actions for legacy agent confirmations
components.btnConfirm.addEventListener('click', () => {
  components.confirmModal.classList.add('hidden');
  if (state.cleanupFocusTrap) {
    state.cleanupFocusTrap();
    state.cleanupFocusTrap = null;
  }
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
  if (state.cleanupFocusTrap) {
    state.cleanupFocusTrap();
    state.cleanupFocusTrap = null;
  }
  if (state.confirmResolve) {
    if (state.confirmTimeoutId) {
      clearTimeout(state.confirmTimeoutId);
      state.confirmTimeoutId = null;
    }
    state.confirmResolve(false);
    state.confirmResolve = null;
  }
});

components.confirmModal.addEventListener('click', e => {
  if (e.target === components.confirmModal) {
    components.confirmModal.classList.add('hidden');
    if (state.cleanupFocusTrap) {
      state.cleanupFocusTrap();
      state.cleanupFocusTrap = null;
    }
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
    chrome.storage.local.remove(['activeSession', 'hyperagent_last_agent_result']);
    // Ask background to reset sessions and per-domain memory for the current page.
    chrome.runtime.sendMessage({ type: 'resetPageSession' });
    addMessage('Session reset. Active memory and context for this page have been cleared.', 'status');
  },
  '/memory': () => {
    switchTab('memory');
    addMessage('Analyzing memory patterns...', 'status');
  },
  '/tools': () => {
    addMessage(
      `
**Agent Capabilities:**
- **Navigate**: Go to URLs, click links, navigate between pages
- **Click**: Click buttons, links, and interactive elements
- **Type**: Fill forms, search boxes, and text inputs
- **Extract**: Pull data, text, and information from pages
- **Scroll**: Scroll pages to find content and elements
- **Wait**: Wait for page loads and dynamic content
- **Screenshot**: Capture page screenshots for vision analysis
- **Select**: Choose options from dropdowns and lists
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
  '/debug': () => {
    chrome.runtime
      .sendMessage({ type: 'getMetrics' })
      .then((resp) => {
        if (!resp?.ok || !resp.metrics) {
          addMessage('No debug data available.', 'status');
          return;
        }
        try {
          const logs = Array.isArray(resp.metrics.logs) ? resp.metrics.logs.slice(-5) : [];
          const payload = {
            lastLogs: logs,
            recovery: resp.metrics.recovery,
            rateLimitStatus: resp.metrics.rateLimitStatus,
          };
          addMessage(
            'Debug info for last task (redacted):\n\n```json\n' +
              JSON.stringify(payload, null, 2).slice(0, 1500) +
              '\n```',
            'agent',
          );
        } catch {
          addMessage('Failed to render debug info.', 'error');
        }
      })
      .catch(() => {
        addMessage('Failed to fetch debug info from background.', 'error');
      });
  },
};

const SUGGESTIONS = [
  { command: '/memory', description: 'Search stored knowledge' },
  { command: '/tools', description: 'List available agent tools' },
  { command: '/clear', description: 'Clear chat history' },
  { command: '/debug', description: 'Show debug info for last task' },
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
function addMessage(content: string, type: 'user' | 'agent' | 'error' | 'status' | 'thinking', options: {
  timestamp?: number;
  canRetry?: boolean;
  canEdit?: boolean;
  actions?: string[];
} = {}) {
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
  const timestamp = options.timestamp || Date.now();

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
      const contentDiv = document.createElement('div');
      contentDiv.className = 'message-content';
      contentDiv.innerHTML = renderMarkdown(content);
      div.appendChild(contentDiv);
      
      // Add message actions
      addMessageActions(div, content, type, options);
    } else if (type === 'error') {
      const contentDiv = document.createElement('div');
      contentDiv.className = 'message-content error-content';
      contentDiv.textContent = content;
      div.appendChild(contentDiv);
      
      // Add retry button for errors
      if (options.canRetry) {
        const retryBtn = document.createElement('button');
        retryBtn.className = 'retry-btn text-xs px-2 py-1 mt-2 bg-red-500 hover:bg-red-600 text-white rounded transition-colors';
        retryBtn.textContent = 'Retry';
        retryBtn.addEventListener('click', () => {
          // Remove the error message and retry last command
          div.remove();
          const lastCmd = state.commandHistory[state.commandHistory.length - 1];
          if (lastCmd) {
            handleCommand(lastCmd);
          }
        });
        div.appendChild(retryBtn);
      }
      
      addMessageActions(div, content, type, options);
    } else {
      const contentDiv = document.createElement('div');
      contentDiv.className = 'message-content';
      contentDiv.textContent = content;
      div.appendChild(contentDiv);
      
      // Add edit capability for user messages
      if (type === 'user' && options.canEdit) {
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn text-xs px-2 py-1 mt-1 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 rounded transition-colors';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => {
          components.commandInput.value = content;
          components.commandInput.focus();
          div.remove();
        });
        div.appendChild(editBtn);
      }
      
      addMessageActions(div, content, type, options);
    }
    
    // Add timestamp
    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-timestamp';
    timeDiv.textContent = new Date(timestamp).toLocaleTimeString();
    timeDiv.title = new Date(timestamp).toLocaleString();
    div.appendChild(timeDiv);
    
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

function addMessageActions(container: HTMLElement, content: string, type: string, options: any) {
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'message-actions';
  
  // Copy message
  const copyBtn = document.createElement('button');
  copyBtn.className = 'action-btn';
  copyBtn.innerHTML = '';
  copyBtn.title = 'Copy message';
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(content);
    showToast('Message copied', 'success');
  });
  actionsDiv.appendChild(copyBtn);
  
  // Copy summary (for agent messages)
  if (type === 'agent') {
    const summaryBtn = document.createElement('button');
    summaryBtn.className = 'action-btn';
    summaryBtn.innerHTML = '';
    summaryBtn.title = 'Copy summary';
    summaryBtn.addEventListener('click', () => {
      // Try to extract summary from JSON response
      try {
        const parsed = JSON.parse(content);
        const summary = parsed.summary || content;
        navigator.clipboard.writeText(summary);
        showToast('Summary copied', 'success');
      } catch {
        navigator.clipboard.writeText(content);
        showToast('Message copied', 'success');
      }
    });
    actionsDiv.appendChild(summaryBtn);
  }
  
  container.appendChild(actionsDiv);
}

function updateChatSearchVisibility() {
  const bar = document.getElementById('chat-search-bar');
  const msgs = components.chatHistory?.querySelectorAll('.chat-msg');
  const hasMessages = msgs && msgs.length > 0;
  if (bar) bar.style.display = hasMessages ? 'block' : 'none';
}

// ─── Connection Status & Page Context ──────────────────────────────
async function updateConnectionStatus() {
  const statusEl = document.getElementById('connection-status');
  const indicatorEl = document.getElementById('connection-indicator');
  const textEl = document.getElementById('connection-text');
  const providerNameEl = document.getElementById('provider-name');
  const providerIndicatorEl = document.getElementById('provider-indicator');
  const modelDisplayEl = document.getElementById('model-display');

  if (!statusEl || !indicatorEl || !textEl) return;

  try {
    const { [STORAGE_KEYS.API_KEY]: apiKey } = await chrome.storage.local.get(STORAGE_KEYS.API_KEY);
    
    if (apiKey && apiKey.trim()) {
      // Test connection with a simple request
      const response = await chrome.runtime.sendMessage({ type: 'testConnection' });
      
      if (response?.ok) {
        statusEl.className = 'flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400';
        indicatorEl.className = 'w-2 h-2 rounded-full bg-emerald-500';
        textEl.textContent = 'Connected to OpenRouter';
        
        if (providerNameEl) providerNameEl.textContent = 'OpenRouter';
        if (providerIndicatorEl) providerIndicatorEl.className = 'w-1.5 h-1.5 rounded-full bg-emerald-500';
        if (modelDisplayEl) {
          modelDisplayEl.textContent = 'Auto';
          modelDisplayEl.classList.remove('hidden');
        }
      } else {
        statusEl.className = 'flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-400';
        indicatorEl.className = 'w-2 h-2 rounded-full bg-amber-500';
        textEl.textContent = 'Connection issue';
      }
    } else {
      statusEl.className = 'flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400';
      indicatorEl.className = 'w-2 h-2 rounded-full bg-zinc-400';
      textEl.textContent = 'Not configured';
      
      if (providerNameEl) providerNameEl.textContent = 'Not configured';
      if (providerIndicatorEl) providerIndicatorEl.className = 'w-1.5 h-1.5 rounded-full bg-zinc-400';
      if (modelDisplayEl) modelDisplayEl.classList.add('hidden');
    }
  } catch (err) {
    statusEl.className = 'flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400';
    indicatorEl.className = 'w-2 h-2 rounded-full bg-red-500';
    textEl.textContent = 'Connection failed';
  }
}

async function updatePageContext() {
  const contextEl = document.getElementById('page-context');
  const titleEl = document.getElementById('page-title');
  const urlEl = document.getElementById('page-url');

  if (!contextEl || !titleEl || !urlEl) return;

  try {
    // Get current tab info
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url && tab?.title) {
      // Only show for http/https pages
      if (tab.url.startsWith('http://') || tab.url.startsWith('https://')) {
        contextEl.classList.remove('hidden');
        titleEl.textContent = tab.title;
        titleEl.title = tab.title;
        urlEl.textContent = new URL(tab.url).hostname;
        urlEl.title = tab.url;
      } else {
        contextEl.classList.add('hidden');
      }
    } else {
      contextEl.classList.add('hidden');
    }
  } catch (err) {
    contextEl.classList.add('hidden');
  }
}

// ─── Enhanced Chat Filtering ───────────────────────────────────────
let currentFilter: 'all' | 'errors' | 'clarifications' | 'actions' = 'all';

function setupChatFilters() {
  const errorsBtn = document.getElementById('filter-errors');
  const clarificationsBtn = document.getElementById('filter-clarifications');
  const actionsBtn = document.getElementById('filter-actions');
  const searchInput = document.getElementById('chat-search-input') as HTMLInputElement;

  if (errorsBtn) {
    errorsBtn.addEventListener('click', () => setChatFilter('errors'));
  }
  if (clarificationsBtn) {
    clarificationsBtn.addEventListener('click', () => setChatFilter('clarifications'));
  }
  if (actionsBtn) {
    actionsBtn.addEventListener('click', () => setChatFilter('actions'));
  }
  
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = (e.target as HTMLInputElement).value;
      if (query.trim()) {
        currentFilter = 'all'; // Reset to all when searching
        updateFilterButtons();
      }
      filterChatBySearch(query);
    });
  }
}

function setChatFilter(filter: 'all' | 'errors' | 'clarifications' | 'actions') {
  currentFilter = filter;
  updateFilterButtons();
  applyChatFilter();
}

function updateFilterButtons() {
  const buttons = {
    errors: document.getElementById('filter-errors'),
    clarifications: document.getElementById('filter-clarifications'),
    actions: document.getElementById('filter-actions')
  };

  Object.entries(buttons).forEach(([type, btn]) => {
    if (btn) {
      const isActive = currentFilter === type;
      btn.className = `px-2 py-1 text-xs rounded border transition-colors ${
        isActive 
          ? 'bg-indigo-500 text-white border-indigo-500' 
          : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800'
      }`;
    }
  });
}

function applyChatFilter() {
  const msgs = components.chatHistory?.querySelectorAll('.chat-msg');
  if (!msgs) return;

  if (currentFilter === 'all') {
    msgs.forEach(el => (el as HTMLElement).style.display = '');
    return;
  }

  msgs.forEach(el => {
    const msgEl = el as HTMLElement;
    const shouldShow = shouldShowMessage(msgEl, currentFilter);
    msgEl.style.display = shouldShow ? '' : 'none';
  });
}

function shouldShowMessage(msgEl: HTMLElement, filter: string): boolean {
  const text = msgEl.textContent || '';
  const hasError = msgEl.classList.contains('error') || text.toLowerCase().includes('error');
  const hasClarification = text.toLowerCase().includes('?') || 
                          msgEl.querySelector('.thinking-msg') ||
                          text.toLowerCase().includes('askuser') ||
                          text.toLowerCase().includes('question');
  const hasActions = text.toLowerCase().includes('click') || 
                    text.toLowerCase().includes('navigate') ||
                    text.toLowerCase().includes('fill') ||
                    text.toLowerCase().includes('extract') ||
                    text.includes('"actions"');

  switch (filter) {
    case 'errors': return hasError;
    case 'clarifications': return hasClarification;
    case 'actions': return hasActions;
    default: return true;
  }
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
    // Re-apply current filter when search is cleared
    applyChatFilter();
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
function scrollToBottom() {
  components.chatHistory.scrollTop = components.chatHistory.scrollHeight;
}

function updateStatus(text: string, stateClass: string = 'active') {
  if (!components.statusBar || !components.statusText) return;
  components.statusBar.classList.remove('hidden');
  components.statusText.textContent = text;
  
  // Update stepper based on status
  if (text.includes('Orchestrating') || text.includes('Processing')) {
    updateStepper('observe');
  } else if (text.includes('Planning') || text.includes('Analyzing')) {
    updateStepper('plan');
  } else if (text.includes('Executing') || text.includes('Acting')) {
    updateStepper('act');
  } else if (text.includes('Verifying') || text.includes('Complete')) {
    updateStepper('verify');
  }
  
  if (stateClass === 'hidden') components.statusBar.classList.add('hidden');
}

function updateStepper(stepId: string) {
  if (!components.steps) return;
  
  const stepOrder = ['observe', 'plan', 'act', 'verify'];
  const currentIndex = stepOrder.indexOf(stepId);
  
  components.steps.forEach((s, index) => {
    const stepEl = s as HTMLElement;
    const isCurrent = stepEl.dataset.step === stepId;
    const isPast = index < currentIndex;
    
    stepEl.classList.toggle('active', isCurrent);
    stepEl.classList.toggle('completed', isPast && !isCurrent);
    
    // Update connecting lines
    const lineEl = stepEl.nextElementSibling;
    if (lineEl && lineEl.classList.contains('step-line')) {
      lineEl.classList.toggle('active', isPast || isCurrent);
    }
  });
}

async function handleCommand(text: string) {
  const cmd = sanitizeInput(text).trim();

  // Match slash commands FIRST — they don't require an API key
  const slashKey = Object.keys(SLASH_COMMANDS).find(
    k => cmd === k || cmd.startsWith(k + ' ')
  ) as keyof typeof SLASH_COMMANDS | undefined;

  if (slashKey) {
    SLASH_COMMANDS[slashKey]();
    components.commandInput.value = '';
    return;
  }

  // API key required for AI commands
  const { [STORAGE_KEYS.API_KEY]: apiKey } = await chrome.storage.local.get(STORAGE_KEYS.API_KEY);
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
    addMessage('Please add your API key in Settings to run commands.', 'status');
    showToast('Open Settings to add your API key', 'warning');
    components.btnSettings?.focus();
    return;
  }

  // Rate limiting check
  const now = Date.now();
  if (now - state.lastCommandTime < COMMAND_RATE_LIMIT_MS) {
    const waitMs = COMMAND_RATE_LIMIT_MS - (now - state.lastCommandTime);
    let waitMessage: string;
    if (waitMs >= 1000) {
      const waitSec = Math.ceil(waitMs / 1000);
      waitMessage = `${waitSec} second${waitSec > 1 ? 's' : ''}`;
    } else if (waitMs >= 100) {
      waitMessage = `${Math.round(waitMs / 100) / 10} seconds`;
    } else {
      waitMessage = 'less than a second';
    }
    addMessage(`Please wait ${waitMessage} before sending another command.`, 'status');
    return;
  }

  if (state.isRunning) return;

  state.lastCommandTime = now;
  saveCommandToHistory(cmd);
  state.historyIndex = -1;
  addMessage(cmd, 'user', { canEdit: true, timestamp: Date.now() });
  components.commandInput.value = '';
  components.commandInput.style.height = '';
  setRunning(true);
  switchTab('chat');
  updateStatus('Orchestrating AI...', 'active');
  // Model selection is handled centrally via OpenRouter smart router; no
  // per-command model override is used.
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
  components.commandInput.disabled = running || !navigator.onLine;

  if (running) {
    // Show status bar with progress — do NOT use blocking loading overlay
    updateStatus('Processing your command...', 'active');
  } else {
    hideLoading();
    updateStatus('Ready', 'success');
    updateStepper('');
    setTimeout(() => updateStatus('', 'hidden'), 3000);
  }
}

// Max chat history size to avoid storage limit (~5MB for chrome.storage.local)
const MAX_CHAT_HISTORY_BYTES = 1024 * 1024; // 1MB

// Track message sizes to avoid O(n^2) re-encoding on each trim
interface MessageSize {
  element: Element;
  byteSize: number;
}

// ─── Persistence ────────────────────────────────────────────────
async function saveHistoryImmediate() {
  try {
    const container = components.chatHistory;
    const messages = Array.from(container.querySelectorAll('.chat-msg'));
    
    if (messages.length === 0) {
      await chrome.storage.local.set({ chat_history_backup: '' });
      return;
    }

    // First pass: calculate sizes for all messages
    const messageSizes: MessageSize[] = messages.map(msg => ({
      element: msg,
      byteSize: new TextEncoder().encode(msg.outerHTML).length
    }));

    const totalBytes = messageSizes.reduce((sum, m) => sum + m.byteSize, 0);

    if (totalBytes <= MAX_CHAT_HISTORY_BYTES) {
      await chrome.storage.local.set({ chat_history_backup: container.innerHTML });
      return;
    }

    // Remove oldest messages in batches until under limit
    // Keep at least 5 recent messages
    let currentBytes = totalBytes;
    let removeIndex = 0;
    const minKeep = Math.min(5, messageSizes.length);
    let removedCount = 0;
    
    while (currentBytes > MAX_CHAT_HISTORY_BYTES && removeIndex < messageSizes.length - minKeep) {
      currentBytes -= messageSizes[removeIndex].byteSize;
      messageSizes[removeIndex].element.remove();
      removedCount++;
      removeIndex++;
    }

    // Save remaining HTML
    await chrome.storage.local.set({ chat_history_backup: container.innerHTML });

    if (removedCount > 0) {
      // Inform the user that older messages were trimmed, without adding new
      // chat bubbles that would immediately re-trigger truncation.
      showToast(
        `Older messages were trimmed to keep history under the safe size limit. (${removedCount} message${removedCount > 1 ? 's' : ''} removed)`,
        'info',
      );
    }
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

// ─── DOM-Based HTML Sanitizer ──────────────────────────────────────
// Uses DOMParser for secure sanitization — immune to regex bypass issues.
// Used for loading saved chat history from storage where the HTML was
// originally safe but storage could be tampered with.
const SAFE_TAGS = new Set([
  'p', 'br', 'strong', 'em', 'b', 'i', 'u', 'code', 'pre', 'ul', 'ol', 'li',
  'a', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'hr',
  'sub', 'sup', 'mark', 'small', 'del', 'ins', 'table', 'thead', 'tbody', 'tr',
  'td', 'th', 'caption', 'img', 'details', 'summary',
]);
const SAFE_ATTRS = new Set([
  'href', 'class', 'target', 'rel', 'title', 'alt', 'src', 'width', 'height',
  'colspan', 'rowspan', 'data-cmd',
]);
const DANGEROUS_URL_RE = /^\s*(javascript|data|vbscript)\s*:/i;

function sanitizeHtmlViaDom(html: string): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  sanitizeNode(doc.body);
  return doc.body.innerHTML;
}

function sanitizeNode(node: Node): void {
  const children = Array.from(node.childNodes);
  for (const child of children) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element;
      const tagName = el.tagName.toLowerCase();

      if (!SAFE_TAGS.has(tagName)) {
        // Unwrap: keep text children, remove the disallowed element
        while (el.firstChild) {
          node.insertBefore(el.firstChild, el);
        }
        node.removeChild(el);
        continue;
      }

      // Strip disallowed attributes
      const attrs = Array.from(el.attributes);
      for (const attr of attrs) {
        if (!SAFE_ATTRS.has(attr.name)) {
          el.removeAttribute(attr.name);
        }
      }

      // Sanitize URLs in href/src
      for (const urlAttr of ['href', 'src']) {
        const val = el.getAttribute(urlAttr);
        if (val && DANGEROUS_URL_RE.test(val)) {
          el.removeAttribute(urlAttr);
        }
      }

      // Recurse into children
      sanitizeNode(el);
    }
  }
}

async function loadHistory() {
  try {
    const data = await chrome.storage.local.get('chat_history_backup');
    if (data.chat_history_backup && typeof data.chat_history_backup === 'string') {
      const savedHtml = data.chat_history_backup;

      // DOM-based sanitization: secure against tampered storage.
      // DOMParser handles all HTML edge cases that regex cannot.
      const sanitizedHtml = sanitizeHtmlViaDom(savedHtml);
      components.chatHistory.innerHTML = sanitizedHtml;
      scrollToBottom();
    }
    updateChatSearchVisibility();
    showExampleCommandsIfNeeded();
  } catch (err) {
    showExampleCommandsIfNeeded();
  }
}


function showExampleCommandsIfNeeded() {
  const chatHistory = components.chatHistory;
  if (!chatHistory) return;

  const hasRealContent = chatHistory.querySelector('.chat-msg');
  if (hasRealContent) return;

  // Check if this is first time use
  chrome.storage.local.get(['show_onboarding', 'onboarding_completed']).then(result => {
    const shouldShowOnboarding = result.show_onboarding !== false && !result.onboarding_completed;
    
    if (shouldShowOnboarding) {
      showOnboardingCard();
    } else {
      showDefaultExamples();
    }
  });
}

function showOnboardingCard() {
  const chatHistory = components.chatHistory;
  if (!chatHistory) return;

  const onboardingCard = document.createElement('div');
  onboardingCard.className = 'chat-msg agent onboarding-card';
  onboardingCard.innerHTML = `
    <div class="onboarding-content">
      <div class="onboarding-header">
        <h3> Welcome to HyperAgent!</h3>
        <p>Your AI-powered browser automation assistant is ready to help.</p>
      </div>
      <div class="onboarding-steps">
        <div class="step-item">
          <div class="step-number">1</div>
          <div class="step-content">
            <strong>Add your API Key</strong>
            <p>Get a free key from <a href="https://openrouter.ai/keys" target="_blank">OpenRouter</a></p>
          </div>
        </div>
        <div class="step-item">
          <div class="step-number">2</div>
          <div class="step-content">
            <strong>Try a command</strong>
            <p>Click an example below or type your own</p>
          </div>
        </div>
        <div class="step-item">
          <div class="step-number">3</div>
          <div class="step-content">
            <strong>Watch it work</strong>
            <p>HyperAgent will navigate, click, and extract data for you</p>
          </div>
        </div>
      </div>
      <div class="onboarding-examples">
        <p class="examples-title">Try these examples:</p>
        <div class="example-buttons">
          <button class="example-btn" data-cmd="Go to amazon.com and search for wireless headphones">
             Shop on Amazon
          </button>
          <button class="example-btn" data-cmd="Extract all email addresses from this page">
             Extract emails
          </button>
          <button class="example-btn" data-cmd="Fill out this form with test data">
             Fill forms
          </button>
        </div>
      </div>
      <div class="onboarding-actions">
        <button id="dismiss-onboarding" class="dismiss-btn">Dismiss</button>
        <button id="open-settings-onboarding" class="primary-btn">⚙️ Open Settings</button>
      </div>
    </div>
  `;

  chatHistory.appendChild(onboardingCard);

  // Add event listeners
  const dismissBtn = onboardingCard.querySelector('#dismiss-onboarding');
  const settingsBtn = onboardingCard.querySelector('#open-settings-onboarding');
  const exampleBtns = onboardingCard.querySelectorAll('.example-btn');

  dismissBtn?.addEventListener('click', () => {
    chrome.storage.local.set({ onboarding_completed: true });
    onboardingCard.remove();
    showDefaultExamples();
  });

  settingsBtn?.addEventListener('click', () => {
    components.btnSettings.click();
  });

  exampleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = (btn as HTMLElement).dataset.cmd;
      if (cmd) {
        components.commandInput.value = cmd;
        components.commandInput.focus();
        components.commandInput.dispatchEvent(new Event('input'));
      }
    });
  });
}

function showDefaultExamples() {
  const chatHistory = components.chatHistory;
  if (!chatHistory) return;

  const examples = [
    "Go to amazon.com and search for wireless headphones",
    "Extract all email addresses from this page",
    "Fill out this form with my contact information",
    "Click the 'Add to Cart' button",
  ];

  const examplesContainer = document.createElement('div');
  examplesContainer.className = 'example-commands p-6 text-center';

  const title = document.createElement('p');
  title.className = 'text-zinc-400 dark:text-zinc-500 mb-4 text-sm font-medium';
  title.textContent = 'Try one of these commands:';
  examplesContainer.appendChild(title);

  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'flex flex-col gap-2 max-w-xs mx-auto';

  examples.forEach(cmd => {
    const btn = document.createElement('button');
    btn.className = 'example-cmd bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3.5 cursor-pointer text-left text-sm text-zinc-900 dark:text-zinc-100 transition-all shadow-sm hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950 hover:-translate-y-0.5 hover:shadow-md';
    btn.dataset.cmd = cmd;
    btn.textContent = cmd;

    btn.addEventListener('click', () => {
      components.commandInput.value = cmd;
      components.commandInput.focus();
      components.commandInput.dispatchEvent(new Event('input'));
    });

    buttonContainer.appendChild(btn);
  });

  examplesContainer.appendChild(buttonContainer);

  const hint = document.createElement('p');
  hint.className = 'text-zinc-300 dark:text-zinc-600 mt-4 text-xs';
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
    // Use consistent user-facing names
    const tierNames: Record<string, string> = { community: 'Free', free: 'Free', beta: 'Premium', premium: 'Premium', unlimited: 'Unlimited' };
    components.usageTier.textContent = tierNames[tier] || tier.charAt(0).toUpperCase() + tier.slice(1);

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
    const bannerFree = tier === 'free' || tier === 'community';
    if (banner) {
      banner.className = `plan-banner ${bannerFree ? 'free' : 'premium'}`;
    }
    if (bannerTier) {
      bannerTier.textContent = `${tierNames[tier] || tier} Plan`;
    }
    if (bannerBadge) {
      bannerBadge.textContent = 'Active';
    }

    // Update plan card buttons based on current tier
    const freePlanBtn = document.getElementById('btn-plan-free') as HTMLButtonElement;
    const premiumBtn = document.getElementById('btn-upgrade-premium') as HTMLButtonElement;
    const cancelBtn = document.getElementById('btn-cancel-subscription');

    // Normalize tier name: billing uses 'community'/'beta', usage tracker uses 'free'/'premium'
    const isFree = tier === 'free' || tier === 'community';
    const isPaid = tier === 'premium' || tier === 'beta' || tier === 'unlimited';

    if (freePlanBtn) {
      if (isFree) {
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
      if (isPaid) {
        premiumBtn.textContent = 'Current Plan';
        premiumBtn.className = 'plan-btn current';
        premiumBtn.disabled = true;
      } else {
        premiumBtn.textContent = 'Upgrade';
        premiumBtn.className = 'plan-btn upgrade';
        premiumBtn.disabled = false;
      }
    }
    if (cancelBtn) {
      cancelBtn.classList.toggle('hidden', isFree);
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
    // Don't handle Enter if suggestions are visible and one is selected — 
    // the suggestion keydown handler will handle it instead
    const suggestionsVisible = !components.suggestions.classList.contains('hidden');
    const suggestionItems = components.suggestions.querySelectorAll('.suggestion-item');
    if (suggestionsVisible && suggestionItems.length > 0 && selectedSuggestionIndex >= 0) {
      return; // Let the suggestion handler below deal with this
    }
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

async function checkAgentStillRunning() {
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'getAgentStatus' });
    if (!resp?.ok || !resp.status?.isRunning) return;

    // Re-sync local running state with background so the UI matches reality.
    setRunning(true);
    updateStatus('A previous task is still running...', 'active');
    addMessage('Your previous task is still running in the background.', 'status');
  } catch {
    // Best-effort only; if this fails we simply skip the reminder.
  }
}

// Load history on start, then check for missed/ongoing results.
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
    'hyperagent_storage_recovered',
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

  if (data.hyperagent_storage_recovered) {
    addMessage(
      'Some stored HyperAgent data looked corrupted and was automatically repaired. Affected memory entries may have been reset.',
      'status',
    );
    await chrome.storage.local.remove('hyperagent_storage_recovered');
  }

  // If the background agent is still running from a previous command, show a
  // subtle reminder when the panel is opened again.
  await checkAgentStillRunning();

  // Initialize memory tab controls after basic chat state is ready.
  initMemoryControls().catch(() => {
    // Non-fatal; memory controls will simply remain in default state.
  });
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

// ─── Memory Tab Controls (learning toggle, health check, snapshot) ────
const memoryLearningToggle = document.getElementById('memory-learning-toggle') as HTMLButtonElement | null;
const memoryHealthCheckBtn = document.getElementById('btn-memory-health-check') as HTMLButtonElement | null;
const memoryDownloadBtn = document.getElementById('btn-memory-download') as HTMLButtonElement | null;

async function initMemoryControls() {
  try {
    const data = await chrome.storage.local.get('hyperagent_learning_enabled');
    const enabled = data['hyperagent_learning_enabled'] !== false;
    updateMemoryToggleUI(enabled);
  } catch {
    updateMemoryToggleUI(true);
  }

  memoryLearningToggle?.addEventListener('click', async () => {
    try {
      const current = await chrome.storage.local.get('hyperagent_learning_enabled');
      const enabled = current['hyperagent_learning_enabled'] !== false;
      const next = !enabled;
      await chrome.storage.local.set({ hyperagent_learning_enabled: next });
      updateMemoryToggleUI(next);
      showToast(`Learning ${next ? 'enabled' : 'disabled'}`, 'info');
    } catch {
      showToast('Failed to update learning setting', 'error');
    }
  });

  memoryHealthCheckBtn?.addEventListener('click', async () => {
    try {
      const resp = await chrome.runtime.sendMessage({ type: 'runMemoryHealthCheck' });
      if (resp?.ok) {
        const issues = resp.result?.issues || [];
        if (issues.length === 0) {
          showToast('Memory storage looks healthy.', 'success');
        } else {
          showToast(`Memory health: ${issues.length} issue(s) found and ${resp.result?.repaired ? 'repaired' : 'reported'}.`, 'warning');
        }
      } else {
        showToast('Memory health check failed', 'error');
      }
    } catch {
      showToast('Memory health check failed', 'error');
    }
  });

  memoryDownloadBtn?.addEventListener('click', async () => {
    try {
      const allData = await chrome.storage.local.get([
        'hyperagent_site_strategies',
        'hyperagent_action_history',
        'hyperagent_sessions',
      ]);
      const snapshot = {
        createdAt: new Date().toISOString(),
        siteStrategies: allData['hyperagent_site_strategies'] || {},
        actionHistory: allData['hyperagent_action_history'] || [],
        sessions: allData['hyperagent_sessions'] || {},
      };
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hyperagent-memory-snapshot-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Memory snapshot downloaded.', 'success');
    } catch {
      showToast('Failed to download memory snapshot', 'error');
    }
  });
}

function updateMemoryToggleUI(enabled: boolean) {
  if (!memoryLearningToggle) return;
  memoryLearningToggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  const knob = memoryLearningToggle.firstElementChild as HTMLElement | null;
  if (enabled) {
    memoryLearningToggle.classList.remove('bg-zinc-300', 'dark:bg-zinc-700');
    memoryLearningToggle.classList.add('bg-emerald-500');
    if (knob) knob.style.transform = 'translateX(16px)';
  } else {
    memoryLearningToggle.classList.add('bg-zinc-300', 'dark:bg-zinc-700');
    memoryLearningToggle.classList.remove('bg-emerald-500');
    if (knob) knob.style.transform = 'translateX(0px)';
  }
}

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
  });
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
      const visionSnapshot = document.getElementById('vision-snapshot') as HTMLImageElement | null;
      const visionPlaceholder = document.getElementById('vision-placeholder');
      if (typeof message.screenshot === 'string' && message.screenshot.length > 0 && visionSnapshot) {
        const s = message.screenshot;
        visionSnapshot.src = s.startsWith('data:') ? s : `data:image/jpeg;base64,${s}`;
        visionSnapshot.classList.remove('hidden');
        visionPlaceholder?.classList.add('hidden');
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
      const msgEl = addMessage(summary, success ? 'agent' : 'error');
      // Attach correlation ID when available so users can reference this task
      // in debug logs or support tickets.
      const correlationId = (message as any).correlationId;
      if (msgEl && typeof correlationId === 'string' && correlationId.trim()) {
        const meta = document.createElement('div');
        meta.className = 'message-timestamp';
        meta.textContent = `Debug ID: ${correlationId}`;
        msgEl.appendChild(meta);
      }
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
      addMessage(error, 'error', { canRetry: true, timestamp: Date.now() });
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
  showToast('Voice input coming soon', 'info');
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
      // Clean up any existing verify form when toggling
      const existingForm = document.getElementById('crypto-verify-form');
      if (existingForm) existingForm.remove();
      
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
  components.btnConfirmCrypto.addEventListener('click', () => {
    // Helper to remove any existing form
    const removeExistingForm = () => {
      const existing = document.getElementById('crypto-verify-form');
      if (existing) existing.remove();
    };
    removeExistingForm();

    // Replace prompt() with inline form
    const formEl = document.createElement('div');
    formEl.id = 'crypto-verify-form';
    formEl.className = 'mt-3 flex flex-col gap-2 p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700';
    formEl.innerHTML = `
      <label class="text-xs font-medium text-zinc-600 dark:text-zinc-300">Transaction Hash <span class="text-red-400">*</span></label>
      <input type="text" id="crypto-tx-hash" placeholder="0x..." class="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" autocomplete="off" />
      <p id="crypto-tx-hint" class="text-[11px] text-zinc-400 hidden">Must be 0x followed by 64 hex characters</p>
      <label class="text-xs font-medium text-zinc-600 dark:text-zinc-300">Wallet Address <span class="text-zinc-400">(optional)</span></label>
      <input type="text" id="crypto-wallet-addr" placeholder="0x... (optional)" class="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" autocomplete="off" />
      <div class="flex gap-2 mt-1">
        <button id="crypto-submit-btn" disabled class="flex-1 px-3 py-2 text-sm font-medium text-white bg-indigo-500 rounded-lg opacity-50 cursor-not-allowed transition-all">Verify Payment</button>
        <button id="crypto-cancel-btn" class="px-3 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-all cursor-pointer">Cancel</button>
      </div>`;

    // Insert after the confirm button
    components.btnConfirmCrypto.parentElement?.appendChild(formEl);

    const txInput = formEl.querySelector('#crypto-tx-hash') as HTMLInputElement;
    const txHint = formEl.querySelector('#crypto-tx-hint') as HTMLElement;
    const submitBtn = formEl.querySelector('#crypto-submit-btn') as HTMLButtonElement;
    const cancelBtn = formEl.querySelector('#crypto-cancel-btn') as HTMLButtonElement;
    const walletInput = formEl.querySelector('#crypto-wallet-addr') as HTMLInputElement;

    const TX_HASH_RE = /^0x[a-fA-F0-9]{64}$/;

    // Helper to update submit button state
    const updateSubmitState = () => {
      const val = txInput.value.trim();
      const valid = TX_HASH_RE.test(val);
      const partiallyInvalid = val.length > 2 && !valid;
      txHint.classList.toggle('hidden', !partiallyInvalid);
      submitBtn.disabled = !valid;
      submitBtn.classList.toggle('opacity-50', !valid);
      submitBtn.classList.toggle('cursor-not-allowed', !valid);
      submitBtn.classList.toggle('cursor-pointer', valid);
      submitBtn.classList.toggle('hover:bg-indigo-600', valid);
    };

    txInput.addEventListener('input', updateSubmitState);

    // Handle Enter key to submit
    const handleEnter = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !submitBtn.disabled) {
        e.preventDefault();
        submitBtn.click();
      } else if (e.key === 'Escape') {
        formEl.remove();
      }
    };
    txInput.addEventListener('keydown', handleEnter);
    walletInput.addEventListener('keydown', handleEnter);

    submitBtn.addEventListener('click', async () => {
      const txHash = txInput.value.trim();
      if (!TX_HASH_RE.test(txHash)) return;

      const walletVal = walletInput.value.trim();
      const fromAddress = (walletVal && /^0x[a-fA-F0-9]{40}$/.test(walletVal))
        ? walletVal : 'unknown';

      const chainId = components.cryptoChainSelect ? Number.parseInt(components.cryptoChainSelect.value) : 1;
      formEl.remove();

      const result = await billingManager.confirmCryptoPayment(txHash, fromAddress, chainId);
      if (result.success) {
        showToast('Payment confirmed! Upgrading to Beta...', 'success');
        updateSubscriptionBadge();
      } else {
        showToast(result.error || 'Payment verification failed', 'error');
      }
    });

    cancelBtn.addEventListener('click', () => formEl.remove());
    txInput.focus();
  });
}

if (components.btnCancelSubscription) {
  components.btnCancelSubscription.addEventListener('click', async () => {
    const confirmed = await showConfirm(
      'You\'ll keep your Beta subscription until the end of your billing period.',
      {
        title: 'Cancel Subscription?',
      },
    );
    if (!confirmed) return;
    
    await billingManager.cancelSubscription();
    showToast('Subscription will cancel at end of period', 'info');
    updateSubscriptionBadge();
  });
}

// License key activation
const licenseInput = document.getElementById('license-key-input') as HTMLInputElement;
const licenseBtn = document.getElementById('btn-activate-license');
const licenseStatus = document.getElementById('license-status');

function setLicenseButtonEnabled(enabled: boolean) {
  if (licenseBtn) {
    (licenseBtn as HTMLButtonElement).disabled = !enabled;
    licenseBtn.classList.toggle('opacity-50', !enabled);
    licenseBtn.classList.toggle('cursor-not-allowed', !enabled);
  }
}

async function handleLicenseActivation() {
  if (!licenseBtn || !licenseInput) return;
  
  const key = licenseInput.value.trim();
  if (!key) {
    if (licenseStatus) {
      licenseStatus.textContent = 'Please enter a license key';
      licenseStatus.className = 'license-status error';
      licenseStatus.classList.remove('hidden');
    }
    return;
  }

  // Disable button during activation to prevent double-clicks
  setLicenseButtonEnabled(false);

  try {
    const result = await billingManager.activateWithLicenseKey(key);
    if (licenseStatus) {
      if (result.success) {
        licenseStatus.textContent = 'License activated successfully!';
        licenseStatus.className = 'license-status success';
        showToast('License activated!', 'success');
        
        // Clear the input after success
        licenseInput.value = '';
        
        // Keep button disabled for a moment, then refresh display
        setTimeout(() => {
          updateUsageDisplay();
          updateSubscriptionBadge();
          // Re-enable button after state update
          setLicenseButtonEnabled(true);
        }, 500);
      } else {
        licenseStatus.textContent = result.error || 'Activation failed';
        licenseStatus.className = 'license-status error';
        setLicenseButtonEnabled(true);
      }
      licenseStatus.classList.remove('hidden');
    }
  } catch (err) {
    setLicenseButtonEnabled(true);
    if (licenseStatus) {
      licenseStatus.textContent = 'An unexpected error occurred';
      licenseStatus.className = 'license-status error';
      licenseStatus.classList.remove('hidden');
    }
  }
}

if (licenseBtn && licenseInput) {
  licenseBtn.addEventListener('click', handleLicenseActivation);
  
  // Support Enter key to activate
  licenseInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleLicenseActivation();
    }
  });
}

// Contact Sales button handler
const btnContactSales = document.getElementById('btn-contact-sales');
if (btnContactSales) {
  btnContactSales.addEventListener('click', () => {
    // Open email to sales team
    const subject = encodeURIComponent('Enterprise Plan Inquiry - HyperAgent');
    const body = encodeURIComponent('Hi HyperAgent Team,\n\nI\'m interested in learning more about your Enterprise plan. Please contact me with more information.\n\nBest regards');
    window.open(`mailto:support@jobhuntin.com?subject=${subject}&body=${body}`, '_blank');
  });
}

// Cancel subscription handler already attached via components.btnCancelSubscription above

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

    // Map internal plan IDs to user-facing names
    const planDisplayNames: Record<string, string> = {
      community: 'Free',
      beta: 'Premium',
    };
    const displayName = planDisplayNames[status.plan] || status.plan.charAt(0).toUpperCase() + status.plan.slice(1);
    const isFree = status.plan === 'community';

    badge.textContent = displayName;
    badge.classList.remove('hidden');
    badge.className = `px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase rounded-full ${isFree
      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
      : 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20'
      }`;
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
    <button class="toast-close" aria-label="Close notification">&times;</button>
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
  openrouter: 'https://openrouter.ai/api/v1',
};

const PROVIDER_MODELS: Record<string, { value: string; label: string }[]> = {
  // HyperAgent always uses OpenRouter's smart router (`openrouter/auto`) under
  // the hood. We render a single fixed option so the UI can show a model label,
  // but the underlying model is not user-selectable.
  openrouter: [...AVAILABLE_MODELS],
};

const PROVIDER_KEY_HINTS: Record<string, string> = {
  openrouter: 'Get your key at openrouter.ai/keys',
};

function detectProviderFromKey(_apiKey: string): string {
  return 'openrouter';
}

function updateModelOptions(provider: string): void {
  const modelSelect = document.getElementById('settings-model') as HTMLSelectElement;
  if (!modelSelect) return;

  const models = PROVIDER_MODELS[provider] ?? PROVIDER_MODELS.openrouter;
  modelSelect.innerHTML = models.map(m => `<option value="${m.value}">${m.label}</option>`).join('');
  if (models.length > 0) {
    modelSelect.value = models[0].value;
    modelSelect.disabled = true;
  }
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
    // Always show the single auto model option; underlying model is fixed.
    modelSelect.value = PROVIDER_MODELS.openrouter[0].value;
    modelSelect.disabled = true;
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

  const provider = providerSelect?.value || 'openrouter';
  const apiKey = apiKeyInput?.value.trim() || '';
  const model = DEFAULTS.MODEL_NAME;
  const baseUrl = PROVIDER_URLS.openrouter;

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

  // Update footer provider display
  const providerIndicator = document.getElementById('provider-indicator');
  const providerName = document.getElementById('provider-name');

  // Update settings modal provider status if it exists
  const settingsProviderStatus = document.getElementById('settings-provider-status');

  if (!apiKey) {
    if (providerIndicator) providerIndicator.className = 'w-1.5 h-1.5 rounded-full bg-red-500';
    if (providerName) providerName.textContent = 'No API key';
    if (settingsProviderStatus) {
      settingsProviderStatus.textContent = 'Not configured';
      settingsProviderStatus.className = 'text-[10px] uppercase tracking-wider font-bold text-zinc-400';
    }
    return;
  }

  const provider = detectProviderFromKey(apiKey);
  const providerNames: Record<string, string> = {
    openrouter: 'OpenRouter',
  };

  const modelNames: Record<string, string> = {
    [DEFAULTS.MODEL_NAME]: 'OpenRouter Auto',
  };

  const displayName = modelNames[model] || providerNames[provider] || 'OpenRouter Auto';

  if (providerIndicator) providerIndicator.className = 'w-1.5 h-1.5 rounded-full bg-emerald-500';
  if (providerName) providerName.textContent = displayName;
  
  // Update settings modal status
  if (settingsProviderStatus) {
    settingsProviderStatus.textContent = 'Configured';
    settingsProviderStatus.className = 'text-[10px] uppercase tracking-wider font-bold text-emerald-500';
  }
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
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    // Toggle eye icons
    const eyeOpen = document.getElementById('icon-eye-open');
    const eyeClosed = document.getElementById('icon-eye-closed');
    if (eyeOpen) eyeOpen.classList.toggle('hidden', !isPassword ? false : true);
    if (eyeClosed) eyeClosed.classList.toggle('hidden', !isPassword ? true : false);
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

// Open full options page from settings modal
const btnOpenFullSettings = document.getElementById('btn-open-full-settings');
if (btnOpenFullSettings) {
  btnOpenFullSettings.addEventListener('click', () => {
    closeSettingsModal();
    chrome.runtime.openOptionsPage();
  });
}

// ─── Dark Mode ────────────────────────────────────────────────────
async function toggleDarkMode() {
  const isDark = document.documentElement.classList.toggle('dark');
  document.body.classList.toggle('dark-mode', isDark);
  await chrome.storage.local.set({ dark_mode: isDark });
  updateDarkModeButton(isDark);
  showToast(`${isDark ? 'Dark' : 'Light'} mode enabled`, 'info');
}

function updateDarkModeButton(isDark: boolean) {
  const btn = document.getElementById('btn-dark-mode');
  if (btn) {
    btn.innerHTML = isDark
      ? '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>'
      : '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  }
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
    document.documentElement.classList.add('dark');
    document.body.classList.add('dark-mode');
  }
  updateDarkModeButton(useDark);
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
  const confirmed = await showConfirm(
    'Export includes chat history and preferences. Do not share this file if it contains sensitive data.',
    {
      title: 'Export Settings?',
      listItems: ['This export may include sensitive data such as chat history.'],
    },
  );

  if (!confirmed) return;
  
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
    const subscription = allData[STORAGE_KEYS.SUBSCRIPTION] as any | undefined;

    const exportData = buildGdprExportSnapshot(allData, {
      billingTier: subscription?.tier || billingManager.getTier(),
      billingStatus: subscription?.status || 'active',
    });

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
  // Render inline confirmation card instead of blocking confirm()/prompt() chain
  const card = document.createElement('div');
  card.className = 'chat-msg agent';
  card.innerHTML = `
    <div class="flex flex-col gap-3">
      <div class="flex items-center gap-2 text-red-500 dark:text-red-400 font-semibold text-sm">
        <span class="text-lg">??</span> Permanent Data Deletion
      </div>
      <p class="text-xs text-zinc-500 dark:text-zinc-400">This will permanently delete <strong>all</strong> your data: API key, chat history, workflows, settings, and billing info. This cannot be undone.</p>
      <input type="text" id="delete-confirm-input" placeholder='Type "DELETE" to confirm' class="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500" autocomplete="off" />
      <div class="flex gap-2">
        <button id="delete-confirm-btn" disabled class="flex-1 px-3 py-2 text-sm font-medium text-white bg-red-500 rounded-lg opacity-50 cursor-not-allowed transition-all">Delete All Data</button>
        <button id="delete-cancel-btn" class="flex-1 px-3 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-700 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-all cursor-pointer">Cancel</button>
      </div>
    </div>`;

  const input = card.querySelector('#delete-confirm-input') as HTMLInputElement;
  const confirmBtn = card.querySelector('#delete-confirm-btn') as HTMLButtonElement;
  const cancelBtn = card.querySelector('#delete-cancel-btn') as HTMLButtonElement;

  input.addEventListener('input', () => {
    const matches = input.value.trim() === 'DELETE';
    confirmBtn.disabled = !matches;
    confirmBtn.classList.toggle('opacity-50', !matches);
    confirmBtn.classList.toggle('cursor-not-allowed', !matches);
    confirmBtn.classList.toggle('cursor-pointer', matches);
    confirmBtn.classList.toggle('hover:bg-red-600', matches);
  });

  confirmBtn.addEventListener('click', async () => {
    if (input.value.trim() !== 'DELETE') return;
    card.remove();
    try {
      await chrome.storage.local.clear();
      showToast('All data deleted. The extension will reload.', 'success');
      setTimeout(() => chrome.runtime.reload(), 1500);
    } catch (error) {
      showToast('Delete failed: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error');
    }
  });

  cancelBtn.addEventListener('click', () => {
    card.remove();
    showToast('Data deletion cancelled', 'info');
  });

  components.chatHistory.appendChild(card);
  scrollToBottom();
  input.focus();
}

function showExportOptions(): void {
  // Render inline action card instead of blocking prompt()
  const card = document.createElement('div');
  card.className = 'chat-msg agent';
  card.innerHTML = `
    <div class="flex flex-col gap-2">
      <p class="text-sm font-medium mb-1">Choose an export format:</p>
      <button data-export="settings" class="text-left px-3 py-2 text-sm rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 border border-zinc-200 dark:border-zinc-700 hover:border-indigo-400 transition-all cursor-pointer">?? Settings only</button>
      <button data-export="chat" class="text-left px-3 py-2 text-sm rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 border border-zinc-200 dark:border-zinc-700 hover:border-indigo-400 transition-all cursor-pointer">?? Chat history</button>
      <button data-export="gdpr" class="text-left px-3 py-2 text-sm rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 border border-zinc-200 dark:border-zinc-700 hover:border-indigo-400 transition-all cursor-pointer">?? Full GDPR export (all data)</button>
    </div>`;

  card.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('[data-export]') as HTMLElement | null;
    if (!target) return;
    const exportType = target.dataset.export;
    card.remove();
    switch (exportType) {
      case 'settings': exportSettings(); break;
      case 'chat': exportChatHistory(); break;
      case 'gdpr': exportAllUserData(); break;
    }
  });

  components.chatHistory.appendChild(card);
  scrollToBottom();
}

// ─── Health Check Ping/Pong ─────────────────────────────────────────
// Monitors connection latency between sidepanel and background
let healthCheckInterval: ReturnType<typeof setInterval> | null = null;

function startHealthCheck() {
  // Run health check every 60 seconds
  healthCheckInterval = setInterval(async () => {
    try {
      const start = Date.now();
      const response = await chrome.runtime.sendMessage({ type: 'ping' });
      const latency = Date.now() - start;
      
      if (response?.ok) {
        // Log health check success with latency (debug mode)
        console.debug(`[HyperAgent] Background pingpong latency: ${latency}ms`);
        
        // If latency is too high, warn user
        if (latency > 1000) {
          console.warn(`[HyperAgent] High background latency: ${latency}ms`);
        }
      }
    } catch (err) {
      console.error('[HyperAgent] Health check failed:', err);
    }
  }, 60000);
  
  // Run immediately on startup
  (async () => {
    try {
      const start = Date.now();
      const response = await chrome.runtime.sendMessage({ type: 'ping' });
      const latency = Date.now() - start;
      if (response?.ok) {
        console.log(`[HyperAgent] Initial health check: ${latency}ms latency`);
      }
    } catch {
      console.warn('[HyperAgent] Initial health check failed');
    }
  })();
}

// Stop health check when panel closes
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (healthCheckInterval) {
      clearInterval(healthCheckInterval);
    }
  });
}

// ─── Initialization ─────────────────────────────────────────────
async function initializeApp() {
  try {
    // Load history first
    await loadHistory();
    
    // Setup new features
    setupChatFilters();
    
    // Update connection status and page context
    await updateConnectionStatus();
    await updatePageContext();
    
    // Load persisted active tab
    const { activeTab } = await chrome.storage.local.get('activeTab');
    if (activeTab && ['chat', 'memory', 'subscription'].includes(activeTab)) {
      switchTab(activeTab);
    }
    
    // Set up periodic updates
    setInterval(updateConnectionStatus, 30000); // Update connection status every 30s
    setInterval(updatePageContext, 5000); // Update page context every 5s
    
    // Health check ping/pong - monitor background latency
    startHealthCheck();
    
    // Listen for tab changes
    if (chrome.tabs?.onUpdated) {
      chrome.tabs.onUpdated.addListener(updatePageContext);
    }
    if (chrome.tabs?.onActivated) {
      chrome.tabs.onActivated.addListener(updatePageContext);
    }
    
    console.log('[HyperAgent] App initialized successfully');
  } catch (err) {
    console.error('[HyperAgent] Failed to initialize app:', err);
  }
}

// Persist active tab when switching
const originalSwitchTab = switchTab;
switchTab = function(tabId: string) {
  originalSwitchTab(tabId);
  chrome.storage.local.set({ activeTab: tabId });
};

// Initialize the app
initializeApp();
