// Simple test script to debug what's happening with the sanitizer
// This simulates what happens when loading chat history

// First, let's look at the current implementation
function encodeHtmlEntities(input) {
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

function protectAgainstXss(input) {
    let value = input;
    const warnings = [];

    // Encode dangerous characters in attributes
    value = value.replace(/<([^>]+)>/g, (match, content) => {
        console.log(`  Processing tag match: "${match}" with content "${content}"`);
        // Encode quotes and angle brackets in attributes while preserving tag structure
        let processedContent = content;
        
        // Encode quotes and angle brackets only within attribute values
        processedContent = processedContent.replace(/([a-zA-Z][a-zA-Z0-9-]*)\s*=\s*["']([^"']*)["']/g, (attrMatch, attrName, attrValue) => {
            console.log(`    Attribute match: "${attrMatch}" (${attrName}="${attrValue}")`);
            const encodedValue = attrValue.replace(/["']/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return `${attrName}="${encodedValue}"`;
        });
        
        console.log(`  Processed content: "${processedContent}"`);
        return `<${processedContent}>`;
    });

    return { value, warnings };
}

function sanitizeHtml(input, options) {
    if (!options.allowHtml) {
        return encodeHtmlEntities(input);
    }

    const allowedTags = options.allowedTags || [
        'p',
        'br',
        'strong',
        'em',
        'u',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
    ];
    const allowedAttributes = options.allowedAttributes || ['href', 'title', 'alt'];

    let sanitized = input;

    // Remove all tags not in allowed list
    sanitized = sanitized.replace(/<([^>]+)>/g, (match, tagContent) => {
        const tagMatch = tagContent.match(/^\/?([a-zA-Z][a-zA-Z0-9]*)/);
        if (!tagMatch) return match;

        const tagName = tagMatch[1].toLowerCase();
        if (!allowedTags.includes(tagName)) {
            return ''; 
        }

        // Sanitize attributes
        let cleanTag = `<${tagContent.includes('/') ? '/' : ''}${tagName}`;

        const attrMatches = tagContent.matchAll(/([a-zA-Z][a-zA-Z0-9-]*)\s*=\s*["']([^"']*)["']/g);
        for (const attrMatch of attrMatches) {
            const [, attrName, attrValue] = attrMatch;
            if (allowedAttributes.includes(attrName.toLowerCase())) {
                const safeValue = attrValue.replace(/[<>"']/g, (char) => {
                    switch (char) {
                        case '<':
                            return '&lt;';
                        case '>':
                            return '&gt;';
                        case '"':
                            return '&quot;';
                        case "'":
                            return '&#x27;';
                        default:
                            return char;
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

function completeSanitizer(input, options = {}) {
    let sanitized = input;
    const result = {
        isValid: true,
        sanitizedValue: input,
        errors: [],
        warnings: [],
        originalLength: input.length,
        sanitizedLength: 0,
    };

    console.log('Step 1: Original input');
    console.log(sanitized);
    console.log('');

    const xssResult = protectAgainstXss(sanitized);
    sanitized = xssResult.value;
    result.warnings.push(...xssResult.warnings);

    console.log('');
    console.log('Step 2: After protectAgainstXss');
    console.log(sanitized);
    console.log('');

    sanitized = sanitizeHtml(sanitized, options);
    result.sanitizedValue = sanitized;
    result.sanitizedLength = sanitized.length;

    console.log('');
    console.log('Step 3: After sanitizeHtml');
    console.log(sanitized);
    console.log('');

    return result;
}

// Test with actual chat history from the screenshot
const screenshotText = `div class="chat-msg status"Chat history cleared./divdiv class="chat-msg user"hi/divdiv class="chat-msg thinking"1/divdiv class="chat-msg error"pl encountered an error after multiple attempts/pdiv class="chat-msg user"Compare laptop prices on Amazon, Best Buy, and Newegg/divdiv class="chat-msg thinking"1/divdiv class="chat-msg error"pl encountered an error after multiple attempts/pdiv class="chat-msg user"Go to amazon.com and search for wireless headphones/divdiv class="chat-msg error"Execution cancelled by user/div`;

// Test with actual HTML tags
const actualHtml = `
<div class="chat-msg status">Chat history cleared.</div>
<div class="chat-msg user">hi</div>
<div class="chat-msg thinking">1</div>
<div class="chat-msg error">pl encountered an error after multiple attempts</p>
<div class="chat-msg user">Compare laptop prices on Amazon, Best Buy, and Newegg</div>
<div class="chat-msg thinking">1</div>
<div class="chat-msg error">pl encountered an error after multiple attempts</p>
<div class="chat-msg user">Go to amazon.com and search for wireless headphones</div>
<div class="chat-msg error">Execution cancelled by user</div>
`;

console.log('=== Test 1: Actual HTML ===');
const result1 = completeSanitizer(actualHtml, {
    allowHtml: true,
    allowedTags: ['p', 'br', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li', 'a', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote'],
    allowedAttributes: ['href', 'class', 'target', 'rel', 'title', 'alt'],
});
console.log('=== Final Result ===');
console.log('Sanitized HTML:', result1.sanitizedValue);

console.log('');
console.log('=== Test 2: Screenshot Text ===');
const result2 = completeSanitizer(screenshotText, {
    allowHtml: true,
    allowedTags: ['p', 'br', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li', 'a', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote'],
    allowedAttributes: ['href', 'class', 'target', 'rel', 'title', 'alt'],
});
console.log('=== Final Result ===');
console.log('Sanitized HTML:', result2.sanitizedValue);