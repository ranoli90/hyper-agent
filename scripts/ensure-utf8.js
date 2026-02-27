/**
 * @fileoverview Post-build script: ensures ALL output JS/JSON/HTML/CSS files
 * are UTF-8 encoded without BOM.
 *
 * ============================================================================
 * WHY THIS EXISTS — READ THIS BEFORE CHANGING ANYTHING
 * ============================================================================
 *
 * Chrome MV3 REQUIRES content scripts, the manifest, and all extension pages
 * to be UTF-8 encoded. If ANY output file has:
 *   - A UTF-8 BOM (0xEF 0xBB 0xBF at start), OR
 *   - UTF-16 LE encoding (0xFF 0xFE BOM, common when Windows saves "Unicode"), OR
 *   - UTF-16 BE encoding (0xFE 0xFF BOM)
 *
 * Chrome will refuse to load the extension with:
 *   "Could not load file 'content-scripts/content.js' for content script.
 *    It isn't UTF-8 encoded."
 *
 * ROOT CAUSE on Windows:
 *   Windows PowerShell, Notepad, Notepad++, and even some VS Code settings
 *   default to UTF-16 LE ("Unicode") when saving files. WXT/Vite may also
 *   emit a UTF-8 BOM on certain platforms. This script canonicalises the
 *   entire build output to clean UTF-8 (no BOM) after every build.
 *
 * HOW TO USE:
 *   - Runs automatically via: npm run build  (wxt build && node scripts/ensure-utf8.js)
 *   - Run manually on build output: npm run fix:utf8
 *   - Run on SOURCE files before a build: npm run fix:sources
 *
 * FOR LLMs / FUTURE DEVELOPERS:
 *   - Do NOT remove this script from the build pipeline.
 *   - Do NOT save source .ts/.js files as UTF-16 in your editor.
 *   - Add .editorconfig and .gitattributes (both present in this repo) to
 *     prevent the problem at the editor/Git level too.
 *   - If you see the Chrome error again: npm run fix:utf8 && reload the extension.
 *
 * PERFORMANCE NOTE:
 *   This script uses fast BOM detection on the first 3 bytes BEFORE reading
 *   the full file. Plain UTF-8 files (the vast majority) are skipped instantly
 *   without any disk write, keeping the build fast.
 *
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', '.output', 'chrome-mv3');

const EXTENSIONS = new Set(['.js', '.json', '.css', '.html', '.mjs', '.cjs']);

/**
 * Fast check: does the file start with a BOM we need to fix?
 * Reads only the first 3 bytes — O(1) for clean files.
 *
 * @param {string} filePath
 * @returns {'utf16le' | 'utf16be' | 'utf8bom' | null}
 */
