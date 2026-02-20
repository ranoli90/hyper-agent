import { describe, it, expect } from 'vitest';
import { parseIntent, getSuggestions } from '../../shared/intent';

describe('parseIntent', () => {
  it('parses navigation commands', () => {
    const intents = parseIntent('go to google.com');
    expect(intents.length).toBeGreaterThan(0);
    expect(intents[0].action).toBe('navigate');
    expect(intents[0].target).toContain('google.com');
  });

  it('parses click commands', () => {
    const intents = parseIntent('click the login button');
    expect(intents.length).toBeGreaterThan(0);
    const clickIntent = intents.find(i => i.action === 'click');
    expect(clickIntent).toBeDefined();
  });

  it('parses search commands', () => {
    const intents = parseIntent('search for cheap flights');
    expect(intents.length).toBeGreaterThan(0);
    const searchIntent = intents.find(i => i.action === 'search');
    expect(searchIntent).toBeDefined();
  });

  it('parses fill commands', () => {
    const intents = parseIntent('fill in the email field');
    expect(intents.length).toBeGreaterThan(0);
    const fillIntent = intents.find(i => i.action === 'fill');
    expect(fillIntent).toBeDefined();
  });

  it('parses scroll commands', () => {
    const intents = parseIntent('scroll down');
    expect(intents.length).toBeGreaterThan(0);
    const scrollIntent = intents.find(i => i.action === 'scroll');
    expect(scrollIntent).toBeDefined();
  });

  it('parses extract commands', () => {
    const intents = parseIntent('extract the price from this page');
    expect(intents.length).toBeGreaterThan(0);
    const extractIntent = intents.find(i => i.action === 'extract');
    expect(extractIntent).toBeDefined();
  });

  it('returns empty for empty input', () => {
    const intents = parseIntent('');
    expect(intents).toHaveLength(0);
  });

  it('handles mixed case', () => {
    const intents = parseIntent('CLICK the Submit BUTTON');
    expect(intents.length).toBeGreaterThan(0);
    const clickIntent = intents.find(i => i.action === 'click');
    expect(clickIntent).toBeDefined();
  });

  it('assigns confidence scores', () => {
    const intents = parseIntent('navigate to example.com');
    expect(intents.length).toBeGreaterThan(0);
    expect(intents[0].confidence).toBeGreaterThan(0);
    expect(intents[0].confidence).toBeLessThanOrEqual(1);
  });

  it('parses go back command', () => {
    const intents = parseIntent('go back');
    expect(intents.length).toBeGreaterThan(0);
    const backIntent = intents.find(i => i.action === 'goBack');
    expect(backIntent).toBeDefined();
  });

  it('parses wait command', () => {
    const intents = parseIntent('wait for 5 seconds');
    expect(intents.length).toBeGreaterThan(0);
    const waitIntent = intents.find(i => i.action === 'wait');
    expect(waitIntent).toBeDefined();
  });

  it('parses hover command', () => {
    const intents = parseIntent('hover over the menu');
    expect(intents.length).toBeGreaterThan(0);
    const hoverIntent = intents.find(i => i.action === 'hover');
    expect(hoverIntent).toBeDefined();
  });

  it('parses tab commands', () => {
    const intents = parseIntent('open a new tab');
    expect(intents.length).toBeGreaterThan(0);
    const tabIntent = intents.find(i => i.action === 'openTab');
    expect(tabIntent).toBeDefined();
  });
});

describe('getSuggestions', () => {
  it('returns suggestions for partial commands', () => {
    const suggestions = getSuggestions('cli');
    expect(suggestions.length).toBeGreaterThan(0);
  });

  it('returns suggestions for navigate keyword (3+ chars)', () => {
    const suggestions = getSuggestions('nav');
    expect(suggestions.length).toBeGreaterThan(0);
  });

  it('returns empty for 2-char input (below threshold)', () => {
    const suggestions = getSuggestions('go');
    expect(suggestions).toHaveLength(0);
  });

  it('returns empty for very short input', () => {
    const suggestions = getSuggestions('');
    expect(suggestions).toHaveLength(0);
  });

  it('limits number of suggestions', () => {
    const suggestions = getSuggestions('a');
    expect(suggestions.length).toBeLessThanOrEqual(10);
  });
});
