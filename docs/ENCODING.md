# Encoding Requirements — HyperAgent Chrome Extension

> **TL;DR for LLMs and developers:** All source files MUST be UTF-8 (no BOM).
> If you see `"It isn't UTF-8 encoded"` in Chrome, run `npm run safe:build`.

---

## The Problem

Chrome MV3 extensions fail to load with this error when any content script,
manifest, or HTML page is not plain UTF-8:

```
Failed to load extension
Error: Could not load file 'content-scripts/content.js' for content script.
       It isn't UTF-8 encoded.
Could not load manifest.
```

### Why This Happens on Windows

Windows defaults to **UTF-16 LE** ("Unicode") for new text files. When an
editor, PowerShell script, or LLM tool saves a `.ts` or `.js` file in UTF-16,
the Vite/WXT compiler transcribes those bytes as-is into the output `.js` file,
which Chrome then rejects.

Common triggers:
- PowerShell `Set-Content` without `-Encoding UTF8`
- Editors with "Unicode" as their default encoding
- Copy-pasting into Notepad and saving
- Git configured with `core.autocrlf = true` on Windows
- LLM agents using `Write-Output` or `Out-File` without specifying encoding

---

## The Fix (Multi-Layer Defense)

This repo has **four layers** preventing encoding issues:

### Layer 1 — `.editorconfig`
Tells every EditorConfig-aware editor (VS Code, JetBrains, Sublime, etc.) to
always save as **UTF-8, LF line endings**. This is the first line of defense.

### Layer 2 — `.gitattributes`
Tells Git to store all source files normalised to LF and check them out as LF
on every platform. Prevents Windows CRLF/encoding drift.

### Layer 3 — `npm run prebuild` (auto-runs before every `npm run build`)
`scripts/fix-source-encoding.js` scans all **source** `.ts/.js/.html/.json`
files and converts any UTF-16 files to UTF-8 before WXT compiles them.

### Layer 4 — Post-build `scripts/ensure-utf8.js`
After WXT builds the output, this script walks the entire `.output/chrome-mv3/`
directory and re-encodes any file that isn't clean UTF-8 (no BOM).

---

## Commands

| Command | What it does |
|---|---|
| `npm run build` | Normal build (auto-runs source fix → WXT build → output fix) |
| `npm run safe:build` | Explicit fix + build (use if `build` still fails) |
| `npm run fix:sources` | Re-encode **source** files only (before building) |
| `npm run fix:utf8` | Re-encode **output** files only (after building) |

---

## For LLMs — Critical Rules

When editing files in this repository:

1. **Never** write files using PowerShell `Out-File` or `Set-Content` without
   `-Encoding UTF8` (or `utf8NoBOM` on PS 6+).

2. **Never** use `Write-Output | Out-File` — it defaults to UTF-16 on Windows.

3. **Always** write files via `[System.IO.File]::WriteAllText()` or the
   `write_to_file` / `replace_file_content` tools (which handle encoding).

4. **If you're not sure**, run `npm run fix:sources` before committing or building.

5. **The `prebuild` script** (`fix-source-encoding.js`) runs automatically
   before `npm run build`. It will log which files were fixed:
   ```
   ✔ Fixed [UTF-16 LE] → UTF-8: entrypoints/content.ts
   ```

6. Do **not** add `charset=utf-8-bom` in `.editorconfig` — Chrome rejects
   the BOM byte in JavaScript files.

---

## Diagnosing the Error Manually

Run this PowerShell snippet to check file encodings:

```powershell
Get-ChildItem -Recurse -Include *.ts,*.js,*.html,*.json entrypoints,shared |
ForEach-Object {
    $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
    $enc = if ($bytes[0] -eq 0xFF -and $bytes[1] -eq 0xFE) { 'UTF-16 LE' }
           elseif ($bytes[0] -eq 0xFE -and $bytes[1] -eq 0xFF) { 'UTF-16 BE' }
           elseif ($bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) { 'UTF-8 BOM' }
           else { 'UTF-8' }
    if ($enc -ne 'UTF-8') { Write-Host "$enc  $($_.FullName)" }
}
```

Or run the Node.js fixer directly:
```bash
node scripts/fix-source-encoding.js
```

---

## How the Build Pipeline Works

```
npm run build
│
├─ [prebuild] scripts/fix-source-encoding.js
│   └─ Scans entrypoints/, shared/, scripts/, src/
│   └─ Converts any UTF-16/BOM files → UTF-8
│
├─ wxt build
│   └─ Compiles TypeScript sources → .output/chrome-mv3/
│
└─ [postbuild] scripts/ensure-utf8.js
    └─ Walks entire .output/chrome-mv3/
    └─ Re-encodes any non-UTF-8 file → UTF-8 (no BOM)
    └─ Exits with error code 1 if any file can't be fixed
```

---

## Files Involved

| File | Purpose |
|---|---|
| `.editorconfig` | Editor-level: force UTF-8 + LF |
| `.gitattributes` | Git-level: normalise line endings |
| `scripts/fix-source-encoding.js` | Pre-build: fix **source** files |
| `scripts/ensure-utf8.js` | Post-build: fix **output** files |
| `package.json` `prebuild` script | Runs `fix-source-encoding.js` automatically |
