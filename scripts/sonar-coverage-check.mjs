#!/usr/bin/env node
// Locally reproduce the part of the SonarCloud scan that silently breaks:
// whether the coverage reports we hand to the scanner actually map onto files
// in the repo.
//
// SonarCloud resolves every path in a coverage report against the repo root
// (`sonar.projectBaseDir`). If a path doesn't resolve, Sonar does NOT fail —
// it just drops that file's coverage and reports it as 0% on new code, which is
// exactly the failure this guards against (jest emits `SF:src/...` relative to
// `apps/web`, which is nothing from the repo root).
//
// This reads the same report paths the real scan uses from
// `sonar-project.properties`, parses each lcov/cobertura report, and verifies
// every referenced source file exists relative to the repo root. It prints a
// per-report summary and a per-file coverage table, and exits non-zero if any
// path fails to resolve or a configured report is missing.
//
// Run AFTER generating coverage (`pnpm test:coverage`), or use the
// `scripts/sonar-local.sh` wrapper which does both. No SONAR_TOKEN needed.
//
// SCOPE — this validates ONLY the *Coverage* quality-gate dimension. It does NOT
// run SonarCloud's rule engine, so it cannot see the Security / Reliability /
// Maintainability / Duplications ratings. A gate can still fail on those even
// when this passes (e.g. a CWE-117 log-injection finding drops Security to B).
// To reproduce the FULL gate locally, run `scripts/sonar-local.sh --scan` with a
// SONAR_TOKEN — that uploads the real analysis and waits on the gate verdict.

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, relative } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const propsPath = join(ROOT, "sonar-project.properties");

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const NC = "\x1b[0m";

/** Split on LF or CRLF so Windows-authored reports parse identically. */
const splitLines = (text) => text.split(/\r?\n/);

/** Parse sonar-project.properties into a flat key→value map (handles `\` line continuations). */
function parseProps(text) {
  const out = {};
  const lines = splitLines(text);
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1);
    while (value.trimEnd().endsWith("\\")) {
      value = value.trimEnd().slice(0, -1) + (lines[++i] ?? "");
    }
    out[key] = value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .join(",");
  }
  return out;
}

/** Extract { file, found, total } records from an lcov report. */
function parseLcov(text) {
  const records = [];
  let file = null;
  let found = 0;
  let hit = 0;
  for (const line of splitLines(text)) {
    if (line.startsWith("SF:")) {
      file = line.slice(3).trim();
      found = 0;
      hit = 0;
    } else if (line.startsWith("DA:")) {
      const count = Number(line.split(",")[1]);
      found += 1;
      if (count > 0) hit += 1;
    } else if (line.startsWith("end_of_record") && file) {
      records.push({ file, total: found, covered: hit });
      file = null;
    }
  }
  return records;
}

/**
 * Extract { records, sources } from a Cobertura (coverage.py) XML report.
 * `sources` are the <source> roots; a class filename may be relative to the
 * repo root OR to one of these, so callers try both when resolving.
 */
function parseCobertura(text) {
  const records = [];
  const sources = [];
  const srcRe = /<source>([^<]*)<\/source>/g;
  let sm;
  while ((sm = srcRe.exec(text)) !== null) {
    const s = sm[1].trim();
    if (s) sources.push(s);
  }
  const classRe = /<class\b[^>]*\bfilename="([^"]+)"[^>]*>([\s\S]*?)<\/class>/g;
  let m;
  while ((m = classRe.exec(text)) !== null) {
    const file = m[1];
    const body = m[2];
    let total = 0;
    let covered = 0;
    const lineRe = /<line\b[^>]*\bhits="(\d+)"[^>]*\/?>/g;
    let lm;
    while ((lm = lineRe.exec(body)) !== null) {
      total += 1;
      if (Number(lm[1]) > 0) covered += 1;
    }
    records.push({ file, total, covered });
  }
  return { records, sources };
}

function pct(covered, total) {
  if (total === 0) return "100.0%";
  return `${((covered / total) * 100).toFixed(1)}%`;
}

