#!/usr/bin/env node
// Rewrite the `SF:` source paths in an lcov report so they are relative to the
// repo root instead of the app directory.
//
// Why: Next.js/jest emits coverage paths relative to `apps/web` (e.g.
// `SF:src/lib/price-history.ts`). The SonarCloud scanner runs at the repo root
// and resolves lcov paths against `sonar.projectBaseDir` (the repo root), so an
// unprefixed `src/...` path maps to nothing on disk. Sonar then silently treats
// every web file as having NO coverage and reports 0% on new code — even though
// the tests fully exercise the file. Prefixing each path with `apps/web/` makes
// it resolve to the real file and the coverage lands.
//
// Usage: node scripts/lcov-reroot.mjs <lcov-file> <path-prefix>
//   node scripts/lcov-reroot.mjs apps/web/coverage/lcov.info apps/web/
//
// Idempotent: paths already carrying the prefix (or absolute paths) are left
// untouched, so it is safe to run repeatedly.

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const [file, prefix] = process.argv.slice(2);

if (!file || !prefix) {
  console.error("usage: node scripts/lcov-reroot.mjs <lcov-file> <path-prefix>");
  process.exit(2);
}

if (!existsSync(file)) {
  console.error(`lcov-reroot: report not found: ${file}`);
  process.exit(1);
}

const isAbsolute = (p) => p.startsWith("/") || /^[A-Za-z]:[\\/]/.test(p);

let rewritten = 0;
const out = readFileSync(file, "utf8").replace(/^SF:(.*)$/gm, (match, p) => {
  if (p.startsWith(prefix) || isAbsolute(p)) return match;
  rewritten += 1;
  return `SF:${prefix}${p}`;
});

writeFileSync(file, out);
console.log(`lcov-reroot: prefixed ${rewritten} source path(s) in ${file} with "${prefix}"`);
