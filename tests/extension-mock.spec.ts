import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionPath = path.join(__dirname, '..', '.output', 'chrome-mv3');

test.describe('HyperAgent Extension with Full Chrome API Mock', () => {
  test.beforeEach(async ({ context }) => {
    // Comprehensive Chrome API mock
    await context.addInitScript(() => {
      // Mock chrome.runtime with full functionality
      const mockRuntime = {
        sendMessage: (message: any, callback?: (response: any) => void) => {
          // Simulate async response
          setTimeout(() => {
            if (callback) callback({ ok: true });
          }, 10);
          
          // Handle specific message types
          if (message.type === 'executeCommand') {
            // Simulate command processing
            setTimeout(() => {
              // Trigger progress message
              window.postMessage({
                type: 'agentProgress',
                status: 'Processing...',
                step: 'plan',
                summary: 'Analyzing command...'
              }, '*');
              
              // For /help command, simulate response
              if (message.command === '/help') {
                setTimeout(() => {
                  window.postMessage({
                    type: 'agentDone',
                    finalSummary: '**Hyper-Commands:**\n- `/memory`: View stored knowledge\n- `/schedule`: Manage background tasks\n- `/tools`: List available agent tools\n- `/clear`: Clear chat history\n- `/help`: Show this message',
                    success: true,
                    stepsUsed: 1
                  }, '*');
                }, 100);
              }
              
              // For /clear command
              if (message.command === '/clear') {
                setTimeout(() => {
                  window.postMessage({
                    type: 'agentDone',
                    finalSummary: 'Chat history cleared.',
                    success: true,
                    stepsUsed: 1
                  }, '*');
                }, 100);
              }
            }, 50);
          }
        },
        onMessage: {
          listeners: [],
          addListener: (callback: (message: any, sender?: any, sendResponse?: (response?: any) => void) => void) => {
            mockRuntime.onMessage.listeners.push(callback);
          },
          removeListener: (callback: any) => {
            const index = mockRuntime.onMessage.listeners.indexOf(callback);
            if (index > -1) mockRuntime.onMessage.listeners.splice(index, 1);
          }
        }
      };

      // Mock chrome.storage
      const mockStorage = {
        local: {
          data: {} as Record<string, any>,
          get: (keys: string | string[] | Record<string, any> | null, callback?: (items: Record<string, any>) => void) => {
            const result: Record<string, any> = {};
            if (typeof keys === 'string') {
              result[keys] = mockStorage.local.data[keys];
            } else if (Array.isArray(keys)) {
              keys.forEach(key => result[key] = mockStorage.local.data[key]);
            }
            setTimeout(() => callback?.(result), 5);
          },
          set: (items: Record<string, any>, callback?: () => void) => {
            Object.assign(mockStorage.local.data, items);
            setTimeout(() => callback?.(), 5);
          }
        }
      };

      // Mock chrome.tabs
      const mockTabs = {
        query: (queryInfo: any, callback?: (tabs: any[]) => void) => {
          const tabs = [{ id: 1, url: 'http://localhost:3000', title: 'Test Page' }];
          setTimeout(() => callback?.(tabs), 5);
        }
      };

      // Install mocks
      (window as any).chrome = {
        runtime: mockRuntime,
        storage: mockStorage,
        tabs: mockTabs,
        sidePanel: {
          open: () => Promise.resolve(),
          setPanelBehavior: () => Promise.resolve()
        }
      };

      // Intercept postMessage for sidepanel communication
      const originalPostMessage = window.postMessage;
      window.postMessage = function(message: any, targetOrigin: string, transfer?: Transferable[]) {
        // Trigger chrome.runtime.onMessage listeners
        mockRuntime.onMessage.listeners.forEach(listener => {
          try {
            listener(message, {}, () => {});
          } catch (e) {
            console.error('Mock listener error:', e);
          }
        });
        
        // Call original
        return originalPostMessage.call(this, message, targetOrigin, transfer);
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
    await expect(page.locator('#chat-history')).toBeVisible();
    
    // Check no critical errors
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.waitForTimeout(1000);
    
    // Filter out expected chrome API errors
    const criticalErrors = errors.filter(e => 
      !e.includes('chrome.runtime') && 
      !e.includes('chrome.storage') &&
      !e.includes('chrome.tabs')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('should handle commands with full API simulation', async ({ page }) => {
    await page.goto(`file://${extensionPath}/sidepanel.html`);
    
    // Type and submit /help command
    const commandInput = page.locator('#command-input');
    await commandInput.fill('/help');
    
    // Suggestions should appear
    await expect(page.locator('#suggestions-container')).not.toHaveClass(/hidden/);
    
    // Submit command
    await commandInput.press('Enter');
    
    // Command should be processed
    await expect(commandInput).toHaveValue('');
    
    // Wait for simulated response
    await page.waitForTimeout(200);
    
    // Check message was added
    const chatMessages = page.locator('.chat-msg');
    await expect(chatMessages.first()).toBeVisible();
    
    // Should have help message
    await expect(page.locator('.chat-msg.agent')).toContainText('Hyper-Commands');
  });

  test('should switch tabs with proper state management', async ({ page }) => {
    await page.goto(`file://${extensionPath}/sidepanel.html`);
    
    // Click vision tab
    await page.click('[data-tab="vision"]');
    await expect(page.locator('[data-tab="vision"]')).toHaveClass(/active/);
    await expect(page.locator('#tab-vision')).toHaveClass(/active/);
    
    // Click tasks tab
    await page.click('[data-tab="tasks"]');
    await expect(page.locator('[data-tab="tasks"]')).toHaveClass(/active/);
    await expect(page.locator('#tab-tasks')).toHaveClass(/active/);
    
    // Click memory tab
    await page.click('[data-tab="memory"]');
    await expect(page.locator('[data-tab="memory"]')).toHaveClass(/active/);
    await expect(page.locator('#tab-memory')).toHaveClass(/active/);
    
    // Back to chat
    await page.click('[data-tab="chat"]');
    await expect(page.locator('[data-tab="chat"]')).toHaveClass(/active/);
    await expect(page.locator('#tab-chat')).toHaveClass(/active/);
  });

  test('should handle modal interactions with proper mocking', async ({ page }) => {
    await page.goto(`file://${extensionPath}/sidepanel.html`);
    
    // Simulate receiving a confirm action message
    await page.evaluate(() => {
      const event = new MessageEvent('message', {
        data: {
          type: 'confirmActions',
          summary: 'Test confirmation',
          actions: [{ type: 'click', description: 'Test action' }]
        }
      });
      window.dispatchEvent(event);
    });
    
    // Modal should appear
    await expect(page.locator('#confirm-modal')).toBeVisible();
    await expect(page.locator('#confirm-summary')).toContainText('Test confirmation');
    await expect(page.locator('#btn-confirm')).toBeVisible();
    await expect(page.locator('#btn-cancel')).toBeVisible();
    
    // Test confirmation
    await page.click('#btn-confirm');
    await expect(page.locator('#confirm-modal')).toHaveClass(/hidden/);
  });

  test('should auto-resize textarea correctly', async ({ page }) => {
    await page.goto(`file://${extensionPath}/sidepanel.html`);
    
    const commandInput = page.locator('#command-input');
    const initialHeight = await commandInput.evaluate(el => (el as HTMLTextAreaElement).offsetHeight);
    
    // Type multiple lines
    await commandInput.fill('Line 1\nLine 2\nLine 3\nLine 4\nLine 6\nLine 7\nLine 8');
    
    const newHeight = await commandInput.evaluate(el => (el as HTMLTextAreaElement).offsetHeight);
    
    // Height should increase
    expect(newHeight).toBeGreaterThan(initialHeight);
  });

  test('should handle slash commands with simulated responses', async ({ page }) => {
    await page.goto(`file://${extensionPath}/sidepanel.html`);
    
    // Test /clear command
    await page.locator('#command-input').fill('/clear');
    await page.locator('#command-input').press('Enter');
    
    // Wait for processing
    await page.waitForTimeout(200);
    
    // Should show cleared message
    const messages = page.locator('.chat-msg');
    const hasClearMessage = await messages.filter({ hasText: 'Chat history cleared' }).count();
    expect(hasClearMessage).toBeGreaterThan(0);
    
    // Test /help command
    await page.locator('#command-input').fill('/help');
    await page.locator('#command-input').press('Enter');
    
    // Wait for processing
    await page.waitForTimeout(200);
    
    // Should show help message
    await expect(page.locator('.chat-msg.agent')).toContainText('Hyper-Commands');
  });
});
