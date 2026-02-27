import { describe, it, expect, beforeEach, vi } from 'vitest';

// Minimal DOM and chrome stubs for content script
const listeners: Record<string, Function[]> = {};

beforeEach(() => {
  (globalThis as any).chrome = {
    runtime: {
      onMessage: {
        addListener: (fn: any) => {
          (listeners['message'] ||= []).push(fn);
        },
      },
    },
  };

  // Basic DOM setup
  document.body.innerHTML = `
    <button id="btn" data-testid="test-btn">Click me</button>
    <input id="input" placeholder="Type here" />
    <select id="select">
      <option value="one">One</option>
      <option value="two">Two</option>
    </select>
  `;
});

describe('Content script actions (smoke)', () => {
  it('getContext returns basic structure', async () => {
    const mod = await import('../../entrypoints/content');
    expect(mod).toBeTruthy();

    const handler = listeners['message']?.[0];
    expect(typeof handler).toBe('function');

    const sendResponse = vi.fn();
    handler({ type: 'getContext' }, {}, sendResponse);

    const resp = sendResponse.mock.calls[0][0];
    expect(resp.type).toBe('getContextResponse');
    expect(resp.context).toBeTruthy();
    expect(typeof resp.context.url).toBe('string');
    expect(Array.isArray(resp.context.semanticElements)).toBe(true);
  });

  it('performAction click succeeds for basic button', async () => {
    await import('../../entrypoints/content');
    const handler = listeners['message']?.[0];
    const sendResponse = vi.fn();

    handler(
      {
        type: 'executeActionOnPage',
        action: {
          type: 'click',
          locator: { strategy: 'css', value: '#btn' },
        },
      },
      {},
      sendResponse,
    );

    const resp = await Promise.resolve(sendResponse.mock.calls[0][0]);
    expect(resp.success).toBe(true);
  });
});

