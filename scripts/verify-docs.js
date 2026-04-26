#!/usr/bin/env node
// scripts/verify-docs.js — sanity check the wiki
//
// Usage: node scripts/verify-docs.js
// CI: invoked by .github/workflows/verify-docs.yml on push to main.
//
// Hard fails (exit 1):
//   - Dead cross-doc .md links INSIDE docs/. (Wiki internal integrity.)
//   - Malformed SHAs in _batch-log.md.
//
// Warnings (informational, not failures):
//   - Code-file refs that don't resolve in this repo. The wiki is mirrored
//     across 4 repos and many refs point at the trade-app code that only
//     exists in D4JSP, not in the sibling repos.
//   - Repo-root .md files (CLAUDE.md, README.md, etc.) that may exist in
//     some repos but not others.
//   - Directory refs (`../foo/`) that may be repo-specific.
//
// Set VERIFY_DOCS_VERBOSE=1 to print warning detail.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DOCS_DIR = path.join(ROOT, 'docs');
const START_MD = path.join(ROOT, 'start.md');

const failures = [];
const warnings = [];
let claimsChecked = 0;

function readDoc(p) { return fs.readFileSync(p, 'utf8'); }
function fileExists(p) { try { return fs.statSync(p).isFile(); } catch { return false; } }
function dirExists(p) { try { return fs.statSync(p).isDirectory(); } catch { return false; } }

function walkMd(dir) {
  const out = [];
  if (!dirExists(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkMd(full));
    else if (entry.isFile() && entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

function isInsideDocs(p) {
  const rel = path.relative(DOCS_DIR, p);
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

// ── Cross-doc links ───────────────────────────────────────────────────────
function checkLinks(mdPath) {
  const content = readDoc(mdPath);
  const dir = path.dirname(mdPath);
  // [text](./path or ../path)
  const linkRe = /\[([^\]]+)\]\((\.{1,2}\/[^)\s#]+)(?:#[^)\s]+)?\)/g;
  let m;
  while ((m = linkRe.exec(content)) !== null) {
    const target = m[2];
    const cleanTarget = target.replace(/:\d+(?:-\d+)?$/, '');
    const resolved = path.resolve(dir, cleanTarget);
    const exists = fileExists(resolved) || dirExists(resolved);

    // Hard-fail: a .md link whose resolved target is inside this repo's docs/
    // tree. That's wiki-internal integrity — must always resolve.
    if (cleanTarget.endsWith('.md') && isInsideDocs(resolved)) {
      if (!exists) {
        failures.push(`${path.relative(ROOT, mdPath)}: dead intra-wiki link → ${target}`);
      } else {
        claimsChecked++;
      }
    } else {
      // Code refs, directory refs, repo-root .md → warn-only
      if (!exists) {
        warnings.push(`${path.relative(ROOT, mdPath)}: ref not in this repo → ${target}`);
      } else {
        claimsChecked++;
      }
    }
  }
}

// ── _batch-log SHA syntax ─────────────────────────────────────────────────
function checkBatchLog() {
  const p = path.join(DOCS_DIR, '_batch-log.md');
  if (!fileExists(p)) return;
  const content = readDoc(p);
  const shaRe = /`(?:D4JSP(?:-(?:Admin|Map|Build-Planner))?\/)?([a-f0-9]{7,40})`/g;
  let m;
  while ((m = shaRe.exec(content)) !== null) {
    const sha = m[1];
    if (!/^[a-f0-9]{7,40}$/.test(sha)) {
      failures.push(`_batch-log.md: malformed SHA "${sha}"`);
    } else {
      claimsChecked++;
    }
  }
}

// ── Run ───────────────────────────────────────────────────────────────────
const allDocs = [START_MD, ...walkMd(DOCS_DIR)].filter(p => fileExists(p));

for (const doc of allDocs) checkLinks(doc);
checkBatchLog();

console.log(`verify-docs: ${allDocs.length} docs scanned, ${claimsChecked} claims checked, ${warnings.length} warning(s)`);

if (warnings.length > 0 && process.env.VERIFY_DOCS_VERBOSE) {
  console.log('\nWarnings (informational, not failures):');
  for (const w of warnings.slice(0, 30)) console.log(`  - ${w}`);
  if (warnings.length > 30) console.log(`  ... ${warnings.length - 30} more (set VERIFY_DOCS_VERBOSE=1 to see all)`);
}

if (failures.length > 0) {
  console.error(`\n${failures.length} hard failure(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log('verify-docs: OK');
process.exit(0);
