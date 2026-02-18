import { loadSettings, isSiteBlacklisted, DEFAULTS } from '../shared/config';
import { callLLM, type HistoryEntry } from '../shared/llmClient';
import { runMacro as executeMacro } from '../shared/macros';
import { runWorkflow as executeWorkflow, getWorkflowById } from '../shared/workflows';
import { trackActionStart, trackActionEnd, getMetrics, getActionMetrics, getSuccessRateByDomain } from '../shared/metrics';
import { createSession, getActiveSession, updateSessionPageInfo, addActionToSession, addResultToSession, updateExtractedData } from '../shared/session';
import { checkDomainAllowed, checkActionAllowed, checkRateLimit, initializeSecuritySettings, getPrivacySettings, getSecurityPolicy, type PrivacySettings, type SecurityPolicy } from '../shared/security';
import type {
  ExtensionMessage,
  Action,
  MacroAction,
  WorkflowAction,
  PageContext,
  MsgAgentProgress,
  MsgConfirmActions,
  MsgAgentDone,
  ErrorContext,
  ActionResult,
} from '../shared/types';

export default defineBackground(() => {
  // ─── Agent state ───────────────────────────────────────────────
  let agentRunning = false;
  let agentAborted = false;
  let pendingConfirmResolve: ((confirmed: boolean) => void) | null = null;
  let pendingUserReplyResolve: ((reply: string) => void) | null = null;
  let currentSessionId: string | null = null;

  // ─── Advanced Error Recovery State ──────────────────────────────
  const recoveryAttempts = new Map<string, { attempt: number; strategy: string; timestamp: number }>();
  const MAX_RECOVERY_ATTEMPTS = 3;
  const RECOVERY_LOG_MAX_ENTRIES = 100;
  const recoveryLog: { timestamp: number; action: string; error: string; strategy: string; outcome: string }[] = [];

  // ─── Recovery tracking helper ─────────────────────────────────────
  function getRecoveryKey(action: Action): string {
    return `${action.type}-${JSON.stringify(action).slice(0, 30)}`;
  }

  function logRecoveryOutcome(action: Action, error: string, strategy: string, outcome: string): void {
    const entry = {
      timestamp: Date.now(),
      action: action.type,
      error,
      strategy,
      outcome,
    };
    recoveryLog.push(entry);
    // Keep log bounded
    if (recoveryLog.length > RECOVERY_LOG_MAX_ENTRIES) {
      recoveryLog.shift();
    }
    console.log(`[HyperAgent] Recovery ${outcome}: ${action.type} - ${error} - ${strategy}`);
  }

  function getRecoveryAttempt(action: Action): number {
    const key = getRecoveryKey(action);
    const entry = recoveryAttempts.get(key);
    return entry?.attempt || 0;
  }

  function incrementRecoveryAttempt(action: Action, strategy: string): void {
    const key = getRecoveryKey(action);
    const entry = recoveryAttempts.get(key) || { attempt: 0, strategy: '', timestamp: 0 };
    entry.attempt += 1;
    entry.strategy = strategy;
    entry.timestamp = Date.now();
    recoveryAttempts.set(key, entry);
  }

  function clearRecoveryAttempt(action: Action): void {
    const key = getRecoveryKey(action);
    recoveryAttempts.delete(key);
  }

  // ─── On install: configure side panel ───────────────────────────
  chrome.runtime.onInstalled.addListener(async () => {
    if (chrome.sidePanel?.setPanelBehavior) {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    }

    chrome.contextMenus.create({
      id: 'hyperagent-send-page',
      title: 'Send this page to HyperAgent',
      contexts: ['page'],
    });

    chrome.contextMenus.create({
      id: 'hyperagent-summarize',
      title: 'Summarize this page with HyperAgent',
      contexts: ['page'],
    });

    chrome.contextMenus.create({
      id: 'hyperagent-selection',
      title: 'Ask HyperAgent about selection',
      contexts: ['selection'],
    });

    const settings = await loadSettings();
    if (!settings.apiKey) {
      chrome.runtime.openOptionsPage();
    }

    // Restore session on startup
    const existingSession = await getActiveSession();
    if (existingSession) {
      currentSessionId = existingSession.id;
      console.log('[HyperAgent] Restored session:', existingSession.id);
    }

    // Initialize security settings (Iteration 15)
    await initializeSecuritySettings();
  });

  // ─── Context menu handler ──────────────────────────────────────
  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!tab?.id) return;

    if (chrome.sidePanel?.open) {
      await chrome.sidePanel.open({ tabId: tab.id });
    }

    let command = '';
    switch (info.menuItemId) {
      case 'hyperagent-send-page':
        command = `Analyze this page: ${tab.url}`;
        break;
      case 'hyperagent-summarize':
        command = `Summarize the content of this page in detail.`;
        break;
      case 'hyperagent-selection':
        command = `Regarding the selected text: "${info.selectionText?.slice(0, 500)}" — explain or act on this.`;
        break;
    }

    if (command) {
      setTimeout(() => {
        sendToSidePanel({ type: 'contextMenuCommand', command });
      }, 600);
    }
  });

  // ─── Message routing ───────────────────────────────────────────
  chrome.runtime.onMessage.addListener(
    (message: ExtensionMessage, _sender, sendResponse) => {
      switch (message.type) {
        case 'executeCommand': {
          if (agentRunning) {
            sendResponse({ ok: false, error: 'Agent is already running' });
            return true;
          }
          runAgentLoop(message.command).catch((err) => {
            console.error('[HyperAgent] Agent loop error:', err);
            sendToSidePanel({
              type: 'agentDone',
              finalSummary: `Agent error: ${err.message || String(err)}`,
              success: false,
              stepsUsed: 0,
            });
            agentRunning = false;
          });
          sendResponse({ ok: true });
          return true;
        }

        case 'stopAgent': {
          agentAborted = true;
          if (pendingConfirmResolve) {
            pendingConfirmResolve(false);
            pendingConfirmResolve = null;
          }
          if (pendingUserReplyResolve) {
            pendingUserReplyResolve('');
            pendingUserReplyResolve = null;
          }
          return false;
        }

        case 'confirmResponse': {
          if (pendingConfirmResolve) {
            pendingConfirmResolve(message.confirmed);
            pendingConfirmResolve = null;
          }
          return false;
        }

        case 'userReply': {
          if (pendingUserReplyResolve) {
            pendingUserReplyResolve(message.reply);
            pendingUserReplyResolve = null;
          }
          return false;
        }
      }
      return false;
    }
  );

  // ─── Helper: send message to side panel ────────────────────────
  function sendToSidePanel(msg: ExtensionMessage) {
    chrome.runtime.sendMessage(msg).catch(() => {});
  }

  // ─── Helper: get active tab ────────────────────────────────────
  async function getActiveTabId(): Promise<number> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('No active tab found');
    return tab.id;
  }

  // ─── Helper: ensure content script and get context ─────────────
  async function getPageContext(tabId: number): Promise<PageContext> {
    // Try direct message first
    try {
      const response = await chrome.tabs.sendMessage(tabId, { type: 'getContext' });
      if (response?.context) return response.context;
    } catch { /* content script not ready */ }

    // Inject content script
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['/content-scripts/content.js'],
      });
      await delay(400);
      const response = await chrome.tabs.sendMessage(tabId, { type: 'getContext' });
      if (response?.context) return response.context;
    } catch (err: any) {
      console.error('[HyperAgent] Failed to inject/query content script:', err);
    }

    // Minimal fallback
    const tab = await chrome.tabs.get(tabId);
    return {
      url: tab.url || '',
      title: tab.title || '',
      bodyText: '',
      metaDescription: '',
      formCount: 0,
      semanticElements: [],
      timestamp: Date.now(),
      scrollPosition: { x: 0, y: 0 },
      viewportSize: { width: 0, height: 0 },
      pageHeight: 0,
    };
  }

  // ─── Helper: capture screenshot ────────────────────────────────
  async function captureScreenshot(): Promise<string> {
    try {
      const dataUrl = await chrome.tabs.captureVisibleTab(undefined as any, {
        format: 'jpeg',
        quality: 60,
      });
      return dataUrl.replace(/^data:image\/\w+;base64,/, '');
    } catch (err) {
      console.warn('[HyperAgent] Screenshot capture failed:', err);
      return '';
    }
  }

  // ─── Helper: check if action is destructive ────────────────────
  function isDestructive(action: Action): boolean {
    if (action.destructive === true) return true;
    if (action.type === 'navigate') return true;
    if (action.type === 'goBack') return true;
    if (action.type === 'closeTab') return true;
    if (action.type === 'click' || action.type === 'pressKey') {
      const desc = ((action as any).description || '').toLowerCase();
      const destructiveKeywords = [
        'submit', 'buy', 'purchase', 'order', 'confirm', 'delete',
        'remove', 'post', 'send', 'pay', 'checkout', 'sign out',
        'log out', 'unsubscribe', 'cancel subscription', 'place order',
        'complete purchase', 'publish', 'reply', 'comment',
      ];
      if (destructiveKeywords.some((kw) => desc.includes(kw))) return true;
    }
    return false;
  }

  // ─── Helper: ask user confirmation ─────────────────────────────
  function askUserConfirmation(actions: Action[], step: number, summary: string): Promise<boolean> {
    return new Promise((resolve) => {
      pendingConfirmResolve = resolve;
      sendToSidePanel({
        type: 'confirmActions',
        actions,
        step,
        summary,
      } as MsgConfirmActions);

      setTimeout(() => {
        if (pendingConfirmResolve) {
          pendingConfirmResolve(false);
          pendingConfirmResolve = null;
        }
      }, DEFAULTS.CONFIRM_TIMEOUT_MS);
    });
  }

  // ─── Helper: ask user for info ─────────────────────────────────
  function askUserForInfo(question: string): Promise<string> {
    return new Promise((resolve) => {
      pendingUserReplyResolve = resolve;
      sendToSidePanel({ type: 'askUser', question });

      setTimeout(() => {
        if (pendingUserReplyResolve) {
          pendingUserReplyResolve('');
          pendingUserReplyResolve = null;
        }
      }, 120000); // 2 min timeout for user replies
    });
  }

  // ─── Helper: execute a single action with optional retry + error classification ───
  async function executeAction(
    tabId: number,
    action: Action,
    dryRun: boolean,
    autoRetry: boolean,
    pageUrl?: string
  ): Promise<{ success: boolean; error?: string; errorType?: string; extractedData?: string; recovered?: boolean }> {
    // Start metrics tracking
    const actionId = trackActionStart(action, pageUrl);
    const startTime = Date.now();
    let pageUrlToTrack = pageUrl;
    
    if (dryRun) {
      console.log('[HyperAgent][DRY-RUN] Would execute:', JSON.stringify(action));
      trackActionEnd(actionId, true, Date.now() - startTime, pageUrl);
      return { success: true };
    }

    // Handle navigation in background
    if (action.type === 'navigate') {
      try {
        await chrome.tabs.update(tabId, { url: action.url });
        await waitForTabLoad(tabId);
        return { success: true };
      } catch (err: any) {
        return { success: false, error: `Navigation failed: ${err.message}`, errorType: 'NAVIGATION_ERROR' };
      }
    }

    if (action.type === 'goBack') {
      try {
        await chrome.tabs.goBack(tabId);
        await waitForTabLoad(tabId);
        return { success: true };
      } catch (err: any) {
        return { success: false, error: `Go back failed: ${err.message}`, errorType: 'NAVIGATION_ERROR' };
      }
    }

    if (action.type === 'wait') {
      await delay(action.ms);
      return { success: true };
    }

    // Handle tab actions in background (no content script needed)
    if (action.type === 'openTab') {
      const result = await openTab(action.url, action.active);
      if (result.success && result.tabId) {
        return { success: true, extractedData: `Opened tab ${result.tabId}: ${action.url}` };
      }
      return { success: false, error: result.error || 'Failed to open tab' };
    }

    if (action.type === 'closeTab') {
      const targetTabId = action.tabId ?? tabId;
      const result = await closeTab(targetTabId);
      if (result.success) {
        return { success: true, extractedData: `Closed tab ${targetTabId}` };
      }
      return { success: false, error: result.error || 'Failed to close tab' };
    }

    if (action.type === 'switchTab') {
      let targetTabId = action.tabId;
      
      // If no tabId provided, try to find by URL pattern
      if (!targetTabId && action.urlPattern) {
        const findResult = await findTabByUrl(action.urlPattern);
        if (!findResult.success || !findResult.tabId) {
          return { success: false, error: findResult.error || 'Tab not found' };
        }
        targetTabId = findResult.tabId;
      }

      if (!targetTabId) {
        return { success: false, error: 'No tabId or urlPattern provided for switchTab' };
      }

      const result = await switchToTab(targetTabId);
      if (result.success) {
        return { success: true, extractedData: `Switched to tab ${targetTabId}` };
      }
      return { success: false, error: result.error || 'Failed to switch tab' };
    }

    if (action.type === 'getTabs') {
      const result = await getAllTabs();
      if (result.success && result.tabs) {
        return { success: true, extractedData: JSON.stringify(result.tabs) };
      }
      return { success: false, error: result.error || 'Failed to get tabs' };
    }

    // Handle runMacro action - execute a saved sequence of actions
    if (action.type === 'runMacro') {
      const macroAction = action as MacroAction;
      const macroResult = await executeMacro(
        macroAction.macroId,
        async (subAction: Action) => {
          // Execute each action in the macro
          return await executeAction(tabId, subAction, dryRun, autoRetry);
        }
      );
      
      if (macroResult.success) {
        return { success: true, extractedData: `Macro executed successfully with ${macroResult.results.length} actions` };
      }
      return { success: false, error: macroResult.error || 'Macro execution failed' };
    }

    // Handle runWorkflow action - execute a saved workflow with conditional logic
    if (action.type === 'runWorkflow') {
      const workflowAction = action as WorkflowAction;
      const workflowResult = await executeWorkflow(
        workflowAction.workflowId,
        async (subAction: Action) => {
          // Execute each action in the workflow
          return await executeAction(tabId, subAction, dryRun, autoRetry);
        }
      );
      
      if (workflowResult.success) {
        return { success: true, extractedData: `Workflow executed successfully with ${workflowResult.results?.length || 0} steps` };
      }
      return { success: false, error: workflowResult.error || 'Workflow execution failed' };
    }

    // Send to content script
    const attempt = async (): Promise<{ success: boolean; error?: string; errorType?: string; extractedData?: string; recovered?: boolean }> => {
      try {
        const response = await chrome.tabs.sendMessage(tabId, {
          type: 'performAction',
          action,
        });
        return {
          success: response?.success ?? false,
          error: response?.error,
          errorType: response?.errorType,
          extractedData: response?.extractedData,
          recovered: response?.recovered,
        };
      } catch (err: any) {
        return { success: false, error: err.message || String(err), errorType: 'ACTION_FAILED' };
      }
    };

    let result = await attempt();

    // Auto-retry with enhanced error classification and recovery tracking
    if (!result.success && autoRetry) {
      const errorType = result.errorType;
      const currentAttempt = getRecoveryAttempt(action);
      
      // Check if we've exceeded max recovery attempts
      if (currentAttempt >= MAX_RECOVERY_ATTEMPTS) {
        logRecoveryOutcome(action, errorType || 'UNKNOWN', 'max-attempts-exceeded', 'failed');
        clearRecoveryAttempt(action);
        return result;
      }

      console.log(`[HyperAgent] Action failed with error type: ${errorType}. Recovery attempt ${currentAttempt + 1}/${MAX_RECOVERY_ATTEMPTS}...`);
      
      // Determine recovery strategy based on error type
      let recoveryStrategy = 'basic-retry';
      if (errorType === 'ELEMENT_NOT_FOUND') {
        recoveryStrategy = 'element-not-found-retry';
      } else if (errorType === 'ELEMENT_NOT_VISIBLE') {
        recoveryStrategy = 'element-not-visible-scroll';
      } else if (errorType === 'ELEMENT_DISABLED') {
        recoveryStrategy = 'element-disabled-wait';
      } else if (errorType === 'ACTION_FAILED' || errorType === 'TIMEOUT') {
        recoveryStrategy = 'action-failed-reconstruct';
      } else if (errorType === 'NAVIGATION_ERROR') {
        recoveryStrategy = 'navigation-error-skip';
      }
      
      // Enhanced retry based on error type
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['/content-scripts/content.js'],
        });
        
        // Wait based on error type - more intelligent delays
        if (errorType === 'ELEMENT_NOT_VISIBLE') {
          await delay(800); // Wait for lazy load
        } else if (errorType === 'ELEMENT_DISABLED') {
          await delay(1500); // Wait for enable
        } else if (errorType === 'TIMEOUT') {
          await delay(1000); // Longer wait for timeout
        } else {
          await delay(300);
        }
        
        // Increment recovery attempt counter
        incrementRecoveryAttempt(action, recoveryStrategy);
        
        result = await attempt();
        
        // If succeeded, log successful recovery
        if (result.success) {
          if (result.recovered) {
            logRecoveryOutcome(action, errorType || 'UNKNOWN', recoveryStrategy, 'recovered');
          } else {
            logRecoveryOutcome(action, errorType || 'UNKNOWN', recoveryStrategy, 'success');
          }
          clearRecoveryAttempt(action);
        }
      } catch (err) {
        // Injection failed — log and return original error
        logRecoveryOutcome(action, errorType || 'UNKNOWN', recoveryStrategy, 'injection-failed');
        clearRecoveryAttempt(action);
      }
    }

    // Track metrics for the action result
    trackActionEnd(actionId, result.success, Date.now() - startTime, pageUrlToTrack);

    return result;
  }

  // ─── Helper: wait for tab to finish loading ────────────────────
  function waitForTabLoad(tabId: number): Promise<void> {
    return new Promise((resolve) => {
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      }, 15000);

      function listener(updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            chrome.tabs.onUpdated.removeListener(listener);
            setTimeout(resolve, 600);
          }
        }
      }

      chrome.tabs.onUpdated.addListener(listener);
    });
  }

  function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ─── Tab Management Functions ───────────────────────────────────────
  async function openTab(url: string, active?: boolean): Promise<{ success: boolean; tabId?: number; error?: string }> {
    try {
      const tab = await chrome.tabs.create({ url, active: active ?? true });
      if (tab.id) {
        await waitForTabLoad(tab.id);
        return { success: true, tabId: tab.id };
      }
      return { success: false, error: 'Failed to create tab' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async function closeTab(tabId: number): Promise<{ success: boolean; error?: string }> {
    try {
      await chrome.tabs.remove(tabId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async function switchToTab(tabId: number): Promise<{ success: boolean; error?: string }> {
    try {
      await chrome.tabs.update(tabId, { active: true });
      await chrome.windows.update(tabId as unknown as number, { focused: true }).catch(() => {});
      await waitForTabLoad(tabId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async function findTabByUrl(pattern: string): Promise<{ success: boolean; tabId?: number; error?: string }> {
    try {
      const tabs = await chrome.tabs.query({});
      const regex = new RegExp(pattern, 'i');
      const matched = tabs.find((tab) => tab.url && regex.test(tab.url));
      if (matched?.id) {
        return { success: true, tabId: matched.id };
      }
      return { success: false, error: `No tab found matching pattern: ${pattern}` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async function getAllTabs(): Promise<{ success: boolean; tabs?: { id: number; url: string; title: string; active: boolean }[]; error?: string }> {
    try {
      const tabs = await chrome.tabs.query({});
      return {
        success: true,
        tabs: tabs.map((tab) => ({
          id: tab.id!,
          url: tab.url || '',
          title: tab.title || '',
          active: tab.active,
        })),
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // ─── Main agent loop ──────────────────────────────────────────
  async function runAgentLoop(command: string) {
    agentRunning = true;
    agentAborted = false;

    const settings = await loadSettings();
    const maxSteps = settings.maxSteps;
    const tabId = await getActiveTabId();

    // Check site blacklist
    const tab = await chrome.tabs.get(tabId);
    if (tab.url && isSiteBlacklisted(tab.url, settings.siteBlacklist)) {
      sendToSidePanel({
        type: 'agentDone',
        finalSummary: 'This site is on your blacklist. HyperAgent will not operate here.',
        success: false,
        stepsUsed: 0,
      });
      agentRunning = false;
      return;
    }

    // Initialize or restore session
    let session = await getActiveSession();
    if (!session || session.pageUrl !== tab.url) {
      // Create new session for this page
      session = await createSession(tab.url || '', tab.title || '');
      currentSessionId = session.id;
    } else {
      currentSessionId = session.id;
      // Update page info if URL changed
      await updateSessionPageInfo(session.id, tab.url || '', tab.title || '');
    }

    const history: HistoryEntry[] = [];
    let requestScreenshot = false;
    let consecutiveErrors = 0;

    try {
      for (let step = 1; step <= maxSteps; step++) {
        // ── Check abort ──
        if (agentAborted) {
          sendToSidePanel({
            type: 'agentDone',
            finalSummary: 'Agent stopped by user.',
            success: false,
            stepsUsed: step - 1,
          });
          return;
        }

        // ── Step 1: Observe ──
        sendToSidePanel({
          type: 'agentProgress',
          step,
          maxSteps,
          summary: 'Analyzing page...',
          status: 'thinking',
        } as MsgAgentProgress);

        let context = await getPageContext(tabId);

        // Vision-first fallback: capture screenshot if DOM is sparse or explicitly requested
        const needsVisionFallback = context.needsScreenshot || context.semanticElements.length < DEFAULTS.VISION_FALLBACK_THRESHOLD;
        if (needsVisionFallback && settings.enableVision) {
          requestScreenshot = true;
        }

        // Capture screenshot if model requested it or vision is enabled for first step
        if (requestScreenshot || (step === 1 && settings.enableVision)) {
          const screenshotBase64 = await captureScreenshot();
          if (screenshotBase64) {
            context = { ...context, screenshotBase64 };
          }
          requestScreenshot = false;
        }

        // ── Step 2: Plan (call LLM) ──
        const llmResponse = await callLLM(command, history, context);

        console.log(`[HyperAgent] Step ${step}/${maxSteps}:`, llmResponse.summary);

        // Handle LLM errors with retry
        if (llmResponse.error && !llmResponse.done) {
          consecutiveErrors++;
          if (consecutiveErrors >= 3) {
            sendToSidePanel({
              type: 'agentDone',
              finalSummary: `Stopping after ${consecutiveErrors} consecutive errors. Last: ${llmResponse.summary}`,
              success: false,
              stepsUsed: step,
            });
            return;
          }
          sendToSidePanel({
            type: 'agentProgress',
            step,
            maxSteps,
            summary: `Error: ${llmResponse.summary}. Retrying...`,
            status: 'retrying',
          } as MsgAgentProgress);
          await delay(2000);
          continue;
        }
        consecutiveErrors = 0;

        // Track if model wants a screenshot next round
        if (llmResponse.needsScreenshot && settings.enableVision) {
          requestScreenshot = true;
        }

        // ── Handle askUser ──
        if (llmResponse.askUser) {
          sendToSidePanel({ type: 'askUser', question: llmResponse.askUser });
          const reply = await askUserForInfo(llmResponse.askUser);

          if (!reply || agentAborted) {
            sendToSidePanel({
              type: 'agentDone',
              finalSummary: reply ? 'Agent stopped.' : 'No reply received. Agent stopped.',
              success: false,
              stepsUsed: step,
            });
            return;
          }

          history.push({ role: 'user', userReply: reply });
          continue; // Re-run LLM with the user's reply
        }

        // Update side panel
        const actionDescs = llmResponse.actions.map((a) => (a as any).description || a.type);
        sendToSidePanel({
          type: 'agentProgress',
          step,
          maxSteps,
          summary: llmResponse.summary,
          thinking: llmResponse.thinking,
          status: llmResponse.done ? 'done' : 'acting',
          actionDescriptions: actionDescs,
        } as MsgAgentProgress);

        // ── Check if done ──
        if (llmResponse.done || llmResponse.actions.length === 0) {
          history.push({ role: 'user', context, command });
          history.push({ role: 'assistant', response: llmResponse });
          sendToSidePanel({
            type: 'agentDone',
            finalSummary: llmResponse.summary || 'Task completed.',
            success: !llmResponse.error,
            stepsUsed: step,
          } as MsgAgentDone);
          return;
        }

        // ── Step 3: Confirm destructive actions ──
        const hasDestructive = settings.requireConfirm && llmResponse.actions.some(isDestructive);

        if (hasDestructive) {
          sendToSidePanel({
            type: 'agentProgress',
            step,
            maxSteps,
            summary: 'Awaiting your confirmation...',
            status: 'confirming',
          } as MsgAgentProgress);

          const confirmed = await askUserConfirmation(llmResponse.actions, step, llmResponse.summary);
          if (!confirmed || agentAborted) {
            sendToSidePanel({
              type: 'agentDone',
              finalSummary: 'Actions cancelled by user.',
              success: false,
              stepsUsed: step,
            } as MsgAgentDone);
            return;
          }
        }

        // ── Step 4: Execute actions ──
        const actionResults: { action: Action; success: boolean; error?: string; extractedData?: string }[] = [];

        for (const action of llmResponse.actions) {
          if (agentAborted) break;

          const result = await executeAction(tabId, action, settings.dryRun, settings.autoRetry);
          actionResults.push({ action, ...result });

          if (!result.success) {
            console.warn(`[HyperAgent] Action failed:`, action.type, result.error);
          }

          // Vision-first verification: capture screenshot after critical actions (click/fill)
          // This helps verify the action had the expected effect
          if (DEFAULTS.AUTO_VERIFY_ACTIONS && settings.enableVision && 
              (action.type === 'click' || action.type === 'fill' || action.type === 'select') &&
              result.success) {
            requestScreenshot = true;
          }

          // Delay between actions
          await delay(DEFAULTS.ACTION_DELAY_MS);
        }

        // ── Step 5: Record history ──
        history.push({ role: 'user', context, command });
        history.push({
          role: 'assistant',
          response: llmResponse,
          actionsExecuted: actionResults,
        });

        // Small delay before next observation cycle
        await delay(350);
      }

      // Max steps reached
      sendToSidePanel({
        type: 'agentDone',
        finalSummary: `Reached maximum steps (${maxSteps}). The task may not be fully complete. You can increase the limit in settings.`,
        success: false,
        stepsUsed: maxSteps,
      } as MsgAgentDone);
    } finally {
      agentRunning = false;
    }
  }
});
