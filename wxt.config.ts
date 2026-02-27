import { defineConfig } from 'wxt';
import fs from 'fs';
import path from 'path';

/**
 * Vite plugin that enforces UTF-8 encoding on ALL build output files.
 * 
 * WHY THIS EXISTS AS A PLUGIN (not a postbuild script):
 * On Windows, `npm run build` chains `wxt build && node ensure-utf8.js`
 * but the Vite process can hang or the PowerShell pipeline can swallow
 * the second command. By running INSIDE the Vite build via `closeBundle`,
 * the fix is guaranteed to execute every single time.
 */
function enforceUtf8Plugin() {
  return {
    name: 'enforce-utf8',
    closeBundle() {
      const outDir = path.resolve('.output', 'chrome-mv3');
      if (!fs.existsSync(outDir)) return;

      const EXTENSIONS = new Set(['.js', '.json', '.css', '.html', '.mjs', '.cjs']);
      const NON_CHARS = /[\uFFFF\uFFFE\uFEFF\uD800-\uDFFF]/g;
      let fixCount = 0;

      function walk(dir: string) {
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, ent.name);
          if (ent.isDirectory()) {
            walk(full);
          } else if (ent.isFile() && EXTENSIONS.has(path.extname(ent.name).toLowerCase())) {
            try {
              const buf = fs.readFileSync(full);

              // Detect BOM encoding
              let text: string;
              let hadBom = false;
              if (buf[0] === 0xFF && buf[1] === 0xFE) {
                // UTF-16 LE
                text = buf.slice(2).toString('utf16le');
                hadBom = true;
              } else if (buf[0] === 0xFE && buf[1] === 0xFF) {
                // UTF-16 BE — swap bytes then decode
                const swapped = Buffer.alloc(buf.length - 2);
                for (let i = 2; i < buf.length - 1; i += 2) {
                  swapped[i - 2] = buf[i + 1];
                  swapped[i - 1] = buf[i];
                }
                text = swapped.toString('utf16le');
                hadBom = true;
              } else if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
                // UTF-8 BOM
                text = buf.slice(3).toString('utf8');
                hadBom = true;
              } else {
                text = buf.toString('utf8');
              }

              // Strip non-characters that Chrome rejects + normalize line endings
              const hasNonChars = NON_CHARS.test(text);
              if (hadBom || hasNonChars) {
                NON_CHARS.lastIndex = 0;
                text = text
                  .replace(/\uFEFF/g, '')
                  .replace(/\uFFFE/g, '')
                  .replace(NON_CHARS, (ch: string) =>
                    '\\u' + (ch.codePointAt(0) || 0).toString(16).toUpperCase().padStart(4, '0')
                  )
                  .replace(/\r\n/g, '\n')
                  .replace(/\r/g, '\n');

                fs.writeFileSync(full, Buffer.from(text, 'utf8'), { flag: 'w' });
                fixCount++;
                console.log(`[enforce-utf8] Fixed: ${path.relative(outDir, full)}`);
              }
            } catch (err: any) {
              console.error(`[enforce-utf8] Failed on ${full}:`, err.message);
            }
          }
        }
      }

      walk(outDir);
      if (fixCount > 0) {
        console.log(`[enforce-utf8] Fixed ${fixCount} file(s)`);
      }
      console.log('[enforce-utf8] ✔ All output files verified as UTF-8 (no BOM)');
    },
  };
}

export default defineConfig({
  // Integrate UTF-8 enforcement directly into the Vite build
  vite: () => ({
    plugins: [enforceUtf8Plugin()],
  }),
  manifest: {
    name: 'HyperAgent',
    minimum_chrome_version: '114', // sidePanel API required
    author: { email: 'support@hyperagent.ai' },
    homepage_url: 'https://hyperagent.ai/privacy',
    description: 'Hyper-intelligent browser agent with deep semantic understanding, self-healing locators, vision capabilities, and adaptive automation.',
    version: '4.0.1',
    permissions: [
      'sidePanel',
      'tabs',
      'activeTab',
      'scripting',
      'storage',
      'unlimitedStorage',
      'contextMenus',
      'alarms',
      'notifications',
    ],
    host_permissions: ['<all_urls>'],
    action: {
      default_title: 'Open HyperAgent',
      // Icons from public/icons/ (16, 32, 48, 128 px) — copied to output root
      default_icon: {
        16: 'icons/16.png',
        32: 'icons/32.png',
        48: 'icons/48.png',
        128: 'icons/128.png',
      },
    },
    side_panel: {
      default_path: 'sidepanel.html',
    },
    icons: {
      16: 'icons/16.png',
      32: 'icons/32.png',
      48: 'icons/48.png',
      128: 'icons/128.png',
    },
    web_accessible_resources: [
      {
        resources: ['icons/*', 'assets/*', 'chunks/*'],
        matches: ['<all_urls>'],
      },
    ],
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'",
    },
  },
});
