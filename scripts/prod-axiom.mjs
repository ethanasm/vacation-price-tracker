#!/usr/bin/env node
// Run an APL query against the production Axiom dataset and pretty-print the
// result. This is the read counterpart to prod-query.mjs (which hits Postgres):
// app logs from api + worker are shipped to one Axiom dataset and this is the
// supported way for the operator (and Claude Code) to read them.
//
// Prefer this over the raw `curl .../_apl` recipe — it handles the auth headers,
// JSON escaping, and the column-oriented "tabular" response shape (which is
// fiddly to read by hand). The Axiom MCP server's own token is frequently
// expired in web sessions, so this PAT-based path is the reliable one.
//
// Usage:
//   pnpm prod:axiom "['vacation-price-tracker-prod'] | where _time > ago(1h) | summarize count() by service"
//   pnpm prod:axiom --json "['vacation-price-tracker-prod'] | where level == 'error' | take 20"
//   echo "['vacation-price-tracker-prod'] | summarize count()" | pnpm prod:axiom
//
// Config (from .env.prod at repo root, or the environment — env wins; in web
// sessions these come from the shell env, never the dev .env file):
//   AXIOM_QUERY_TOKEN  required, a PAT with Query capability (the ingest token
//                      used by the app cannot read)
//   AXIOM_ORG_ID       Axiom org slug; defaults to showbook-egap
// The dataset name is written inline in the APL (e.g. ['vacation-price-tracker-prod']).
//
// APL gotchas you will hit (these are why the helper exists):
//   - Always constrain time: `| where _time > ago(24h)`. The _apl endpoint
//     otherwise scans a ~1 year default window.
//   - The log message column is `msg`, NOT `message`.
//   - App-supplied fields (logger, trip_id, workflow_id, count, …) are folded
//     into the `fields` map — query them as `['fields']['logger']`, not as
//     top-level columns. Only CORE_FIELDS (_time, service, level, event, env,
//     hostname, pid, msg, status) and the err.* allowlist are real columns.
//   - Third-party library logs (langfuse, temporalio, uvicorn) arrive with
//     `event == null`; that's expected, not a misconfiguration.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(__dirname, "..", ".env.prod");

// Mirror prod-query.mjs: read .env.prod on the prod host, fall back to the shell
// environment (which is how web sessions get these vars). Env wins over file.
function loadEnvFile(path) {
  const out = {};
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return out; // missing .env.prod is fine if vars are in the environment
  }
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function die(msg) {
  console.error(`prod-axiom: ${msg}`);
  process.exit(1);
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8").trim();
}

// The /_apl?format=tabular response is column-oriented:
//   tables[0].fields  = [{name}, …]
//   tables[0].columns = [[col0 values…], [col1 values…], …]
// Transpose into an array of row objects for console.table.
function tabularToRows(payload) {
  const table = payload?.tables?.[0];
  if (!table || !Array.isArray(table.fields) || !Array.isArray(table.columns)) {
    return [];
  }
  const names = table.fields.map((f) => f.name);
  const colCount = table.columns.length;
  const rowCount = colCount ? table.columns[0].length : 0;
  const rows = [];
  for (let r = 0; r < rowCount; r++) {
    const row = {};
    for (let c = 0; c < colCount; c++) {
      let v = table.columns[c][r];
      if (v !== null && typeof v === "object") v = JSON.stringify(v);
      row[names[c]] = v;
    }
    rows.push(row);
  }
  return rows;
}

async function main() {
  const args = process.argv.slice(2);
  let asJson = false;
  const aplParts = [];
  for (const arg of args) {
    if (arg === "--json") asJson = true;
    else aplParts.push(arg);
  }

  let apl = aplParts.join(" ").trim();
  if (!apl && !process.stdin.isTTY) apl = await readStdin();
  if (!apl) {
    die('no APL provided. Usage: pnpm prod:axiom "[\'vacation-price-tracker-prod\'] | summarize count()"');
  }

  const fileEnv = loadEnvFile(ENV_PATH);
  const getVar = (name) => process.env[name] ?? fileEnv[name];

  const token = getVar("AXIOM_QUERY_TOKEN");
  if (!token) die("AXIOM_QUERY_TOKEN is not set (.env.prod or environment; needs a PAT with Query capability)");
  const org = getVar("AXIOM_ORG_ID") || "showbook-egap";

  const url = "https://api.axiom.co/v1/datasets/_apl?format=tabular";
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-AXIOM-ORG-ID": org,
      },
      body: JSON.stringify({ apl }),
    });
  } catch (err) {
    die(`request to Axiom failed: ${err.message}`);
  }

  const raw = await res.text();
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    die(`HTTP ${res.status}: non-JSON response: ${raw.slice(0, 500)}`);
  }

  if (!res.ok) {
    die(`HTTP ${res.status}: ${payload?.message || payload?.error || raw.slice(0, 300)}`);
  }

  // Surface query-planner warnings (e.g. license-limited time range) to stderr.
  for (const m of payload?.status?.messages || []) {
    console.error(`axiom[${m.priority || "note"}]: ${m.msg}`);
  }

  if (asJson) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const rows = tabularToRows(payload);
  if (rows.length === 0) console.log("(0 rows)");
  else console.table(rows);
  const examined = payload?.status?.rowsExamined;
  const elapsed = payload?.status?.elapsedTime;
  console.error(`${rows.length} row(s)${examined != null ? `, ${examined} examined` : ""}${elapsed != null ? ` in ${elapsed}ms` : ""}`);
}

main().catch((err) => die(err?.message || String(err)));
