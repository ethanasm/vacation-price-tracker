"""Tests for the read-only prod SQL debug endpoint and its query validator.

The endpoint (`POST /v1/admin/sql`) mirrors showbook's `/api/admin/sql`,
adapted to FastAPI + async SQLAlchemy. Defense in depth: bearer token, a
prefix allowlist, a READ ONLY transaction (Postgres engine-level, plus an
always-rollback so nothing a query attempts can persist), a row cap, a
per-statement timeout, and a per-IP rate limit.

These run against the SQLite test session, so the Postgres-specific guards
(`SET TRANSACTION READ ONLY`, `statement_timeout`) are exercised via the
`_classify_db_error` unit tests rather than a live Postgres backend.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

TOKEN = "a" * 40


# ---------------------------------------------------------------------------
# Query validator (pure logic)
# ---------------------------------------------------------------------------
class TestValidateAdminQuery:
    @pytest.mark.parametrize(
        "query,expected",
        [
            ("SELECT 1", "SELECT 1"),
            ("select 1;", "select 1"),
            ("  EXPLAIN SELECT 1  ", "EXPLAIN SELECT 1"),
            ("WITH t AS (SELECT 1) SELECT * FROM t", "WITH t AS (SELECT 1) SELECT * FROM t"),
            ("SHOW timezone", "SHOW timezone"),
        ],
    )
    def test_accepts_read_only_statements(self, query, expected):
        from app.core.admin_query import validate_admin_query

        ok, value = validate_admin_query(query)
        assert ok is True
        assert value == expected

    @pytest.mark.parametrize(
        "query",
        [
            "DELETE FROM users",
            "UPDATE trips SET name = 'x'",
            "INSERT INTO users VALUES (1)",
            "DROP TABLE trips",
            "TRUNCATE users",
        ],
    )
    def test_rejects_write_verbs(self, query):
        from app.core.admin_query import validate_admin_query

        ok, _ = validate_admin_query(query)
        assert ok is False

    def test_rejects_multiple_statements(self):
        from app.core.admin_query import validate_admin_query

        ok, _ = validate_admin_query("SELECT 1; SELECT 2")
        assert ok is False

    @pytest.mark.parametrize("query", ["", "   ", ";", 123, None, {"q": 1}])
    def test_rejects_empty_or_non_string(self, query):
        from app.core.admin_query import validate_admin_query

        ok, _ = validate_admin_query(query)
        assert ok is False


# ---------------------------------------------------------------------------
# DB error classifier (covers the Postgres-only SQLSTATE branches)
# ---------------------------------------------------------------------------
class TestClassifyDbError:
    def _err(self, sqlstate):
        class _Orig:
            pass

        orig = _Orig()
        orig.sqlstate = sqlstate

        class _Wrapped(Exception):
            pass

        exc = _Wrapped("boom")
        exc.orig = orig
        return exc

    def test_timeout_sqlstate(self):
        from app.routers.admin import _classify_db_error

        assert _classify_db_error(self._err("57014")) == "timeout"

    def test_read_only_sqlstate(self):
        from app.routers.admin import _classify_db_error

        assert _classify_db_error(self._err("25006")) == "read_only"
        assert _classify_db_error(self._err("42501")) == "read_only"

    def test_other_error(self):
        from app.routers.admin import _classify_db_error

        assert _classify_db_error(self._err("42P01")) == "error"
        assert _classify_db_error(Exception("no orig")) == "error"


# ---------------------------------------------------------------------------
# Client-IP resolution (header precedence)
# ---------------------------------------------------------------------------
class TestClientIp:
    def _request(self, headers, *, client_host="1.2.3.4"):
        client = SimpleNamespace(host=client_host) if client_host is not None else None
        return SimpleNamespace(headers=headers, client=client)

    def test_prefers_x_forwarded_for(self):
        from app.routers.admin import _client_ip

        req = self._request({"x-forwarded-for": "9.9.9.9, 8.8.8.8"})
        assert _client_ip(req) == "9.9.9.9"

    def test_falls_back_to_x_real_ip(self):
        from app.routers.admin import _client_ip

        req = self._request({"x-real-ip": "  7.7.7.7  "})
        assert _client_ip(req) == "7.7.7.7"

    def test_falls_back_to_client_host(self):
        from app.routers.admin import _client_ip

        assert _client_ip(self._request({}, client_host="5.5.5.5")) == "5.5.5.5"

    def test_anonymous_when_no_client(self):
        from app.routers.admin import _client_ip

        assert _client_ip(self._request({}, client_host=None)) == "anonymous"


# ---------------------------------------------------------------------------
# Admin session factory (lazy engine creation)
# ---------------------------------------------------------------------------
async def test_get_admin_session_creates_and_yields(monkeypatch, tmp_path):
    import app.routers.admin as admin_module
    from app.core.config import settings
    from sqlalchemy.ext.asyncio import AsyncSession

    # A file-backed SQLite URL uses a real connection pool, so the engine's
    # pool_size/max_overflow kwargs are accepted (the :memory: StaticPool isn't).
    db_url = f"sqlite+aiosqlite:///{tmp_path / 'admin.db'}"
    monkeypatch.setattr(settings, "admin_query_database_url", None)
    monkeypatch.setattr(settings, "database_url", db_url)
    monkeypatch.setattr(admin_module, "_admin_sessionmaker", None)

    agen = admin_module.get_admin_session()
    session = await agen.__anext__()
    try:
        assert isinstance(session, AsyncSession)
        # Sessionmaker is memoized after the first call.
        assert admin_module._admin_sessionmaker is not None
        assert admin_module._get_admin_sessionmaker() is admin_module._admin_sessionmaker
    finally:
        await agen.aclose()


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------
@pytest.fixture
def admin_app(app, test_session, mock_redis, monkeypatch):
    """The shared `app` fixture, with the admin token set and the admin DB
    session + redis pointed at the test doubles."""
    import app.routers.admin as admin_module
    from app.core.config import settings

    monkeypatch.setattr(settings, "admin_query_token", TOKEN)
    admin_module.redis_client = mock_redis

    async def override_admin_session():
        yield test_session

    app.dependency_overrides[admin_module.get_admin_session] = override_admin_session
    return app


@pytest.fixture
def admin_client(admin_app):
    return TestClient(admin_app)


def _auth(token=TOKEN):
    return {"Authorization": f"Bearer {token}"}


class TestAdminSqlAuth:
    def test_missing_token_is_unauthorized(self, admin_client):
        resp = admin_client.post("/v1/admin/sql", json={"query": "SELECT 1"})
        assert resp.status_code == 401

    def test_wrong_token_is_unauthorized(self, admin_client):
        resp = admin_client.post(
            "/v1/admin/sql", json={"query": "SELECT 1"}, headers=_auth("wrong")
        )
        assert resp.status_code == 401

    def test_unset_token_disables_endpoint(self, admin_client, monkeypatch):
        from app.core.config import settings

        monkeypatch.setattr(settings, "admin_query_token", "")
        resp = admin_client.post(
            "/v1/admin/sql", json={"query": "SELECT 1"}, headers=_auth()
        )
        assert resp.status_code == 401

    def test_short_token_disables_endpoint(self, admin_client, monkeypatch):
        from app.core.config import settings

        monkeypatch.setattr(settings, "admin_query_token", "tooshort")
        resp = admin_client.post(
            "/v1/admin/sql", json={"query": "SELECT 1"}, headers=_auth("tooshort")
        )
        assert resp.status_code == 401


class TestAdminSqlExecution:
    def test_select_returns_rows(self, admin_client):
        resp = admin_client.post(
            "/v1/admin/sql", json={"query": "SELECT 1 AS n"}, headers=_auth()
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["rows"] == [{"n": 1}]
        assert body["rowCount"] == 1
        assert body["truncated"] is False
        assert "elapsedMs" in body

    def test_write_query_rejected(self, admin_client):
        resp = admin_client.post(
            "/v1/admin/sql", json={"query": "DELETE FROM users"}, headers=_auth()
        )
        assert resp.status_code == 422

    def test_multiple_statements_rejected(self, admin_client):
        resp = admin_client.post(
            "/v1/admin/sql", json={"query": "SELECT 1; SELECT 2"}, headers=_auth()
        )
        assert resp.status_code == 422

    def test_missing_query_field(self, admin_client):
        resp = admin_client.post("/v1/admin/sql", json={"nope": 1}, headers=_auth())
        assert resp.status_code == 422

    def test_non_object_body(self, admin_client):
        resp = admin_client.post("/v1/admin/sql", json=[1, 2, 3], headers=_auth())
        assert resp.status_code == 400

    def test_invalid_json_body(self, admin_client):
        resp = admin_client.post(
            "/v1/admin/sql",
            content="not json",
            headers={**_auth(), "Content-Type": "application/json"},
        )
        assert resp.status_code == 400
        assert resp.json()["error"] == "bad_request"

    def test_invalid_sql_returns_server_error(self, admin_client):
        resp = admin_client.post(
            "/v1/admin/sql",
            json={"query": "SELECT * FROM does_not_exist_table"},
            headers=_auth(),
        )
        assert resp.status_code == 500

    def test_row_cap_truncates(self, admin_client, monkeypatch):
        import app.routers.admin as admin_module

        monkeypatch.setattr(admin_module, "MAX_ROWS", 3)
        # SQLite recursive CTE generating 5 rows
        query = (
            "WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c "
            "WHERE x < 5) SELECT x FROM c"
        )
        resp = admin_client.post("/v1/admin/sql", json={"query": query}, headers=_auth())
        assert resp.status_code == 200
        body = resp.json()
        assert body["rowCount"] == 3
        assert body["truncated"] is True


class TestAdminSqlRateLimit:
    def test_rate_limited(self, admin_client, mock_redis):
        mock_redis.incr = AsyncMock(return_value=999)
        mock_redis.expire = AsyncMock()
        resp = admin_client.post(
            "/v1/admin/sql", json={"query": "SELECT 1"}, headers=_auth()
        )
        assert resp.status_code == 429

    def test_first_request_sets_window_expiry(self, admin_client, mock_redis):
        # count == 1 is the first hit in a fresh window; the limiter sets the TTL.
        mock_redis.incr = AsyncMock(return_value=1)
        mock_redis.expire = AsyncMock()
        resp = admin_client.post(
            "/v1/admin/sql", json={"query": "SELECT 1 AS n"}, headers=_auth()
        )
        assert resp.status_code == 200
        mock_redis.expire.assert_awaited_once()


class TestAdminSqlDbErrors:
    """The DB-error branches (timeout/read-only) via a session whose execute
    raises a wrapped driver error carrying a SQLSTATE."""

    @pytest.fixture
    def app_with_raising_session(self, admin_app):
        import app.routers.admin as admin_module

        def _make(sqlstate):
            class _RaisingSession:
                bind = None  # dialect == "" → skips the Postgres-only guards

                async def execute(self, *args, **kwargs):
                    orig = SimpleNamespace(sqlstate=sqlstate)
                    exc = RuntimeError("boom")
                    exc.orig = orig
                    raise exc

                async def rollback(self):
                    return None

            async def override():
                yield _RaisingSession()

            admin_app.dependency_overrides[admin_module.get_admin_session] = override
            return admin_app

        return _make

    def test_timeout_maps_to_504(self, app_with_raising_session):
        client = TestClient(app_with_raising_session("57014"))
        resp = client.post("/v1/admin/sql", json={"query": "SELECT 1"}, headers=_auth())
        assert resp.status_code == 504
        assert resp.json()["error"] == "timeout"

    def test_read_only_maps_to_422(self, app_with_raising_session):
        client = TestClient(app_with_raising_session("25006"))
        resp = client.post("/v1/admin/sql", json={"query": "SELECT 1"}, headers=_auth())
        assert resp.status_code == 422
        assert resp.json()["error"] == "query_rejected"
