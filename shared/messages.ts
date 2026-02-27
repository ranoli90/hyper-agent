import type { ExtensionMessage } from './types';

const MAX_COMMAND_LENGTH = 10000;
const MAX_TOOL_ID_LENGTH = 64;
const MAX_TASK_ID_LENGTH = 256;
const MAX_WORKFLOW_ID_LENGTH = 64;
const MAX_REPLY_LENGTH = 10000;
const MAX_LICENSE_KEY_LENGTH = 256;

function validateExecuteCommand(message: any): boolean {
  const cmd = message.command;
  const scheduled = message.scheduled;
  return (
    typeof cmd === 'string' &&
    cmd.trim().length > 0 &&
    cmd.length <= MAX_COMMAND_LENGTH &&
    (message.useAutonomous === undefined || typeof message.useAutonomous === 'boolean') &&
    (scheduled === undefined || typeof scheduled === 'boolean')
  );
}

function validateUserReply(message: any): boolean {
  const reply = message.reply;
  return typeof reply === 'string' && reply.length <= MAX_REPLY_LENGTH;
}

function validateContextMenuCommand(message: any): boolean {
  const cmd = message.command;
  return typeof cmd === 'string' && cmd.trim().length > 0 && cmd.length <= MAX_COMMAND_LENGTH;
}

function validateClearSnapshot(message: any): boolean {
  const cTaskId = message.taskId;
  return (
    cTaskId === undefined ||
    (typeof cTaskId === 'string' && cTaskId.length > 0 && cTaskId.length <= MAX_TASK_ID_LENGTH)
  );
}

function validateResumeSnapshot(message: any): boolean {
  const taskId = message.taskId;
  return typeof taskId === 'string' && taskId.length > 0 && taskId.length <= MAX_TASK_ID_LENGTH;
}

function validateExecuteTool(message: any): boolean {
  const toolId = message.toolId;
  const params = message.params;
  return (
    typeof toolId === 'string' &&
    toolId.length > 0 &&
    toolId.length <= MAX_TOOL_ID_LENGTH &&
    (params === undefined || (typeof params === 'object' && params !== null && !Array.isArray(params)))
  );
}

function validateParseIntent(message: any): boolean {
  const pCmd = message.command;
  return typeof pCmd === 'string' && pCmd.length <= MAX_COMMAND_LENGTH;
}

function validateToggleScheduledTask(message: any): boolean {
  const tId = message.taskId;
  return (
    typeof tId === 'string' &&
    tId.length > 0 &&
    tId.length <= MAX_TASK_ID_LENGTH &&
    (message.enabled === undefined || typeof message.enabled === 'boolean')
  );
}

function validateDeleteScheduledTask(message: any): boolean {
  const dId = message.taskId;
  return typeof dId === 'string' && dId.length > 0 && dId.length <= MAX_TASK_ID_LENGTH;
}

function validateInstallWorkflow(message: any): boolean {
  const wfId = message.workflowId;
  return typeof wfId === 'string' && /^[a-zA-Z0-9_-]+$/.test(wfId) && wfId.length <= MAX_WORKFLOW_ID_LENGTH;
}

function validateActivateLicenseKey(message: any): boolean {
  const key = message.key;
  return typeof key === 'string' && key.length > 0 && key.length <= MAX_LICENSE_KEY_LENGTH;
}

export function validateExtensionMessage(message: unknown): message is ExtensionMessage {
  if (!message || typeof message !== 'object') return false;
  const { type } = message as Record<string, unknown>;
  if (typeof type !== 'string') return false;

  const msg = message as Record<string, unknown>;

  switch (type) {
    case 'executeCommand':
      return validateExecuteCommand(msg);
    case 'stopAgent':
      return true;
    case 'confirmResponse':
      return typeof msg.confirmed === 'boolean';
    case 'userReply':
      return validateUserReply(msg);
    case 'getAgentStatus':
    case 'clearHistory':
    case 'getMetrics':
      return true;
    case 'contextMenuCommand':
      return validateContextMenuCommand(msg);
    case 'captureScreenshot':
    case 'getToolStats':
    case 'getTools':
    case 'getSwarmStatus':
    case 'getSnapshot':
    case 'listSnapshots':
      return true;
    case 'clearSnapshot':
      return validateClearSnapshot(msg);
    case 'resumeSnapshot':
      return validateResumeSnapshot(msg);
    case 'getGlobalLearningStats':
    case 'getIntentSuggestions':
    case 'getUsage':
    case 'getMemoryStats':
    case 'getScheduledTasks':
    case 'getSubscriptionState':
    case 'verifySubscription':
    case 'cancelSubscription':
      return true;
    case 'executeTool':
      return validateExecuteTool(msg);
    case 'parseIntent':
      return validateParseIntent(msg);
    case 'getAPICache':
    case 'setAPICache':
    case 'invalidateCacheTag':
    case 'getMemoryLeaks':
    case 'forceMemoryCleanup':
    case 'getAutonomousSession':
    case 'createAutonomousSession':
    case 'getProactiveSuggestions':
    case 'executeSuggestion':
    case 'getCacheStats':
    case 'sanitizeInput':
    case 'sanitizeUrl':
    case 'sanitizeBatch':
      return true;
    case 'toggleScheduledTask':
      return validateToggleScheduledTask(msg);
    case 'deleteScheduledTask':
      return validateDeleteScheduledTask(msg);
    case 'installWorkflow':
      return validateInstallWorkflow(msg);
    case 'activateLicenseKey':
      return validateActivateLicenseKey(msg);
    case 'openCheckout':
      return true;
    default:
      return false;
  }
}

// Re-export constants for tests
export {
  MAX_COMMAND_LENGTH,
  MAX_TOOL_ID_LENGTH,
  MAX_TASK_ID_LENGTH,
  MAX_WORKFLOW_ID_LENGTH,
  MAX_REPLY_LENGTH,
  MAX_LICENSE_KEY_LENGTH,
};