/** Convert a Sonar/ant glob (with `**` and `*`) to an anchored RegExp. */
function globToRegex(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        i++;
        if (glob[i + 1] === "/") {
          i++;
          re += "(?:.*/)?"; // `**/` — any leading directories, or none
        } else {
          re += ".*"; // trailing `**` — anything under here
        }
      } else {
        re += "[^/]*"; // single `*` — within one path segment
      }
    } else if ("\\^$+?.()|[]{}".includes(c)) {
      re += `\\${c}`;
    } else {
      re += c;
    }
  }
  return new RegExp(`^${re}$`);
}

/** Recursively list files under `dir` (repo-root-relative, forward slashes). */
function walkFiles(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const abs = join(dir, e.name);
    if (e.isDirectory()) out.push(...walkFiles(abs));
    else if (e.isFile()) out.push(relative(ROOT, abs).split("\\").join("/"));
  }
  return out;
}

// Source extensions Sonar measures coverage for. `.d.ts` carries no coverage.
const COVERAGE_EXTS = [".py", ".ts", ".tsx"];
const isCoverable = (f) => COVERAGE_EXTS.some((x) => f.endsWith(x)) && !f.endsWith(".d.ts");

/**
 * Does this file produce executable lines Sonar would count? Python modules
 * always do. A TypeScript file that is pure type declarations (interfaces/types,
 * no runtime exports or re-exports) compiles to nothing, so it has no lines to
 * cover and never affects the coverage %. Skipping those avoids false positives
 * (e.g. the generated `lib/api/types.ts`).
 */
function producesCoverage(file) {
  if (file.endsWith(".py")) return true;
  let code;
  try {
    code = readFileSync(join(ROOT, file), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
  } catch {
    return true;
  }
  return (
    /\bexport\s+(default|const|let|var|function|async|class|enum|namespace)\b/.test(code) ||
    /^\s*(const|let|var|function|class|enum)\s/m.test(code) ||
    /\bexport\s*\{[^}]*\}\s*from\b/.test(code) // re-export barrel — runtime
  );
}

/**
 * Find source files Sonar will scan (under sonar.sources) that are NOT in any
 * coverage report and NOT excluded — Sonar's "Zero Coverage Sensor" marks these
 * 0%, silently dragging down Coverage on New Code. This is the trap where a file
 * omitted from coverage.py (e.g. apps/api/app/models/*) isn't also listed in
 * sonar.coverage.exclusions.
 */
function findZeroCoverageSources(props, coveredFiles) {
  const sources = (props["sonar.sources"]?.split(",") ?? []).map((s) => s.trim()).filter(Boolean);
  const testRes = (props["sonar.test.inclusions"]?.split(",") ?? [])
    .map((s) => s.trim())
    .filter(Boolean)
    .map(globToRegex);
  const exclRes = (props["sonar.coverage.exclusions"]?.split(",") ?? [])
    .map((s) => s.trim())
    .filter(Boolean)
    .map(globToRegex);

  const flagged = [];
  for (const src of sources) {
    for (const file of walkFiles(join(ROOT, src))) {
      if (!isCoverable(file)) continue;
      if (testRes.some((r) => r.test(file))) continue; // test file, not production code
      if (exclRes.some((r) => r.test(file))) continue; // intentionally excluded
      if (coveredFiles.has(file)) continue; // present in a coverage report
      if (!producesCoverage(file)) continue; // type-only module — no lines to cover
      flagged.push(file);
    }
  }
  return flagged.sort();
}

const props = parseProps(readFileSync(propsPath, "utf8"));
const reports = [
  ...(props["sonar.javascript.lcov.reportPaths"]?.split(",") ?? []).map((p) => ({
    path: p,
    kind: "lcov",
  })),
  ...(props["sonar.python.coverage.reportPaths"]?.split(",") ?? []).map((p) => ({
    path: p,
    kind: "cobertura",
  })),
].filter((r) => r.path);

let problems = 0;
let missingReports = 0;
const coveredFiles = new Set();

console.log(`${BOLD}SonarCloud coverage path check${NC} ${DIM}(repo root: ${ROOT})${NC}\n`);