function detectBom(filePath) {
  // Open file and read first 3 bytes only
  let fd;
  try {
    fd = fs.openSync(filePath, 'r');
    const header = Buffer.alloc(3);
    const bytesRead = fs.readSync(fd, header, 0, 3, 0);
    if (bytesRead >= 2) {
      if (header[0] === 0xFF && header[1] === 0xFE) return 'utf16le';
      if (header[0] === 0xFE && header[1] === 0xFF) return 'utf16be';
    }
    if (bytesRead >= 3 && header[0] === 0xEF && header[1] === 0xBB && header[2] === 0xBF) {
      return 'utf8bom';
    }
    return null; // No BOM — already clean UTF-8
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

/**
 * Re-encode a file that has a BOM as clean UTF-8 (no BOM, LF line endings).
 *
 * @param {string} filePath
 * @param {'utf16le' | 'utf16be' | 'utf8bom'} bomType
 */
function fixBomFile(filePath, bomType) {
  const buf = fs.readFileSync(filePath);
  let text;

  if (bomType === 'utf16le') {
    // Skip the 2-byte BOM then decode as UTF-16 LE
    text = buf.slice(2).toString('utf16le');
  } else if (bomType === 'utf16be') {
    // Swap bytes (Node has no built-in UTF-16 BE decoder), then decode as LE
    const swapped = Buffer.alloc(buf.length - 2);
    for (let i = 2; i < buf.length - 1; i += 2) {
      swapped[i - 2] = buf[i + 1];
      swapped[i - 1] = buf[i];
    }
    text = swapped.toString('utf16le');
  } else {
    // UTF-8 BOM: skip first 3 bytes
    text = buf.slice(3).toString('utf8');
  }

  // Strip any stray BOM/surrogate characters embedded in the decoded text
  text = text
    .replace(/\uFEFF/g, '')   // zero-width no-break space / UTF-8 BOM char
    .replace(/\uFFFE/g, '')   // reversed BOM
    .replace(/\uFFFF/g, '')   // non-character
    .replace(/[\uD800-\uDFFF]/g, ''); // lone surrogates (invalid in UTF-8)

  // Normalise line endings to LF
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  fs.writeFileSync(filePath, Buffer.from(text, 'utf8'), { flag: 'w' });

  const label = bomType === 'utf16le' ? 'UTF-16 LE'
    : bomType === 'utf16be' ? 'UTF-16 BE'
      : 'UTF-8 BOM';
  console.log(`[ensure-utf8] ⚠  Fixed ${label} → UTF-8: ${path.relative(OUT_DIR, filePath)}`);
}

/**
 * Strip Unicode non-characters from JS files.
 *
 * Chrome's content script loader rejects files containing literal U+FFFF,
 * U+FFFE, or U+FEFF characters (even though they're valid UTF-8 bytes).
 * These appear in bundled regex/lexer libraries that use them as sentinels.
 *
 * Fix: replace the literal character with its \uXXXX escape sequence.
 * At runtime, JS `"\uFFFF"` produces the same codepoint, so library
 * semantics are preserved.
 *
 * @param {string} filePath
 * @returns {boolean} true if file was modified
 */
function stripNonCharacters(filePath) {
  // Only process JS files — JSON/HTML/CSS won't contain these
  if (!/\.(?:js|mjs|cjs)$/i.test(filePath)) return false;

  const text = fs.readFileSync(filePath, 'utf8');

  // Regex: match literal U+FFFF, U+FFFE, U+FEFF, lone surrogates, and other non-characters
  const NON_CHARS = /[\uFFFF\uFFFE\uFEFF\uD800-\uDFFF]/g;
  if (!NON_CHARS.test(text)) return false; // Fast path: nothing to fix

  // Reset lastIndex after .test()
  NON_CHARS.lastIndex = 0;
  const cleaned = text.replace(NON_CHARS, (ch) => {
    return '\\u' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
  });

  fs.writeFileSync(filePath, Buffer.from(cleaned, 'utf8'), { flag: 'w' });
  const count = (text.match(NON_CHARS) || []).length;
  console.log(`[ensure-utf8] ⚠  Escaped ${count} non-character(s) in: ${path.relative(OUT_DIR, filePath)}`);
  return true;
}

/**
 * Recursively walk a directory and fix any files with BOMs or non-characters.
 * Clean UTF-8 files are detected via a 3-byte header check and skipped instantly.
 *
 * @param {string} dir
 */
function walkDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walkDir(full);
    } else if (ent.isFile() && EXTENSIONS.has(path.extname(ent.name).toLowerCase())) {
      try {
        // Step 1: Fix BOM encoding issues
        const bomType = detectBom(full);
        if (bomType !== null) {
          fixBomFile(full, bomType);
        }
        // Step 2: Escape non-characters that Chrome rejects
        stripNonCharacters(full);
      } catch (err) {
        console.error(`[ensure-utf8] ✖ Failed on ${full}:`, err.message);
        process.exit(1); // Fail the build — a bad output file will break Chrome
      }
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────

if (!fs.existsSync(OUT_DIR)) {
  console.warn('[ensure-utf8] .output/chrome-mv3 not found — skipping (run `npm run build` first).');
  process.exit(0);
}

console.log('[ensure-utf8] Scanning build output for encoding issues...');
walkDir(OUT_DIR);
console.log('[ensure-utf8] ✔ All output files verified as UTF-8 (no BOM).');
