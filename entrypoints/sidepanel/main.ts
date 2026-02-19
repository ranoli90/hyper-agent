import type {
  ExtensionMessage,
  Action,
  MsgAgentProgress,
  MsgConfirmActions,
  MsgAgentDone,
  MsgAskUser,
} from '../../shared/types';

// ─── DOM Elements ───────────────────────────────────────────────
const components = {
  chatHistory: document.getElementById('chat-history')!,
  commandInput: document.getElementById('command-input') as HTMLTextAreaElement,
  btnExecute: document.getElementById('btn-execute') as HTMLButtonElement,
  btnStop: document.getElementById('btn-stop') as HTMLButtonElement,
  btnSettings: document.getElementById('btn-settings') as HTMLButtonElement,
  statusBar: document.getElementById('status-bar')!,
  statusText: document.getElementById('status-text')!,
  suggestions: document.getElementById('suggestions-container')!,
  btnMic: document.getElementById('btn-mic') as HTMLButtonElement,

  // Tabs
  tabs: document.querySelectorAll('.tab-btn'),
  panes: document.querySelectorAll('.tab-pane'),

  // Vision
  visionSnapshot: document.getElementById('vision-snapshot') as HTMLImageElement,
  visionPlaceholder: document.getElementById('vision-placeholder')!,

  // Modals
  confirmModal: document.getElementById('confirm-modal')!,
  confirmSummary: document.getElementById('confirm-summary')!,
  confirmList: document.getElementById('confirm-actions-list')!,
  btnConfirm: document.getElementById('btn-confirm')!,
  btnCancel: document.getElementById('btn-cancel')!,

  askModal: document.getElementById('ask-modal')!,
  askQuestion: document.getElementById('ask-question')!,
  askReply: document.getElementById('ask-reply') as HTMLTextAreaElement,
  btnAskReply: document.getElementById('btn-ask-reply')!,
  btnAskCancel: document.getElementById('btn-ask-cancel')!,

  // Stepper
  steps: document.querySelectorAll('.step'),
};

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

// ─── Slash Commands ─────────────────────────────────────────────
const SLASH_COMMANDS = {
  '/clear': () => {
    components.chatHistory.innerHTML = '';
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

// ─── Event Listeners ────────────────────────────────────────────
components.btnExecute.addEventListener('click', () => {
  const text = components.commandInput.value;
  if (text.trim()) handleCommand(text);
});

components.btnStop.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'stopAgent' });
  addMessage('Stopping...', 'status');
});

components.commandInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const text = components.commandInput.value;
    if (text.trim()) handleCommand(text);
  }
});

components.commandInput.addEventListener('input', (e) => {
  const target = e.target as HTMLTextAreaElement;
  target.style.height = 'auto';
  target.style.height = (target.scrollHeight) + 'px';

  const val = target.value;
  if (val.startsWith('/')) showSuggestions(val);
  else components.suggestions.classList.add('hidden');
});

components.btnSettings.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// ─── Message Handler ────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message: any) => {
  switch (message.type) {
    case 'agentProgress': {
      updateStatus(message.status, 'active');
      if (message.step) updateStepper(message.step);
      if (message.summary) addMessage(message.summary, 'thinking');

      // Live Trace: Display the physical actions the agent is taking
      if (message.actionDescriptions && message.actionDescriptions.length > 0) {
        const trace = message.actionDescriptions.map((d: string) => `• ${d}`).join('\n');
        addMessage(`*Executing actions:* \n${trace}`, 'status');
      }
      break;
    }
    case 'visionUpdate': {
      if (message.screenshot) {
        components.visionSnapshot.src = message.screenshot;
        components.visionSnapshot.classList.remove('hidden');
        components.visionPlaceholder.classList.add('hidden');
      }
      break;
    }
    case 'confirmActions': {
      components.confirmSummary.textContent = message.summary;
      components.confirmModal.classList.remove('hidden');
      new Promise<boolean>(resolve => state.confirmResolve = resolve).then(confirmed => {
        chrome.runtime.sendMessage({ type: 'confirmResponse', confirmed });
      });
      break;
    }
    case 'agentDone': {
      addMessage(message.finalSummary, message.success ? 'agent' : 'error');
      setRunning(false);
      break;
    }
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
