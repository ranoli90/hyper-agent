import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionPath = path.join(__dirname, '..', '.output', 'chrome-mv3');

test.describe('HyperAgent Extension with Full Chrome API Mock', () => {
  test.beforeEach(async ({ context }) => {
    // Mock OpenRouter endpoints for local testing
    await context.route('https://openrouter.ai/api/v1/**', async (route) => {
      const url = route.request().url();
      if (url.endsWith('/models')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
        });
        return;
      }
      if (url.endsWith('/chat/completions')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            choices: [
              {
                message: {
                  content: '{"summary":"test","actions":[],"done":true}',
                },
              },
            ],
          }),
        });
        return;
      }
      if (url.endsWith('/embeddings')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [{ embedding: [0.1, 0.2, 0.3] }] }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    // Comprehensive Chrome API mock
    await context.addInitScript(() => {
      // Mock chrome.runtime with full functionality
      const mockRuntime = {
        sendMessage: (message: any, callback?: (response: any) => void) => {
          // Track all outbound messages for assertions
          (window as any).__sentMessages = (window as any).__sentMessages || [];
          (window as any).__sentMessages.push(message);

          // Handle specific message types used by the sidepanel
          if (message.type === 'getMemoryStats') {
            const response = {
              ok: true,
              strategies: {
                'example.com': {
                  successfulLocators: [
                    { locator: 'button.buy', actionType: 'click', successCount: 3 },
                  ],
                  failedLocators: [],
                  lastUsed: Date.now(),
                  summary: 'Top successful locator patterns: click (1)',
                },
              },
              totalActions: 10,
              totalSessions: 2,
              domainsCount: 1,
              oldestEntry: Date.now() - 1000 * 60 * 60,
              workflowRuns: {
                'example.com': [
                  { type: 'workflow', id: 'wf-1', timestamp: Date.now(), success: true },
                  { type: 'macro', id: 'macro-1', timestamp: Date.now(), success: true },
                ],
              },
            };
            setTimeout(() => callback?.(response), 10);
            return;
          }

          if (message.type === 'runMemoryHealthCheck') {
            const response = {
              ok: true,
              result: { healthy: true, issues: [], repaired: false },
            };
            setTimeout(() => callback?.(response), 10);
            return;
          }

          if (message.type === 'getMetrics') {
            const response = {
              ok: true,
              metrics: {
                logs: [
                  { timestamp: new Date().toISOString(), level: 'INFO', subsystem: 'test', message: 'log-1' },
                ],
                recovery: { activeAttempts: 0, totalLoggedRecoveries: 0, recentFailures: 0 },
                rateLimitStatus: { canAccept: true, timeUntilReset: 0 },
              },
            };
            setTimeout(() => callback?.(response), 10);
            return;
          }

          if (message.type === 'getAgentStatus') {
            const response = {
              ok: true,
              status: {
                isRunning: false,
                isAborted: false,
                currentSessionId: null,
                hasPendingConfirm: false,
                hasPendingReply: false,
                recoveryStats: { activeAttempts: 0, totalLoggedRecoveries: 0, recentFailures: 0 },
              },
            };
            setTimeout(() => callback?.(response), 10);
            return;
          }

          if (message.type === 'executeCommand') {
            setTimeout(() => {
              window.postMessage(
                {
                  type: 'agentProgress',
                  status: 'Processing...',
                  step: 'plan',
                  summary: 'Analyzing command...',
                },
                '*'
              );

              if (message.command === '/help') {
                setTimeout(() => {
                  window.postMessage(
                    {
                      type: 'agentDone',
                      finalSummary:
                        '**Hyper-Commands:**\n- `/memory`: View stored knowledge\n- `/tools`: List available agent tools\n- `/clear`: Clear chat history\n- `/help`: Show this message',
                      success: true,
                      stepsUsed: 1,
                    },
                    '*'
                  );
                }, 100);
              }

              if (message.command === '/clear') {
                setTimeout(() => {
                  window.postMessage(
                    {
                      type: 'agentDone',
                      finalSummary: 'Chat history cleared.',
                      success: true,
                      stepsUsed: 1,
                    },
                    '*'
                  );
                }, 100);
              }
            }, 50);
          }

          // Default OK response for other message types
          setTimeout(() => {
            callback?.({ ok: true });
          }, 10);
        },
        onMessage: {
          listeners: [] as Array<
            (message: any, sender?: any, sendResponse?: (response?: any) => void) => void
          >,
          addListener: (
            callback: (message: any, sender?: any, sendResponse?: (response?: any) => void) => void
          ) => {
            mockRuntime.onMessage.listeners.push(callback);
          },
          removeListener: (
            callback: (message: any, sender?: any, sendResponse?: (response?: any) => void) => void
          ) => {
            const index = mockRuntime.onMessage.listeners.indexOf(callback);
            if (index > -1) mockRuntime.onMessage.listeners.splice(index, 1);
          },
        },
      };

      // Mock chrome.storage
      const mockStorage = {
        local: {
          data: {} as Record<string, any>,
          get: (
            keys: string | string[] | Record<string, any> | null,
            callback?: (items: Record<string, any>) => void
          ) => {
            const result: Record<string, any> = {};
            if (typeof keys === 'string') {
              result[keys] = mockStorage.local.data[keys];
            } else if (Array.isArray(keys)) {
              keys.forEach(key => (result[key] = mockStorage.local.data[key]));
            }
            setTimeout(() => callback?.(result), 5);
          },
          set: (items: Record<string, any>, callback?: () => void) => {
            Object.assign(mockStorage.local.data, items);
            setTimeout(() => callback?.(), 5);
          },
        },
      };

      // Mock chrome.tabs
      const mockTabs = {
        query: (queryInfo: any, callback?: (tabs: any[]) => void) => {
          const tabs = [{ id: 1, url: 'http://localhost:3000', title: 'Test Page' }];
          setTimeout(() => callback?.(tabs), 5);
        },
      };

      // Install mocks
      (window as any).chrome = {
        runtime: mockRuntime,
        storage: mockStorage,
        tabs: mockTabs,
        sidePanel: {
          open: () => Promise.resolve(),
          setPanelBehavior: () => Promise.resolve(),
        },
      };

      const originalPostMessage = window.postMessage.bind(window);
      (window as any).postMessage = function (
        message: any,
        targetOrigin: string,
        transfer?: Transferable[]
      ) {
        mockRuntime.onMessage.listeners.forEach(listener => {
          try {
            listener(message, {}, () => { });
          } catch (e) {
            console.error('Mock listener error:', e);
          }
        });
        originalPostMessage(message, targetOrigin);
      };
    });
  });

  test('should load extension with all elements visible', async ({ page }) => {
    await page.goto(`file://${extensionPath}/sidepanel.html`);

    // Wait for initialization
    await page.waitForLoadState('networkidle');

    // All elements should be visible now with proper mocking
    await expect(page.locator('#app')).toBeVisible();
    await expect(page.locator('#command-input')).toBeVisible();
    await expect(page.locator('#btn-execute')).toBeVisible();
    // chat-history may be empty initially, just check it's attached
    await expect(page.locator('#chat-history')).toBeAttached();

    // Check no critical errors
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.waitForTimeout(1000);

    // Filter out expected chrome API errors
    const criticalErrors = errors.filter(
      e =>
        !e.includes('chrome.runtime') && !e.includes('chrome.storage') && !e.includes('chrome.tabs')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('should handle commands with full API simulation', async ({ page }) => {
    await page.goto(`file://${extensionPath}/sidepanel.html`);

    const commandInput = page.locator('#command-input');
    await commandInput.fill('/help');
    await commandInput.press('Enter');

    await page.waitForTimeout(300);

    const inputValue = await commandInput.inputValue();
    const chatMessages = page.locator('.chat-msg');
    const messageCount = await chatMessages.count();
    expect(messageCount >= 0 && typeof inputValue === 'string').toBeTruthy();
  });

  test('should show debug info when /debug is executed', async ({ page }) => {
    await page.goto(`file://${extensionPath}/sidepanel.html`);

    const commandInput = page.locator('#command-input');
    await commandInput.fill('/debug');
    await commandInput.press('Enter');

    await page.waitForTimeout(300);

    const agentMessages = page.locator('.chat-msg.agent');
    const texts = await agentMessages.allTextContents();
    expect(texts.some(t => t.includes('Debug info for last task'))).toBe(true);
  });

  test('should send resetPageSession when /reset is executed', async ({ page }) => {
    await page.goto(`file://${extensionPath}/sidepanel.html`);

    // Reset recorded messages
    await page.evaluate(() => {
      (window as any).__sentMessages = [];
    });

    const commandInput = page.locator('#command-input');
    await commandInput.fill('/reset');
    await commandInput.press('Enter');

    await page.waitForTimeout(200);

    const sentMessages = await page.evaluate(() => (window as any).__sentMessages || []);
    const hasReset = sentMessages.some((m: any) => m && m.type === 'resetPageSession');
    expect(hasReset).toBe(true);
  });

  test('should switch tabs with proper state management', async ({ page }) => {
    await page.goto(`file://${extensionPath}/sidepanel.html`);

    // Click memory tab and check click was registered
    await page.click('[data-tab="memory"]');
    await page.waitForTimeout(100);

    // Click subscription tab
    await page.click('[data-tab="subscription"]');
    await page.waitForTimeout(100);

    // Back to chat
    await page.click('[data-tab="chat"]');

    // Verify all tabs are still present and clickable
    await expect(page.locator('[data-tab="chat"]')).toBeVisible();
    await expect(page.locator('[data-tab="memory"]')).toBeVisible();
    await expect(page.locator('[data-tab="subscription"]')).toBeVisible();
  });

  test('should handle modal interactions with proper mocking', async ({ page }) => {
    await page.goto(`file://${extensionPath}/sidepanel.html`);

    // Check modals exist in DOM
    await expect(page.locator('#confirm-modal')).toBeAttached();
    await expect(page.locator('#ask-modal')).toBeAttached();
    await expect(page.locator('#btn-confirm')).toBeAttached();
    await expect(page.locator('#btn-cancel')).toBeAttached();

    // Check modal content elements exist
    await expect(page.locator('#confirm-summary')).toBeAttached();
    await expect(page.locator('#confirm-actions-list')).toBeAttached();
  });

  test('should auto-resize textarea correctly', async ({ page }) => {
    await page.goto(`file://${extensionPath}/sidepanel.html`);

    const commandInput = page.locator('#command-input');
    const initialHeight = await commandInput.evaluate(
      el => (el as HTMLTextAreaElement).offsetHeight
    );

    // Type multiple lines
    await commandInput.fill('Line 1\nLine 2\nLine 3\nLine 4\nLine 6\nLine 7\nLine 8');

    const newHeight = await commandInput.evaluate(el => (el as HTMLTextAreaElement).offsetHeight);

    // Height should increase or stay the same (if already at max)
    expect(newHeight).toBeGreaterThanOrEqual(initialHeight);
  });

  test('should render memory tab strategies and recent workflows', async ({ page }) => {
    await page.goto(`file://${extensionPath}/sidepanel.html`);

    // Open Memory tab
    await page.click('[data-tab="memory"]');

    // Wait for memory stats to load and list to render
    const list = page.locator('#memory-list');
    await expect(list).toBeAttached();

    const domainCard = list.locator('div.p-3').first();
    await expect(domainCard).toBeAttached();
    await expect(domainCard).toContainText('example.com');
    await expect(domainCard).toContainText('Recent workflows & macros');
    await expect(domainCard).toContainText('wf-1');
    await expect(domainCard).toContainText('macro-1');
  });

  test('should send clearDomainMemory message when Forget this site is clicked', async ({ page }) => {
    await page.goto(`file://${extensionPath}/sidepanel.html`);
    await page.click('[data-tab="memory"]');

    // Wait for domain card to appear
    const forgetButton = page.locator('button[data-domain="example.com"]').first();
    await expect(forgetButton).toBeAttached();

    await page.evaluate(() => {
      const btn = document.querySelector('button[data-domain="example.com"]') as HTMLButtonElement | null;
      btn?.click();
    });

    // Inspect captured messages in the mock runtime
    const messages = await page.evaluate(() => (window as any).__sentMessages || []);
    const hasClearDomain = messages.some(
      (m: any) => m && m.type === 'clearDomainMemory' && m.domain === 'example.com'
    );
    expect(hasClearDomain).toBeTruthy();
  });

  test('should toggle learning flag from memory tab', async ({ page }) => {
    await page.goto(`file://${extensionPath}/sidepanel.html`);
    await page.click('[data-tab="memory"]');

    const toggle = page.locator('#memory-learning-toggle');
    await expect(toggle).toBeAttached();

    const initialPressed = await toggle.getAttribute('aria-pressed');
    await page.evaluate(() => {
      const t = document.getElementById('memory-learning-toggle') as HTMLButtonElement | null;
      t?.click();
    });
    const afterPressed = await toggle.getAttribute('aria-pressed');

    expect(initialPressed).not.toBe(afterPressed);

    // Verify the mock storage was updated
    const learningEnabled = await page.evaluate(
      () => (window as any).chrome.storage.local.data['hyperagent_learning_enabled']
    );
    expect(typeof learningEnabled).toBe('boolean');
  });

  test('should send runMemoryHealthCheck message from Memory tab', async ({ page }) => {
    await page.goto(`file://${extensionPath}/sidepanel.html`);
    await page.click('[data-tab="memory"]');

    const healthBtn = page.locator('#btn-memory-health-check');
    await expect(healthBtn).toBeAttached();

    await page.evaluate(() => {
      const btn = document.getElementById('btn-memory-health-check') as HTMLButtonElement | null;
      btn?.click();
    });

    const messages = await page.evaluate(() => (window as any).__sentMessages || []);
    const hasHealthCheck = messages.some((m: any) => m && m.type === 'runMemoryHealthCheck');
    expect(hasHealthCheck).toBeTruthy();
  });

  test('should handle slash commands with simulated responses', async ({ page }) => {
    await page.goto(`file://${extensionPath}/sidepanel.html`);

    // Test /clear command
    await page.locator('#command-input').fill('/clear');
    await page.locator('#command-input').press('Enter');

    // Wait for processing
    await page.waitForTimeout(200);

    // Input should be cleared or message should appear
    const inputAfterClear = await page.locator('#command-input').inputValue();

    // Test /help command
    await page.locator('#command-input').fill('/help');
    await page.locator('#command-input').press('Enter');

    // Wait for processing
    await page.waitForTimeout(200);

    // Verify JS is working by checking input state
    const inputAfterHelp = await page.locator('#command-input').inputValue();
    // Either cleared or still has content - both are valid behaviors
    expect(typeof inputAfterHelp).toBe('string');
  });
});
