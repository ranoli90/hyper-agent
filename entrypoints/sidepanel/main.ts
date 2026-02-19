import type {
  ExtensionMessage,
  Action,
  MsgAgentProgress,
  MsgConfirmActions,
  MsgAgentDone,
  MsgAskUser,
} from '../../shared/types';
import { billingManager, PRICING_PLANS } from '../../shared/billing';

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
    const cmd = components.commandInput.value.replace('/think', '').trim();
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
- \`/memory\`: View stored knowledge
- \`/schedule\`: Manage background tasks
- \`/tools\`: List agent capabilities
- \`/clear\`: Clear chat history
- \`/help\`: Show this message
    `,
      'agent'
    );
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
      return `<pre><code class="language-${lang}">${escapeHtml(code.trim())}</code></pre>`;
    });
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );

    // Wrap lines in paragraphs if they aren't already block elements
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
  if (cmd.startsWith('/') && SLASH_COMMANDS[cmd as keyof typeof SLASH_COMMANDS]) {
    SLASH_COMMANDS[cmd as keyof typeof SLASH_COMMANDS]();
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

  if (!running) {
    updateStatus('Ready', 'success');
    updateStepper('');
    setTimeout(() => updateStatus('', 'hidden'), 3000);
  }
}

// ─── Persistence ────────────────────────────────────────────────
async function saveHistory() {
  const historyHTML = components.chatHistory.innerHTML;
  await chrome.storage.local.set({ chat_history_backup: historyHTML });
}

async function loadHistory() {
  const data = await chrome.storage.local.get('chat_history_backup');
  if (data.chat_history_backup) {
    components.chatHistory.innerHTML = data.chat_history_backup;
    scrollToBottom();
  }
}

function updateUsageDisplay() {
  chrome.runtime.sendMessage({ type: 'getUsage' }, response => {
    if (response?.usage) {
      const { actions, sessions, sessionTime } = response.usage;
      const { actions: limitActions, sessions: limitSessions, tier } = response.limits;

      components.usageActions.textContent = `${actions} / ${limitActions === -1 ? '∞' : limitActions}`;
      components.usageSessions.textContent = `${sessions} / ${limitSessions === -1 ? '∞' : limitSessions}`;
      components.usageTier.textContent = tier.charAt(0).toUpperCase() + tier.slice(1);
    }
  });
}

function loadMarketplace() {
  // Sample workflows for the marketplace
  const workflows = [
    {
      id: 'web-scraper',
      name: 'Web Scraper',
      description: 'Automatically extract data from web pages',
      price: 'Free',
      category: 'Data',
    },
    {
      id: 'email-automation',
      name: 'Email Automation',
      description: 'Send personalized emails based on triggers',
      price: '$4.99',
      category: 'Communication',
    },
    {
      id: 'social-media-poster',
      name: 'Social Media Poster',
      description: 'Schedule and post to multiple social platforms',
      price: '$9.99',
      category: 'Marketing',
    },
    {
      id: 'invoice-processor',
      name: 'Invoice Processor',
      description: 'Extract and process invoice data automatically',
      price: '$14.99',
      category: 'Business',
    },
  ];

  components.marketplaceList.innerHTML = '';
  workflows.forEach(workflow => {
    const card = document.createElement('div');
    card.className = 'workflow-card';
    card.innerHTML = `
      <h4>${workflow.name}</h4>
      <p>${workflow.description}</p>
      <div class="workflow-meta">
        <span class="category">${workflow.category}</span>
        <span class="price">${workflow.price}</span>
      </div>
      <button class="install-btn" data-workflow-id="${workflow.id}">
        ${workflow.price === 'Free' ? 'Install' : 'Purchase'}
      </button>
    `;
    components.marketplaceList.appendChild(card);
  });

  // Add event listeners for install buttons
  components.marketplaceList.querySelectorAll('.install-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const workflowId = (e.target as HTMLElement).dataset.workflowId;
      if (workflowId) {
        installWorkflow(workflowId);
      }
    });
  });
}

