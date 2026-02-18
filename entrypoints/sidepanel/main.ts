import type {
  ExtensionMessage,
  Action,
  MsgAgentProgress,
  MsgConfirmActions,
  MsgAgentDone,
  MsgAskUser,
} from '../../shared/types';
import { getSuggestions } from '../../shared/intent';

// ─── DOM references ─────────────────────────────────────────────
const chatHistory = document.getElementById('chat-history')!;
const commandInput = document.getElementById('command-input') as HTMLTextAreaElement;
const btnExecute = document.getElementById('btn-execute') as HTMLButtonElement;
const btnStop = document.getElementById('btn-stop') as HTMLButtonElement;
const btnSettings = document.getElementById('btn-settings') as HTMLButtonElement;
const statusBar = document.getElementById('status-bar')!;
const statusText = document.getElementById('status-text')!;
const suggestionsContainer = document.getElementById('suggestions-container') as HTMLDivElement;

// Confirmation modal
const confirmModal = document.getElementById('confirm-modal')!;
const confirmSummary = document.getElementById('confirm-summary')!;
const confirmActionsList = document.getElementById('confirm-actions-list')!;
const btnConfirm = document.getElementById('btn-confirm')!;
const btnCancel = document.getElementById('btn-cancel')!;

// Ask modal
const askModal = document.getElementById('ask-modal')!;
const askQuestion = document.getElementById('ask-question')!;
const askReply = document.getElementById('ask-reply') as HTMLTextAreaElement;
const btnAskReply = document.getElementById('btn-ask-reply')!;
const btnAskCancel = document.getElementById('btn-ask-cancel')!;

let isRunning = false;
let confirmResolve: ((confirmed: boolean) => void) | null = null;
let askResolve: ((reply: string) => void) | null = null;

// ─── Chat message helpers ───────────────────────────────────────
function addMessage(text: string, type: 'user' | 'agent' | 'status' | 'error' | 'thinking') {
  const div = document.createElement('div');
  div.className = `chat-msg ${type}`;
  div.textContent = text;
  chatHistory.appendChild(div);
  chatHistory.scrollTop = chatHistory.scrollHeight;
  return div;
}

