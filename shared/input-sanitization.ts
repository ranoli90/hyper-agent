// ─── Comprehensive Input Sanitization & XSS Protection System ──────────
// Enterprise-grade security system for Chrome extensions handling user input,
// web scraping, and dynamic content rendering

export interface SanitizationOptions {
  allowHtml?: boolean;
  allowedTags?: string[];
  allowedAttributes?: string[];
  allowDataUrls?: boolean;
  maxLength?: number;
  preserveWhitespace?: boolean;
  encodeEntities?: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  sanitizedValue: string;
  errors: string[];
  warnings: string[];
  originalLength: number;
  sanitizedLength: number;
}

export interface SecurityConfig {
  enableSanitization: boolean;
  enableXssProtection: boolean;
  enableCsp: boolean;
  strictMode: boolean;
  allowedDomains: string[];
  blockedPatterns: RegExp[];
  maxInputLength: number;
  enableLogging: boolean;
}

export class InputSanitizer {
  private config: SecurityConfig;

  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = {
      enableSanitization: true,
      enableXssProtection: true,
      enableCsp: true,
      strictMode: true,
      allowedDomains: [],
      blockedPatterns: [
        /<script[^>]*>.*?<\/script>/gi,
        /javascript:/gi,
        /data:text\/html/gi,
        /vbscript:/gi,
        /on\w+\s*=/gi,
        /<iframe[^>]*>/gi,
        /<object[^>]*>/gi,
        /<embed[^>]*>/gi
      ],
      maxInputLength: 1000000, // 1MB
      enableLogging: true,
      ...config
    };
  }

  // ─── Main Sanitization Methods ────────────────────────────────────────
  sanitize(input: string, options: SanitizationOptions = {}): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      sanitizedValue: input,
      errors: [],
      warnings: [],
      originalLength: input.length,
      sanitizedLength: 0
    };

    if (!input || typeof input !== 'string') {
      result.isValid = false;
      result.errors.push('Input must be a non-empty string');
      return result;
    }

    // Length validation
    if (input.length > this.config.maxInputLength) {
      result.isValid = false;
      result.errors.push(`Input length (${input.length}) exceeds maximum allowed (${this.config.maxInputLength})`);
      return result;
    }

    let sanitized = input;

    // XSS protection
    if (this.config.enableXssProtection) {
      const xssResult = this.protectAgainstXss(sanitized);
      sanitized = xssResult.value;
      result.warnings.push(...xssResult.warnings);
    }

    // Blocked pattern detection
    for (const pattern of this.config.blockedPatterns) {
      if (pattern.test(sanitized)) {
        result.isValid = false;
        result.errors.push(`Input contains blocked pattern: ${pattern.source}`);
        break;
      }
    }

    // HTML sanitization
    if (options.allowHtml !== false) {
      sanitized = this.sanitizeHtml(sanitized, options);
    } else {
      // Encode HTML entities
      sanitized = this.encodeHtmlEntities(sanitized);
    }

    // Length limits
    if (options.maxLength && sanitized.length > options.maxLength) {
      sanitized = sanitized.substring(0, options.maxLength);
      result.warnings.push(`Content truncated to ${options.maxLength} characters`);
    }

    // Whitespace handling
    if (!options.preserveWhitespace) {
      sanitized = sanitized.trim();
    }

    result.sanitizedValue = sanitized;
    result.sanitizedLength = sanitized.length;

    // Logging
    if (this.config.enableLogging && (result.errors.length > 0 || result.warnings.length > 0)) {
      console.warn('[InputSanitizer]', {
        originalLength: result.originalLength,
        sanitizedLength: result.sanitizedLength,
        errors: result.errors,
        warnings: result.warnings,
        isValid: result.isValid
      });
    }

    return result;
  }

  // ─── XSS Protection ───────────────────────────────────────────────────
  private protectAgainstXss(input: string): { value: string; warnings: string[] } {
    let value = input;
    const warnings: string[] = [];

    // Remove dangerous script tags
    const scriptTagRegex = /<script[^>]*>.*?<\/script>/gi;
    if (scriptTagRegex.test(value)) {
      value = value.replace(scriptTagRegex, '');
      warnings.push('Removed script tags');
    }

    // Remove event handlers
    const eventHandlerRegex = /on\w+\s*=\s*["'][^"']*["']/gi;
    if (eventHandlerRegex.test(value)) {
      value = value.replace(eventHandlerRegex, '');
      warnings.push('Removed event handlers');
    }

    // Remove javascript: URLs
    const jsUrlRegex = /javascript:[^"'\s]*/gi;
    if (jsUrlRegex.test(value)) {
      value = value.replace(jsUrlRegex, '');
      warnings.push('Removed javascript URLs');
    }

    // Remove vbscript: URLs
    const vbscriptRegex = /vbscript:[^"'\s]*/gi;
    if (vbscriptRegex.test(value)) {
      value = value.replace(vbscriptRegex, '');
      warnings.push('Removed vbscript URLs');
    }

    // Remove data: URLs if not explicitly allowed
    const dataUrlRegex = /data:[^"'\s]*/gi;
    if (dataUrlRegex.test(value)) {
      value = value.replace(dataUrlRegex, '');
      warnings.push('Removed data URLs');
    }

    // Remove dangerous iframe, object, embed tags
    const dangerousTags = ['iframe', 'object', 'embed', 'form'];
    for (const tag of dangerousTags) {
      const tagRegex = new RegExp(`<${tag}[^>]*>.*?</${tag}>`, 'gi');
      if (tagRegex.test(value)) {
        value = value.replace(tagRegex, '');
        warnings.push(`Removed ${tag} tags`);
      }
    }

    // Encode dangerous characters in attributes
    value = value.replace(/<([^>]+)>/g, (match, content) => {
      // Encode quotes and angle brackets in attributes
      return content.replace(/["']/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    });

    return { value, warnings };
  }

  // ─── HTML Sanitization ────────────────────────────────────────────────
  private sanitizeHtml(input: string, options: SanitizationOptions): string {
    if (!options.allowHtml) {
      return this.encodeHtmlEntities(input);
    }

    const allowedTags = options.allowedTags || ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
    const allowedAttributes = options.allowedAttributes || ['href', 'title', 'alt'];

    // Simple HTML sanitizer (in production, use DOMPurify)
    let sanitized = input;

    // Remove all tags not in allowed list
    sanitized = sanitized.replace(/<([^>]+)>/g, (match, tagContent) => {
      const tagMatch = tagContent.match(/^\/?([a-zA-Z][a-zA-Z0-9]*)/);
      if (!tagMatch) return match;

      const tagName = tagMatch[1].toLowerCase();
      if (!allowedTags.includes(tagName)) {
        return ''; // Remove tag completely
      }

      // Sanitize attributes
      let cleanTag = `<${tagContent.includes('/') ? '/' : ''}${tagName}`;

      // Extract and validate attributes
      const attrMatches = tagContent.matchAll(/([a-zA-Z][a-zA-Z0-9-]*)\s*=\s*["']([^"']*)["']/g);
      for (const attrMatch of attrMatches) {
        const [, attrName, attrValue] = attrMatch;
        if (allowedAttributes.includes(attrName.toLowerCase())) {
          // Encode dangerous characters in attribute values
          const safeValue = attrValue.replace(/[<>"']/g, (char) => {
            switch (char) {
              case '<': return '&lt;';
              case '>': return '&gt;';
              case '"': return '&quot;';
              case "'": return '&#x27;';
              default: return char;
            }
          });
          cleanTag += ` ${attrName}="${safeValue}"`;
        }
      }

      cleanTag += '>';
      return cleanTag;
    });

    return sanitized;
  }

  // ─── Entity Encoding ──────────────────────────────────────────────────
  private encodeHtmlEntities(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  // ─── Specialized Sanitizers ───────────────────────────────────────────
  sanitizeUrl(url: string): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      sanitizedValue: url,
      errors: [],
      warnings: [],
      originalLength: url.length,
      sanitizedLength: 0
    };

    try {
      const urlObj = new URL(url);

      // Check against allowed domains
      if (this.config.allowedDomains.length > 0) {
        const isAllowed = this.config.allowedDomains.some(domain =>
          urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`)
        );
        if (!isAllowed) {
          result.isValid = false;
          result.errors.push(`Domain ${urlObj.hostname} is not in allowed domains list`);
        }
      }

      // Remove dangerous protocols
      const dangerousProtocols = ['javascript:', 'vbscript:', 'data:', 'file:'];
      if (dangerousProtocols.includes(urlObj.protocol)) {
        result.isValid = false;
        result.errors.push(`Dangerous protocol detected: ${urlObj.protocol}`);
      }

      // Encode URL components
      result.sanitizedValue = urlObj.toString();
      result.sanitizedLength = result.sanitizedValue.length;

    } catch (error) {
      result.isValid = false;
      result.errors.push('Invalid URL format');
    }

    return result;
  }

  sanitizeEmail(email: string): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      sanitizedValue: email.toLowerCase().trim(),
      errors: [],
      warnings: [],
      originalLength: email.length,
      sanitizedLength: 0
    };

    // Basic email validation
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

    if (!emailRegex.test(result.sanitizedValue)) {
      result.isValid = false;
      result.errors.push('Invalid email format');
    }

    result.sanitizedLength = result.sanitizedValue.length;
    return result;
  }

  sanitizePhone(phone: string): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      sanitizedValue: phone.replace(/[^\d+\-\s()]/g, ''),
      errors: [],
      warnings: [],
      originalLength: phone.length,
      sanitizedLength: 0
    };

    // Basic phone validation (digits, spaces, dashes, parentheses, plus)
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    if (!phoneRegex.test(result.sanitizedValue)) {
      result.isValid = false;
      result.errors.push('Invalid phone number format');
    }

    result.sanitizedLength = result.sanitizedValue.length;
    return result;
  }

  sanitizeFilename(filename: string): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      sanitizedValue: filename.replace(/[^a-zA-Z0-9._-]/g, '_'),
      errors: [],
      warnings: [],
      originalLength: filename.length,
      sanitizedLength: 0
    };

    // Check for dangerous extensions
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com'];
    const lowerFilename = result.sanitizedValue.toLowerCase();
    const hasDangerousExt = dangerousExtensions.some(ext => lowerFilename.endsWith(ext));

    if (hasDangerousExt) {
      result.isValid = false;
      result.errors.push('Dangerous file extension detected');
    }

    result.sanitizedLength = result.sanitizedValue.length;
    return result;
  }

  // ─── Batch Sanitization ───────────────────────────────────────────────
  sanitizeBatch(inputs: Record<string, string>, options: SanitizationOptions = {}): Record<string, ValidationResult> {
    const results: Record<string, ValidationResult> = {};

    for (const [key, value] of Object.entries(inputs)) {
      results[key] = this.sanitize(value, options);
    }

    return results;
  }

  // ─── Content Security Policy ──────────────────────────────────────────
  generateCSP(directives: Record<string, string[]> = {}): string {
    const defaultDirectives = {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'"], // Required for Chrome extensions
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'https:'],
      'connect-src': ["'self'", 'https:'],
      'font-src': ["'self'", 'https:'],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"]
    };

    const finalDirectives = { ...defaultDirectives, ...directives };

    return Object.entries(finalDirectives)
      .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
      .join('; ');
  }

  // ─── Security Headers ─────────────────────────────────────────────────
  getSecurityHeaders(): Record<string, string> {
    return {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': this.generateCSP()
    };
  }

  // ─── Validation Helpers ──────────────────────────────────────────────
  validateJson(input: string): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      sanitizedValue: input,
      errors: [],
      warnings: [],
      originalLength: input.length,
      sanitizedLength: 0
    };

    try {
      JSON.parse(input);
      result.sanitizedValue = input;
      result.sanitizedLength = input.length;
    } catch (error) {
      result.isValid = false;
      result.errors.push(`Invalid JSON: ${error instanceof Error ? error.message : 'Parse error'}`);
    }

    return result;
  }

  validateBase64(input: string): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      sanitizedValue: input,
      errors: [],
      warnings: [],
      originalLength: input.length,
      sanitizedLength: input.length
    };

    // Basic base64 validation
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(input)) {
      result.isValid = false;
      result.errors.push('Invalid base64 format');
    }

    // Check length (base64 should be ~33% larger than original)
    if (input.length % 4 !== 0) {
      result.warnings.push('Base64 string length is not a multiple of 4');
    }

    return result;
  }

  // ─── Configuration ───────────────────────────────────────────────────
  updateConfig(newConfig: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): SecurityConfig {
    return { ...this.config };
  }
}

// ─── Global Input Sanitizer Instance ───────────────────────────────────
export const inputSanitizer = new InputSanitizer({
  enableSanitization: true,
  enableXssProtection: true,
  enableCsp: true,
  strictMode: true,
  allowedDomains: ['*.craigslist.org', '*.facebook.com', '*.autotrader.com', '*.ebay.com'],
  maxInputLength: 1000000,
  enableLogging: true
});

// ─── Convenience Functions ────────────────────────────────────────────
export const sanitize = {
  text: (input: string, options?: SanitizationOptions) =>
    inputSanitizer.sanitize(input, options),
  url: (input: string) =>
    inputSanitizer.sanitizeUrl(input),
  email: (input: string) =>
    inputSanitizer.sanitizeEmail(input),
  phone: (input: string) =>
    inputSanitizer.sanitizePhone(input),
  filename: (input: string) =>
    inputSanitizer.sanitizeFilename(input),
  html: (input: string, options?: SanitizationOptions) =>
    inputSanitizer.sanitize(input, { ...options, allowHtml: true }),
  json: (input: string) =>
    inputSanitizer.validateJson(input),
  base64: (input: string) =>
    inputSanitizer.validateBase64(input),
  batch: (inputs: Record<string, string>, options?: SanitizationOptions) =>
    inputSanitizer.sanitizeBatch(inputs, options)
};

// ─── DOM XSS Protection ────────────────────────────────────────────────
export class DOMSanitizer {
  private sanitizer: InputSanitizer;

  constructor(sanitizer: InputSanitizer) {
    this.sanitizer = sanitizer;
  }

  // Safe innerHTML setter
  setInnerHTML(element: Element, html: string): void {
    const result = this.sanitizer.sanitize(html, { allowHtml: true });
    if (result.isValid) {
      element.innerHTML = result.sanitizedValue;
    } else {
      console.error('[DOMSanitizer] Refused to set dangerous HTML:', result.errors);
      element.innerHTML = 'Content blocked for security reasons';
    }
  }

  // Safe text content setter
  setTextContent(element: Element, text: string): void {
    const result = this.sanitizer.sanitize(text, { allowHtml: false });
    element.textContent = result.sanitizedValue;
  }

  // Safe attribute setter
  setAttribute(element: Element, name: string, value: string): void {
    // Don't allow event handler attributes
    if (name.startsWith('on')) {
      console.error('[DOMSanitizer] Refused to set event handler attribute:', name);
      return;
    }

    const result = this.sanitizer.sanitize(value, { allowHtml: false });
    element.setAttribute(name, result.sanitizedValue);
  }

  // Safe CSS injection
  injectCSS(css: string): void {
    const result = this.sanitizer.sanitize(css, { allowHtml: false });
    if (result.isValid) {
      const style = document.createElement('style');
      style.textContent = result.sanitizedValue;
      document.head.appendChild(style);
    } else {
      console.error('[DOMSanitizer] Refused to inject dangerous CSS');
    }
  }
}

// ─── Global DOM Sanitizer Instance ────────────────────────────────────
export const domSanitizer = new DOMSanitizer(inputSanitizer);

// ─── Export Default ────────────────────────────────────────────────────
export default inputSanitizer;
