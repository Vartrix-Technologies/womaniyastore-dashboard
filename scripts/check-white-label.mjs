#!/usr/bin/env node
/**
 * check-white-label.mjs
 *
 * Regression guard: detects hardcoded brand-specific colors and string literals
 * that should be sourced from appConfig or bc.* palette variables instead.
 *
 * Usage:  node scripts/check-white-label.mjs
 * CI:     exits with code 1 if violations are found, 0 if clean.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, extname } from 'path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

// Directories to scan (relative to ROOT)
const SCAN_DIRS = ['src', 'public'];

// Files/dirs to exclude from scanning
const EXCLUDE_PATHS = [
  'src/lib/config/app.config.ts',      // source of truth — intentional values live here
  'src/context/ThemeColorContext.tsx',  // palette definitions — rose values are defined here intentionally
  'scripts',                            // this script itself
  '.next',
  'node_modules',
];

// ── Category A: Rose-palette hex codes that must not appear outside app.config.ts ──
// These are the hardcoded rose/pink/mauve brand hex values that belong in bc.* variables.
const ROSE_HEX_PATTERNS = [
  '#5e1a38', '#8c2e56', '#7a2547',  // header gradient / divider
  '#fdf0f3', '#fff5f7', '#fce4ec',  // page / soft / border backgrounds
  '#e8a0b8', '#d4869f', '#ffe4ef',  // text-on-header shades
  '#f9a8c4',                         // logo border
  '#3d0a19', '#9a6070', '#c4869c',  // text: dark / muted / accent-muted
  '#7c1342',                         // text-accent (payment method)
  '#fecdd3',                         // footer label
];

// ── Category B: Internal brand string literals that must not be hardcoded in .ts/.tsx ──
// These should be imported from appConfig.internal / appConfig.billing
const BRAND_STRING_PATTERNS = [
  '/womaniya_logo',                        // old logo path (should be appConfig.billing.logoPath)
  'womaniya_last_email',                   // should be appConfig.internal.lastEmailKey
  'womaniya_cached_profile',              // should be appConfig.internal.profileCacheKey
  'womaniya-color-palette',              // should be appConfig.internal.colorPaletteKey
  'womaniya-inventory-cache-timestamp',  // should be appConfig.internal.inventoryCacheTimestampKey
  'womaniya-pos-cart',                   // should be appConfig.internal.cartStorageKey
  'womaniya-backup',                     // should be appConfig.internal.backupFilePrefix
];

// Extensions to scan for Category B (brand string literals)
const TS_EXTENSIONS = new Set(['.ts', '.tsx']);

// ── Helpers ──────────────────────────────────────────────────────────────────

function isExcluded(filePath) {
  const rel = relative(ROOT, filePath).replace(/\\/g, '/');
  return EXCLUDE_PATHS.some((ex) => rel === ex || rel.startsWith(ex + '/'));
}

function* walkFiles(dir) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (isExcluded(fullPath)) continue;
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      yield* walkFiles(fullPath);
    } else {
      yield fullPath;
    }
  }
}

function checkFile(filePath, violations) {
  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return; // skip unreadable files (binary etc.)
  }

  const ext = extname(filePath).toLowerCase();
  const rel = relative(ROOT, filePath).replace(/\\/g, '/');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const lowerLine = line.toLowerCase();

    // Category A: rose hex codes — checked in ALL scanned files
    for (const hex of ROSE_HEX_PATTERNS) {
      if (lowerLine.includes(hex.toLowerCase())) {
        violations.push({ file: rel, line: lineNum, match: hex, text: line.trim(), category: 'A' });
      }
    }

    // Category B: brand string literals — only in TypeScript/TSX files
    if (TS_EXTENSIONS.has(ext)) {
      for (const str of BRAND_STRING_PATTERNS) {
        if (line.includes(str)) {
          violations.push({ file: rel, line: lineNum, match: str, text: line.trim(), category: 'B' });
        }
      }
    }
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────

const violations = [];

for (const dir of SCAN_DIRS) {
  const absDir = join(ROOT, dir);
  try {
    statSync(absDir);
  } catch {
    continue; // directory doesn't exist, skip
  }
  for (const filePath of walkFiles(absDir)) {
    checkFile(filePath, violations);
  }
}

if (violations.length === 0) {
  console.log('✓ check-white-label: no violations found.');
  process.exit(0);
}

// Group violations by category for readable output
const catA = violations.filter((v) => v.category === 'A');
const catB = violations.filter((v) => v.category === 'B');

if (catA.length > 0) {
  console.error(`\n❌ Category A — Hardcoded rose palette hex codes (${catA.length} violation${catA.length > 1 ? 's' : ''}):`);
  console.error('   These should be replaced with bc.* palette variables.\n');
  for (const v of catA) {
    console.error(`   ${v.file}:${v.line}  [${v.match}]`);
    console.error(`     ${v.text}\n`);
  }
}

if (catB.length > 0) {
  console.error(`\n❌ Category B — Hardcoded brand string literals (${catB.length} violation${catB.length > 1 ? 's' : ''}):`);
  console.error('   These should be imported from appConfig.internal / appConfig.billing.\n');
  for (const v of catB) {
    console.error(`   ${v.file}:${v.line}  [${v.match}]`);
    console.error(`     ${v.text}\n`);
  }
}

console.error(`\n${violations.length} white-label violation${violations.length > 1 ? 's' : ''} found. Fix before committing.\n`);
process.exit(1);