function installWorkflow(workflowId: string) {
  addMessage(`Installing workflow: ${workflowId}...`, 'status');

  chrome.runtime.sendMessage({ type: 'installWorkflow', workflowId }, response => {
    if (response?.success) {
      addMessage(`Workflow "${workflowId}" installed successfully!`, 'agent');
    } else {
      addMessage(`Failed to install workflow: ${response?.error || 'Unknown error'}`, 'error');
    }
  });
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
          card.innerHTML = `
            <div class="memory-domain">${domain}</div>
            <div class="memory-stats-row">
              <span>Success: ${s.successfulLocators?.length || 0}</span>
              <span>Failed: ${s.failedLocators?.length || 0}</span>
            </div>
            <div class="memory-last-used">Last used: ${s.lastUsed ? new Date(s.lastUsed).toLocaleDateString() : 'Never'}</div>
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
async function loadTasksTab() {
  const tasksList = document.getElementById('tasks-list');
  if (!tasksList) return;

  try {
    const response = await chrome.runtime.sendMessage({ type: 'getScheduledTasks' });

    if (response?.tasks && response.tasks.length > 0) {
      tasksList.innerHTML = '';

      response.tasks.forEach((task: any) => {
        const item = document.createElement('div');
        item.className = 'task-item';
        item.innerHTML = `
          <div class="task-header">
            <span class="task-name">${task.name}</span>
            <span class="task-status ${task.enabled ? 'enabled' : 'disabled'}">${task.enabled ? 'Active' : 'Paused'}</span>
          </div>
          <div class="task-command">${task.command}</div>
          <div class="task-schedule">${formatSchedule(task.schedule)}</div>
          <div class="task-next-run">Next: ${task.nextRun ? new Date(task.nextRun).toLocaleString() : 'Not scheduled'}</div>
          <div class="task-actions">
            <button class="btn-small" data-task-id="${task.id}" data-action="toggle">${task.enabled ? 'Pause' : 'Enable'}</button>
            <button class="btn-small btn-danger" data-task-id="${task.id}" data-action="delete">Delete</button>
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

  const captureBtn = document.getElementById('btn-capture-vision');
  if (captureBtn) {
    captureBtn.addEventListener('click', async () => {
      try {
        const response = await chrome.runtime.sendMessage({ type: 'captureScreenshot' });
        if (response?.dataUrl) {
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

// Load history on start
loadHistory();

components.btnSettings.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// ─── Message Handler ────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message: any) => {
  // Validate message structure
  if (!message || typeof message !== 'object' || !message.type) return;

  switch (message.type) {
    case 'agentProgress': {
      if (typeof message.status === 'string') updateStatus(message.status, 'active');
      if (typeof message.step === 'string') updateStepper(message.step);
      if (typeof message.summary === 'string') addMessage(message.summary, 'thinking');

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
      if (typeof message.screenshot === 'string' && message.screenshot.length > 0) {
        components.visionSnapshot.src = message.screenshot;
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

      new Promise<boolean>(resolve => {
        // Store resolve function in state so buttons can call it
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
let voiceInterface = new VoiceInterface({
  onStart: () => {
    components.btnMic.classList.add('active');
    components.commandInput.placeholder = 'Listening...';
  },
  onEnd: () => {
    components.btnMic.classList.remove('active');
    components.commandInput.placeholder = 'Ask HyperAgent...';
    const text = components.commandInput.value.trim();
    if (text) handleCommand(text);
  },
  onResult: text => {
    components.commandInput.value = text;
  },
});

components.btnUpgradePremium.addEventListener('click', async () => {
  await billingManager.openCheckout('premium');
  addMessage('Redirecting to Stripe checkout for Premium plan...', 'status');
});

components.btnUpgradeUnlimited.addEventListener('click', async () => {
  await billingManager.openCheckout('unlimited');
  addMessage('Redirecting to Stripe checkout for Unlimited plan...', 'status');
});

// Init
addMessage('**HyperAgent Dashboard Initialized.** Ready for commands.', 'agent');
switchTab('chat');
updateCharCounter(components.commandInput.value || '');
