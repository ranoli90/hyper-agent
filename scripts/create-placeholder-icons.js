/**
 * Writes minimal valid PNG files to public/icons so the extension manifest resolves.
 * Run once (or when icons are missing). Build copies public/ to .output.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = path.join(__dirname, '..', 'public', 'icons');
// Minimal 1x1 transparent PNG (valid for any size reference)
const MINI_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

if (!fs.existsSync(ICONS_DIR)) fs.mkdirSync(ICONS_DIR, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  fs.writeFileSync(path.join(ICONS_DIR, `${size}.png`), MINI_PNG);
}
console.log('[create-placeholder-icons] Wrote public/icons/16, 32, 48, 128.png');