function addMessageWithActions(
  text: string,
  actions: string[] | undefined,
  type: 'agent' | 'thinking' = 'agent'
) {
  const div = document.createElement('div');
  div.className = `chat-msg ${type}`;

  const textSpan = document.createElement('div');
  textSpan.textContent = text;
  div.appendChild(textSpan);

  if (actions && actions.length > 0) {
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'chat-actions';
    actionsDiv.innerHTML = actions
      .map((a) => `<span class="action-tag">${escapeHtml(a)}</span>`)
      .join('');
    div.appendChild(actionsDiv);
  }

  chatHistory.appendChild(div);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function updateStatus(text: string, statusClass: string = 'thinking') {
  statusBar.classList.remove('hidden', 'thinking', 'acting', 'confirming', 'done', 'error');
  statusBar.classList.add(statusClass);
  statusText.textContent = text;
}

function hideStatus() {
  statusBar.classList.add('hidden');
}

function setRunning(running: boolean) {
  isRunning = running;
  btnExecute.classList.toggle('hidden', running);
  btnStop.classList.toggle('hidden', !running);
  commandInput.disabled = running;
  if (!running) {
    updateStatus('Idle', 'done');
    setTimeout(hideStatus, 4000);
  }
}

// ─── Format action for display ──────────────────────────────────
function formatAction(action: Action): { type: string; desc: string } {
  const desc = (action as any).description || '';
  switch (action.type) {
    case 'click':
      return { type: 'click', desc: desc || 'Click element' };
    case 'fill':
      return { type: 'fill', desc: desc || `Enter "${action.value.slice(0, 30)}"` };
    case 'select':
      return { type: 'select', desc: desc || `Select "${action.value}"` };
    case 'scroll':
      return { type: 'scroll', desc: desc || `Scroll ${action.direction}` };
    case 'navigate':
      return { type: 'navigate', desc: desc || `Go to ${action.url.slice(0, 40)}` };
    case 'goBack':
      return { type: 'goBack', desc: desc || 'Go back' };
    case 'wait':
      return { type: 'wait', desc: desc || `Wait ${action.ms}ms` };
    case 'pressKey':
      const mods = (action as any).modifiers?.length ? ` + ${(action as any).modifiers.join('+')}` : '';
      return { type: 'pressKey', desc: desc || `Press ${action.key}${mods}` };
    case 'hover':
      return { type: 'hover', desc: desc || 'Hover element' };
    case 'focus':
      return { type: 'focus', desc: desc || 'Focus element' };
    case 'extract':
      return { type: 'extract', desc: desc || 'Extract data' };
    default:
      return { type: (action as any).type || 'action', desc: JSON.stringify(action).slice(0, 50) };
  }
}

// ─── Confirmation flow ──────────────────────────────────────────
function showConfirmation(actions: Action[], summary: string): Promise<boolean> {
  confirmSummary.textContent = summary || 'The agent wants to perform these actions:';
  confirmActionsList.innerHTML = '';

  for (const action of actions) {
    const formatted = formatAction(action);
    const item = document.createElement('div');
    item.className = 'action-item';

    const typeSpan = document.createElement('div');
    typeSpan.className = 'action-type';
    typeSpan.textContent = formatted.type;

    const descSpan = document.createElement('div');
    descSpan.className = 'action-desc';
    descSpan.textContent = formatted.desc;

    item.appendChild(typeSpan);
    item.appendChild(descSpan);
    confirmActionsList.appendChild(item);
  }

  confirmModal.classList.remove('hidden');
  askReply.value = '';

  return new Promise((resolve) => {
    confirmResolve = resolve;
  });
}

btnConfirm.addEventListener('click', () => {
  confirmModal.classList.add('hidden');
  if (confirmResolve) {
    confirmResolve(true);
    confirmResolve = null;
  }
});

btnCancel.addEventListener('click', () => {
  confirmModal.classList.add('hidden');
  if (confirmResolve) {
    confirmResolve(false);
    confirmResolve = null;
  }
});

// ─── Ask user flow ──────────────────────────────────────────────
function showAskUser(question: string): Promise<string> {
  askQuestion.textContent = question;
  askReply.value = '';
  askModal.classList.remove('hidden');
  askReply.focus();

  return new Promise((resolve) => {
    askResolve = resolve;
  });
}

btnAskReply.addEventListener('click', () => {
  const reply = askReply.value.trim();
  askModal.classList.add('hidden');
  if (askResolve) {
    askResolve(reply);
    askResolve = null;
  }
});

btnAskCancel.addEventListener('click', () => {
  askModal.classList.add('hidden');
  if (askResolve) {
    askResolve('');
    askResolve = null;
  }
});

// Enter to reply in ask modal
askReply.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    btnAskReply.click();
  }
});

// ─── Execute command ────────────────────────────────────────────
btnExecute.addEventListener('click', () => {
  const command = commandInput.value.trim();
  if (!command || isRunning) return;

  addMessage(command, 'user');
  commandInput.value = '';
  setRunning(true);
  updateStatus('Starting...', 'thinking');

  chrome.runtime.sendMessage({ type: 'executeCommand', command } as ExtensionMessage);
});

// ─── Stop agent ─────────────────────────────────────────────────
btnStop.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'stopAgent' } as ExtensionMessage);
  addMessage('Stopping agent...', 'status');
});

// Enter to send (Shift+Enter for newline)
commandInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    btnExecute.click();
  }
});

// ─── Suggestion System ─────────────────────────────────────────────
function showSuggestions(suggestions: string[]) {
  if (suggestions.length === 0) {
    suggestionsContainer.classList.add('hidden');
    return;
  }

  suggestionsContainer.innerHTML = '';
  for (const suggestion of suggestions) {
    const item = document.createElement('div');
    item.className = 'suggestion-item';
    item.textContent = suggestion;
    item.addEventListener('click', () => {
      commandInput.value = suggestion;
      commandInput.focus();
      suggestionsContainer.classList.add('hidden');
    });
    suggestionsContainer.appendChild(item);
  }
  suggestionsContainer.classList.remove('hidden');
}

function hideSuggestions() {
  suggestionsContainer.classList.add('hidden');
}

