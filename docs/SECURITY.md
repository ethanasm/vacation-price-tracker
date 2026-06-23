# Security Policy

## Reporting a vulnerability

If you've found a security issue in Vacation Price Tracker, please **do not**
open a public GitHub issue. Instead, report it privately via GitHub's
["Report a vulnerability"](https://github.com/ethanasm/vacation-price-tracker/security/advisories/new)
flow on the repository's Security tab.

I'll acknowledge the report within a few days and follow up with next steps.

## Scope

Only the latest commit on `main` is considered in scope. There is no bug bounty —
this is a personal project and reports are accepted in good faith.

In-scope examples:

- Authentication / authorization bugs (IDORs, session/JWT handling, OAuth
  callback handling, CSRF).
- Server-side request forgery, command injection, SQL injection.
- Bypasses of the read-only `POST /v1/admin/sql` endpoint guard (write through a
  read-only transaction, statement-timeout bypass, token compare weaknesses).
- Cost-abuse vectors against paid/again-throttled upstreams (Groq LLM, the
  Skiplagged MCP). See [`GUARDRAILS.md`](./GUARDRAILS.md) for existing caps.
- Secrets accidentally committed to the repository.

Out of scope:

- Issues that require a self-hoster to misconfigure their own deployment
  (e.g. setting `ADMIN_QUERY_TOKEN` to a weak value, or pointing
  `ADMIN_QUERY_DATABASE_URL` at a writable role).
- Denial of service against a self-hosted instance from an authenticated user.
- Findings against third-party dependencies with no working exploit path through
  this app. (Dependency CVEs are tracked separately via `pnpm audit` / `pip-audit`
  in CI.)
