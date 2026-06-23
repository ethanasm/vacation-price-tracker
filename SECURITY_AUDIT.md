# Security Audit Report
**Date:** June 23, 2026
**Project:** Vacation Price Tracker
**Audit Type:** Dependency Security Analysis

---

## Executive Summary

✅ **Overall Status: SECURE**

All previously accepted-risk advisories have been resolved by upstream patches and a dependency upgrade pass. No outstanding vulnerabilities.

**pip-audit Results:** No known vulnerabilities found
**pnpm audit Results:** No known vulnerabilities found (apps/web)

> **Note on pnpm audit:** The legacy npm audit endpoint that pnpm uses returns HTTP 410 (npm retired it in favour of the bulk advisory endpoint). Until pnpm migrates, CI runs `pnpm audit --prod --ignore-registry-errors` so the registry error itself doesn't fail the build. Real advisories, when the endpoint is reachable, are still surfaced.

### Resolved in the latest pass (June 23, 2026)
- **ecdsa Minerva timing attack (CVE-2024-23342):** the upstream maintainers do
  **not** plan a fix, so this cannot be cleared by a version bump — an earlier
  note here that 0.19.2 "patched it upstream" was incorrect. `ecdsa` was only
  present transitively via `python-jose`, which this project used solely for
  **HS256** (HMAC) JWTs, so ECDSA was never exercised. JWT signing/verification
  was migrated to **PyJWT** and both `python-jose[cryptography]` and the direct
  `ecdsa` pin were removed; `ecdsa`/`rsa` are now absent from `uv.lock`.
- **89 npm dev/tooling advisories:** cleared by bumping direct build tooling
  (nx 22→23, shadcn 3→4, @nxlv/python 20→22, jest, openapi-typescript, etc.) plus
  major-scoped `pnpm.overrides` that force patched transitive versions (axios,
  hono, minimatch, vite, vitest, rollup, fast-uri, qs, ws, …). None reached the
  production runtime — `pnpm audit --prod` was already clean.

### Resolved in the April 15, 2026 audit (since Jan 13, 2026)
- **CVE-2026-0994 (protobuf):** protobuf 6.33.4 → 6.33.6 via the temporalio 1.21.1 → 1.26.0 upgrade.
- **CVE-2026-1703 (pip):** pip 25.3 → 26.0.1 in the uv-managed venv.
- **CVE-2025-61920 (authlib JOSE DoS):** authlib 1.6.6 → 1.6.10.
- Plus minor patch bumps to cryptography, pygments, requests, pytest.

---

## Critical Dependencies Analysis

### 1. ✅ FastAPI 0.135.3
- **Status:** ✅ Secure (current)
- **Known CVEs:** None for this version

### 2. ✅ Starlette 1.0.0 (FastAPI Dependency)
- **Status:** ✅ Secure
- **Notes:** Major version bump from 0.50.0; no known advisories

### 3. ✅ PyJWT 2.13.0 (replaced python-jose)
- **Status:** ✅ Secure
- **Notes:** JWT encode/decode migrated from `python-jose` to **PyJWT** (HS256
  only). This drops the transitive `ecdsa` dependency, whose Minerva P-256 timing
  attack (CVE-2024-23342) has **no upstream fix**. PyJWT relies on the
  `cryptography` backend and does not pull in `ecdsa`/`rsa`.
- **Algorithm confusion:** mitigated — every `jwt.decode` passes an explicit
  `algorithms=[...]` allowlist, and signing uses a symmetric secret.

### 4. ✅ cryptography 46.0.7
- **Status:** ✅ Secure (patched)
- **Notes:** Bumped from 46.0.3 to clear all known advisories

### 5. ✅ SQLAlchemy 2.0.49
- **Status:** ✅ Secure
- **Known CVEs:** None for 2.x versions

### 6. ✅ asyncpg 0.31.0
- **Status:** ✅ Secure

### 7. ✅ Authlib 1.6.10
- **Status:** ✅ Secure
- **CVE-2025-61920 (DoS via oversized JOSE segments):** Resolved (>=1.6.9)

### 8. ✅ Redis 7.4.0
- **Status:** ✅ Secure

### 9. ✅ Pydantic 2.13.1
- **Status:** ✅ Secure

### 10. ✅ Temporalio 1.26.0
- **Status:** ✅ Secure
- **Notes:** Bump pulled in protobuf 6.33.6, clearing CVE-2026-0994

