#!/usr/bin/env node
// Run a read-only SQL query against the production database via the FastAPI
// admin endpoint (POST /v1/admin/sql). The DB is owned by the API and is not
// exposed on the LAN, so this HTTPS-fronted, bearer-authenticated endpoint is
// the supported way for the operator (and Claude Code) to inspect prod data.
//
// Usage:
//   pnpm prod:query "SELECT count(*) FROM trips"
//   pnpm prod:query --json "SELECT id, trip_name FROM trips LIMIT 5"
//   echo "SELECT now()" | pnpm prod:query        # query from stdin
//
// Config (from .env.prod at repo root, or the environment — env wins):
//   ADMIN_QUERY_TOKEN  required, the Bearer token (>= 32 chars)
//   PROD_API_URL       API base URL; falls back to BACKEND_URL, then
//                      ADMIN_QUERY_URL (the var Claude Code web sessions inject),
//                      then http://127.0.0.1:8001 (the loopback bind in prod
//                      compose). ADMIN_QUERY_URL may be the API origin or the
//                      full /v1/admin/sql endpoint — both are accepted.
//
// Only read-only statements are accepted; the endpoint enforces that server-side.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(__dirname, "..", ".env.prod");

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
  console.error(`prod-query: ${msg}`);
  process.exit(1);
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8").trim();
}

async function main() {
  const fileEnv = loadEnvFile(ENV_PATH);
  const getVar = (name) => process.env[name] ?? fileEnv[name];

  const args = process.argv.slice(2);
  let asJson = false;
  const queryParts = [];
  for (const arg of args) {
    if (arg === "--json") asJson = true;
    else queryParts.push(arg);
  }

  let query = queryParts.join(" ").trim();
  if (!query && !process.stdin.isTTY) query = await readStdin();
  if (!query) {
    die('no query provided. Usage: pnpm prod:query "SELECT count(*) FROM trips"');
  }

  const token = getVar("ADMIN_QUERY_TOKEN");
  if (!token) die("ADMIN_QUERY_TOKEN is not set (.env.prod or environment)");
  if (token.length < 32) die("ADMIN_QUERY_TOKEN must be >= 32 chars");

  // ADMIN_QUERY_URL is injected into Claude Code web sessions; it may be the API
  // origin or the full endpoint, so normalise either to a base before appending.
  const base = (getVar("PROD_API_URL") || getVar("BACKEND_URL") || getVar("ADMIN_QUERY_URL") || "http://127.0.0.1:8001")
    .replace(/\/$/, "")
    .replace(/\/v1\/admin\/sql$/, "");
  const url = `${base}/v1/admin/sql`;

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query }),
    });
  } catch (err) {
    die(`request to ${url} failed: ${err.message}`);
  }

  let payload;
  const raw = await res.text();
  try {
    payload = JSON.parse(raw);
  } catch {
    die(`HTTP ${res.status}: non-JSON response: ${raw.slice(0, 500)}`);
  }

  if (!res.ok) {
    const detail = payload.details ? ` — ${payload.details}` : "";
    die(`HTTP ${res.status} ${payload.error || "error"}${detail}`);
  }

  if (asJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    const rows = payload.rows || [];
    if (rows.length === 0) console.log("(0 rows)");
    else console.table(rows);
    const note = payload.truncated ? " (truncated)" : "";
    console.error(`${payload.rowCount} row(s)${note} in ${payload.elapsedMs}ms`);
  }
}

main().catch((err) => die(err?.message || String(err)));
