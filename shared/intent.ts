import type { CommandIntent } from './types';

// ─── Command Patterns ──────────────────────────────────────────────────
interface CommandPattern {
  action: string;
  keywords: string[];
  templates: string[];
  confidence: number;
}

const COMMAND_PATTERNS: CommandPattern[] = [
  {
    action: 'navigate',
    keywords: ['go', 'navigate', 'visit', 'open', 'load', 'show', 'display'],
    templates: [
      'go to {target}',
      'navigate to {target}',
      'visit {target}',
      'open {target}',
      'go {target}',
    ],
    confidence: 0.9,
  },
  {
    action: 'search',
    keywords: ['search', 'find', 'look', 'seek', 'query', 'google'],
    templates: [
      'search for {target}',
      'search {target}',
      'find {target}',
      'find and {target}',
      'look for {target}',
      'search on google for {target}',
    ],
    confidence: 0.85,
  },
  {
    action: 'click',
    keywords: ['click', 'tap', 'press', 'select', 'hit'],
    templates: [
      'click {target}',
      'click on {target}',
      'tap {target}',
      'press {target}',
      'select {target}',
    ],
    confidence: 0.8,
  },
  {
    action: 'fill',
    keywords: ['fill', 'enter', 'type', 'input', 'write', 'put'],
    templates: [
      'fill {target}',
      'fill in {target}',
      'enter {target}',
      'type {target}',
      'input {target}',
    ],
    confidence: 0.8,
  },
  {
    action: 'extract',
    keywords: ['extract', 'get', 'fetch', 'grab', 'capture', 'read', 'show', 'display', 'list'],
    templates: [
      'extract {target}',
      'get {target}',
      'fetch {target}',
      'show {target}',
      'display {target}',
      'list {target}',
    ],
    confidence: 0.75,
  },
  {
    action: 'scroll',
    keywords: ['scroll', 'scroll down', 'scroll up', 'scroll to'],
    templates: [
      'scroll down',
      'scroll up',
      'scroll to {target}',
      'scroll {target}',
    ],
    confidence: 0.85,
  },
  {
    action: 'wait',
    keywords: ['wait', 'pause', 'delay', 'sleep'],
    templates: [
      'wait',
      'wait for {target}',
      'pause',
    ],
    confidence: 0.8,
  },
  {
    action: 'goBack',
    keywords: ['back', 'go back', 'return', 'previous'],
    templates: [
      'go back',
      'go back to {target}',
      'return',
    ],
    confidence: 0.9,
  },
  {
    action: 'openTab',
    keywords: ['new tab', 'open tab', 'tab', 'create tab'],
    templates: [
      'open new tab',
      'open tab {target}',
      'new tab {target}',
      'create tab {target}',
    ],
    confidence: 0.85,
  },
  {
    action: 'closeTab',
    keywords: ['close tab', 'close', 'close current tab'],
    templates: [
      'close tab',
      'close this tab',
      'close current tab',
    ],
    confidence: 0.9,
  },
  {
    action: 'switchTab',
    keywords: ['switch tab', 'switch to', 'change tab', 'go to tab'],
    templates: [
      'switch tab {target}',
      'switch to {target}',
      'switch to tab {target}',
    ],
    confidence: 0.85,
  },
  {
    action: 'hover',
    keywords: ['hover', 'mouse over', 'over'],
    templates: [
      'hover {target}',
      'hover over {target}',
      'mouse over {target}',
    ],
    confidence: 0.75,
  },
  {
    action: 'focus',
    keywords: ['focus', 'focus on', 'activate'],
    templates: [
      'focus {target}',
      'focus on {target}',
      'activate {target}',
    ],
    confidence: 0.75,
  },
];

// ─── Common Commands Templates ──────────────────────────────────────────
const COMMON_COMMANDS = [
  'go to {target}',
  'navigate to {target}',
  'visit {target}',
  'search for {target}',
  'find {target}',
  'click {target}',
  'click on {target}',
  'fill {target}',
  'enter {target}',
  'extract {target}',
  'get {target}',
  'show {target}',
  'scroll down',
  'scroll up',
  'go back',
  'open new tab',
  'close tab',
  'switch tab {target}',
];

// ─── Parse Intent ──────────────────────────────────────────────────────
/**
 * Parse a command string into possible intents
 * Uses pattern matching to identify action type and extract target
 * Now supports multi-language commands (auto-detects and translates)
 */
