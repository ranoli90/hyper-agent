import { describe, it, expect } from 'vitest';
import {
  validateExtensionMessage,
  MAX_COMMAND_LENGTH,
  MAX_TOOL_ID_LENGTH,
  MAX_TASK_ID_LENGTH,
  MAX_WORKFLOW_ID_LENGTH,
  MAX_REPLY_LENGTH,
  MAX_LICENSE_KEY_LENGTH,
} from '../../shared/messages';

describe('Message Validation', () => {
  describe('validateExtensionMessage', () => {
    describe('null/undefined/invalid input', () => {
      it('should reject null', () => {
        expect(validateExtensionMessage(null)).toBe(false);
      });

      it('should reject undefined', () => {
        expect(validateExtensionMessage(undefined)).toBe(false);
      });

      it('should reject non-object types', () => {
        expect(validateExtensionMessage('string')).toBe(false);
        expect(validateExtensionMessage(123)).toBe(false);
        expect(validateExtensionMessage(true)).toBe(false);
      });

      it('should reject object without type field', () => {
        expect(validateExtensionMessage({})).toBe(false);
        expect(validateExtensionMessage({ command: 'test' })).toBe(false);
      });

      it('should reject object with non-string type', () => {
        expect(validateExtensionMessage({ type: 123 })).toBe(false);
        expect(validateExtensionMessage({ type: null })).toBe(false);
        expect(validateExtensionMessage({ type: true })).toBe(false);
      });

      it('should reject unknown message types', () => {
        expect(validateExtensionMessage({ type: 'unknownType' })).toBe(false);
        expect(validateExtensionMessage({ type: 'invalidMessage' })).toBe(false);
      });
    });

    describe('executeCommand', () => {
      it('should validate valid executeCommand message', () => {
        expect(validateExtensionMessage({ type: 'executeCommand', command: 'Go to google.com' })).toBe(true);
      });

      it('should validate executeCommand with useAutonomous flag', () => {
        expect(validateExtensionMessage({ type: 'executeCommand', command: 'Test', useAutonomous: true })).toBe(true);
        expect(validateExtensionMessage({ type: 'executeCommand', command: 'Test', useAutonomous: false })).toBe(true);
      });

      it('should validate executeCommand with scheduled flag', () => {
        expect(validateExtensionMessage({ type: 'executeCommand', command: 'Test', scheduled: true })).toBe(true);
        expect(validateExtensionMessage({ type: 'executeCommand', command: 'Test', scheduled: false })).toBe(true);
      });

      it('should reject executeCommand without command', () => {
        expect(validateExtensionMessage({ type: 'executeCommand' })).toBe(false);
      });

      it('should reject executeCommand with empty command', () => {
        expect(validateExtensionMessage({ type: 'executeCommand', command: '' })).toBe(false);
        expect(validateExtensionMessage({ type: 'executeCommand', command: '   ' })).toBe(false);
      });

      it('should reject executeCommand with non-string command', () => {
        expect(validateExtensionMessage({ type: 'executeCommand', command: 123 })).toBe(false);
        expect(validateExtensionMessage({ type: 'executeCommand', command: null })).toBe(false);
      });

      it('should reject command exceeding max length (10000 chars)', () => {
        const longCommand = 'a'.repeat(10001);
        expect(validateExtensionMessage({ type: 'executeCommand', command: longCommand })).toBe(false);
      });

      it('should accept command at max length (10000 chars)', () => {
        const maxCommand = 'a'.repeat(10000);
        expect(validateExtensionMessage({ type: 'executeCommand', command: maxCommand })).toBe(true);
      });

      it('should reject invalid useAutonomous type', () => {
        expect(validateExtensionMessage({ type: 'executeCommand', command: 'Test', useAutonomous: 'yes' })).toBe(false);
        expect(validateExtensionMessage({ type: 'executeCommand', command: 'Test', useAutonomous: 1 })).toBe(false);
      });

      it('should reject invalid scheduled type', () => {
        expect(validateExtensionMessage({ type: 'executeCommand', command: 'Test', scheduled: 'yes' })).toBe(false);
        expect(validateExtensionMessage({ type: 'executeCommand', command: 'Test', scheduled: 1 })).toBe(false);
      });
    });

    describe('stopAgent', () => {
      it('should validate stopAgent message', () => {
        expect(validateExtensionMessage({ type: 'stopAgent' })).toBe(true);
      });
    });

    describe('confirmResponse', () => {
      it('should validate confirmResponse with true', () => {
        expect(validateExtensionMessage({ type: 'confirmResponse', confirmed: true })).toBe(true);
      });

      it('should validate confirmResponse with false', () => {
        expect(validateExtensionMessage({ type: 'confirmResponse', confirmed: false })).toBe(true);
      });

      it('should reject confirmResponse without confirmed field', () => {
        expect(validateExtensionMessage({ type: 'confirmResponse' })).toBe(false);
      });

      it('should reject confirmResponse with non-boolean confirmed', () => {
        expect(validateExtensionMessage({ type: 'confirmResponse', confirmed: 'yes' })).toBe(false);
        expect(validateExtensionMessage({ type: 'confirmResponse', confirmed: 1 })).toBe(false);
        expect(validateExtensionMessage({ type: 'confirmResponse', confirmed: null })).toBe(false);
      });
    });

    describe('userReply', () => {
      it('should validate userReply message', () => {
        expect(validateExtensionMessage({ type: 'userReply', reply: 'This is my response' })).toBe(true);
      });

      it('should validate empty string reply', () => {
        expect(validateExtensionMessage({ type: 'userReply', reply: '' })).toBe(true);
      });

      it('should reject userReply without reply field', () => {
        expect(validateExtensionMessage({ type: 'userReply' })).toBe(false);
      });

      it('should reject userReply with non-string reply', () => {
        expect(validateExtensionMessage({ type: 'userReply', reply: 123 })).toBe(false);
        expect(validateExtensionMessage({ type: 'userReply', reply: null })).toBe(false);
      });

      it('should reject reply exceeding max length (10000 chars)', () => {
        const longReply = 'a'.repeat(10001);
        expect(validateExtensionMessage({ type: 'userReply', reply: longReply })).toBe(false);
      });

      it('should accept reply at max length (10000 chars)', () => {
        const maxReply = 'a'.repeat(10000);
        expect(validateExtensionMessage({ type: 'userReply', reply: maxReply })).toBe(true);
      });
    });

    describe('executeTool', () => {
      it('should validate executeTool with toolId only', () => {
        expect(validateExtensionMessage({ type: 'executeTool', toolId: 'navigate' })).toBe(true);
      });

      it('should validate executeTool with toolId and params', () => {
        expect(validateExtensionMessage({ type: 'executeTool', toolId: 'navigate', params: { url: 'https://example.com' } })).toBe(true);
      });

      it('should validate executeTool with empty params object', () => {
        expect(validateExtensionMessage({ type: 'executeTool', toolId: 'click', params: {} })).toBe(true);
      });

      it('should reject executeTool without toolId', () => {
        expect(validateExtensionMessage({ type: 'executeTool' })).toBe(false);
      });

      it('should reject executeTool with empty toolId', () => {
        expect(validateExtensionMessage({ type: 'executeTool', toolId: '' })).toBe(false);
      });

      it('should reject executeTool with non-string toolId', () => {
        expect(validateExtensionMessage({ type: 'executeTool', toolId: 123 })).toBe(false);
        expect(validateExtensionMessage({ type: 'executeTool', toolId: null })).toBe(false);
      });

      it('should reject toolId exceeding max length (64 chars)', () => {
        const longToolId = 'a'.repeat(65);
        expect(validateExtensionMessage({ type: 'executeTool', toolId: longToolId })).toBe(false);
      });

      it('should accept toolId at max length (64 chars)', () => {
        const maxToolId = 'a'.repeat(64);
        expect(validateExtensionMessage({ type: 'executeTool', toolId: maxToolId })).toBe(true);
      });

      it('should reject executeTool with array params', () => {
        expect(validateExtensionMessage({ type: 'executeTool', toolId: 'test', params: [] })).toBe(false);
      });

      it('should reject executeTool with null params', () => {
        expect(validateExtensionMessage({ type: 'executeTool', toolId: 'test', params: null })).toBe(false);
      });

      it('should reject executeTool with string params', () => {
        expect(validateExtensionMessage({ type: 'executeTool', toolId: 'test', params: 'url' })).toBe(false);
      });
    });

    describe('installWorkflow', () => {
      it('should validate installWorkflow with alphanumeric workflowId', () => {
        expect(validateExtensionMessage({ type: 'installWorkflow', workflowId: 'myWorkflow123' })).toBe(true);
      });

      it('should validate installWorkflow with dashes and underscores', () => {
        expect(validateExtensionMessage({ type: 'installWorkflow', workflowId: 'my-workflow_123' })).toBe(true);
      });

      it('should validate installWorkflow with uppercase letters', () => {
        expect(validateExtensionMessage({ type: 'installWorkflow', workflowId: 'MyWorkflow' })).toBe(true);
      });

      it('should reject installWorkflow without workflowId', () => {
        expect(validateExtensionMessage({ type: 'installWorkflow' })).toBe(false);
      });

      it('should reject installWorkflow with empty workflowId', () => {
        expect(validateExtensionMessage({ type: 'installWorkflow', workflowId: '' })).toBe(false);
      });

      it('should reject installWorkflow with special characters', () => {
        expect(validateExtensionMessage({ type: 'installWorkflow', workflowId: 'workflow@123' })).toBe(false);
        expect(validateExtensionMessage({ type: 'installWorkflow', workflowId: 'workflow!' })).toBe(false);
        expect(validateExtensionMessage({ type: 'installWorkflow', workflowId: 'workflow.name' })).toBe(false);
        expect(validateExtensionMessage({ type: 'installWorkflow', workflowId: 'workflow name' })).toBe(false);
      });

      it('should reject workflowId exceeding max length (64 chars)', () => {
        const longId = 'a'.repeat(65);
        expect(validateExtensionMessage({ type: 'installWorkflow', workflowId: longId })).toBe(false);
      });

      it('should accept workflowId at max length (64 chars)', () => {
        const maxId = 'a'.repeat(64);
        expect(validateExtensionMessage({ type: 'installWorkflow', workflowId: maxId })).toBe(true);
      });
    });

    describe('taskId validations', () => {
      describe('resumeSnapshot', () => {
        it('should validate resumeSnapshot with taskId', () => {
          expect(validateExtensionMessage({ type: 'resumeSnapshot', taskId: 'task-123' })).toBe(true);
        });

        it('should reject resumeSnapshot without taskId', () => {
          expect(validateExtensionMessage({ type: 'resumeSnapshot' })).toBe(false);
        });

        it('should reject resumeSnapshot with empty taskId', () => {
          expect(validateExtensionMessage({ type: 'resumeSnapshot', taskId: '' })).toBe(false);
        });

        it('should reject taskId exceeding max length (256 chars)', () => {
          const longId = 'a'.repeat(257);
          expect(validateExtensionMessage({ type: 'resumeSnapshot', taskId: longId })).toBe(false);
        });

        it('should accept taskId at max length (256 chars)', () => {
          const maxId = 'a'.repeat(256);
          expect(validateExtensionMessage({ type: 'resumeSnapshot', taskId: maxId })).toBe(true);
        });
      });

      describe('clearSnapshot', () => {
        it('should validate clearSnapshot without taskId (clears all)', () => {
          expect(validateExtensionMessage({ type: 'clearSnapshot' })).toBe(true);
        });

        it('should validate clearSnapshot with taskId', () => {
          expect(validateExtensionMessage({ type: 'clearSnapshot', taskId: 'task-123' })).toBe(true);
        });

        it('should reject clearSnapshot with empty taskId', () => {
          expect(validateExtensionMessage({ type: 'clearSnapshot', taskId: '' })).toBe(false);
        });

        it('should reject clearSnapshot with taskId exceeding max length', () => {
          const longId = 'a'.repeat(257);
          expect(validateExtensionMessage({ type: 'clearSnapshot', taskId: longId })).toBe(false);
        });
      });

      describe('toggleScheduledTask', () => {
        it('should validate toggleScheduledTask with taskId', () => {
          expect(validateExtensionMessage({ type: 'toggleScheduledTask', taskId: 'task-123' })).toBe(true);
        });

        it('should validate toggleScheduledTask with enabled flag', () => {
          expect(validateExtensionMessage({ type: 'toggleScheduledTask', taskId: 'task-123', enabled: true })).toBe(true);
          expect(validateExtensionMessage({ type: 'toggleScheduledTask', taskId: 'task-123', enabled: false })).toBe(true);
        });

        it('should reject toggleScheduledTask without taskId', () => {
          expect(validateExtensionMessage({ type: 'toggleScheduledTask' })).toBe(false);
        });

        it('should reject toggleScheduledTask with invalid enabled type', () => {
          expect(validateExtensionMessage({ type: 'toggleScheduledTask', taskId: 'task-123', enabled: 'yes' })).toBe(false);
        });

        it('should reject taskId exceeding max length', () => {
          const longId = 'a'.repeat(257);
          expect(validateExtensionMessage({ type: 'toggleScheduledTask', taskId: longId })).toBe(false);
        });
      });

      describe('deleteScheduledTask', () => {
        it('should validate deleteScheduledTask with taskId', () => {
          expect(validateExtensionMessage({ type: 'deleteScheduledTask', taskId: 'task-123' })).toBe(true);
        });

        it('should reject deleteScheduledTask without taskId', () => {
          expect(validateExtensionMessage({ type: 'deleteScheduledTask' })).toBe(false);
        });

        it('should reject deleteScheduledTask with empty taskId', () => {
          expect(validateExtensionMessage({ type: 'deleteScheduledTask', taskId: '' })).toBe(false);
        });

        it('should reject taskId exceeding max length', () => {
          const longId = 'a'.repeat(257);
          expect(validateExtensionMessage({ type: 'deleteScheduledTask', taskId: longId })).toBe(false);
        });
      });
    });

    describe('activateLicenseKey', () => {
      it('should validate activateLicenseKey with key', () => {
        expect(validateExtensionMessage({ type: 'activateLicenseKey', key: 'license-key-123' })).toBe(true);
      });

      it('should reject activateLicenseKey without key', () => {
        expect(validateExtensionMessage({ type: 'activateLicenseKey' })).toBe(false);
      });

      it('should reject activateLicenseKey with empty key', () => {
        expect(validateExtensionMessage({ type: 'activateLicenseKey', key: '' })).toBe(false);
      });

      it('should reject key exceeding max length (256 chars)', () => {
        const longKey = 'a'.repeat(257);
        expect(validateExtensionMessage({ type: 'activateLicenseKey', key: longKey })).toBe(false);
      });

      it('should accept key at max length (256 chars)', () => {
        const maxKey = 'a'.repeat(256);
        expect(validateExtensionMessage({ type: 'activateLicenseKey', key: maxKey })).toBe(true);
      });
    });

    describe('contextMenuCommand', () => {
      it('should validate contextMenuCommand', () => {
        expect(validateExtensionMessage({ type: 'contextMenuCommand', command: 'Go to google.com' })).toBe(true);
      });

      it('should reject contextMenuCommand with empty command', () => {
        expect(validateExtensionMessage({ type: 'contextMenuCommand', command: '' })).toBe(false);
        expect(validateExtensionMessage({ type: 'contextMenuCommand', command: '   ' })).toBe(false);
      });

      it('should reject command exceeding max length', () => {
        const longCommand = 'a'.repeat(10001);
        expect(validateExtensionMessage({ type: 'contextMenuCommand', command: longCommand })).toBe(false);
      });
    });

    describe('parseIntent', () => {
      it('should validate parseIntent with command', () => {
        expect(validateExtensionMessage({ type: 'parseIntent', command: 'Click the submit button' })).toBe(true);
      });

      it('should validate parseIntent with empty command', () => {
        expect(validateExtensionMessage({ type: 'parseIntent', command: '' })).toBe(true);
      });

      it('should reject parseIntent without command', () => {
        expect(validateExtensionMessage({ type: 'parseIntent' })).toBe(false);
      });

      it('should reject command exceeding max length', () => {
        const longCommand = 'a'.repeat(10001);
        expect(validateExtensionMessage({ type: 'parseIntent', command: longCommand })).toBe(false);
      });
    });

    describe('simple message types (no params)', () => {
      it('should validate getAgentStatus', () => {
        expect(validateExtensionMessage({ type: 'getAgentStatus' })).toBe(true);
      });

      it('should validate clearHistory', () => {
        expect(validateExtensionMessage({ type: 'clearHistory' })).toBe(true);
      });

      it('should validate getMetrics', () => {
        expect(validateExtensionMessage({ type: 'getMetrics' })).toBe(true);
      });

      it('should validate captureScreenshot', () => {
        expect(validateExtensionMessage({ type: 'captureScreenshot' })).toBe(true);
      });

      it('should validate getToolStats', () => {
        expect(validateExtensionMessage({ type: 'getToolStats' })).toBe(true);
      });

      it('should validate getTools', () => {
        expect(validateExtensionMessage({ type: 'getTools' })).toBe(true);
      });

      it('should validate getSwarmStatus', () => {
        expect(validateExtensionMessage({ type: 'getSwarmStatus' })).toBe(true);
      });

      it('should validate getSnapshot', () => {
        expect(validateExtensionMessage({ type: 'getSnapshot' })).toBe(true);
      });

      it('should validate listSnapshots', () => {
        expect(validateExtensionMessage({ type: 'listSnapshots' })).toBe(true);
      });

      it('should validate getGlobalLearningStats', () => {
        expect(validateExtensionMessage({ type: 'getGlobalLearningStats' })).toBe(true);
      });

      it('should validate getIntentSuggestions', () => {
        expect(validateExtensionMessage({ type: 'getIntentSuggestions' })).toBe(true);
      });

      it('should validate getUsage', () => {
        expect(validateExtensionMessage({ type: 'getUsage' })).toBe(true);
      });

      it('should validate getMemoryStats', () => {
        expect(validateExtensionMessage({ type: 'getMemoryStats' })).toBe(true);
      });

      it('should validate getScheduledTasks', () => {
        expect(validateExtensionMessage({ type: 'getScheduledTasks' })).toBe(true);
      });

      it('should validate getSubscriptionState', () => {
        expect(validateExtensionMessage({ type: 'getSubscriptionState' })).toBe(true);
      });

      it('should validate verifySubscription', () => {
        expect(validateExtensionMessage({ type: 'verifySubscription' })).toBe(true);
      });

      it('should validate cancelSubscription', () => {
        expect(validateExtensionMessage({ type: 'cancelSubscription' })).toBe(true);
      });

      it('should validate openCheckout', () => {
        expect(validateExtensionMessage({ type: 'openCheckout' })).toBe(true);
      });

      it('should validate getAPICache', () => {
        expect(validateExtensionMessage({ type: 'getAPICache' })).toBe(true);
      });

      it('should validate setAPICache', () => {
        expect(validateExtensionMessage({ type: 'setAPICache' })).toBe(true);
      });

      it('should validate invalidateCacheTag', () => {
        expect(validateExtensionMessage({ type: 'invalidateCacheTag' })).toBe(true);
      });

      it('should validate getMemoryLeaks', () => {
        expect(validateExtensionMessage({ type: 'getMemoryLeaks' })).toBe(true);
      });

      it('should validate forceMemoryCleanup', () => {
        expect(validateExtensionMessage({ type: 'forceMemoryCleanup' })).toBe(true);
      });

      it('should validate getAutonomousSession', () => {
        expect(validateExtensionMessage({ type: 'getAutonomousSession' })).toBe(true);
      });

      it('should validate createAutonomousSession', () => {
        expect(validateExtensionMessage({ type: 'createAutonomousSession' })).toBe(true);
      });

      it('should validate getProactiveSuggestions', () => {
        expect(validateExtensionMessage({ type: 'getProactiveSuggestions' })).toBe(true);
      });

      it('should validate executeSuggestion', () => {
        expect(validateExtensionMessage({ type: 'executeSuggestion' })).toBe(true);
      });

      it('should validate getCacheStats', () => {
        expect(validateExtensionMessage({ type: 'getCacheStats' })).toBe(true);
      });

      it('should validate sanitizeInput', () => {
        expect(validateExtensionMessage({ type: 'sanitizeInput' })).toBe(true);
      });

      it('should validate sanitizeUrl', () => {
        expect(validateExtensionMessage({ type: 'sanitizeUrl' })).toBe(true);
      });

      it('should validate sanitizeBatch', () => {
        expect(validateExtensionMessage({ type: 'sanitizeBatch' })).toBe(true);
      });
    });

    describe('security - injection prevention', () => {
      it('should accept command with potential script content (sanitization happens elsewhere)', () => {
        const scriptCommand = '<script>alert("xss")</script>';
        expect(validateExtensionMessage({ type: 'executeCommand', command: scriptCommand })).toBe(true);
      });

      it('should accept workflowId with valid characters only', () => {
        expect(validateExtensionMessage({ type: 'installWorkflow', workflowId: 'my_workflow-123' })).toBe(true);
        expect(validateExtensionMessage({ type: 'installWorkflow', workflowId: 'ABC_def-456' })).toBe(true);
      });

      it('should reject workflowId with path traversal attempt', () => {
        expect(validateExtensionMessage({ type: 'installWorkflow', workflowId: '../etc/passwd' })).toBe(false);
        expect(validateExtensionMessage({ type: 'installWorkflow', workflowId: '..\\windows\\system32' })).toBe(false);
      });

      it('should reject workflowId with null bytes', () => {
        expect(validateExtensionMessage({ type: 'installWorkflow', workflowId: 'workflow\x00.js' })).toBe(false);
      });

      it('should reject workflowId with unicode special chars', () => {
        expect(validateExtensionMessage({ type: 'installWorkflow', workflowId: 'workflow\u0001' })).toBe(false);
        expect(validateExtensionMessage({ type: 'installWorkflow', workflowId: 'workflow\tname' })).toBe(false);
      });

      it('should accept toolId with typical identifier characters', () => {
        expect(validateExtensionMessage({ type: 'executeTool', toolId: 'navigate-to-url' })).toBe(true);
        expect(validateExtensionMessage({ type: 'executeTool', toolId: 'click_button' })).toBe(true);
        expect(validateExtensionMessage({ type: 'executeTool', toolId: 'extractData' })).toBe(true);
      });

      it('should reject extremely long commands that could cause memory issues', () => {
        const hugeCommand = 'a'.repeat(100000);
        expect(validateExtensionMessage({ type: 'executeCommand', command: hugeCommand })).toBe(false);
      });
    });
  });
});

describe('Message Length Constants', () => {
  it('should have correct MAX_COMMAND_LENGTH', () => {
    expect(MAX_COMMAND_LENGTH).toBe(10000);
  });

  it('should have correct MAX_TOOL_ID_LENGTH', () => {
    expect(MAX_TOOL_ID_LENGTH).toBe(64);
  });

  it('should have correct MAX_TASK_ID_LENGTH', () => {
    expect(MAX_TASK_ID_LENGTH).toBe(256);
  });

  it('should have correct MAX_WORKFLOW_ID_LENGTH', () => {
    expect(MAX_WORKFLOW_ID_LENGTH).toBe(64);
  });

  it('should have correct MAX_REPLY_LENGTH', () => {
    expect(MAX_REPLY_LENGTH).toBe(10000);
  });

  it('should have correct MAX_LICENSE_KEY_LENGTH', () => {
    expect(MAX_LICENSE_KEY_LENGTH).toBe(256);
  });
});
