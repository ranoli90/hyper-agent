/**
 * @fileoverview Source-level encoding fixer for HyperAgent.
 *
 * ============================================================================
 * WHY THIS EXISTS — READ THIS BEFORE CHANGING ANYTHING
 * ============================================================================
 *
 * Chrome requires ALL extension files (content scripts, manifest, HTML pages)
 * to be UTF-8.  The most common way this breaks on Windows:
 *
 *   1. An LLM agent or developer opens a .ts file in an editor that defaults
 *      to "Unicode" (UTF-16 LE), makes changes, and saves.
 *   2. WXT/Vite compiles the UTF-16 source and emits a garbled .js file.
 *   3. Chrome refuses to load the extension:
 *        "Could not load file 'content-scripts/content.js' for content script.
 *         It isn't UTF-8 encoded."
 *
 * This script scans every SOURCE .ts/.js/.html/.json/.css file and re-encodes
 * any UTF-16 files back to clean UTF-8 BEFORE the build runs.
 *
 * HOW TO USE:
 *   npm run fix:sources      ← re-encode source files
 *   npm run build            ← then rebuild
 *
 * It is also safe to run at any time without doing a build.
 *
 * WHAT IT DOES:
 *   - Detects UTF-16 LE/BE and UTF-8 BOM files
 *   - Transcodes them to plain UTF-8 (no BOM)
 *   - Normalises line endings to LF
 *   - Only rewrites files that actually need changing
 *
 * FOR LLMs / FUTURE DEVELOPERS:
 *   - Add this to your pre-build CI step if encoding issues recur.
 *   - The .editorconfig and .gitattributes in this repo prevent new files
 *     from being saved in the wrong encoding.
 *   - The build-time analogue for OUTPUT files is scripts/ensure-utf8.js.
 *
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

/** Directories/files to scan (relative to repo root) */
const SCAN_DIRS = [
    'entrypoints',
    'shared',
    'scripts',
    'src',
];

const EXTENSIONS = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
    '.html', '.css', '.json',
]);

/** Files/dirs to skip */
const SKIP_PATTERNS = [
    'node_modules',
    '.output',
    '.wxt',
    '.git',
    'playwright-report',
    'test-results',
    'dist',
];

let fixed = 0;
let skipped = 0;

/**
 * Decode a buffer respecting UTF-16 LE/BE and UTF-8 BOM.
 * @param {Buffer} buf
 * @returns {{ text: string, encoding: string }}
 */
function decodeBuffer(buf) {
    if (buf.length >= 2) {
        if (buf[0] === 0xff && buf[1] === 0xfe) {
            return { text: buf.slice(2).toString('utf16le'), encoding: 'UTF-16 LE' };
        }
        if (buf[0] === 0xfe && buf[1] === 0xff) {
            const swapped = Buffer.alloc(buf.length - 2);
            for (let i = 2; i < buf.length - 1; i += 2) {
                swapped[i - 2] = buf[i + 1];
                swapped[i - 1] = buf[i];
            }
            return { text: swapped.toString('utf16le'), encoding: 'UTF-16 BE' };
        }
    }
    if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
        return { text: buf.slice(3).toString('utf8'), encoding: 'UTF-8 BOM' };
    }
    return { text: buf.toString('utf8'), encoding: 'UTF-8' };
}

/**
 * Check & fix a single file.
 * @param {string} filePath
 */
function fixFile(filePath) {
    const buf = fs.readFileSync(filePath);
    const { text, encoding } = decodeBuffer(buf);

    const needsFixing = encoding !== 'UTF-8';

    let clean = text
        .replace(/\uFEFF/g, '')
        .replace(/\uFFFE/g, '')
        .replace(/\uFFFF/g, '')
        .replace(/[\uD800-\uDFFF]/g, ''); // lone surrogates

    // Normalise line endings to LF
    clean = clean.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Ensure trailing newline
    clean = clean.trimEnd() + '\n';

    const outBuf = Buffer.from(clean, 'utf8');

    if (!needsFixing && outBuf.equals(buf)) {
        skipped++;
        return;
    }

    fs.writeFileSync(filePath, outBuf, { flag: 'w' });
    const rel = path.relative(ROOT, filePath);
    console.log(`  ✔ Fixed [${encoding}] → UTF-8: ${rel}`);
    fixed++;
}

/**
 * Recursively walk a directory.
 * @param {string} dir
 */
function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        if (SKIP_PATTERNS.some(p => ent.name === p || ent.name.startsWith(p))) {
            continue;
        }
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
            walk(full);
        } else if (ent.isFile() && EXTENSIONS.has(path.extname(ent.name).toLowerCase())) {
            try {
                fixFile(full);
            } catch (err) {
                console.error(`  ✖ Error processing ${full}: ${err.message}`);
            }
        }
    }
}

// ─── Main ─────────────────────────────────────────────────────────────────

console.log('[fix-sources] Scanning source files for encoding issues...\n');

for (const dir of SCAN_DIRS) {
    const full = path.join(ROOT, dir);
    walk(full);
}

console.log(`\n[fix-sources] Done. Fixed: ${fixed} file(s), Already OK: ${skipped} file(s).`);

if (fixed > 0) {
    console.log('\n[fix-sources] ⚠ Re-encode complete. Run `npm run build` to rebuild the extension.');
} else {
    console.log('[fix-sources] ✔ All source files are already UTF-8. No changes needed.');
}
