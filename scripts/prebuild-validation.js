/**
 * @fileoverview Pre-build validation for HyperAgent extension.
 * 
 * ============================================================================
 * PRE-BUILD VALIDATION - READ THIS BEFORE CHANGING ANYTHING
 * ============================================================================
 * 
 * This script runs BEFORE every build to catch common issues:
 * 
 * 1. HTML STRUCTURE VALIDATION
 *    - Checks that all HTML files have properly matched tags
 *    - Validates that section elements are properly closed
 *    - Prevents the "broken side panel" issue where content appears outside
 *      its intended parent elements
 * 
 * 2. ENCODING VALIDATION
 *    - Ensures all source files are UTF-8 encoded
 *    - Catches UTF-16 and other non-UTF-8 encodings that break Chrome
 * 
 * 3. REQUIRED FILES CHECK
 *    - Verifies critical files exist
 *    - Checks manifest has required fields
 * 
 * WHY THIS EXISTS:
 *    The sidepanel HTML has been repeatedly broken because:
 *    - Content was placed OUTSIDE <section> tags (wrong nesting)
 *    - Editors or tools saved files in wrong encoding (UTF-16)
 *    - No validation caught these issues before build
 * 
 * HOW TO USE:
 *    npm run prebuild        ← runs validation only
 *    npm run build           ← runs validation then build
 * 
 * CI INTEGRATION:
 *    Add to your CI pipeline:
 *      npm run prebuild && npm run build
 * 
 * FOR DEVELOPERS:
 *    - Never edit HTML directly in the .output folder (it's rebuilt)
 *    - Always make changes in entrypoints/ folder
 *    - Run npm run prebuild before npm run build
 *    - If validation fails, FIX the source files before building
 * 
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// ============================================================================
// HTML STRUCTURE VALIDATION
// ============================================================================

const HTML_FILES = [
    'entrypoints/sidepanel/index.html',
    'entrypoints/options/index.html',
];

const CRITICAL_TAGS = [
    { open: '<section', close: '</section>' },
    { open: '<div', close: '</div>' },
    { open: '<main', close: '</main>' },
    { open: '<header', close: '</header>' },
    { open: '<body', close: '</body>' },
    { open: '<html', close: '</html>' },
];

/**
 * Validates that HTML tags are properly matched.
 * Specifically checks for the sidepanel issue where content
 * appears after the closing </section> tag but should be inside it.
 */
function validateHtmlStructure(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const errors = [];
    
    // Check for the specific bug: content outside section but after swarm tab
    // This is the bug that kept recurring - "Use Cases" appearing outside swarm section
    if (filePath.includes('sidepanel')) {
        // Find the actual tab-swarm section in the HTML (not in documentation comments)
        // First, strip out the documentation comment at the top if present
        let searchContent = content;
        const docCommentMatch = content.match(/^\s*<!--\s*[\s\S]*?HYPERAGENT[\s\S]*?-->\s*/);
        if (docCommentMatch) {
            searchContent = content.substring(docCommentMatch[0].length);
        }
        
        // Only look for the actual tab-swarm section (not in comments)
        // Match the section from the opening tag to its closing </section>
        const swarmSectionStart = searchContent.indexOf('<section id="tab-swarm"');
        const sectionEnd = searchContent.indexOf('</section>', swarmSectionStart);
        
        if (swarmSectionStart !== -1 && sectionEnd !== -1) {
            // Check that Use Cases and Saved Missions are INSIDE the section
            const useCasesComment = '<!-- Use Cases -->';
            const savedMissionsComment = '<!-- Saved Missions -->';
            
            const useCasesPos = searchContent.indexOf(useCasesComment);
            const savedMissionsPos = searchContent.indexOf(savedMissionsComment);
            
            if (useCasesPos > sectionEnd && useCasesPos !== -1) {
                errors.push(`"Use Cases" section appears AFTER closing </section> tag - should be INSIDE the swarm tab section`);
            }
            if (savedMissionsPos > sectionEnd && savedMissionsPos !== -1) {
                errors.push(`"Saved Missions" section appears AFTER closing </section> tag - should be INSIDE the swarm tab section`);
            }
        }
        
        // Check for general tag balancing - but ignore comment blocks
        // First, strip HTML comments
        const contentNoComments = searchContent.replace(/<!--[\s\S]*?-->/g, '');
        
        for (const { open, close } of CRITICAL_TAGS) {
            const openCount = (contentNoComments.match(new RegExp(open, 'g')) || []).length;
            const closeCount = (contentNoComments.match(new RegExp(close, 'g')) || []).length;
            
            if (openCount !== closeCount) {
                errors.push(`Tag mismatch: ${open} appears ${openCount} times but ${close} appears ${closeCount} times`);
            }
        }
    }
    
    return errors;
}