export function parseIntent(command: string): CommandIntent[] {
  // Normalize command to lowercase for matching
  const normalized = command.toLowerCase().trim();
  const intents: CommandIntent[] = [];

  if (!normalized || typeof normalized !== 'string') {
    return intents;
  }

  // Valid action types that LLM can execute
  const validActions = new Set(['navigate', 'search', 'click', 'fill', 'extract', 'scroll', 'wait', 'goBack', 'openTab', 'closeTab', 'switchTab', 'hover', 'focus', 'pressKey']);

  // Try to match each pattern
  for (const pattern of COMMAND_PATTERNS) {
    // Validate pattern action
    if (!validActions.has(pattern.action)) {
      console.warn(`[Intent] Invalid action in pattern: ${pattern.action}`);
      continue;
    }
    
    // Check if any keyword matches - with safe regex
    const keywordMatch = pattern.keywords.some((keyword) => {
      try {
        // Escape special regex characters in keyword
        const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`^${escaped}\\b|\\s${escaped}\\b|\\b${escaped}$`, 'i');
        return regex.test(normalized);
      } catch (err) {
        console.warn(`[Intent] Regex error for keyword "${keyword}":`, err);
        return keyword && normalized.includes(keyword);
      }
    });

    if (keywordMatch) {
      // Extract target by removing the matched keyword
      let target: string | undefined;
      
      for (const keyword of pattern.keywords) {
        try {
          const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`${escaped}\\s+(.+)`,'i');
          const match = normalized.match(regex);
          if (match && match[1]) {
            target = match[1].trim();
            break;
          }
        } catch (err) {
          console.warn(`[Intent] Regex match error:`, err);
        }
      }

      // If no target extracted, try removing keyword from start
      if (!target) {
        for (const keyword of pattern.keywords) {
          if (normalized.startsWith(keyword.toLowerCase())) {
            target = normalized.slice(keyword.length).trim();
            if (target) break;
          }
        }
      }

      // Only add intent if we found a keyword match
      if (!intents.some(i => i.action === pattern.action)) { // Avoid duplicates
        intents.push({
          action: pattern.action,
          target: target || undefined,
          confidence: pattern.confidence,
          originalText: command,
        });
      }
    }
  }

  // If no patterns matched, treat entire command as a target for navigate/search
  if (intents.length === 0) {
    // Check if it looks like a URL
    const isUrl = normalized.match(/^https?:\/\//) || normalized.match(/\.(com|org|net|edu|gov|io|co)/);
    if (isUrl) {
      intents.push({
        action: 'navigate',
        target: command,
        confidence: 0.9,
        originalText: command,
      });
    } else {
      // Default to search
      intents.push({
        action: 'search',
        target: command,
        confidence: 0.6,
        originalText: command,
      });
    }
  }

  // Sort by confidence
  intents.sort((a, b) => b.confidence - a.confidence);

  return intents;
}

// ─── Get Suggestions ───────────────────────────────────────────────────
/**
 * Suggest command completions based on partial input
 * Returns suggestions after 3+ characters typed
 */
export function getSuggestions(command: string): string[] {
  const normalized = command.toLowerCase().trim();
  
  // Only show suggestions after 3+ characters
  if (normalized.length < 3) {
    return [];
  }

  const suggestions: string[] = [];
  const seen = new Set<string>();

  // Match against common command templates
  for (const template of COMMON_COMMANDS) {
    const templateLower = template.toLowerCase();
    
    // Check if template starts with the input
    if (templateLower.startsWith(normalized)) {
      if (!seen.has(template)) {
        suggestions.push(capitalizeFirst(template));
        seen.add(template);
      }
    }
    
    // Check if input starts a keyword in the template
    const templateWords = templateLower.split(' ');
    for (let i = 0; i < templateWords.length; i++) {
      const word = templateWords[i].replace('{target}', '');
      if (word.startsWith(normalized)) {
        // Suggest completing from this word
        const completion = templateWords.slice(i).join(' ');
        if (!seen.has(completion)) {
          suggestions.push(capitalizeFirst(completion));
          seen.add(completion);
        }
      }
    }
  }

  // Match against pattern keywords
  for (const pattern of COMMAND_PATTERNS) {
    for (const keyword of pattern.keywords) {
      if (keyword.startsWith(normalized)) {
        // Suggest keyword + template
        const _template = pattern.templates[0].replace('{target}', '<target>');
        const suggestion = `${keyword} <target>`;
        if (!seen.has(suggestion)) {
          suggestions.push(capitalizeFirst(suggestion));
          seen.add(suggestion);
        }
      }
    }
  }

  // Limit to top 5 suggestions
  return suggestions.slice(0, 5);
}

// ─── Helper ───────────────────────────────────────────────────────────
function capitalizeFirst(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}
