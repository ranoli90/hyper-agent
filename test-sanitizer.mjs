import { inputSanitizer } from './shared/input-sanitization.js';

const testCases = [
  {
    name: 'Basic HTML tags',
    input: '<div class="chat-msg status">Chat history cleared.</div>',
    expected: '<div class="chat-msg status">Chat history cleared.</div>',
  },
  {
    name: 'Dangerous script tag',
    input: '<script>alert("XSS")</script>safe content',
    expected: 'safe content',
  },
  {
    name: 'Event handler',
    input: '<button onclick="alert(1)">Click</button>',
    expected: '<button >Click</button>',
  },
  {
    name: 'Javascript URL',
    input: '<a href="javascript:alert(1)">Link</a>',
    expected: '<a href="">Link</a>',
  },
  {
    name: 'Complex chat history',
    input: `
<div class="chat-msg user">Compare laptop prices on Amazon, Best Buy, and Newegg</div>
<div class="chat-msg thinking">1</div>
<div class="chat-msg error">pl encountered an error after multiple attempts</p>
    `.trim(),
  },
];

console.log('=== Sanitizer Functionality Test ===');
console.log('==================================');
console.log('');

let allPassed = true;

testCases.forEach((test, index) => {
  const result = inputSanitizer.sanitize(test.input, {
    allowHtml: true,
    allowedTags: ['p', 'br', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li', 'a', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote'],
    allowedAttributes: ['href', 'class', 'target', 'rel', 'title', 'alt'],
  });

  console.log(`Test ${index + 1}: ${test.name}`);
  console.log(`- Input:    ${JSON.stringify(test.input.slice(0, 50))}${test.input.length > 50 ? '...' : ''}`);
  console.log(`- Sanitized:${JSON.stringify(result.sanitizedValue.slice(0, 50))}${result.sanitizedValue.length > 50 ? '...' : ''}`);
  
  if (test.expected) {
    if (result.sanitizedValue === test.expected) {
      console.log('✅ PASSED');
    } else {
      console.log('❌ FAILED');
      console.log(`- Expected: ${JSON.stringify(test.expected.slice(0, 50))}${test.expected.length > 50 ? '...' : ''}`);
      allPassed = false;
    }
  } else {
    console.log('ℹ️ Test (no expected value)');
    if (result.isValid) {
      console.log('✅ PASSED');
    } else {
      console.log('❌ FAILED');
      console.log(`- Errors: ${JSON.stringify(result.errors)}`);
      allPassed = false;
    }
  }
  
  if (result.warnings.length > 0) {
    console.log(`⚠️ Warnings: ${JSON.stringify(result.warnings)}`);
  }
  
  console.log('');
});

console.log('==================================');
if (allPassed) {
  console.log('✅ All tests passed!');
} else {
  console.log('❌ Some tests failed!');
  process.exit(1);
}