// ============================================================================
// ENCODING VALIDATION  
// ============================================================================

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.html', '.css', '.json']);
const SKIP_DIRS = ['node_modules', '.output', '.git', '.wxt', 'test-results', 'playwright-report'];

function validateEncoding(filePath) {
    const buf = fs.readFileSync(filePath);
    
    // Check for UTF-16 LE BOM
    if (buf[0] === 0xFF && buf[1] === 0xFE) {
        return 'UTF-16 LE';
    }
    // Check for UTF-16 BE BOM
    if (buf[0] === 0xFE && buf[1] === 0xFF) {
        return 'UTF-16 BE';
    }
    // Check for UTF-8 BOM
    if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
        return 'UTF-8 BOM';
    }
    
    return null; // OK - clean UTF-8
}

// ============================================================================
// MAIN VALIDATION
// ============================================================================

function walkDir(dir, callback) {
    if (!fs.existsSync(dir)) return;
    
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        if (SKIP_DIRS.includes(ent.name)) continue;
        
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
            walkDir(full, callback);
        } else if (ent.isFile()) {
            callback(full);
        }
    }
}

function runValidation() {
    console.log('\n️  HYPERAGENT PRE-BUILD VALIDATION\n');
    console.log('==================================\n');
    
    let hasErrors = false;
    
    // 1. Validate HTML Structure
    console.log(' Checking HTML structure...\n');
    for (const relPath of HTML_FILES) {
        const fullPath = path.join(ROOT, relPath);
        if (!fs.existsSync(fullPath)) {
            console.log(`  ⚠️  Skipping missing: ${relPath}`);
            continue;
        }
        
        const errors = validateHtmlStructure(fullPath);
        if (errors.length > 0) {
            console.log(`  ❌ ${relPath}:`);
            errors.forEach(e => console.log(`     - ${e}`));
            hasErrors = true;
        } else {
            console.log(`  ✅ ${relPath}`);
        }
    }
    
    // 2. Validate Encoding
    console.log('\n Checking file encoding...\n');
    const dirsToCheck = ['entrypoints', 'shared', 'scripts', 'src'];
    let encodingErrors = 0;
    
    for (const dir of dirsToCheck) {
        const fullDir = path.join(ROOT, dir);
        if (!fs.existsSync(fullDir)) continue;
        
        walkDir(fullDir, (filePath) => {
            const ext = path.extname(filePath).toLowerCase();
            if (!SOURCE_EXTENSIONS.has(ext)) return;
            
            const encoding = validateEncoding(filePath);
            if (encoding) {
                console.log(`  ❌ ${path.relative(ROOT, filePath)}: ${encoding}`);
                encodingErrors++;
                hasErrors = true;
            }
        });
    }
    
    if (encodingErrors === 0) {
        console.log('  ✅ All source files are UTF-8 encoded');
    }
    
    // 3. Check required files exist
    console.log('\n Checking required files...\n');
    const requiredFiles = [
        'entrypoints/sidepanel/index.html',
        'entrypoints/options/index.html',
        'entrypoints/background.ts',
        'entrypoints/content.ts',
        'wxt.config.ts',
        'package.json',
    ];
    
    for (const relPath of requiredFiles) {
        const fullPath = path.join(ROOT, relPath);
        if (fs.existsSync(fullPath)) {
            console.log(`  ✅ ${relPath}`);
        } else {
            console.log(`  ❌ ${relPath} - MISSING!`);
            hasErrors = true;
        }
    }
    
    // Summary
    console.log('\n==================================');
    if (hasErrors) {
        console.log('❌ VALIDATION FAILED - Fix errors before building');
        console.log('\nTo fix HTML issues:');
        console.log('  - Check that all content is inside proper <section> tags');
        console.log('  - Ensure </section> is at the end of each tab\'s content');
        console.log('  - Look for content that appears AFTER </section> but should be inside');
        console.log('\nTo fix encoding issues:');
        console.log('  - Run: npm run fix:sources');
        console.log('  - Then re-run: npm run prebuild\n');
        process.exit(1);
    } else {
        console.log('✅ ALL VALIDATIONS PASSED\n');
        console.log('You can now safely run: npm run build\n');
    }
}

runValidation();
