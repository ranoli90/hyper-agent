import type {
  ExtensionMessage,
  Action,
  MsgAgentProgress,
  MsgConfirmActions,
  MsgAgentDone,
  MsgAskUser,
} from '../../shared/types';

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
  btnMic: safeGetElement<HTMLButtonElement>('btn-mic')!,

  // Tabs
  tabs: document.querySelectorAll('.tab-btn'),
  panes: document.querySelectorAll('.tab-pane'),

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
if (!components.chatHistory || !components.commandInput || !components.btnExecute) {
  console.error('[HyperAgent] Failed to initialize critical UI components.');
  // Optionally render a "Broken UI" error message directly to body if completely failed
}

// ─── State ──────────────────────────────────────────────────────
const state = {
  isRunning: false,
  confirmResolve: null as ((confirmed: boolean) => void) | null,
  askResolve: null as ((reply: string) => void) | null,
  activeTab: 'chat',
};

// ─── Tab Logic ──────────────────────────────────────────────────
function switchTab(tabId: string) {
  state.activeTab = tabId;
  components.tabs.forEach(btn => {
    btn.classList.toggle('active', (btn as HTMLElement).dataset.tab === tabId);
  });
  components.panes.forEach(pane => {
    pane.classList.toggle('active', pane.id === `tab-${tabId}`);
  });
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
    addMessage(`
**Active Tools:**
- **Email**: Draft or send emails
- **Calendar**: Manage meetings
- **File**: Process downloads
- **Calculator**: Math operations
- **Time**: Current world time
    `, 'agent');
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
    addMessage(`
**Hyper-Commands:**
- \`/memory\`: View stored knowledge
- \`/schedule\`: Manage background tasks
- \`/tools\`: List agent capabilities
- \`/clear\`: Clear chat history
- \`/help\`: Show this message
    `, 'agent');
  }
};

const SUGGESTIONS = [
  { command: '/memory', description: 'Search stored knowledge' },
  { command: '/schedule', description: 'Manage background tasks' },
  { command: '/tools', description: 'List available agent tools' },
  { command: '/clear', description: 'Clear chat history' },
  { command: '/help', description: 'Help & documentation' },
];

function showSuggestions(query: string) {
  const container = components.suggestions;
  if (!container) return;

  const matches = SUGGESTIONS.filter(s =>
    s.command.toLowerCase().startsWith(query.toLowerCase()) ||
    s.description.toLowerCase().includes(query.toLowerCase())
  );

  if (matches.length === 0) {
    container.classList.add('hidden');
    return;
  }

  container.innerHTML = '';
  matches.forEach(s => {
    const div = document.createElement('div');
    div.className = 'suggestion-item';
    div.innerHTML = `
      <span class="command">${s.command}</span>
      <span class="desc">${s.description}</span>
    `;
    div.addEventListener('click', () => {
      components.commandInput.value = s.command + ' ';
      components.commandInput.focus();
      container.classList.add('hidden');

      // Auto-resize after selection
      components.commandInput.dispatchEvent(new Event('input'));
    });
    container.appendChild(div);
  });

  container.classList.remove('hidden');
}

// ─── Chat Interface ─────────────────────────────────────────────
function addMessage(content: string, type: 'user' | 'agent' | 'error' | 'status' | 'thinking') {
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
  let html = text.replace(/```(\w*)([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code class="language-${lang}">${escapeHtml(code.trim())}</code></pre>`;
  });
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

  // Wrap lines in paragraphs if they aren't already block elements
  html = html.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
  return html;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
  const cmd = text.trim();
  if (cmd.startsWith('/') && SLASH_COMMANDS[cmd as keyof typeof SLASH_COMMANDS]) {
    SLASH_COMMANDS[cmd as keyof typeof SLASH_COMMANDS]();
    components.commandInput.value = '';
    return;
  }

  if (state.isRunning) return;

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
    useAutonomous: true
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
  await chrome.storage.local.set({ 'chat_history_backup': historyHTML });
}

async function loadHistory() {
  const data = await chrome.storage.local.get('chat_history_backup');
  if (data.chat_history_backup) {
    components.chatHistory.innerHTML = data.chat_history_backup;
    scrollToBottom();
  }
}

// ─── Utilities ──────────────────────────────────────────────────
function debounce(func: Function, wait: number) {
  let timeout: any;
  return function (...args: any[]) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
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

components.commandInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const text = components.commandInput.value;
    if (text.trim()) handleCommand(text);
  }
});

const handleInput = debounce((e: Event) => {
  const target = e.target as HTMLTextAreaElement;

  // Auto-resize with max-height
  target.style.height = 'auto';
  const newHeight = Math.min(target.scrollHeight, 200); // Cap at 200px
  target.style.height = newHeight + 'px';
  target.style.overflowY = target.scrollHeight > 200 ? 'auto' : 'hidden';

  const val = target.value;
  if (val.startsWith('/')) showSuggestions(val);
  else components.suggestions.classList.add('hidden');
}, 100);

components.commandInput.addEventListener('input', (e) => {
  // Immediate resize for better feel, logic in debounce handles suggestions
  const target = e.target as HTMLTextAreaElement;
  target.style.height = 'auto';
  const newHeight = Math.min(target.scrollHeight, 200);
  target.style.height = newHeight + 'px';
  target.style.overflowY = target.scrollHeight > 200 ? 'auto' : 'hidden';

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
        const validDescriptions = message.actionDescriptions.filter((d: any) => typeof d === 'string');
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
      const question = typeof message.question === 'string' ? message.question : 'Agent needs more information.';
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
        state.confirmResolve = resolve;
        // Timeout after 30 seconds to prevent hanging
        setTimeout(() => {
          if (state.confirmResolve) {
            state.confirmResolve(false);
            state.confirmResolve = null;
          }
        }, 30000);
      }).then(confirmed => {
        chrome.runtime.sendMessage({ type: 'confirmResponse', confirmed });
      });
      break;
    }
    case 'agentDone': {
      const summary = typeof message.finalSummary === 'string' ? message.finalSummary : 'Task completed';
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
    components.commandInput.placeholder = "Listening...";
  },
  onEnd: () => {
    components.btnMic.classList.remove('active');
    components.commandInput.placeholder = "Ask HyperAgent...";
    const text = components.commandInput.value.trim();
    if (text) handleCommand(text);
  },
  onResult: (text) => {
    components.commandInput.value = text;
  }
});

components.btnMic.addEventListener('click', () => {
  voiceInterface.isListening ? voiceInterface.stopListening() : voiceInterface.startListening();
});

// Init
addMessage('**HyperAgent Dashboard Initialized.** Ready for commands.', 'agent');
switchTab('chat');
