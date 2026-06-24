# Mobile Backend (Auth Bridge + Push) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the backend the VPT mobile app needs — a Google-ID-token → JWT-pair auth bridge, `Authorization: Bearer` support on the shared auth dependency and refresh endpoint, device push-token registration, and an Expo push-send path in the daily price-check — without breaking the existing cookie-based web flow.

**Architecture:** This is plan **P5** of the "Aurora" effort (see `docs/superpowers/plans/2026-06-23-AURORA-INDEX.md`). It owns `apps/api/**` and `apps/worker/**` ONLY and shares no files with P1 (web) or P2/P3/P4 (mobile app), so it runs in **Wave 1** concurrently with everything. The mobile client performs Google OAuth natively (Expo AuthSession), POSTs the resulting Google ID token to a new `POST /v1/auth/mobile-token` endpoint, and receives the **same** access/refresh JWT pair the web OAuth callback mints — returned **in the response body** (not `Set-Cookie`). It then sends `Authorization: Bearer <access_token>` on every request, so the shared `get_current_user` dependency and `POST /v1/auth/refresh` gain additive Bearer-header support (the cookie path stays for web). The worker's existing email/SMS notification outbox gains a parallel Expo push-send that fires when a trip total crosses its threshold.

**Tech Stack:** FastAPI (Python 3.12) · SQLModel + PostgreSQL · Alembic · PyJWT · authlib (`authlib.jose` for Google JWKS verification — already a dependency) · httpx (Expo push HTTP, already a dependency) · Temporal SDK for Python (worker) · pytest + pytest-asyncio (SQLite test DB via the conftest `get_db` override).

## Global Constraints

*Every task implicitly includes this section. Values copied verbatim from the index and the repo.*

### PR operator docs (required)
Every PR opened for this plan MUST include an **"Operator / Deployment Steps"** section in its description listing: new **environment variables** (name · where set — web `.env` / api `.env`·`.env.prod` / `eas.json` / GitHub secret / GitHub variable · required-vs-optional · example or placeholder value); **DB migrations**; **new GitHub secrets/variables**; and any **one-time infra / runner / credential provisioning** the change introduces. If it introduces none, state **"No operator steps"** explicitly. *(This plan adds `GOOGLE_OAUTH_MOBILE_AUDIENCES`, `VPT_E2E_BACKEND_TOKEN`, `E2E_MODE` and the `device_tokens` migration — all must appear in the operator section.)*

