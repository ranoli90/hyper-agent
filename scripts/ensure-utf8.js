/**
 * Ensures all JS and JSON files in the built extension are UTF-8 encoded without BOM.
 * Chrome rejects content scripts and the manifest if they aren't UTF-8 (e.g. UTF-16 or BOM on Windows).
 * Also removes invalid Unicode characters that Chrome may reject.
 * Writes raw UTF-8 bytes (no BOM) so Chrome always accepts the files.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', '.output', 'chrome-mv3');

const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const UTF16LE_BOM = Buffer.from([0xff, 0xfe]);
const UTF16BE_BOM = Buffer.from([0xfe, 0xff]);

function ensureUtf8(filePath) {
  let buf = fs.readFileSync(filePath);
  let content;
  if (buf.length >= 3 && buf.slice(0, 3).equals(UTF8_BOM)) {
    content = buf.toString('utf8', 3);
  } else if (buf.length >= 2 && buf.slice(0, 2).equals(UTF16LE_BOM)) {
    content = buf.toString('utf16le', 2);
  } else if (buf.length >= 2 && buf.slice(0, 2).equals(UTF16BE_BOM)) {
    content = buf.toString('utf16be', 2);
  } else {
    content = buf.toString('utf8');
    if (content.length > 0 && content.charCodeAt(0) === 0xfeff) content = content.slice(1);
  }
  
  // Remove invalid Unicode characters that Chrome may reject
  // This fixes issues with minifier-generated invalid characters (e.g., \uFFFF, surrogates)
  content = content
    .replace(/\uffff/gi, 'FF')           // Replace invalid Unicode marker
    .replace(/[\ud800-\udfff]/g, '')     // Remove surrogate pairs
    .replace(/[\uFEFF\uFFFE\uFFFF]/g, ''); // Remove BOM and invalid markers
  
  // Ensure trailing newline for Chrome compatibility
  if (!content.endsWith('\n')) {
    content += '\n';
  }
  
  // Write as raw UTF-8 bytes (no BOM). Using Buffer ensures no BOM is ever added.
  const outBuf = Buffer.from(content, 'utf8');
  fs.writeFileSync(filePath, outBuf, { flag: 'w' });
}

function walkDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walkDir(full);
    } else if (ent.isFile() && (ent.name.endsWith('.js') || ent.name.endsWith('.json'))) {
      try {
        ensureUtf8(full);
      } catch (err) {
        console.error('[ensure-utf8] Failed:', full, err.message);
        throw err;
      }
    }
  }
}

if (!fs.existsSync(OUT_DIR)) {
  console.warn('[ensure-utf8] .output/chrome-mv3 not found, skipping.');
  process.exit(0);
}
walkDir(OUT_DIR);
console.log('[ensure-utf8] All .js and .json in .output/chrome-mv3 rewritten as UTF-8 (no BOM).');