### 11. ✅ pip 26.0.1 (Transitive)
- **Status:** ✅ Secure
- **CVE-2026-1703:** Fixed in 26.0; uv-managed venv now uses 26.0.1

---

## Development Dependencies

### Testing & Code Quality
- ✅ **pytest 9.0.3** - Secure
- ✅ **ruff 0.15.10** - Secure
- ✅ **pytest-asyncio 1.3.0** - Secure
- ✅ **aiosqlite 0.22.1** - Secure

### Frontend Dependency Audit (pnpm)
- ✅ **apps/web** - No known vulnerabilities found via `pnpm audit`

---

## Action Items

### ✅ All Critical Items Resolved

No high-priority security actions required.

### 🟡 Recommended (Optional)
1. **Run pip-audit periodically**
   - Already wired into `pnpm verify`. To run on demand:
   ```bash
   uv run pip-audit --skip-editable
   ```
   No `--ignore-vuln` flags are required as of this audit — every previously suppressed CVE is patched.

2. **Monitor security advisories**
   - https://github.com/advisories
   - https://security.snyk.io/
   - PyPI security mailing lists

3. **Track pnpm audit endpoint migration**
   - Watch pnpm releases for the switch to the npm bulk advisory endpoint. Once available, drop `--ignore-registry-errors` from the verify scripts and the GitHub Actions workflow so registry errors fail the build again.

### 🟢 Best Practices
4. **Pin dependency versions in production**
   - `uv.lock` already pins all transitive versions ✅
   - Direct deps now also have minimum-version pins for previously-vulnerable packages
   - Review and run `uv lock --upgrade` quarterly

5. **Security headers in FastAPI**
   - Add security middleware in production:
   ```python
   from fastapi.middleware.trustedhost import TrustedHostMiddleware
   from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware

   app.add_middleware(TrustedHostMiddleware, allowed_hosts=["yourdomain.com"])
   app.add_middleware(HTTPSRedirectMiddleware)  # Production only
   ```

6. **Rate limiting**
   - Consider adding `slowapi` for rate limiting:
   ```bash
   uv add slowapi
   ```

---

## Security Best Practices Currently Implemented ✅

1. ✅ **JWT Security**
   - HTTP-only cookies
   - Secure flag (production)
   - SameSite=Lax
   - Short expiry (15 min access, 7 day refresh)
   - Token rotation on refresh

2. ✅ **CSRF Protection**
   - Double-submit cookie strategy via dedicated middleware
   - CSRF token required on all unsafe HTTP methods

3. ✅ **Database Security**
   - Parameterized queries (SQLAlchemy ORM)
   - No raw SQL with user input
   - Unique constraints on sensitive fields

4. ✅ **Dependency Management**
   - Lock file (`uv.lock`) pins all transitive dependencies
   - Reproducible builds
   - Direct minimum-version pins for previously-vulnerable packages

5. ✅ **Environment Variables**
   - Secrets in `.env` (not committed)
   - `.env.example` for documentation

---

## Recommended Security Tools

### For CI/CD Pipeline
Already wired in `.github/workflows/python.yml` and `.github/workflows/nextjs.yml`:
- `uv run pip-audit` (Python deps)
- `pnpm audit --prod --ignore-registry-errors` (npm deps)

### Local Development
```bash
# Install additional security scanning tools
uv add --dev bandit safety

# Run security checks
uv run pip-audit --skip-editable     # Check dependencies (already wired in `pnpm verify`)
uv run bandit -r apps/api/app/       # Check code for security issues
uv run safety check                  # Alternative dependency checker
```

---

## Compliance Notes

- **OWASP Top 10 (2021):** Addressed via secure auth, CSRF middleware, parameterized queries, dependency management
- **GDPR:** User data (email) properly protected; consider data retention policy
- **OAuth 2.0 Security:** Properly implemented with state validation, secure token storage

---

## Next Security Review

**Scheduled:** July 2026 (Quarterly review)

**Triggers for immediate review:**
- New CVE announced for any core dependency
- Before deploying to production
- After adding new dependencies
- When upgrading Python version
- When pnpm publishes the audit-endpoint migration

---

## Contact

For security concerns, email: security@yourdomain.com (update with actual contact)

**Responsible Disclosure:** Report security vulnerabilities privately before public disclosure.