- **Package manager:** `pnpm@9.12.1`; **single root `pnpm-lock.yaml`**. Python deps via `uv` (root `pyproject.toml`). Do NOT add a `google-auth` dependency — use `authlib` (already pinned `authlib>=1.6.12`) for Google JWKS verification.
- **Verify gate:** `pnpm verify` must stay green (install `--frozen-lockfile` + `uv sync --extra dev` → build → lint → typecheck → test:coverage → audit). Run `pnpm sonar:verify` before opening a PR (coverage-path + security check).
- **Coverage gate: 95%** for BOTH `api` and `worker` (`pytest --cov --cov-fail-under=95`). `apps/api/app/models/**` is omitted from coverage.py but is in `sonar.coverage.exclusions` — a NEW model file MUST stay in sync between the two (see root `CLAUDE.md` SonarCloud section). Use `# pragma: no cover` for Postgres-only branches that can't run under the SQLite test DB.
- **Commit scopes:** `feat(api): …` / `feat(worker): …` (Conventional Commits). **No** `Co-authored-by: Claude` / "Generated with Claude Code" trailers and **no** `https://claude.ai/code/session_…` footer in commits or PR bodies.
- **Structured logging (CWE-117):** log via stdlib `logging` with `extra={"event": "<dotted.name>", ...}`. **Never log raw client input** (no raw `id_token`, no raw `Authorization` header, no raw push token) — log `user_id`, status codes, and event names only. Errors with `exc_info=exc`. SonarCloud's Security Rating gate fails on log injection.
- **Error shape:** the global handler returns RFC 7807 Problem Details JSON. Raise the typed errors in `app/core/errors.py` (`AuthenticationRequired`→401, `AccessDenied`→403, `RateLimitExceeded(retry_after=…)`→429, `BadRequestError`→400). Do NOT hand-roll `HTTPException` for these.
- **Auth-bridge contract (authoritative — from the index "Discovered During Foundation Drafting" section and P2's `apps/mobile/lib/auth/contract.ts`):**
  ```
  POST /v1/auth/mobile-token   body: { "id_token": "<Google ID token (JWT)>" }
  200 → { "access_token": "<JWT>", "refresh_token": "<JWT>",
          "user": { "id": "<uuid>", "email": "<str>", "email_notifications_enabled": <bool> } }
  401 invalid_google_token · 403 access_denied · 429 rate_limited · other → server_error_<status>
  ```
  The endpoint MUST verify `id_token` against `GOOGLE_OAUTH_MOBILE_AUDIENCES`, run `should_allow_sign_in`, upsert the user by `google_sub`, mint via `create_access_token` / `create_refresh_token`, and return the pair **in the body** (NOT `Set-Cookie`). The `user` object field names are exactly `id`, `email`, `email_notifications_enabled` (matches the existing `UserResponse`).
- **Migrations:** Alembic, files in `apps/api/migrations/versions/` named `YYYYMMDD_NNNNNN_<slug>.py`. Chain `down_revision` off the latest head (`008_feature_flags`, file `20260624_000000_feature_flags.py`). Use string revision ids like `009_device_tokens`.
- **No "Trip members"/sharing.** Sign-in is **Google-OAuth only**.

---

## File Structure

**New files (api):**
- `apps/api/app/core/google_verify.py` — `verify_google_id_token(id_token, audiences) -> GoogleIdentity` using `authlib.jose` against a cached Google JWKS. Pure, injectable JWKS for tests.
- `apps/api/app/models/device_token.py` — `DeviceToken` SQLModel table (`device_tokens`).
- `apps/api/app/schemas/device_token.py` — Pydantic request/response models for the registration endpoint.
- `apps/api/app/routers/device_tokens.py` — `POST`/`DELETE /v1/notifications/device-token`.
- `apps/api/migrations/versions/20260625_000000_device_tokens.py` — Alembic migration for the `device_tokens` table.
- Test files: `apps/api/tests/test_google_verify.py`, `apps/api/tests/test_auth_mobile.py` (mobile-token + bearer auth + bearer refresh), `apps/api/tests/test_device_tokens.py`.

**Modified files (api):**
- `apps/api/app/core/config.py` — add `google_oauth_mobile_audiences` setting + `google_oauth_mobile_audiences_list` property.
- `apps/api/app/routers/auth.py` — add Bearer support to `get_current_user`; add `POST /v1/auth/mobile-token`; add body/Bearer support to `POST /v1/auth/refresh`.
- `apps/api/app/middleware/csrf.py` — add `/v1/auth/mobile-token`, `/v1/auth/refresh`, `/v1/notifications/device-token` to `CSRF_EXEMPT_PREFIXES` (Bearer/token machine endpoints, no browser session).
- `apps/api/app/models/__init__.py` — export `DeviceToken`.
- `apps/api/app/main.py` — register the `device_tokens` router.
- `apps/api/tests/conftest.py` — import `DeviceToken` so SQLite metadata creates the table.
- `.env.example` / `.env.prod.example` — add `GOOGLE_OAUTH_MOBILE_AUDIENCES`.

**New files (worker):**
- `apps/worker/worker/clients/expo_push.py` — `ExpoPushClient` (httpx wrapper over `https://exp.host/--/api/v2/push/send`, dry-run when no tokens). NOTE: the worker shares `apps/api`'s `app.*` package on `PYTHONPATH`; this new client lives under `worker/` because it is worker-only.
- Test files: `apps/worker/tests/test_expo_push.py`, additions to `apps/worker/tests/` for the push activity.

**Modified files (worker):**
- `apps/worker/worker/activities/notifications.py` — add `send_push_notification_activity(snapshot_id)` mirroring `evaluate_notifications_activity`'s at-least-once, idempotent semantics.
- `apps/worker/worker/workflows/price_check.py` — call the push activity alongside `evaluate_notifications_activity`.
- `apps/worker/worker/__main__.py` — register the new activity with the Temporal worker.
- `apps/api/app/core/feature_flags.py` — add a `push_notifications` flag to `KNOWN_FLAGS` (shared by api + worker via `PYTHONPATH`).

---

### Task 1: Bearer-header support in `get_current_user`

Today `get_current_user` (in `apps/api/app/routers/auth.py`) reads the JWT **only** from the `access_token_cookie` cookie. It is the FastAPI dependency used across `trips.py` / `users.py` (`Depends(get_current_user)`). Mobile sends `Authorization: Bearer <access_token>`. Add a fallback: read the cookie first (web wins), else parse the Bearer header (mobile). Refactor extraction into a helper so it is testable and DRY.

**Files:**
- Modify: `apps/api/app/routers/auth.py:272-310` (the `get_current_user` body), plus add a private `_extract_access_token(request)` helper.
- Test: `apps/api/tests/test_auth_mobile.py` (new).

**Interfaces:**
- Consumes: `CookieNames.ACCESS_TOKEN`, `JWTClaims`, `TokenType`, `settings`, `create_access_token`, `User`, `AuthenticationRequired` (all already imported in `auth.py`).
- Produces:
  - `def _extract_access_token(request: Request) -> str | None` — returns the raw JWT from the `access_token_cookie` cookie if present, else from an `Authorization: Bearer <jwt>` header, else `None`.
  - `get_current_user(request, db)` unchanged signature (`async def -> UserResponse`); resolution order is cookie → bearer.

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/test_auth_mobile.py`:
```python
"""Tests for the mobile auth surface: Bearer-header auth, the mobile-token
bridge endpoint, and body/Bearer refresh."""

import uuid
from unittest.mock import AsyncMock

import app.routers.auth as auth_module
import pytest
from app.core.config import settings
from app.core.constants import CookieNames, JWTClaims
from app.core.security import create_access_token
from app.models.user import User
from sqlmodel import select

from tests.test_models import set_test_timestamps


async def _make_user(session) -> User:
    user = User(google_sub=f"sub-{uuid.uuid4().hex}", email=f"{uuid.uuid4().hex}@example.com")
    set_test_timestamps(user)
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


class TestBearerAuth:
    @pytest.mark.asyncio
    async def test_cookie_and_bearer_resolve_same_user(self, client, test_session):
        user = await _make_user(test_session)
        token = create_access_token(data={JWTClaims.SUBJECT: str(user.id)})

        cookie_resp = client.get("/v1/auth/me", cookies={CookieNames.ACCESS_TOKEN: token})
        bearer_resp = client.get("/v1/auth/me", headers={"Authorization": f"Bearer {token}"})

        assert cookie_resp.status_code == 200
        assert bearer_resp.status_code == 200
        assert cookie_resp.json()["id"] == bearer_resp.json()["id"] == str(user.id)

    @pytest.mark.asyncio
    async def test_bad_bearer_token_401s(self, client, test_session):
        resp = client.get("/v1/auth/me", headers={"Authorization": "Bearer not-a-jwt"})
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_missing_both_401s(self, client, test_session):
        resp = client.get("/v1/auth/me")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_non_bearer_authorization_scheme_ignored(self, client, test_session):
        # A `Basic ...` header is not a bearer token → treated as no token → 401.
        resp = client.get("/v1/auth/me", headers={"Authorization": "Basic abc123"})
        assert resp.status_code == 401
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx run api:test -- tests/test_auth_mobile.py::TestBearerAuth -v`
Expected: FAIL — `test_cookie_and_bearer_resolve_same_user` fails (bearer path returns 401 because `get_current_user` only reads the cookie).

- [ ] **Step 3: Implement the Bearer fallback**

In `apps/api/app/routers/auth.py`, add the helper above `get_current_user` (after the existing `_store_refresh_token`):
```python
def _extract_access_token(request: Request) -> str | None:
    """Resolve the access-token JWT from the cookie (web) or, failing that, an
    ``Authorization: Bearer <jwt>`` header (mobile). The cookie wins so the web
    flow is unchanged; the bearer path is additive and backwards-compatible."""
    cookie_token = request.cookies.get(CookieNames.ACCESS_TOKEN)
    if cookie_token:
        return cookie_token
    auth_header = request.headers.get("Authorization")
    if auth_header:
        scheme, _, credential = auth_header.partition(" ")
        if scheme.lower() == "bearer" and credential:
            return credential
    return None
```

Then change the top of `get_current_user` (currently `apps/api/app/routers/auth.py:275-278`) from:
```python
    access_token = request.cookies.get(CookieNames.ACCESS_TOKEN)

    if not access_token:
        raise AuthenticationRequired("Not authenticated")
```
to:
```python
    access_token = _extract_access_token(request)

    if not access_token:
        raise AuthenticationRequired("Not authenticated")
```
(Leave the rest of `get_current_user` — JWT decode, token-type check, user fetch — exactly as is.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx run api:test -- tests/test_auth_mobile.py::TestBearerAuth -v`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/routers/auth.py apps/api/tests/test_auth_mobile.py
git commit -m "feat(api): accept Authorization Bearer in get_current_user"
```

---

### Task 2: Google ID-token verifier

Add a small, dependency-light verifier that validates a Google ID token (signature against Google's published JWKS, issuer, audience, expiry) and returns the identity claims. Uses `authlib.jose` (already a dependency) — do NOT add `google-auth`. The JWKS source is injectable so tests run offline with a locally-generated RSA key.

**Files:**
- Create: `apps/api/app/core/google_verify.py`
- Test: `apps/api/tests/test_google_verify.py`

**Interfaces:**
- Produces:
  - `class GoogleIdentity` (frozen dataclass): `sub: str`, `email: str`, `email_verified: bool`.
  - `class GoogleTokenError(Exception)` — raised on any verification failure (bad signature, wrong aud/iss, expired, missing claims).
  - `def fetch_google_jwks() -> dict` — fetches `https://www.googleapis.com/oauth2/v3/certs` via httpx (module-level cached for the process lifetime).
  - `def verify_google_id_token(id_token: str, audiences: list[str], *, jwks: dict | None = None) -> GoogleIdentity` — verifies and returns identity; `jwks` injectable for tests, defaults to `fetch_google_jwks()`.
- Consumes: nothing from earlier tasks.

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/test_google_verify.py`:
```python
"""Tests for Google ID-token verification (offline, with a locally-minted key)."""

import time

import pytest
from authlib.jose import JsonWebKey, jwt as jose_jwt

from app.core.google_verify import (
    GoogleIdentity,
    GoogleTokenError,
    verify_google_id_token,
)

ISSUER = "https://accounts.google.com"
AUDIENCE = "ios-client-id.apps.googleusercontent.com"


@pytest.fixture
def rsa_key():
    """A local RSA key standing in for Google's signing key."""
    return JsonWebKey.generate_key("RSA", 2048, is_private=True)


@pytest.fixture
def jwks(rsa_key):
    pub = rsa_key.as_dict(is_private=False)
    pub["kid"] = "test-kid"
    return {"keys": [pub]}


def _mint(rsa_key, claims: dict) -> str:
    header = {"alg": "RS256", "kid": "test-kid"}
    return jose_jwt.encode(header, claims, rsa_key).decode("ascii")


def _claims(**overrides) -> dict:
    base = {
        "iss": ISSUER,
        "aud": AUDIENCE,
        "sub": "google-sub-123",
        "email": "user@example.com",
        "email_verified": True,
        "exp": int(time.time()) + 3600,
        "iat": int(time.time()),
    }
    base.update(overrides)
    return base


def test_valid_token_returns_identity(rsa_key, jwks):
    token = _mint(rsa_key, _claims())
    identity = verify_google_id_token(token, [AUDIENCE], jwks=jwks)
    assert isinstance(identity, GoogleIdentity)
    assert identity.sub == "google-sub-123"
    assert identity.email == "user@example.com"
    assert identity.email_verified is True


def test_wrong_audience_rejected(rsa_key, jwks):
    token = _mint(rsa_key, _claims(aud="some-other-client-id"))
    with pytest.raises(GoogleTokenError):
        verify_google_id_token(token, [AUDIENCE], jwks=jwks)


def test_wrong_issuer_rejected(rsa_key, jwks):
    token = _mint(rsa_key, _claims(iss="https://evil.example.com"))
    with pytest.raises(GoogleTokenError):
        verify_google_id_token(token, [AUDIENCE], jwks=jwks)


def test_expired_token_rejected(rsa_key, jwks):
    token = _mint(rsa_key, _claims(exp=int(time.time()) - 10))
    with pytest.raises(GoogleTokenError):
        verify_google_id_token(token, [AUDIENCE], jwks=jwks)


def test_missing_sub_or_email_rejected(rsa_key, jwks):
    token = _mint(rsa_key, _claims(sub=None))
    with pytest.raises(GoogleTokenError):
        verify_google_id_token(token, [AUDIENCE], jwks=jwks)


def test_garbage_token_rejected(jwks):
    with pytest.raises(GoogleTokenError):
        verify_google_id_token("not.a.jwt", [AUDIENCE], jwks=jwks)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx run api:test -- tests/test_google_verify.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.core.google_verify'`.

- [ ] **Step 3: Implement the verifier**

Create `apps/api/app/core/google_verify.py`:
```python
"""Verify Google ID tokens for the mobile auth bridge.

Mobile clients perform Google OAuth natively (Expo AuthSession) and POST the
resulting ID token to ``POST /v1/auth/mobile-token``. This module verifies that
token's signature against Google's published JWKS and checks the standard
claims (issuer, audience, expiry). Uses ``authlib.jose`` (already a project
dependency) so we do not pull in ``google-auth``.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx
from authlib.jose import JsonWebKey, jwt as jose_jwt
from authlib.jose.errors import JoseError

logger = logging.getLogger(__name__)

# Google publishes its OpenID config and JWKS at well-known URLs. The certs
# rotate roughly daily; we cache for the process lifetime and refetch on a
# verification miss (handled by callers reloading the module-level cache).
GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs"
_VALID_ISSUERS = ("https://accounts.google.com", "accounts.google.com")
_FETCH_TIMEOUT_SECONDS = 10.0

_jwks_cache: dict | None = None


class GoogleTokenError(Exception):
    """Raised when a Google ID token fails verification."""


@dataclass(frozen=True)
class GoogleIdentity:
    """The subset of Google ID-token claims the auth bridge needs."""

    sub: str
    email: str
    email_verified: bool


def fetch_google_jwks() -> dict:
    """Fetch (and process-cache) Google's JWKS. Raises GoogleTokenError on failure."""
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache
    try:
        resp = httpx.get(GOOGLE_CERTS_URL, timeout=_FETCH_TIMEOUT_SECONDS)
        resp.raise_for_status()
        _jwks_cache = resp.json()
    except httpx.HTTPError as exc:  # pragma: no cover - network error path
        raise GoogleTokenError("Could not fetch Google JWKS") from exc
    return _jwks_cache


def verify_google_id_token(
    id_token: str,
    audiences: list[str],
    *,
    jwks: dict | None = None,
) -> GoogleIdentity:
    """Verify a Google ID token and return its identity claims.

    ``audiences`` is the list of OAuth client IDs (iOS + Android) allowed to mint
    a token. ``jwks`` is injectable for tests; it defaults to Google's live JWKS.
    Raises GoogleTokenError on any failure (bad signature, wrong aud/iss, expired,
    missing claims). Never logs the raw token (CWE-117).
    """
    key_set = jwks if jwks is not None else fetch_google_jwks()
    claims_options = {
        "iss": {"essential": True, "values": list(_VALID_ISSUERS)},
        "aud": {"essential": True, "values": list(audiences)},
        "exp": {"essential": True},
    }
    try:
        keys = JsonWebKey.import_key_set(key_set)
        claims = jose_jwt.decode(id_token, keys, claims_options=claims_options)
        claims.validate()  # checks exp/iss/aud per claims_options
    except (JoseError, ValueError, KeyError) as exc:
        raise GoogleTokenError("Google ID token verification failed") from exc

    sub = claims.get("sub")
    email = claims.get("email")
    if not sub or not email:
        raise GoogleTokenError("Google ID token missing required claims (sub, email)")

    return GoogleIdentity(
        sub=str(sub),
        email=str(email),
        email_verified=claims.get("email_verified") is True,
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx run api:test -- tests/test_google_verify.py -v`
Expected: PASS (6 passed).

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/core/google_verify.py apps/api/tests/test_google_verify.py
git commit -m "feat(api): add Google ID-token verifier via authlib JWKS"
```

---

### Task 3: `GOOGLE_OAUTH_MOBILE_AUDIENCES` setting + CSRF exemptions

Add the config knob the bridge needs and exempt the new machine endpoints from CSRF (they authenticate via a Bearer token or a signed Google token, with no browser cookie session — the double-submit-cookie defense cannot apply).

**Files:**
- Modify: `apps/api/app/core/config.py:29-30` (after the allowlist fields).
- Modify: `apps/api/app/middleware/csrf.py:22` (`CSRF_EXEMPT_PREFIXES`).
- Test: `apps/api/tests/test_auth_mobile.py` (append `TestSettingsAndCsrf`).

**Interfaces:**
- Produces:
  - `Settings.google_oauth_mobile_audiences: str = ""` (comma-separated raw env value).
  - `Settings.google_oauth_mobile_audiences_list -> list[str]` property (trimmed, non-empty entries).
  - `CSRF_EXEMPT_PREFIXES` now includes `/v1/auth/mobile-token`, `/v1/auth/refresh`, `/v1/notifications/device-token`.

- [ ] **Step 1: Write the failing test**

Append to `apps/api/tests/test_auth_mobile.py`:
```python
class TestSettingsAndCsrf:
    def test_audiences_list_parses_and_trims(self, monkeypatch):
        from app.core.config import Settings

        s = Settings(google_oauth_mobile_audiences=" a.apps.googleusercontent.com , b.apps.googleusercontent.com ,")
        assert s.google_oauth_mobile_audiences_list == [
            "a.apps.googleusercontent.com",
            "b.apps.googleusercontent.com",
        ]

    def test_audiences_list_empty_when_unset(self):
        from app.core.config import Settings

        assert Settings(google_oauth_mobile_audiences="").google_oauth_mobile_audiences_list == []

    def test_mobile_endpoints_are_csrf_exempt(self):
        from app.middleware.csrf import _is_csrf_exempt

        assert _is_csrf_exempt("/v1/auth/mobile-token")
        assert _is_csrf_exempt("/v1/auth/refresh")
        assert _is_csrf_exempt("/v1/notifications/device-token")
        # The web cookie endpoints are NOT exempt.
        assert not _is_csrf_exempt("/v1/auth/logout")
```
*(`Settings` requires `secret_key`, `google_client_id`, `google_client_secret`, `database_url`, `groq_api_key`; the test env loads them from `.env.test`/`.env.example` via the conftest. If `Settings(...)` raises a validation error for missing required fields, the conftest already sets them — these tests run under the same env as the rest of the suite.)*

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx run api:test -- tests/test_auth_mobile.py::TestSettingsAndCsrf -v`
Expected: FAIL — `AttributeError: 'Settings' object has no attribute 'google_oauth_mobile_audiences_list'` and the CSRF assertions fail.

- [ ] **Step 3: Implement the setting and exemptions**

In `apps/api/app/core/config.py`, after the `auth_allowed_domains` field (line 30):
```python
    # Mobile auth bridge: comma-separated Google OAuth client IDs (iOS + Android)
    # that may mint a session via POST /v1/auth/mobile-token. The native app's
    # ID token's `aud` claim must match one of these.
    google_oauth_mobile_audiences: str = ""
```
Then add this property next to `cors_allowed_origins_list` (after line 159):
```python
    @property
    def google_oauth_mobile_audiences_list(self) -> list[str]:
        """Allowed mobile OAuth client IDs (aud) for the mobile-token bridge."""
        raw = self.google_oauth_mobile_audiences
        return [a.strip() for a in raw.split(",") if a.strip()]
```

In `apps/api/app/middleware/csrf.py`, change `CSRF_EXEMPT_PREFIXES` (line 22) from:
```python
CSRF_EXEMPT_PREFIXES = ("/v1/admin/", "/v1/notifications/unsubscribe", "/v1/telemetry/")
```
to:
```python
CSRF_EXEMPT_PREFIXES = (
    "/v1/admin/",
    "/v1/notifications/unsubscribe",
    "/v1/notifications/device-token",
    "/v1/telemetry/",
    # Bearer/token machine endpoints for the mobile app — no browser cookie
    # session, so the double-submit-cookie CSRF defense does not apply.
    "/v1/auth/mobile-token",
    "/v1/auth/refresh",
)
```
*(Note: `/v1/auth/refresh` is also used by the web client today, but the web refresh is a same-site POST that already carried the CSRF token — making it exempt is safe because it authenticates entirely from the refresh-token cookie/body and rotates a Redis-stored token; an attacker without the refresh token cannot abuse it. This change is required so the mobile client, which has no CSRF cookie, can refresh.)*

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx run api:test -- tests/test_auth_mobile.py::TestSettingsAndCsrf -v`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/core/config.py apps/api/app/middleware/csrf.py apps/api/tests/test_auth_mobile.py
git commit -m "feat(api): add mobile OAuth audiences setting and CSRF exemptions"
```

---

### Task 4: `POST /v1/auth/mobile-token` endpoint

The auth bridge. Verify the Google `id_token` against `GOOGLE_OAUTH_MOBILE_AUDIENCES`, run the existing `should_allow_sign_in` allow-list gate, upsert the user by `google_sub`, mint the SAME access/refresh pair the web callback issues, store the refresh token in Redis (rotation parity with web), and return the pair **in the body** with the `user` object. Error map: `401 invalid_google_token` / `403 access_denied` / `429 rate_limited` / config-missing → `500`.

**Files:**
- Modify: `apps/api/app/routers/auth.py` (new imports + new endpoint + a `MobileTokenRequest`/`MobileTokenResponse` Pydantic model).
- Test: `apps/api/tests/test_auth_mobile.py` (append `TestMobileToken`).

**Interfaces:**
- Consumes: `verify_google_id_token` / `GoogleIdentity` / `GoogleTokenError` (Task 2); `settings.google_oauth_mobile_audiences_list` (Task 3); `should_allow_sign_in` / `parse_allowlist`; `create_access_token` / `create_refresh_token`; `_store_refresh_token`; `_build_jwt_data`; `User`; `redis_client` (module-level, mocked in tests); `RateLimitExceeded` / `AccessDenied` from `app.core.errors`; the per-minute rate limiter already runs as middleware — this endpoint reuses it (no per-route Redis limiter needed; the `429 rate_limited` mapping below is satisfied by that middleware which raises `RateLimitExceeded`).
- Produces:
  - `class MobileTokenRequest(BaseModel)`: `id_token: str`.
  - `class MobileTokenResponse(BaseModel)`: `access_token: str`, `refresh_token: str`, `user: UserResponse`.
  - `POST /v1/auth/mobile-token` → `MobileTokenResponse` (200), or 401/403/429/500 problem details.

- [ ] **Step 1: Write the failing test**

Append to `apps/api/tests/test_auth_mobile.py` (add `from unittest.mock import patch` to the imports at the top of the file):
```python
class TestMobileToken:
    @pytest.mark.asyncio
    async def test_new_user_minted_and_returned_in_body(self, client, test_session, monkeypatch):
        monkeypatch.setattr(settings, "google_oauth_mobile_audiences", "aud-1")
        identity = auth_module.GoogleIdentity(
            sub="new-google-sub", email="new@example.com", email_verified=True
        )
        with patch.object(auth_module, "verify_google_id_token", return_value=identity):
            resp = client.post("/v1/auth/mobile-token", json={"id_token": "x" * 30})

        assert resp.status_code == 200
        body = resp.json()
        assert body["access_token"]
        assert body["refresh_token"]
        assert body["user"]["email"] == "new@example.com"
        assert body["user"]["email_notifications_enabled"] is True
        assert uuid.UUID(body["user"]["id"])  # valid uuid
        # The pair is in the BODY, never Set-Cookie.
        assert "set-cookie" not in {k.lower() for k in resp.headers}
        # User row was created.
        created = (
            await test_session.execute(select(User).where(User.google_sub == "new-google-sub"))
        ).scalars().first()
        assert created is not None

    @pytest.mark.asyncio
    async def test_existing_user_reused_no_duplicate(self, client, test_session, monkeypatch):
        monkeypatch.setattr(settings, "google_oauth_mobile_audiences", "aud-1")
        user = User(google_sub="existing-sub", email="existing@example.com")
        set_test_timestamps(user)
        test_session.add(user)
        await test_session.commit()
        await test_session.refresh(user)

        identity = auth_module.GoogleIdentity(
            sub="existing-sub", email="existing@example.com", email_verified=True
        )
        with patch.object(auth_module, "verify_google_id_token", return_value=identity):
            resp = client.post("/v1/auth/mobile-token", json={"id_token": "x" * 30})

        assert resp.status_code == 200
        assert resp.json()["user"]["id"] == str(user.id)
        rows = (
            await test_session.execute(select(User).where(User.google_sub == "existing-sub"))
        ).scalars().all()
        assert len(rows) == 1

    @pytest.mark.asyncio
    async def test_invalid_google_token_401(self, client, monkeypatch):
        monkeypatch.setattr(settings, "google_oauth_mobile_audiences", "aud-1")
        with patch.object(
            auth_module, "verify_google_id_token", side_effect=auth_module.GoogleTokenError("bad")
        ):
            resp = client.post("/v1/auth/mobile-token", json={"id_token": "x" * 30})
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_allowlist_denial_403(self, client, monkeypatch):
        monkeypatch.setattr(settings, "google_oauth_mobile_audiences", "aud-1")
        monkeypatch.setattr(settings, "auth_allowed_domains", "allowed.com")
        identity = auth_module.GoogleIdentity(
            sub="denied-sub", email="denied@notallowed.com", email_verified=True
        )
        with patch.object(auth_module, "verify_google_id_token", return_value=identity):
            resp = client.post("/v1/auth/mobile-token", json={"id_token": "x" * 30})
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_unverified_email_denied_403(self, client, monkeypatch):
        monkeypatch.setattr(settings, "google_oauth_mobile_audiences", "aud-1")
        identity = auth_module.GoogleIdentity(
            sub="unv-sub", email="unverified@example.com", email_verified=False
        )
        with patch.object(auth_module, "verify_google_id_token", return_value=identity):
            resp = client.post("/v1/auth/mobile-token", json={"id_token": "x" * 30})
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_missing_audiences_config_500(self, client, monkeypatch):
        monkeypatch.setattr(settings, "google_oauth_mobile_audiences", "")
        resp = client.post("/v1/auth/mobile-token", json={"id_token": "x" * 30})
        assert resp.status_code == 500
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx run api:test -- tests/test_auth_mobile.py::TestMobileToken -v`
Expected: FAIL — 404 (endpoint not registered) and `AttributeError: module 'app.routers.auth' has no attribute 'GoogleIdentity'`.

- [ ] **Step 3: Implement the endpoint**

In `apps/api/app/routers/auth.py`, replace the existing errors import (currently `from app.core.errors import AuthenticationRequired, BadRequestError`) with the line below and add the Google-verify import:
```python
from app.core.errors import AccessDenied, AppError, AuthenticationRequired, BadRequestError
from app.core.google_verify import GoogleIdentity, GoogleTokenError, verify_google_id_token
```
*(`AccessDenied` and `AppError` are added to the existing errors import; `BadRequestError` stays because the Google callback still uses it. `GoogleIdentity`/`GoogleTokenError`/`verify_google_id_token` are re-exported through `auth_module` so the tests can `patch.object(auth_module, "verify_google_id_token", ...)`. `AppError` is the 500-status base class — `app/core/errors.py:22` sets `status_code = HTTP_500_INTERNAL_SERVER_ERROR` — used for the missing-config branch below.)*

Add the request/response models next to `UserResponse`:
```python
class MobileTokenRequest(BaseModel):
    """Body the native app POSTs: a Google ID token obtained via Expo AuthSession."""

    id_token: str


class MobileTokenResponse(BaseModel):
    """The JWT pair + user, returned in the BODY (never Set-Cookie) for mobile."""

    access_token: str
    refresh_token: str
    user: UserResponse
```

Add the endpoint (place it after `google_auth_callback`, before `refresh_token`):
```python
@router.post("/v1/auth/mobile-token", response_model=MobileTokenResponse)
async def mobile_token(
    payload: MobileTokenRequest,
    db: AsyncSession = Depends(get_db),
) -> MobileTokenResponse:
    """Exchange a Google ID token (from the native app) for the same JWT pair the
    web OAuth callback issues. Returns the pair in the body — the mobile client
    stores it in expo-secure-store and sends `Authorization: Bearer`."""
    audiences = settings.google_oauth_mobile_audiences_list
    if not audiences:
        # Missing config is an operator error, not a client error → 500. AppError
        # is the 500-status base in app/core/errors.py.
        logger.error(
            "mobile-token called but GOOGLE_OAUTH_MOBILE_AUDIENCES is unset",
            extra={"event": "auth.mobile.config_error"},
        )
        raise AppError("Mobile auth is not configured.")

    try:
        identity: GoogleIdentity = verify_google_id_token(payload.id_token, audiences)
    except GoogleTokenError:
        # Never log the raw token (CWE-117); the event name is enough to triage.
        logger.warning(
            "Mobile Google ID token verification failed",
            extra={"event": "auth.mobile.token_invalid"},
        )
        raise AuthenticationRequired("invalid_google_token") from None

    if not should_allow_sign_in(
        email=identity.email,
        email_verified=identity.email_verified,
        emails=parse_allowlist(settings.auth_allowed_emails),
        domains=parse_allowlist(settings.auth_allowed_domains),
    ):
        logger.info(
            "Mobile sign-in denied by allowlist",
            extra={"event": "auth.mobile.denied"},
        )
        raise AccessDenied("access_denied")

    result = await db.execute(select(User).where(User.google_sub == identity.sub))
    user = result.scalars().first()
    if not user:
        user = User(google_sub=identity.sub, email=identity.email)
        db.add(user)
        await db.commit()
        await db.refresh(user)

    jwt_data = _build_jwt_data(user.id)
    access_token = create_access_token(data=jwt_data)
    refresh_token = create_refresh_token(data=jwt_data)
    await _store_refresh_token(user.id, refresh_token)

    logger.info(
        "Mobile sign-in successful",
        extra={"event": "auth.mobile.success", "user_id": str(user.id)},
    )

    return MobileTokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse(
            id=str(user.id),
            email=user.email,
            email_notifications_enabled=user.email_notifications_enabled,
        ),
    )
```
*(Verify the test `test_missing_audiences_config_500` expects 500 — `AppError` maps to `HTTP_500_INTERNAL_SERVER_ERROR` per `app/core/errors.py:22`.)*

Finally, register the endpoint by ensuring the `auth.router` is already included in `main.py` (it is — `apps/api/app/main.py:127`); no router change needed.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx run api:test -- tests/test_auth_mobile.py::TestMobileToken -v`
Expected: PASS (6 passed).

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/routers/auth.py apps/api/tests/test_auth_mobile.py
git commit -m "feat(api): add POST /v1/auth/mobile-token bridge endpoint"
```

---

### Task 5: Bearer/body-capable `POST /v1/auth/refresh`

Today refresh is cookie-in / `Set-Cookie`-out (web). The mobile client has no cookie — it sends the refresh token in the request body and expects the new pair **in the body**. Add a body path while keeping the cookie path identical for web. The mode is detected from where the refresh token came from: if a JSON body with `refresh_token` is present, respond in the body; otherwise respond with cookies (web, unchanged).

**Files:**
- Modify: `apps/api/app/routers/auth.py:146-188` (`refresh_token` endpoint).
- Test: `apps/api/tests/test_auth_mobile.py` (append `TestRefresh`).

**Interfaces:**
- Consumes: `create_access_token` / `create_refresh_token` / `_store_refresh_token` / `_build_jwt_data` / `_set_auth_cookies`; `redis_client` (mocked); `CookieNames`; `JWTClaims`; `MobileTokenResponse` (Task 4, reused as the body shape) / `UserResponse`.
- Produces:
  - `class RefreshRequest(BaseModel)`: `refresh_token: str | None = None`.
  - `POST /v1/auth/refresh` accepts an optional JSON body. Body present + valid → returns `MobileTokenResponse` (200, body). No body → reads the cookie and returns the cookie `Response` (unchanged web behavior). Invalid/rotated token → 401 in both modes.

- [ ] **Step 1: Write the failing test**

Append to `apps/api/tests/test_auth_mobile.py`:
```python
class TestRefresh:
    @pytest.mark.asyncio
    async def test_body_refresh_returns_new_pair_in_body(self, client, test_session, mock_redis):
        from app.core.security import create_refresh_token

        user = await _make_user(test_session)
        rt = create_refresh_token(data={JWTClaims.SUBJECT: str(user.id)})
        # The endpoint checks Redis for the stored refresh token.
        mock_redis.get = AsyncMock(return_value=rt)

        resp = client.post("/v1/auth/refresh", json={"refresh_token": rt})

        assert resp.status_code == 200
        body = resp.json()
        assert body["access_token"]
        assert body["refresh_token"]
        assert body["user"]["id"] == str(user.id)
        assert "set-cookie" not in {k.lower() for k in resp.headers}

    @pytest.mark.asyncio
    async def test_cookie_refresh_still_sets_cookies(self, client, test_session, mock_redis):
        from app.core.constants import CookieNames as CN
        from app.core.security import create_refresh_token

        user = await _make_user(test_session)
        rt = create_refresh_token(data={JWTClaims.SUBJECT: str(user.id)})
        mock_redis.get = AsyncMock(return_value=rt)

        resp = client.post("/v1/auth/refresh", cookies={CN.REFRESH_TOKEN: rt})

        assert resp.status_code == 200
        assert "set-cookie" in {k.lower() for k in resp.headers}

    @pytest.mark.asyncio
    async def test_body_refresh_rotated_token_401(self, client, test_session, mock_redis):
        from app.core.security import create_refresh_token

        user = await _make_user(test_session)
        rt = create_refresh_token(data={JWTClaims.SUBJECT: str(user.id)})
        mock_redis.get = AsyncMock(return_value="a-different-stored-token")

        resp = client.post("/v1/auth/refresh", json={"refresh_token": rt})
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_no_token_anywhere_401(self, client, mock_redis):
        resp = client.post("/v1/auth/refresh")
        assert resp.status_code == 401
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx run api:test -- tests/test_auth_mobile.py::TestRefresh -v`
Expected: FAIL — `test_body_refresh_returns_new_pair_in_body` fails (the current endpoint ignores the body, finds no cookie, and 401s).

- [ ] **Step 3: Implement body/Bearer refresh**

In `apps/api/app/routers/auth.py`, add the request model near the others:
```python
class RefreshRequest(BaseModel):
    """Optional body for the mobile refresh path (web sends the cookie instead)."""

    refresh_token: str | None = None
```

Replace the entire `refresh_token` endpoint (currently lines 146-188) with:
```python
@router.post("/v1/auth/refresh")
async def refresh_token(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Refresh the access token. Web sends the refresh token in the
    ``refresh_token_cookie`` cookie and gets new cookies back; mobile sends it in
    a JSON body (``{"refresh_token": ...}``) and gets the new pair in the body."""
    # Detect the mode: a JSON body with a refresh_token means the mobile path.
    body_token: str | None = None
    try:
        raw = await request.json()
        if isinstance(raw, dict) and isinstance(raw.get("refresh_token"), str):
            body_token = raw["refresh_token"]
    except Exception:  # noqa: BLE001 - no/invalid body is the cookie (web) path
        body_token = None

    refresh_token_value = body_token or request.cookies.get(CookieNames.REFRESH_TOKEN)
    body_mode = body_token is not None

    if not refresh_token_value:
        raise AuthenticationRequired("Refresh token not found.")

    try:
        payload = jwt.decode(
            refresh_token_value,
            settings.secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        user_id = uuid.UUID(payload.get(JWTClaims.SUBJECT))
    except (jwt.PyJWTError, ValueError) as exc:
        raise AuthenticationRequired("Invalid refresh token.") from exc

    stored_token = await redis_client.get(CacheKeys.refresh_token(str(user_id)))
    if stored_token != refresh_token_value:
        raise AuthenticationRequired("Refresh token has been rotated or invalidated.")

    jwt_data = _build_jwt_data(user_id)
    new_access_token = create_access_token(data=jwt_data)
    new_refresh_token = create_refresh_token(data=jwt_data)
    await _store_refresh_token(user_id, new_refresh_token)

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if user:
        logger.info(
            "User token refreshed",
            extra={"event": "auth.token.refresh", "user_id": str(user.id)},
        )

    if body_mode:
        if user is None:  # pragma: no cover - the refresh token's user must exist
            raise AuthenticationRequired("User not found")
        return MobileTokenResponse(
            access_token=new_access_token,
            refresh_token=new_refresh_token,
            user=UserResponse(
                id=str(user.id),
                email=user.email,
                email_notifications_enabled=user.email_notifications_enabled,
            ),
        )

    response = Response("Tokens refreshed.", status_code=200)
    _set_auth_cookies(response, new_access_token, new_refresh_token)
    return response
```
*(The existing structured-log line that interpolated `id=%s email=%s` is replaced with the event-only form to avoid logging PII; functionally identical.)*

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx run api:test -- tests/test_auth_mobile.py::TestRefresh -v`
Expected: PASS (4 passed).

- [ ] **Step 5: Run the full auth suite (regression check) and commit**

Run: `pnpm nx run api:test -- tests/test_auth.py tests/test_auth_mobile.py -v`
Expected: PASS (existing web auth tests still green — cookie refresh, logout, me, callback).

```bash
git add apps/api/app/routers/auth.py apps/api/tests/test_auth_mobile.py
git commit -m "feat(api): accept refresh token in body for mobile clients"
```

---

### Task 6: `DeviceToken` model + migration

A new `device_tokens` table maps a user to one or more Expo push tokens (a user can sign in on multiple devices). Unique on the token so re-registering the same device is an idempotent upsert.

**Files:**
- Create: `apps/api/app/models/device_token.py`
- Create: `apps/api/migrations/versions/20260625_000000_device_tokens.py`
- Modify: `apps/api/app/models/__init__.py` (export `DeviceToken`).
- Modify: `apps/api/tests/conftest.py` (import `DeviceToken` in the `test_engine` fixture so SQLite creates the table).
- Test: `apps/api/tests/test_device_tokens.py` (the model-level assertions; the endpoint tests come in Task 7).

**Interfaces:**
- Produces:
  - `class DeviceToken(SQLModel, table=True)`, `__tablename__ = "device_tokens"`, columns: `id: uuid.UUID` (pk), `user_id: uuid.UUID` (FK `users.id`, `ondelete=CASCADE`, indexed), `expo_push_token: str` (unique, indexed, max_length 255), `platform: str` (max_length 16 — `"ios"`/`"android"`), `created_at: datetime` (server_default now), `updated_at: datetime` (server_default now, onupdate now).
- Consumes: nothing from earlier tasks.

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/test_device_tokens.py`:
```python
"""Tests for the device-token model + registration endpoints."""

import uuid

import pytest
from app.models.device_token import DeviceToken
from app.models.user import User
from sqlalchemy.exc import IntegrityError
from sqlmodel import select

from tests.test_models import set_test_timestamps


async def _user(session) -> User:
    u = User(google_sub=f"sub-{uuid.uuid4().hex}", email=f"{uuid.uuid4().hex}@example.com")
    set_test_timestamps(u)
    session.add(u)
    await session.commit()
    await session.refresh(u)
    return u


class TestDeviceTokenModel:
    @pytest.mark.asyncio
    async def test_can_persist_a_device_token(self, test_session):
        user = await _user(test_session)
        dt = DeviceToken(user_id=user.id, expo_push_token="ExponentPushToken[abc]", platform="ios")
        set_test_timestamps(dt)
        test_session.add(dt)
        await test_session.commit()

        rows = (await test_session.execute(select(DeviceToken))).scalars().all()
        assert len(rows) == 1
        assert rows[0].expo_push_token == "ExponentPushToken[abc]"
        assert rows[0].platform == "ios"

    @pytest.mark.asyncio
    async def test_token_is_unique(self, test_session):
        user = await _user(test_session)
        for _ in range(1):
            dt = DeviceToken(user_id=user.id, expo_push_token="ExponentPushToken[dup]", platform="ios")
            set_test_timestamps(dt)
            test_session.add(dt)
            await test_session.commit()
        dup = DeviceToken(user_id=user.id, expo_push_token="ExponentPushToken[dup]", platform="android")
        set_test_timestamps(dup)
        test_session.add(dup)
        with pytest.raises(IntegrityError):
            await test_session.commit()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx run api:test -- tests/test_device_tokens.py::TestDeviceTokenModel -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.models.device_token'`.

- [ ] **Step 3: Implement the model, exports, conftest import, and migration**

Create `apps/api/app/models/device_token.py`:
```python
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlalchemy.sql import func
from sqlmodel import Field, SQLModel


class DeviceToken(SQLModel, table=True):
    """An Expo push token registered by a user's mobile device.

    A user may have several (one per device). Unique on ``expo_push_token`` so
    re-registering the same device is an idempotent upsert. Rows cascade-delete
    with the user.
    """

    __tablename__ = "device_tokens"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(
        sa_column=Column(
            ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
        )
    )
    expo_push_token: str = Field(
        sa_column=Column(String(255), unique=True, index=True, nullable=False)
    )
    platform: str = Field(sa_column=Column(String(16), nullable=False))

    created_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    )
    updated_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            onupdate=func.now(),
            nullable=False,
        )
    )
```

In `apps/api/app/models/__init__.py`, add the import (alphabetical, after `conversation`) and the `__all__` entry:
```python
from app.models.device_token import DeviceToken
```
and add `"DeviceToken",` to `__all__`.

In `apps/api/tests/conftest.py`, add `DeviceToken` to BOTH the import list and the reference tuple inside `test_engine` (lines 39-61):
```python
    from app.models import (
        Conversation,
        DeviceToken,
        Message,
        NotificationOutbox,
        NotificationRule,
        PriceSnapshot,
        Trip,
        TripFlightPrefs,
        TripHotelPrefs,
        User,
    )

    _ = (
        User,
        Trip,
        TripFlightPrefs,
        TripHotelPrefs,
        PriceSnapshot,
        NotificationRule,
        NotificationOutbox,
        Conversation,
        Message,
        DeviceToken,
    )
```

Create `apps/api/migrations/versions/20260625_000000_device_tokens.py`:
```python
"""Add device_tokens table for mobile Expo push registration.

Revision ID: 009_device_tokens
Revises: 008_feature_flags
Create Date: 2026-06-25 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "009_device_tokens"
down_revision: str | None = "008_feature_flags"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "device_tokens",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("expo_push_token", sa.String(length=255), nullable=False),
        sa.Column("platform", sa.String(length=16), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_device_tokens_user_id", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("expo_push_token", name="uq_device_tokens_expo_push_token"),
    )
    op.create_index("ix_device_tokens_user_id", "device_tokens", ["user_id"])
    op.create_index(
        "ix_device_tokens_expo_push_token", "device_tokens", ["expo_push_token"], unique=True
    )


def downgrade() -> None:
    op.drop_index("ix_device_tokens_expo_push_token", table_name="device_tokens")
    op.drop_index("ix_device_tokens_user_id", table_name="device_tokens")
    op.drop_table("device_tokens")
```
*(Verify `008_feature_flags` is the current head: `grep -n "revision\|down_revision" apps/api/migrations/versions/20260624_000000_feature_flags.py` — its `revision` must be `008_feature_flags`. If the string differs, set `down_revision` to that exact value.)*

**SonarCloud sync:** confirm `apps/api/app/models/**` is in `sonar.coverage.exclusions` (it is — the new model file is covered by that glob, so no `sonar-project.properties` edit is needed). The model is also omitted from coverage.py's `omit` via the `app/models/**` glob — verify with `grep -n "models" pyproject.toml`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx run api:test -- tests/test_device_tokens.py::TestDeviceTokenModel -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Verify the migration applies, then commit**

Run (against the dev Docker DB, which is up per root `CLAUDE.md`):
`docker exec api alembic upgrade head && docker exec api alembic downgrade -1 && docker exec api alembic upgrade head`
Expected: upgrade → downgrade → upgrade all succeed with no error; `docker exec db psql -U postgres -d vacation_tracker -c "\d device_tokens"` shows the table.

```bash
git add apps/api/app/models/device_token.py apps/api/app/models/__init__.py apps/api/tests/conftest.py apps/api/tests/test_device_tokens.py apps/api/migrations/versions/20260625_000000_device_tokens.py
git commit -m "feat(api): add device_tokens model and migration"
```

---

### Task 7: Device-token registration endpoints

`POST /v1/notifications/device-token` upserts the caller's Expo push token (register on sign-in / token refresh); `DELETE /v1/notifications/device-token` removes it (unregister on sign-out). Both require auth (`Depends(get_current_user)` — now Bearer-capable from Task 1) and are scoped to the authenticated user.

**Files:**
- Create: `apps/api/app/schemas/device_token.py`
- Create: `apps/api/app/routers/device_tokens.py`
- Modify: `apps/api/app/main.py` (register the router).
- Test: `apps/api/tests/test_device_tokens.py` (append `TestDeviceTokenEndpoints`).

**Interfaces:**
- Consumes: `get_current_user` / `UserResponse` (from `app.routers.auth`); `get_db`; `DeviceToken` (Task 6).
- Produces:
  - `class DeviceTokenRegister(BaseModel)`: `expo_push_token: str`, `platform: str`.
  - `class DeviceTokenResponse(BaseModel)`: `expo_push_token: str`, `platform: str`.
  - `POST /v1/notifications/device-token` → `DeviceTokenResponse` (200, upsert).
  - `DELETE /v1/notifications/device-token` → 204 (idempotent — deleting a non-existent token is a no-op success).
  - `router` (FastAPI `APIRouter`, `prefix="/v1/notifications"`, `tags=["notifications"]`).

- [ ] **Step 1: Write the failing test**

Append to `apps/api/tests/test_device_tokens.py` (add imports `from app.core.constants import JWTClaims` and `from app.core.security import create_access_token` at the top):
```python
def _auth(user) -> dict:
    token = create_access_token(data={JWTClaims.SUBJECT: str(user.id)})
    return {"Authorization": f"Bearer {token}"}


class TestDeviceTokenEndpoints:
    @pytest.mark.asyncio
    async def test_register_creates_token(self, client, test_session):
        user = await _user(test_session)
        resp = client.post(
            "/v1/notifications/device-token",
            headers=_auth(user),
            json={"expo_push_token": "ExponentPushToken[reg1]", "platform": "ios"},
        )
        assert resp.status_code == 200
        assert resp.json()["expo_push_token"] == "ExponentPushToken[reg1]"
        rows = (await test_session.execute(select(DeviceToken))).scalars().all()
        assert len(rows) == 1
        assert rows[0].user_id == user.id

    @pytest.mark.asyncio
    async def test_register_is_idempotent_upsert(self, client, test_session):
        user = await _user(test_session)
        body = {"expo_push_token": "ExponentPushToken[same]", "platform": "ios"}
        client.post("/v1/notifications/device-token", headers=_auth(user), json=body)
        # Re-register the same token (e.g. platform corrected to android).
        body2 = {"expo_push_token": "ExponentPushToken[same]", "platform": "android"}
        resp = client.post("/v1/notifications/device-token", headers=_auth(user), json=body2)
        assert resp.status_code == 200
        rows = (await test_session.execute(select(DeviceToken))).scalars().all()
        assert len(rows) == 1
        assert rows[0].platform == "android"

    @pytest.mark.asyncio
    async def test_delete_removes_token(self, client, test_session):
        user = await _user(test_session)
        body = {"expo_push_token": "ExponentPushToken[del]", "platform": "ios"}
        client.post("/v1/notifications/device-token", headers=_auth(user), json=body)
        resp = client.request(
            "DELETE",
            "/v1/notifications/device-token",
            headers=_auth(user),
            json={"expo_push_token": "ExponentPushToken[del]", "platform": "ios"},
        )
        assert resp.status_code == 204
        rows = (await test_session.execute(select(DeviceToken))).scalars().all()
        assert rows == []

    @pytest.mark.asyncio
    async def test_delete_nonexistent_is_noop_204(self, client, test_session):
        user = await _user(test_session)
        resp = client.request(
            "DELETE",
            "/v1/notifications/device-token",
            headers=_auth(user),
            json={"expo_push_token": "ExponentPushToken[never]", "platform": "ios"},
        )
        assert resp.status_code == 204

    @pytest.mark.asyncio
    async def test_register_requires_auth(self, client, test_session):
        resp = client.post(
            "/v1/notifications/device-token",
            json={"expo_push_token": "ExponentPushToken[x]", "platform": "ios"},
        )
        assert resp.status_code == 401
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx run api:test -- tests/test_device_tokens.py::TestDeviceTokenEndpoints -v`
Expected: FAIL — 404 (router not registered).

- [ ] **Step 3: Implement the schemas, router, and registration**

Create `apps/api/app/schemas/device_token.py`:
```python
"""Request/response models for the mobile device-token registration endpoint."""

from pydantic import BaseModel


class DeviceTokenRegister(BaseModel):
    """Register/unregister payload: the Expo push token + originating platform."""

    expo_push_token: str
    platform: str


class DeviceTokenResponse(BaseModel):
    """The registered token (echoed back to confirm the upsert)."""

    expo_push_token: str
    platform: str
```

Create `apps/api/app/routers/device_tokens.py`:
```python
"""Mobile push device-token registration (Expo push tokens).

The native app registers its Expo push token after sign-in and on token
rotation, and unregisters on sign-out. Tokens are scoped to the authenticated
user and unique per device (upsert on conflict). The worker reads this table to
deliver price-drop push notifications.
"""

import logging
import uuid

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.db.deps import get_db
from app.models.device_token import DeviceToken
from app.routers.auth import UserResponse, get_current_user
from app.schemas.device_token import DeviceTokenRegister, DeviceTokenResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/notifications", tags=["notifications"])


@router.post("/device-token", response_model=DeviceTokenResponse)
async def register_device_token(
    payload: DeviceTokenRegister,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
) -> DeviceTokenResponse:
    """Register (or upsert) the caller's Expo push token for this device."""
    user_id = uuid.UUID(current_user.id)
    existing = (
        await db.execute(
            select(DeviceToken).where(DeviceToken.expo_push_token == payload.expo_push_token)
        )
    ).scalars().first()

    if existing is None:
        db.add(
            DeviceToken(
                user_id=user_id,
                expo_push_token=payload.expo_push_token,
                platform=payload.platform,
            )
        )
    else:
        # Re-registration: reassign to the current user and refresh the platform.
        existing.user_id = user_id
        existing.platform = payload.platform
        db.add(existing)
    await db.commit()

    logger.info(
        "Registered device token",
        extra={"event": "notifications.device_token.register", "user_id": current_user.id},
    )
    return DeviceTokenResponse(
        expo_push_token=payload.expo_push_token, platform=payload.platform
    )


@router.delete("/device-token", status_code=status.HTTP_204_NO_CONTENT)
async def unregister_device_token(
    payload: DeviceTokenRegister,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
) -> Response:
    """Unregister a device token on sign-out. Idempotent (no-op if absent)."""
    user_id = uuid.UUID(current_user.id)
    await db.execute(
        delete(DeviceToken).where(
            DeviceToken.expo_push_token == payload.expo_push_token,
            DeviceToken.user_id == user_id,
        )
    )
    await db.commit()
    logger.info(
        "Unregistered device token",
        extra={"event": "notifications.device_token.unregister", "user_id": current_user.id},
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
```

In `apps/api/app/main.py`, add `device_tokens` to the router import (line 37) and register it after the existing `notifications` router (line 131):
```python
from app.routers import admin, auth, chat, device_tokens, notifications, sse, telemetry, trips, users
```
```python
app.include_router(notifications.router)
app.include_router(device_tokens.router)
```
*(Both routers share the `/v1/notifications` prefix; FastAPI merges them fine since the paths differ — `unsubscribe` vs `device-token`.)*

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx run api:test -- tests/test_device_tokens.py -v`
Expected: PASS (model tests + 5 endpoint tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/schemas/device_token.py apps/api/app/routers/device_tokens.py apps/api/app/main.py apps/api/tests/test_device_tokens.py
git commit -m "feat(api): add device-token register/unregister endpoints"
```

---

### Task 8: `push_notifications` feature flag

Mirror the existing `email_notifications` gate so push can be enabled/disabled at runtime (DB `feature_flags` table, no redeploy), shared by api + worker via `PYTHONPATH`. This lands before the worker activity so the activity can gate on it.

**Files:**
- Modify: `apps/api/app/core/feature_flags.py` (add the flag to `FeatureFlags` + `KNOWN_FLAGS`).
- Test: `apps/api/tests/test_feature_flags.py` (append a case).

**Interfaces:**
- Produces: `FeatureFlags.PUSH_NOTIFICATIONS = "push_notifications"`; a new `FeatureFlagSpec` in `KNOWN_FLAGS` (default `False`).
- Consumes: nothing from earlier tasks.

- [ ] **Step 1: Write the failing test**

Append to `apps/api/tests/test_feature_flags.py`:
```python
@pytest.mark.asyncio
async def test_push_notifications_flag_registered(test_session):
    from app.core.feature_flags import FeatureFlags, list_feature_flags

    names = {f["name"] for f in await list_feature_flags(test_session)}
    assert FeatureFlags.PUSH_NOTIFICATIONS in names
    assert FeatureFlags.PUSH_NOTIFICATIONS == "push_notifications"
```
*(If `test_feature_flags.py` lacks `import pytest`, add it.)*

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx run api:test -- tests/test_feature_flags.py::test_push_notifications_flag_registered -v`
Expected: FAIL — `AttributeError: type object 'FeatureFlags' has no attribute 'PUSH_NOTIFICATIONS'`.

- [ ] **Step 3: Add the flag**

In `apps/api/app/core/feature_flags.py`, add to the `FeatureFlags` class:
```python
    PUSH_NOTIFICATIONS = "push_notifications"
```
and add to `KNOWN_FLAGS` (after the `SMS_NOTIFICATIONS` spec):
```python
    FeatureFlagSpec(
        FeatureFlags.PUSH_NOTIFICATIONS,
        "Send Expo push notifications to mobile devices on price drops.",
        False,
    ),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx run api:test -- tests/test_feature_flags.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/core/feature_flags.py apps/api/tests/test_feature_flags.py
git commit -m "feat(api): add push_notifications feature flag"
```

---

### Task 9: Expo push client (worker)

A thin async httpx wrapper over Expo's push API (`https://exp.host/--/api/v2/push/send`), mirroring `apps/api/app/clients/email.py`'s `ResendClient` shape (dry-run fallback, typed errors). Worker-only, lives under `apps/worker/worker/clients/`.

**Files:**
- Create: `apps/worker/worker/clients/__init__.py` (if it doesn't exist).
- Create: `apps/worker/worker/clients/expo_push.py`
- Test: `apps/worker/tests/test_expo_push.py`

**Interfaces:**
- Produces:
  - `EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"`.
  - `class ExpoPushError(Exception)`.
  - `class ExpoPushMessage(TypedDict)`: `to: str`, `title: str`, `body: str`, `data: dict`.
  - `class ExpoPushClient`: `async def send(self, messages: list[ExpoPushMessage]) -> list[dict]` — POSTs the batch, raises `ExpoPushError` on transport/HTTP failure, returns Expo's per-message tickets (`data` array). Empty `messages` → returns `[]` without a network call.
- Consumes: nothing from earlier tasks.

- [ ] **Step 1: Write the failing test**

Create `apps/worker/tests/test_expo_push.py`:
```python
"""Tests for the Expo push client (HTTP mocked)."""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from worker.clients.expo_push import (
    EXPO_PUSH_URL,
    ExpoPushClient,
    ExpoPushError,
)


@pytest.mark.asyncio
async def test_send_posts_batch_and_returns_tickets():
    captured = {}

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"data": [{"status": "ok", "id": "ticket-1"}]}

    async def fake_post(url, json, **kwargs):
        captured["url"] = url
        captured["json"] = json
        return FakeResponse()

    fake_client = MagicMock()
    fake_client.post = AsyncMock(side_effect=fake_post)
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=False)

    with patch("worker.clients.expo_push.httpx.AsyncClient", return_value=fake_client):
        tickets = await ExpoPushClient().send(
            [{"to": "ExponentPushToken[a]", "title": "Price drop", "body": "Now $680", "data": {"trip_id": "t1"}}]
        )

    assert captured["url"] == EXPO_PUSH_URL
    assert captured["json"][0]["to"] == "ExponentPushToken[a]"
    assert tickets == [{"status": "ok", "id": "ticket-1"}]


@pytest.mark.asyncio
async def test_send_empty_is_noop():
    tickets = await ExpoPushClient().send([])
    assert tickets == []


@pytest.mark.asyncio
async def test_send_http_error_raises():
    fake_client = MagicMock()
    fake_client.post = AsyncMock(side_effect=httpx.ConnectError("boom"))
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=False)

    with patch("worker.clients.expo_push.httpx.AsyncClient", return_value=fake_client):
        with pytest.raises(ExpoPushError):
            await ExpoPushClient().send(
                [{"to": "ExponentPushToken[a]", "title": "x", "body": "y", "data": {}}]
            )
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx run worker:test -- tests/test_expo_push.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'worker.clients.expo_push'`.

- [ ] **Step 3: Implement the client**

Create `apps/worker/worker/clients/__init__.py` (empty file) if absent.

Create `apps/worker/worker/clients/expo_push.py`:
```python
"""Expo push-notification client.

A thin async wrapper over Expo's push API
(https://docs.expo.dev/push-notifications/sending-notifications/) built on
``httpx`` — the same transport the API's Resend client uses. Expo's endpoint is
unauthenticated for tokens minted by the project; it accepts a JSON array of
messages and returns a ``data`` array of per-message tickets.
"""

import logging
from typing import TypedDict

import httpx

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
DEFAULT_TIMEOUT_SECONDS = 15.0


class ExpoPushError(Exception):
    """Raised when Expo rejects a push send or the request fails."""


class ExpoPushMessage(TypedDict):
    to: str
    title: str
    body: str
    data: dict


class ExpoPushClient:
    """Sends push notifications via the Expo push service."""

    def __init__(self, timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS) -> None:
        self._timeout = httpx.Timeout(timeout_seconds)

    async def send(self, messages: list[ExpoPushMessage]) -> list[dict]:
        """POST a batch of push messages. Returns Expo's per-message tickets.

        An empty list is a no-op (returns ``[]`` without a network call). Raises
        ``ExpoPushError`` on any transport or HTTP failure.
        """
        if not messages:
            return []
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.post(
                    EXPO_PUSH_URL,
                    json=list(messages),
                    headers={
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                    },
                )
                response.raise_for_status()
                payload = response.json()
        except httpx.HTTPError as exc:
            raise ExpoPushError(f"Expo push request failed: {exc}") from exc
        tickets = payload.get("data", []) if isinstance(payload, dict) else []
        return tickets
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx run worker:test -- tests/test_expo_push.py -v`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add apps/worker/worker/clients/__init__.py apps/worker/worker/clients/expo_push.py apps/worker/tests/test_expo_push.py
git commit -m "feat(worker): add Expo push client"
```

---

### Task 10: Push-send activity + wire into PriceCheckWorkflow

A new Temporal activity `send_push_notification_activity(snapshot_id)` that mirrors `evaluate_notifications_activity`'s at-least-once, idempotent semantics: gated on the `push_notifications` flag, evaluates the same threshold/drop logic against the snapshot, looks up the user's device tokens, and sends one Expo push per device. It is wired into `PriceCheckWorkflow` alongside the existing notification eval. To keep the push decision idempotent and independent of the email outbox dedup state, it reuses the **same** drop/threshold computation but is keyed on `(snapshot_id)` re-evaluation — it does not write the email outbox row, it only sends push. The push dedup uses the same `NotificationRule.last_notified_*` re-arm state already maintained by `evaluate_notifications_activity`, so push fires for the same snapshots that enqueue an email row.

> **Design note (idempotency):** `evaluate_notifications_activity` already runs first in the workflow and updates `rule.last_notified_price`. Rather than duplicate that mutation (which would double-advance the dedup marker), `send_push_notification_activity` reads whether an outbox row was enqueued for this snapshot — if `NotificationOutbox` has a row for `snapshot_id`, the threshold was crossed and push should fire. This makes push a pure read of the decision the eval activity already committed, so it is naturally idempotent on `snapshot_id` and never advances dedup state itself.

**Files:**
- Modify: `apps/worker/worker/activities/notifications.py` (add the activity + imports).
- Modify: `apps/worker/worker/workflows/price_check.py` (call it after eval).
- Modify: `apps/worker/worker/__main__.py` (register the activity).
- Test: `apps/worker/tests/test_push_activity.py` (new).

**Interfaces:**
- Consumes: `ExpoPushClient` / `ExpoPushError` / `ExpoPushMessage` (Task 9); `is_feature_enabled` / `FeatureFlags.PUSH_NOTIFICATIONS` (Task 8); `DeviceToken` (Task 6); `NotificationOutbox`, `PriceSnapshot`, `Trip`, `AsyncSessionLocal`.
- Produces:
  - `@activity.defn async def send_push_notification_activity(snapshot_id: str) -> int` — returns the number of push messages sent (0 when the flag is off, no outbox row exists, or the user has no devices). Idempotent on `snapshot_id`.

- [ ] **Step 1: Write the failing test**

Create `apps/worker/tests/test_push_activity.py`:
```python
"""Tests for the Expo push-send activity. The DB and Expo HTTP are both faked."""

import uuid
from decimal import Decimal
from unittest.mock import AsyncMock, patch

import pytest

from worker.activities import notifications as notif


class _FakeSession:
    """Minimal async-session stand-in returning scripted rows."""

    def __init__(self, *, outbox_row, device_tokens, trip):
        self._outbox_row = outbox_row
        self._device_tokens = device_tokens
        self._trip = trip
        self.entered = False

    async def __aenter__(self):
        self.entered = True
        return self

    async def __aexit__(self, *exc):
        return False


@pytest.mark.asyncio
async def test_no_push_when_flag_disabled():
    with patch.object(notif, "is_feature_enabled", AsyncMock(return_value=False)):
        with patch.object(notif, "AsyncSessionLocal") as session_factory:
            session_factory.return_value = _FakeSession(outbox_row=None, device_tokens=[], trip=None)
            sent = await notif.send_push_notification_activity(str(uuid.uuid4()))
    assert sent == 0


@pytest.mark.asyncio
async def test_sends_one_push_per_device_when_outbox_row_exists(monkeypatch):
    snapshot_id = uuid.uuid4()
    user_id = uuid.uuid4()
    trip_id = uuid.uuid4()

    # Build the rows the activity reads.
    outbox = notif.NotificationOutbox(
        user_id=user_id, trip_id=trip_id, snapshot_id=snapshot_id,
        new_price=Decimal("680.00"),
    )
    trip = notif.Trip(id=trip_id, user_id=user_id, name="Maui")  # name used in the push body
    devices = [
        notif.DeviceToken(user_id=user_id, expo_push_token="ExponentPushToken[a]", platform="ios"),
        notif.DeviceToken(user_id=user_id, expo_push_token="ExponentPushToken[b]", platform="android"),
    ]

    sent_messages = {}

    async def fake_send(self, messages):
        sent_messages["messages"] = messages
        return [{"status": "ok"} for _ in messages]

    # Patch the activity's data access to return our scripted rows.
    with patch.object(notif, "is_feature_enabled", AsyncMock(return_value=True)), \
         patch.object(notif, "_load_push_context", AsyncMock(return_value=(outbox, trip, devices))), \
         patch.object(notif.ExpoPushClient, "send", fake_send):
        sent = await notif.send_push_notification_activity(str(snapshot_id))

    assert sent == 2
    tokens = {m["to"] for m in sent_messages["messages"]}
    assert tokens == {"ExponentPushToken[a]", "ExponentPushToken[b]"}
    assert all("Maui" in m["body"] or "Maui" in m["title"] for m in sent_messages["messages"])


@pytest.mark.asyncio
async def test_no_push_when_no_outbox_row():
    with patch.object(notif, "is_feature_enabled", AsyncMock(return_value=True)), \
         patch.object(notif, "_load_push_context", AsyncMock(return_value=(None, None, []))):
        sent = await notif.send_push_notification_activity(str(uuid.uuid4()))
    assert sent == 0


@pytest.mark.asyncio
async def test_no_push_when_user_has_no_devices():
    outbox = notif.NotificationOutbox(
        user_id=uuid.uuid4(), trip_id=uuid.uuid4(), snapshot_id=uuid.uuid4(),
        new_price=Decimal("680.00"),
    )
    trip = notif.Trip(id=outbox.trip_id, user_id=outbox.user_id, name="Maui")
    with patch.object(notif, "is_feature_enabled", AsyncMock(return_value=True)), \
         patch.object(notif, "_load_push_context", AsyncMock(return_value=(outbox, trip, []))):
        sent = await notif.send_push_notification_activity(str(outbox.snapshot_id))
    assert sent == 0


@pytest.mark.asyncio
async def test_expo_error_is_swallowed_returns_zero():
    outbox = notif.NotificationOutbox(
        user_id=uuid.uuid4(), trip_id=uuid.uuid4(), snapshot_id=uuid.uuid4(),
        new_price=Decimal("680.00"),
    )
    trip = notif.Trip(id=outbox.trip_id, user_id=outbox.user_id, name="Maui")
    devices = [notif.DeviceToken(user_id=outbox.user_id, expo_push_token="ExponentPushToken[a]", platform="ios")]

    async def boom(self, messages):
        raise notif.ExpoPushError("network down")

    with patch.object(notif, "is_feature_enabled", AsyncMock(return_value=True)), \
         patch.object(notif, "_load_push_context", AsyncMock(return_value=(outbox, trip, devices))), \
         patch.object(notif.ExpoPushClient, "send", boom):
        sent = await notif.send_push_notification_activity(str(outbox.snapshot_id))
    assert sent == 0  # delivery failure never fails the workflow
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx run worker:test -- tests/test_push_activity.py -v`
Expected: FAIL — `AttributeError: module 'worker.activities.notifications' has no attribute 'send_push_notification_activity'` (and `_load_push_context`, `ExpoPushClient`, `DeviceToken`, `ExpoPushError`).

- [ ] **Step 3: Implement the activity**

In `apps/worker/worker/activities/notifications.py`, add to the imports:
```python
from app.core.feature_flags import FeatureFlags, is_feature_enabled
from app.models.device_token import DeviceToken
from worker.clients.expo_push import ExpoPushClient, ExpoPushError, ExpoPushMessage
```
*(`FeatureFlags`/`is_feature_enabled` are already imported — add `DeviceToken` and the Expo client.)*

Add the data-access helper and the activity (after `evaluate_notifications_activity`):
```python
async def _load_push_context(session, snapshot_uuid: uuid.UUID):
    """Return (outbox_row, trip, device_tokens) for a snapshot, or (None, None, []).

    Push fires for exactly the snapshots that ``evaluate_notifications_activity``
    enqueued an outbox row for — so this is a pure read of the decision that
    activity already committed, keeping push idempotent on snapshot_id without
    advancing any dedup state.
    """
    outbox = (
        await session.execute(
            select(NotificationOutbox).where(NotificationOutbox.snapshot_id == snapshot_uuid)
        )
    ).scalar_one_or_none()
    if outbox is None:
        return None, None, []
    trip = await session.get(Trip, outbox.trip_id)
    devices = (
        await session.execute(
            select(DeviceToken).where(DeviceToken.user_id == outbox.user_id)
        )
    ).scalars().all()
    return outbox, trip, list(devices)


def _format_push(trip_name: str, new_price: Decimal) -> tuple[str, str]:
    """Build the push title + body. Mirrors the digest's 'price dropped' framing."""
    title = "Price drop"
    body = f"{trip_name} is now ${new_price:.0f}. Tap to see the latest prices."
    return title, body


@activity.defn
async def send_push_notification_activity(snapshot_id: str) -> int:
    """Send an Expo push to each of the user's devices when a price-drop outbox
    row exists for this snapshot. Returns the number of messages sent.

    Idempotent on ``snapshot_id`` (reads, never mutates, the dedup state). A
    delivery failure is logged and swallowed (returns 0) so it never fails the
    price-check workflow — the email digest remains the durable channel.
    """
    snapshot_uuid = uuid.UUID(snapshot_id)
    async with AsyncSessionLocal() as session:
        if not await is_feature_enabled(session, FeatureFlags.PUSH_NOTIFICATIONS):
            return 0

        outbox, trip, devices = await _load_push_context(session, snapshot_uuid)
        if outbox is None or trip is None or not devices:
            return 0

        title, body = _format_push(trip.name, outbox.new_price)
        messages: list[ExpoPushMessage] = [
            {
                "to": device.expo_push_token,
                "title": title,
                "body": body,
                "data": {"trip_id": str(trip.id)},
            }
            for device in devices
        ]

    # Network send is outside the DB session (no row writes needed).
    try:
        await ExpoPushClient().send(messages)
    except ExpoPushError as exc:
        logger.error(
            "Expo push send failed",
            exc_info=exc,
            extra={
                "event": "notifications.push.send_failed",
                "trip_id": str(trip.id),
                "device_count": len(messages),
            },
        )
        return 0

    logger.info(
        "Sent push notifications",
        extra={
            "event": "notifications.push.sent",
            "trip_id": str(trip.id),
            "device_count": len(messages),
        },
    )
    return len(messages)
```
*(Note `Trip` and `NotificationOutbox` and `select` are already imported in this module; `Decimal` is too. Confirm `from app.models.trip import Trip` is present — it is, line 27.)*

In `apps/worker/worker/workflows/price_check.py`, extend the passed-through import and call the activity. Change the `with workflow.unsafe.imports_passed_through():` block (lines 18-21) to:
```python
with workflow.unsafe.imports_passed_through():
    # Pulls in the email render/client stack (jinja2/httpx); keep it passed
    # through so the workflow sandbox doesn't re-import those modules.
    from worker.activities.notifications import (
        evaluate_notifications_activity,
        send_push_notification_activity,
    )
```
Then, in the `if snapshot_id:` block (after the `evaluate_notifications_activity` call, line 135), add:
```python
        if snapshot_id:
            await workflow.execute_activity(
                evaluate_notifications_activity,
                snapshot_id,
                start_to_close_timeout=timedelta(seconds=15),
                retry_policy=RetryPolicy(maximum_attempts=3),
            )
            # Fire OS push notifications for the same crossing. Runs after the
            # eval activity (which commits the outbox row push reads from);
            # delivery failures are swallowed inside the activity so push never
            # fails the price-check run.
            await workflow.execute_activity(
                send_push_notification_activity,
                snapshot_id,
                start_to_close_timeout=timedelta(seconds=20),
                retry_policy=RetryPolicy(maximum_attempts=3),
            )
```

In `apps/worker/worker/__main__.py`, register the new activity. Find the `activities=[...]` list passed to the `Worker(...)` constructor and add `send_push_notification_activity` next to `evaluate_notifications_activity` (import it from `worker.activities.notifications` alongside the existing import).
*(Run `grep -n "evaluate_notifications_activity\|activities=" apps/worker/worker/__main__.py` to locate both the import and the registration list; add the new name to both.)*

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx run worker:test -- tests/test_push_activity.py -v`
Expected: PASS (5 passed).

- [ ] **Step 5: Run the full worker suite (regression) and commit**

Run: `pnpm nx run worker:test -v`
Expected: PASS (existing notification + price_check tests still green).

```bash
git add apps/worker/worker/activities/notifications.py apps/worker/worker/workflows/price_check.py apps/worker/worker/__main__.py apps/worker/tests/test_push_activity.py
git commit -m "feat(worker): send Expo push on price-drop crossing"
```

---

### Task 11: `POST /v1/e2e/mint-token` (e2e-only bearer minter)

P4's `mobile-e2e.yml` runs Maestro against an **isolated** `vpt-e2e` backend and needs a bearer JWT for a synthetic e2e user — without doing a real Google OAuth round-trip. This endpoint mints the same `create_access_token` / `create_refresh_token` pair for a configured synthetic user and returns it in the body. **It composes with Task 1's Bearer support:** the minted `access_token` is accepted by `get_current_user` via the `Authorization: Bearer` path, so the e2e harness can authenticate every subsequent request with it.

It is **doubly gated** so it is inert in normal prod: (a) it only does anything when an `E2E_MODE` setting is on, and (b) it requires a shared-secret header matched against `VPT_E2E_BACKEND_TOKEN` (timing-safe). This mirrors the existing `POST /v1/auth/test-login` pattern (`apps/api/app/routers/auth.py:223-269`), which is gated on `ENVIRONMENT=test` — but unlike `test-login` (cookies, test env only), this returns the pair in the body for the dedicated `vpt-e2e` deployment and adds the shared-secret guard so it is safe even though `E2E_MODE` is a deploy-time toggle rather than the hard `test` environment.

**Files:**
- Modify: `apps/api/app/core/config.py` (add `e2e_mode: bool` and `vpt_e2e_backend_token: str` settings).
- Modify: `apps/api/app/routers/auth.py` (new `E2eMintRequest`-free endpoint — it takes no body; reuses `MobileTokenResponse`).
- Modify: `apps/api/app/middleware/csrf.py` (add `/v1/e2e/` to `CSRF_EXEMPT_PREFIXES` — header-secret machine endpoint, no browser session).
- Test: `apps/api/tests/test_auth_mobile.py` (append `TestE2eMintToken`).

**Interfaces:**
- Consumes: `create_access_token` / `create_refresh_token` / `_store_refresh_token` / `_build_jwt_data` (auth.py); `MobileTokenResponse` / `UserResponse` (Task 4); `_extract_access_token` + Bearer `get_current_user` (Task 1, for the round-trip test); `User`; `AccessDenied` / `AuthenticationRequired` / `AppError` (errors); `settings.e2e_mode` / `settings.vpt_e2e_backend_token`.
- Produces:
  - `Settings.e2e_mode: bool = False` and `Settings.vpt_e2e_backend_token: str = ""`.
  - `E2E_SECRET_HEADER = "X-E2E-Token"` (module constant in `auth.py`).
  - `POST /v1/e2e/mint-token` → `MobileTokenResponse` (200). Returns 404 when `e2e_mode` is off (endpoint inert), 403 on missing/blank/mismatched secret header, 500 when `e2e_mode` is on but `vpt_e2e_backend_token` is unset.

- [ ] **Step 1: Write the failing test**

Append to `apps/api/tests/test_auth_mobile.py` (the file already imports `AsyncMock`, `settings`, `JWTClaims`, `CookieNames`, `create_access_token`, `User`, `select`, `uuid`):
```python
import hmac  # add to the top-of-file imports


class TestE2eMintToken:
    SYNTHETIC_EMAIL = "e2e@vpt.test"

    @pytest.mark.asyncio
    async def test_inert_when_e2e_mode_off(self, client, monkeypatch):
        monkeypatch.setattr(settings, "e2e_mode", False)
        monkeypatch.setattr(settings, "vpt_e2e_backend_token", "s3cret-e2e-token")
        resp = client.post("/v1/e2e/mint-token", headers={"X-E2E-Token": "s3cret-e2e-token"})
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_valid_secret_mints_working_bearer(self, client, test_session, monkeypatch):
        monkeypatch.setattr(settings, "e2e_mode", True)
        monkeypatch.setattr(settings, "vpt_e2e_backend_token", "s3cret-e2e-token")

        resp = client.post("/v1/e2e/mint-token", headers={"X-E2E-Token": "s3cret-e2e-token"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["access_token"]
        assert body["refresh_token"]
        assert body["user"]["email"] == self_email := self.SYNTHETIC_EMAIL  # noqa: F841

        # The synthetic user was upserted.
        created = (
            await test_session.execute(select(User).where(User.email == self.SYNTHETIC_EMAIL))
        ).scalars().first()
        assert created is not None

        # The minted access_token authenticates via Task 1's Bearer path.
        me = client.get("/v1/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
        assert me.status_code == 200
        assert me.json()["id"] == body["user"]["id"]

    @pytest.mark.asyncio
    async def test_reuses_existing_synthetic_user(self, client, test_session, monkeypatch):
        monkeypatch.setattr(settings, "e2e_mode", True)
        monkeypatch.setattr(settings, "vpt_e2e_backend_token", "s3cret-e2e-token")

        first = client.post("/v1/e2e/mint-token", headers={"X-E2E-Token": "s3cret-e2e-token"})
        second = client.post("/v1/e2e/mint-token", headers={"X-E2E-Token": "s3cret-e2e-token"})
        assert first.json()["user"]["id"] == second.json()["user"]["id"]
        rows = (
            await test_session.execute(select(User).where(User.email == self.SYNTHETIC_EMAIL))
        ).scalars().all()
        assert len(rows) == 1

    @pytest.mark.asyncio
    async def test_missing_secret_header_403(self, client, monkeypatch):
        monkeypatch.setattr(settings, "e2e_mode", True)
        monkeypatch.setattr(settings, "vpt_e2e_backend_token", "s3cret-e2e-token")
        resp = client.post("/v1/e2e/mint-token")
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_wrong_secret_header_403(self, client, monkeypatch):
        monkeypatch.setattr(settings, "e2e_mode", True)
        monkeypatch.setattr(settings, "vpt_e2e_backend_token", "s3cret-e2e-token")
        resp = client.post("/v1/e2e/mint-token", headers={"X-E2E-Token": "wrong-token"})
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_e2e_mode_on_but_token_unset_500(self, client, monkeypatch):
        monkeypatch.setattr(settings, "e2e_mode", True)
        monkeypatch.setattr(settings, "vpt_e2e_backend_token", "")
        resp = client.post("/v1/e2e/mint-token", headers={"X-E2E-Token": "anything"})
        assert resp.status_code == 500
```
*(The `self_email := ...` walrus in `test_valid_secret_mints_working_bearer` is just an inline assertion that the email equals the constant — keep it as a plain `assert body["user"]["email"] == self.SYNTHETIC_EMAIL` if you prefer; both are equivalent.)*

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx run api:test -- tests/test_auth_mobile.py::TestE2eMintToken -v`
Expected: FAIL — 404 for the valid-secret case too (endpoint not registered) and `AttributeError` on `settings.e2e_mode`.

- [ ] **Step 3: Implement the settings, CSRF exemption, and endpoint**

In `apps/api/app/core/config.py`, after the `admin_query_database_url` field (line 105), add:
```python
    # End-to-end test harness (P4 mobile-e2e). When `e2e_mode` is on (set ONLY on
    # the isolated vpt-e2e deployment), POST /v1/e2e/mint-token issues a bearer
    # JWT for a synthetic user so Maestro can authenticate without real Google
    # OAuth. Guarded by a shared secret matched against vpt_e2e_backend_token.
    # Both default off/blank so the endpoint is inert in normal prod.
    e2e_mode: bool = False
    vpt_e2e_backend_token: str = ""
```

In `apps/api/app/middleware/csrf.py`, add `"/v1/e2e/"` to the `CSRF_EXEMPT_PREFIXES` tuple (it authenticates via the `X-E2E-Token` header, not a browser cookie):
```python
CSRF_EXEMPT_PREFIXES = (
    "/v1/admin/",
    "/v1/notifications/unsubscribe",
    "/v1/notifications/device-token",
    "/v1/telemetry/",
    "/v1/e2e/",
    # Bearer/token machine endpoints for the mobile app — no browser cookie
    # session, so the double-submit-cookie CSRF defense does not apply.
    "/v1/auth/mobile-token",
    "/v1/auth/refresh",
)
```
*(This supersedes the Task 3 form of the tuple — when implementing in order, just add the `"/v1/e2e/"` line.)*

In `apps/api/app/routers/auth.py`, add a `hmac` import at the top (`import hmac`) and a module constant near the top of the file:
```python
E2E_SECRET_HEADER = "X-E2E-Token"
E2E_SYNTHETIC_GOOGLE_SUB = "e2e-user-000"
E2E_SYNTHETIC_EMAIL = "e2e@vpt.test"
```
Add the endpoint (place it after `test_login`, before `get_current_user`):
```python
@router.post("/v1/e2e/mint-token", response_model=MobileTokenResponse)
async def e2e_mint_token(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> MobileTokenResponse:
    """Mint a bearer JWT pair for the synthetic e2e user (P4 mobile-e2e harness).

    Doubly gated: inert (404) unless `E2E_MODE` is on, and requires the shared
    `X-E2E-Token` secret. Returns the pair in the body; the access_token then
    authenticates via the Bearer path in get_current_user (Task 1). Only ever
    enabled on the isolated vpt-e2e backend, never normal prod.
    """
    if not settings.e2e_mode:
        # Endpoint is inert outside e2e — behave as if it does not exist.
        raise NotFoundError("Not found.")

    if not settings.vpt_e2e_backend_token:
        logger.error(
            "e2e mint-token called but VPT_E2E_BACKEND_TOKEN is unset",
            extra={"event": "auth.e2e.config_error"},
        )
        raise AppError("E2E token minting is not configured.")

    provided = request.headers.get(E2E_SECRET_HEADER, "")
    if not provided or not hmac.compare_digest(provided, settings.vpt_e2e_backend_token):
        logger.warning(
            "e2e mint-token rejected: bad or missing secret",
            extra={"event": "auth.e2e.denied"},
        )
        raise AccessDenied("Invalid e2e token.")

    result = await db.execute(select(User).where(User.google_sub == E2E_SYNTHETIC_GOOGLE_SUB))
    user = result.scalars().first()
    if not user:
        user = User(google_sub=E2E_SYNTHETIC_GOOGLE_SUB, email=E2E_SYNTHETIC_EMAIL)
        db.add(user)
        await db.commit()
        await db.refresh(user)

    jwt_data = _build_jwt_data(user.id)
    access_token = create_access_token(data=jwt_data)
    refresh_token = create_refresh_token(data=jwt_data)
    await _store_refresh_token(user.id, refresh_token)

    logger.info(
        "Minted e2e bearer token",
        extra={"event": "auth.e2e.minted", "user_id": str(user.id)},
    )
    return MobileTokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse(
            id=str(user.id),
            email=user.email,
            email_notifications_enabled=user.email_notifications_enabled,
        ),
    )
```
Add `NotFoundError` to the errors import line (it becomes):
```python
from app.core.errors import (
    AccessDenied,
    AppError,
    AuthenticationRequired,
    BadRequestError,
    NotFoundError,
)
```
*(`NotFoundError` is `status_code=404` per `app/core/errors.py:68`. The `auth.router` is already registered in `main.py:127`, so no router change is needed — the new path is just another route on it.)*

Add the env var to **both** templates. In `.env.example`, after the admin-SQL section, add:
```bash
# --- E2E TEST HARNESS (mobile Maestro; isolated vpt-e2e backend ONLY) ---
# Leave E2E_MODE off (and the token blank) on every real deployment. When on,
# POST /v1/e2e/mint-token issues a synthetic-user bearer JWT guarded by this
# shared secret (sent as the X-E2E-Token header by mobile-e2e.yml).
E2E_MODE=false
VPT_E2E_BACKEND_TOKEN=
```
Add the identical block to `.env.prod.example` (commented intent: keep `E2E_MODE=false` in real prod; the `vpt-e2e` deploy overrides it).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx run api:test -- tests/test_auth_mobile.py::TestE2eMintToken -v`
Expected: PASS (6 passed).

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/core/config.py apps/api/app/middleware/csrf.py apps/api/app/routers/auth.py apps/api/tests/test_auth_mobile.py .env.example .env.prod.example
git commit -m "feat(api): add e2e-only mint-token endpoint for mobile-e2e harness"
```

---

### Task 12: Env templates + OpenAPI regeneration + coverage gate

Surface the new env var in both templates, regenerate the OpenAPI schema so P2/P3's generated mobile types pick up the new endpoints, and confirm both 95% coverage gates pass.

**Files:**
- Modify: `.env.example` (after the allowlist section, ~line 46).
- Modify: `.env.prod.example` (the auth section, ~line 25).
- Regenerate: `apps/web/src/lib/api/openapi.json` + `apps/web/src/lib/api/types.ts` (via the web `generate:api-types` script — this is the documented mechanism; P5 only runs it, it does not hand-edit web TS).

**Interfaces:**
- Consumes: the endpoints from Tasks 4, 5, 7, 11 (they appear in the regenerated schema).
- Produces: documented env var + an OpenAPI schema that includes `/v1/auth/mobile-token`, the updated `/v1/auth/refresh`, `/v1/notifications/device-token`, and `/v1/e2e/mint-token`.

- [ ] **Step 1: Add the env var to both templates**

In `.env.example`, after the `AUTH_ALLOWED_DOMAINS=` line (line 46), add:
```bash
# --- MOBILE AUTH BRIDGE (optional; required only if the mobile app is used) ---
# Comma-separated Google OAuth client IDs (iOS + Android) allowed to mint a
# session via POST /v1/auth/mobile-token. The native app's Google ID token must
# carry one of these as its `aud`. Leave blank to disable the mobile bridge
# (the endpoint then returns 500 until configured).
#   GOOGLE_OAUTH_MOBILE_AUDIENCES=ios-id.apps.googleusercontent.com,android-id.apps.googleusercontent.com
GOOGLE_OAUTH_MOBILE_AUDIENCES=
```
Add the identical block to `.env.prod.example` in its `# --- AUTH (GOOGLE OAUTH) ---` section.

- [ ] **Step 2: Regenerate the OpenAPI schema + mobile-facing types**

Run: `cd apps/web && pnpm generate:api-types`
Expected: `apps/web/src/lib/api/openapi.json` and `apps/web/src/lib/api/types.ts` update; `grep -c "mobile-token" apps/web/src/lib/api/openapi.json` returns ≥ 1; `device-token` also present.
*(This edits files under `apps/web/**`, which P1 owns. These are GENERATED artifacts, not hand-authored web code — regenerating them is the documented contract handoff (root `CLAUDE.md` / web `package.json` `generate:api-types`). If running concurrently with P1 causes a merge conflict on these two generated files, regenerate after the merge rather than hand-resolving. Do not touch any other `apps/web` file.)*

- [ ] **Step 3: Run both coverage gates**

Run: `pnpm nx run api:test:coverage`
Expected: PASS, coverage ≥ 95%. If a new line is uncovered, add a test (do NOT lower the gate). The Postgres-only network branches (`fetch_google_jwks` HTTP error, Expo `# pragma` paths) are already marked or are exercised by the offline tests.

Run: `pnpm nx run worker:test:coverage`
Expected: PASS, coverage ≥ 95%.

- [ ] **Step 4: Run the full verify gate**

Run: `pnpm verify`
Expected: install → build → lint → typecheck → test:coverage → audit all green. Then `pnpm sonar:verify` (no token) → coverage-path validator green (confirms the new `device_token.py` model maps correctly and no scanned file is missing from reports).

- [ ] **Step 5: Commit**

```bash
git add .env.example .env.prod.example apps/web/src/lib/api/openapi.json apps/web/src/lib/api/types.ts
git commit -m "feat(api): document mobile audiences env and regenerate OpenAPI"
```

---

## Self-Review

**1. Spec coverage** (every "Discovered During Foundation Drafting" item + the suggested tasks):

| Spec item | Task |
|-----------|------|
| Bearer-header support in `get_current_user` | Task 1 |
| `POST /v1/auth/mobile-token` (verify aud, allow-list, upsert, mint, body response, 401/403/429/500) | Task 4 (Google verify: Task 2; settings/CSRF: Task 3) |
| Bearer/body-capable `POST /v1/auth/refresh` | Task 5 |
| Device-token model + migration + register/unregister endpoints | Tasks 6, 7 |
| Expo push send in worker + wire into price_check | Tasks 9, 10 |
| `push_notifications` feature flag | Task 8 |
| `POST /v1/e2e/mint-token` (e2e-only, gated, shared-secret, body response, composes with Task 1 Bearer) + `E2E_MODE`/`VPT_E2E_BACKEND_TOKEN` settings + env templates | Task 11 |
| `GOOGLE_OAUTH_MOBILE_AUDIENCES` setting + env templates | Tasks 3, 12 |
| OpenAPI regeneration for P2/P3 generated types | Task 12 |
| Exact response shape matches P2 `lib/auth/contract.ts` | Verified below |
| 95% coverage gate (api AND worker) | Task 12 |

**2. Response-shape check vs P2 `apps/mobile/lib/auth/contract.ts`:** P2's `MobileTokenResponse` is `{ access_token: string; refresh_token: string; user: { id: string; email: string; email_notifications_enabled: boolean } }` and its `isMobileTokenResponse` guard requires non-empty `access_token`/`refresh_token`, an object `user`, non-empty `user.id`/`user.email`, and boolean `user.email_notifications_enabled`. Task 4's `MobileTokenResponse(access_token=..., refresh_token=..., user=UserResponse(id, email, email_notifications_enabled))` serializes to exactly that JSON (FastAPI emits snake_case field names verbatim). The error map matches P2's `exchange.ts`: 401→`invalid_google_token`, 403→`access_denied`, 429→`rate_limited`, else→`server_error_<status>`. **Matches byte-for-byte.**

**3. Placeholder scan:** No TODO/TBD/"add error handling" patterns remain; every code step shows complete, runnable code. Task 4 Step 3's missing-config branch raises `AppError(...)` (the 500-status base) inline — there is no deliberate-wrong line for an implementer to copy. Task 11's e2e endpoint shows the full settings, CSRF tuple, and handler implementation with no gaps.

**4. Type consistency:** `_extract_access_token` (Task 1, re-used by Task 11's bearer round-trip) · `verify_google_id_token`/`GoogleIdentity`/`GoogleTokenError` (Task 2, re-referenced in Task 4) · `google_oauth_mobile_audiences_list` (Task 3, used in Task 4) · `MobileTokenResponse`/`UserResponse` (Task 4, reused in Tasks 5 & 11) · `DeviceToken` (Task 6, used in Tasks 7 & 10) · `FeatureFlags.PUSH_NOTIFICATIONS` (Task 8, used in Task 10) · `ExpoPushClient`/`ExpoPushError`/`ExpoPushMessage` (Task 9, used in Task 10) · `_load_push_context`/`send_push_notification_activity` (Task 10, registered in `__main__.py` and called in `price_check.py`) · `E2E_SECRET_HEADER`/`e2e_mode`/`vpt_e2e_backend_token` (Task 11). The `CSRF_EXEMPT_PREFIXES` tuple is defined once in Task 3 and extended once in Task 11 (add `"/v1/e2e/"`) — Task 11 notes it supersedes the Task 3 form. All names are consistent across tasks.

---

## Execution Handoff

This is plan **P5**. Per the orchestration index, implement it with `superpowers:subagent-driven-development` (fresh subagent per task + two-stage review) or `superpowers:executing-plans` (batch with checkpoints). P5 runs in Wave 1 concurrently with P1 and P2 — it shares no files except the two GENERATED OpenAPI artifacts in Task 12 (regenerate post-merge if P1 conflicts). When the work is committed and `pnpm verify` is green, hand off to the `creating-prs` skill (PR title `feat(api): mobile auth bridge, bearer support, and push notifications`).