for (const { path, kind } of reports) {
  const abs = join(ROOT, path);
  if (!existsSync(abs)) {
    console.log(`${YELLOW}⚠ missing report${NC} ${path} ${DIM}(run pnpm test:coverage first)${NC}`);
    missingReports += 1;
    continue;
  }

  const text = readFileSync(abs, "utf8");
  const { records, sources } =
    kind === "lcov" ? { records: parseLcov(text), sources: [] } : parseCobertura(text);

  // Sonar resolves a coverage path against the project base dir (the repo root);
  // for Cobertura it may also be relative to a declared <source> root. A record
  // resolves if any of those candidates exists on disk.
  const resolvesOnDisk = (file) =>
    existsSync(resolve(ROOT, file)) || sources.some((s) => existsSync(resolve(ROOT, s, file)));
  const unresolved = records.filter((r) => !resolvesOnDisk(r.file));

  // Record every file present in a report (repo-root-relative) so we can later
  // find source files that are ABSENT from all reports.
  for (const r of records) coveredFiles.add(r.file.split("\\").join("/"));

  const totalLines = records.reduce((a, r) => a + r.total, 0);
  const coveredLines = records.reduce((a, r) => a + r.covered, 0);

  const status = unresolved.length === 0 ? `${GREEN}✓${NC}` : `${RED}✗${NC}`;
  console.log(
    `${status} ${BOLD}${path}${NC} ${DIM}(${kind})${NC} — ${records.length} files, ` +
      `${pct(coveredLines, totalLines)} lines, ` +
      `${unresolved.length === 0 ? `${GREEN}all paths resolve${NC}` : `${RED}${unresolved.length} unresolved${NC}`}`
  );

  if (unresolved.length > 0) {
    problems += unresolved.length;
    for (const r of unresolved.slice(0, 10)) {
      console.log(
        `    ${RED}unresolved${NC} ${r.file} ${DIM}→ ${resolve(ROOT, r.file)} (not on disk)${NC}`
      );
    }
    if (unresolved.length > 10) console.log(`    ${DIM}…and ${unresolved.length - 10} more${NC}`);
    console.log(
      `    ${YELLOW}Sonar will report these files as 0% coverage on new code.${NC}`
    );
  }
}

// Only hunt for zero-coverage'd sources when the reports are actually present;
// otherwise every file looks "absent" and the signal is noise.
let zeroCov = [];
if (missingReports === 0) {
  zeroCov = findZeroCoverageSources(props, coveredFiles);
  if (zeroCov.length > 0) {
    console.log("");
    console.log(
      `${RED}✗${NC} ${BOLD}${zeroCov.length} source file(s)${NC} are scanned by Sonar but absent from every` +
        ` coverage report ${DIM}(not in sonar.coverage.exclusions)${NC}:`
    );
    for (const f of zeroCov.slice(0, 20)) console.log(`    ${RED}zero-coverage${NC} ${f}`);
    if (zeroCov.length > 20) console.log(`    ${DIM}…and ${zeroCov.length - 20} more${NC}`);
    console.log(
      `    ${YELLOW}Sonar's Zero Coverage Sensor marks these 0% on new code. Either add tests,` +
        ` or — if intentionally not measured (e.g. coverage.py \`omit\`) — add them to` +
        ` sonar.coverage.exclusions.${NC}`
    );
  }
}

console.log("");
if (missingReports > 0) {
  console.log(
    `${YELLOW}${missingReports} report(s) missing — generate them with ${BOLD}pnpm test:coverage${NC}${YELLOW} and re-run.${NC}`
  );
}
if (problems > 0 || zeroCov.length > 0) {
  const bits = [];
  if (problems > 0) bits.push(`${problems} unresolvable coverage path(s)`);
  if (zeroCov.length > 0) bits.push(`${zeroCov.length} zero-coverage'd source file(s)`);
  console.log(`${RED}${BOLD}FAIL${NC} ${bits.join(" + ")} — Sonar would report these as 0% on new code.`);
  process.exit(1);
}
if (missingReports > 0) {
  process.exit(1);
}
console.log(
  `${GREEN}${BOLD}OK${NC} every coverage path resolves and every scanned source file is in a report.`
);
console.log(
  `${DIM}Note: this checks the Coverage dimension only. Security / Reliability /` +
    ` Maintainability ratings are evaluated by the real scan (sonar-local.sh --scan).${NC}`
);