// Update suggestions on input
let suggestionTimeout: number | null = null;
commandInput.addEventListener('input', () => {
  // Clear previous timeout
  if (suggestionTimeout) {
    clearTimeout(suggestionTimeout);
  }

  const value = commandInput.value;
  if (value.length < 3 || isRunning) {
    hideSuggestions();
    return;
  }

  // Debounce suggestions
  suggestionTimeout = window.setTimeout(() => {
    const suggestions = getSuggestions(value);
    showSuggestions(suggestions);
  }, 150);
});

// Hide suggestions on blur
commandInput.addEventListener('blur', () => {
  // Delay to allow click on suggestion
  setTimeout(hideSuggestions, 200);
});

// Navigate suggestions with arrow keys
commandInput.addEventListener('keydown', (e) => {
  if (suggestionsContainer.classList.contains('hidden')) return;

  const items = suggestionsContainer.querySelectorAll('.suggestion-item');
  if (items.length === 0) return;

  let activeIndex = Array.from(items).findIndex((item) => item.classList.contains('active'));

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (activeIndex >= 0) items[activeIndex].classList.remove('active');
    activeIndex = (activeIndex + 1) % items.length;
    items[activeIndex].classList.add('active');
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (activeIndex >= 0) items[activeIndex].classList.remove('active');
    activeIndex = activeIndex <= 0 ? items.length - 1 : activeIndex - 1;
    items[activeIndex].classList.add('active');
  } else if (e.key === 'Enter' && activeIndex >= 0) {
    e.preventDefault();
    (items[activeIndex] as HTMLElement).click();
  } else if (e.key === 'Escape') {
    hideSuggestions();
  }
});

// ─── Settings button ────────────────────────────────────────────
btnSettings.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// ─── Listen for messages from background ────────────────────────
chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, _sendResponse) => {
    switch (message.type) {
      case 'agentProgress': {
        const msg = message as MsgAgentProgress;

        const statusLabels: Record<string, string> = {
          thinking: 'Thinking...',
          acting: 'Executing...',
          confirming: 'Awaiting confirmation...',
          retrying: 'Retrying...',
          done: 'Done',
          error: 'Error',
        };
        const label = statusLabels[msg.status] || msg.status;
        updateStatus(`Step ${msg.step}/${msg.maxSteps}: ${label}`, msg.status);

        if (msg.summary) {
          // Show thinking separately if present
          if (msg.thinking) {
            addMessage(msg.thinking, 'thinking');
          }
          addMessageWithActions(`[Step ${msg.step}] ${msg.summary}`, msg.actionDescriptions, 'agent');
        }
        break;
      }

      case 'confirmActions': {
        const msg = message as MsgConfirmActions;
        updateStatus(`Step ${msg.step}: Confirm actions`, 'confirming');
        showConfirmation(msg.actions, msg.summary).then((confirmed) => {
          chrome.runtime.sendMessage({
            type: 'confirmResponse',
            confirmed,
          } as ExtensionMessage);
        });
        break;
      }

      case 'askUser': {
        const msg = message as MsgAskUser;
        updateStatus('Awaiting your input...', 'confirming');
        showAskUser(msg.question).then((reply) => {
          chrome.runtime.sendMessage({
            type: 'userReply',
            reply,
          } as ExtensionMessage);
          if (reply) {
            addMessage(`You replied: ${reply.slice(0, 100)}${reply.length > 100 ? '...' : ''}`, 'user');
          }
        });
        break;
      }

      case 'agentDone': {
        const msg = message as MsgAgentDone;
        addMessage(msg.finalSummary, msg.success ? 'agent' : 'error');
        updateStatus(msg.success ? `Complete (${msg.stepsUsed} steps)` : 'Failed', msg.success ? 'done' : 'error');
        setRunning(false);
        break;
      }

      case 'contextMenuCommand': {
        commandInput.value = message.command;
        commandInput.focus();
        break;
      }
    }
    return false;
  }
);

// ─── Welcome message on load ────────────────────────────────────
addMessage(
  'Welcome to HyperAgent! Type a command to get started. I can navigate, click, fill forms, and interact with any webpage on your behalf.',
  'agent'
);
