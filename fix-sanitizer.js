const fs = require("fs");
const path = require("path");

const sanitizationFile = path.resolve(__dirname, "shared/input-sanitization.ts");
let content = fs.readFileSync(sanitizationFile, "utf8");

// Replace the problematic tag encoding method (lines 192-196)
const oldCode = `    // Encode dangerous characters in attributes
    value = value.replace(/<([^>]+)>/g, (match, content) => {
      // Encode quotes and angle brackets in attributes
      return content.replace(/["']/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    });`;

const newCode = `    // Encode dangerous characters in attributes
    value = value.replace(/<([^>]+)>/g, (match, content) => {
      // Encode quotes and angle brackets in attributes while preserving tag structure
      let processedContent = content;
      
      // Encode quotes and angle brackets only within attribute values
      processedContent = processedContent.replace(/([a-zA-Z][a-zA-Z0-9-]*)\s*=\s*["']([^"']*)["']/g, (attrMatch, attrName, attrValue) => {
        const encodedValue = attrValue.replace(/["']/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return \`\${attrName}="\${encodedValue}"\`;
      });
      
      return \`<\${processedContent}>\`;
    });`;

content = content.replace(oldCode, newCode);

fs.writeFileSync(sanitizationFile, content, "utf8");
console.log("Fixed protectAgainstXss tag encoding in input-sanitization.ts");
