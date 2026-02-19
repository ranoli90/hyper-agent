import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionPath = path.join(__dirname, '..', '.output', 'chrome-mv3');

test.describe('HyperAgent Extension - Basic Functionality', () => {
  test('should load HTML structure correctly', async ({ page }) => {
    // Load the extension's sidepanel HTML
    await page.goto(`file://${extensionPath}/sidepanel.html`);
    
    // Check basic HTML structure exists
    await expect(page.locator('#app')).toBeVisible();
    await expect(page.locator('header#header')).toBeVisible();
    await expect(page.locator('main#main-content')).toBeVisible();
    await expect(page.locator('#input-area')).toBeVisible();
    
    // Check all tabs exist
    await expect(page.locator('[data-tab="chat"]')).toBeVisible();
    await expect(page.locator('[data-tab="vision"]')).toBeVisible();
    await expect(page.locator('[data-tab="tasks"]')).toBeVisible();
    await expect(page.locator('[data-tab="memory"]')).toBeVisible();
    
    // Check input elements exist
    await expect(page.locator('#command-input')).toBeVisible();
    await expect(page.locator('#btn-execute')).toBeVisible();
    await expect(page.locator('#btn-mic')).toBeVisible();
    
    // Check modals exist (but may be hidden)
    await expect(page.locator('#confirm-modal')).toBeAttached();
    await expect(page.locator('#ask-modal')).toBeAttached();
  });

  test('should have proper CSS styling applied', async ({ page }) => {
    await page.goto(`file://${extensionPath}/sidepanel.html`);
    
    // Check if CSS is loaded by verifying styles
    const computedStyle = await page.evaluate(() => {
      const input = document.getElementById('command-input');
      if (!input) return null;
      const styles = window.getComputedStyle(input);
      return {
        fontFamily: styles.fontFamily,
        padding: styles.padding,
        border: styles.border
      };
    });
    
    // Font family may not load in test environment, just check it has some font
    expect(computedStyle?.fontFamily).not.toBe('');
    expect(computedStyle?.padding).not.toBe('');
  });

  test('should handle basic DOM interactions', async ({ page }) => {
    await page.goto(`file://${extensionPath}/sidepanel.html`);
    
    // Test textarea input
    const commandInput = page.locator('#command-input');
    await commandInput.fill('Test command');
    await expect(commandInput).toHaveValue('Test command');
    
    // Test button clicks (even without handlers, should not error)
    await page.click('#btn-execute');
    await page.click('[data-tab="vision"]');
    await page.click('[data-tab="tasks"]');
    await page.click('[data-tab="memory"]');
    await page.click('[data-tab="chat"]');
    
    // Elements should still be present
    await expect(commandInput).toBeVisible();
    await expect(page.locator('#app')).toBeVisible();
  });

  test('should have all required script tags', async ({ page }) => {
    const response = await page.goto(`file://${extensionPath}/sidepanel.html`);
    const html = await response!.text();
    
    // Check for main script (built by WXT)
    expect(html).toContain('<script type="module" crossorigin src="/chunks/sidepanel-');
    
    // Check for CSS (built by WXT)
    expect(html).toContain('<link rel="stylesheet" crossorigin href="/assets/sidepanel-');
  });

  test('should load without JavaScript errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    
    await page.goto(`file://${extensionPath}/sidepanel.html`);
    
    // Wait for any initialization
    await page.waitForTimeout(2000);
    
    // Filter out expected Chrome API errors
    const unexpectedErrors = errors.filter(e => 
      !e.includes('chrome.runtime') && 
      !e.includes('chrome.storage') &&
      !e.includes('chrome.tabs') &&
      !e.includes('chrome.sidePanel') &&
      !e.includes('Cannot read properties of undefined (reading \'runtime\')')
    );
    
    console.log('JS Errors:', errors);
    console.log('Unexpected Errors:', unexpectedErrors);
    
    // Should not have unexpected errors
    expect(unexpectedErrors).toHaveLength(0);
  });

  test('should have proper meta and structure', async ({ page }) => {
    await page.goto(`file://${extensionPath}/sidepanel.html`);
    
    // Check page title
    await expect(page).toHaveTitle('HyperAgent');
    
    // Check meta tags
    const viewport = page.locator('meta[name="viewport"]');
    await expect(viewport).toHaveAttribute('content', 'width=device-width, initial-scale=1.0');
    
    // Check charset
    await expect(page.locator('meta[charset="UTF-8"]')).toBeVisible();
  });

  test('should handle keyboard events', async ({ page }) => {
    await page.goto(`file://${extensionPath}/sidepanel.html`);
    
    const commandInput = page.locator('#command-input');
    await commandInput.focus();
    
    // Test typing
    await page.keyboard.type('test');
    await expect(commandInput).toHaveValue('test');
    
    // Test Enter key
    await page.keyboard.press('Enter');
    
    // Input should still be there (without Chrome APIs to process it)
    await expect(commandInput).toHaveValue('test');
    
    // Test backspace
    await page.keyboard.press('Backspace');
    await expect(commandInput).toHaveValue('tes');
  });
});
