from __future__ import annotations

import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from app.core.constants import NotificationStatus, TripStatus
from app.models.notification_outbox import NotificationOutbox
from app.models.price_snapshot import PriceSnapshot
from app.models.trip import Trip
from app.models.user import User
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel
from worker.activities import health_check as hc

NOW = datetime.now(UTC)


class _FakeRedis:
    def __init__(self, *, ping_ok: bool = True, get_value: str | None = None) -> None:
        self._ping_ok = ping_ok
        self._get_value = get_value

    async def ping(self):
        if not self._ping_ok:
            raise RuntimeError("redis down")
        return True

    async def get(self, _key):
        return self._get_value


class _FakeResend:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    async def send(self, **kwargs):
        self.calls.append(kwargs)
        return {"id": "h1"}


class _BoomResend:
    async def send(self, **_kwargs):
        from app.clients.email import EmailSendError

        raise EmailSendError("resend down")


class _BoomSession:
    async def __aenter__(self):
        raise RuntimeError("db down")

    async def __aexit__(self, *_exc):
        return None


class _RaisingGetRedis:
    async def ping(self):
        return True

    async def get(self, _key):
        raise RuntimeError("redis get boom")


@pytest_asyncio.fixture
async def configured(monkeypatch):
    import app.models  # noqa: F401 - register tables

    engine = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    monkeypatch.setattr(hc, "AsyncSessionLocal", factory)
    monkeypatch.setattr(hc, "redis_client", _FakeRedis())
    # Baseline: Temporal up with a clean last refresh, so individual tests isolate
    # whatever they break. Override _connect_temporal to test the down path.
    monkeypatch.setattr(
        hc,
        "_connect_temporal",
        AsyncMock(
            return_value=_temporal_client(
                recent_actions=[_action()],
                wf_result={"users_total": 1, "users_successful": 1, "users_failed": 0},
            )
        ),
    )
    monkeypatch.setattr(hc.settings, "admin_emails", "ops@example.com")
    monkeypatch.setattr(hc.settings, "axiom_query_token", "")  # error_volume → unknown
    monkeypatch.setattr(hc.settings, "frontend_url", "https://app.test")

    yield factory
    await engine.dispose()


async def _seed(factory, *, snapshots_24h=1, error_trips=0, failed_outbox=0):
    async with factory() as session:
        user = User(email="t@example.com", google_sub=f"s-{uuid.uuid4()}")
        session.add(user)
        await session.flush()
        trip = Trip(
            user_id=user.id,
            name="Trip",
            origin_airport="SFO",
            destination_code="OGG",
            depart_date=datetime(2026, 12, 1).date(),
            status=TripStatus.ACTIVE,
        )
        session.add(trip)
        await session.flush()
        for _ in range(snapshots_24h):
            session.add(PriceSnapshot(trip_id=trip.id, total_price=None, created_at=NOW))
        for _ in range(error_trips):
            session.add(
                Trip(
                    user_id=user.id,
                    name=f"err-{uuid.uuid4()}",
                    origin_airport="SFO",
                    destination_code="OGG",
                    depart_date=datetime(2026, 12, 1).date(),
                    status=TripStatus.ERROR,
                )
            )
        for _ in range(failed_outbox):
            session.add(
                NotificationOutbox(
                    user_id=user.id,
                    trip_id=trip.id,
                    snapshot_id=uuid.uuid4(),
                    new_price=1,
                    status=NotificationStatus.FAILED,
                )
            )
        await session.commit()


@pytest.mark.asyncio
async def test_sends_digest_to_admins(configured, monkeypatch):
    fake = _FakeResend()
    monkeypatch.setattr(hc, "ResendClient", lambda: fake)
    await _seed(configured, snapshots_24h=3)

    result = await hc.run_health_check_activity()

    assert result["sent"] == 1
    assert result["skipped"] is False
    assert len(fake.calls) == 1
    call = fake.calls[0]
    assert call["to"] == ["ops@example.com"]
    assert call["subject"].startswith("[VPT health]")
    assert call["idempotency_key"].startswith("health-summary-")


@pytest.mark.asyncio
async def test_skips_when_no_admins(configured, monkeypatch):
    fake = _FakeResend()
    monkeypatch.setattr(hc, "ResendClient", lambda: fake)
    monkeypatch.setattr(hc.settings, "admin_emails", "")
    await _seed(configured)

    result = await hc.run_health_check_activity()

    assert result["skipped"] is True
    assert result["sent"] == 0
    assert fake.calls == []


@pytest.mark.asyncio
async def test_no_snapshots_is_fail(configured, monkeypatch):
    fake = _FakeResend()
    monkeypatch.setattr(hc, "ResendClient", lambda: fake)
    await _seed(configured, snapshots_24h=0)

    result = await hc.run_health_check_activity()

    assert result["status"] == "fail"
    assert result["sent"] == 1
    assert fake.calls[0]["subject"].startswith("[VPT health] FAIL")


@pytest.mark.asyncio
async def test_email_failure_is_swallowed(configured, monkeypatch):
    monkeypatch.setattr(hc, "ResendClient", lambda: _BoomResend())
    await _seed(configured)

    result = await hc.run_health_check_activity()

    assert result["sent"] == 0
    assert result["skipped"] is False  # attempted, but failed gracefully


@pytest.mark.asyncio
async def test_redis_down_marks_fail(configured, monkeypatch):
    monkeypatch.setattr(hc, "redis_client", _FakeRedis(ping_ok=False))
    monkeypatch.setattr(hc, "ResendClient", lambda: _FakeResend())
    await _seed(configured)

    result = await hc.run_health_check_activity()
    assert result["status"] == "fail"


@pytest.mark.asyncio
async def test_budget_warn_threshold(configured, monkeypatch):
    # 90% of the Groq ceiling → warn (no fail elsewhere if snapshots present).
    monkeypatch.setattr(hc.settings, "global_daily_groq_token_budget", 1000)
    monkeypatch.setattr(hc, "redis_client", _FakeRedis(get_value="900"))
    monkeypatch.setattr(hc, "ResendClient", lambda: _FakeResend())
    await _seed(configured, snapshots_24h=2)

    result = await hc.run_health_check_activity()
    assert result["warn"] >= 1


@pytest.mark.asyncio
async def test_error_volume_check_uses_axiom(configured, monkeypatch):
    monkeypatch.setattr(hc.settings, "axiom_query_token", "tok")
    monkeypatch.setattr(hc.settings, "axiom_org_id", "org")
    monkeypatch.setattr(hc.settings, "axiom_dataset", "ds")
    monkeypatch.setattr(hc, "query_count", AsyncMock(return_value=150))
    monkeypatch.setattr(hc, "ResendClient", lambda: _FakeResend())
    await _seed(configured, snapshots_24h=2)

    result = await hc.run_health_check_activity()
    assert result["status"] == "fail"  # 150 errors ≥ fail threshold


@pytest.mark.asyncio
async def test_error_trips_and_failed_notifications_warn(configured, monkeypatch):
    monkeypatch.setattr(hc, "ResendClient", lambda: _FakeResend())
    await _seed(configured, snapshots_24h=2, error_trips=2, failed_outbox=1)

    result = await hc.run_health_check_activity()
    assert result["status"] == "warn"
    assert result["warn"] >= 2  # failed_trips + notifications


@pytest.mark.asyncio
async def test_budget_fail_when_over_ceiling(configured, monkeypatch):
    monkeypatch.setattr(hc.settings, "global_daily_skiplagged_call_budget", 100)
    monkeypatch.setattr(hc, "redis_client", _FakeRedis(get_value="100"))
    monkeypatch.setattr(hc, "ResendClient", lambda: _FakeResend())
    await _seed(configured, snapshots_24h=2)

    result = await hc.run_health_check_activity()
    assert result["status"] == "fail"


@pytest.mark.asyncio
@pytest.mark.parametrize(("count", "expected"), [(0, "ok"), (5, "warn")])
async def test_error_volume_levels(configured, monkeypatch, count, expected):
    monkeypatch.setattr(hc.settings, "axiom_query_token", "tok")
    monkeypatch.setattr(hc.settings, "axiom_org_id", "org")
    monkeypatch.setattr(hc.settings, "axiom_dataset", "ds")
    monkeypatch.setattr(hc, "query_count", AsyncMock(return_value=count))
    monkeypatch.setattr(hc, "ResendClient", lambda: _FakeResend())
    await _seed(configured, snapshots_24h=2)

    result = await hc.run_health_check_activity()
    statuses = {expected}
    # ok path → overall ok; warn path → overall warn (no other warn/fail expected).
    assert result["status"] in statuses


def _temporal_client(*, recent_actions, wf_status="COMPLETED", wf_result=None):
    sched = SimpleNamespace(info=SimpleNamespace(recent_actions=recent_actions))
    wf = SimpleNamespace(
        describe=AsyncMock(return_value=SimpleNamespace(status=SimpleNamespace(name=wf_status))),
        result=AsyncMock(return_value=wf_result),
    )
    return SimpleNamespace(
        get_schedule_handle=lambda _id: SimpleNamespace(describe=AsyncMock(return_value=sched)),
        get_workflow_handle=lambda *_a, **_k: wf,
    )


def _action():
    return SimpleNamespace(
        action=SimpleNamespace(workflow_id="scheduled-refresh-all-users", first_execution_run_id="r1")
    )


@pytest.mark.asyncio
async def test_refresh_run_no_actions_warn(configured, monkeypatch):
    monkeypatch.setattr(hc, "_connect_temporal", AsyncMock(return_value=_temporal_client(recent_actions=[])))
    monkeypatch.setattr(hc, "ResendClient", lambda: _FakeResend())
    await _seed(configured, snapshots_24h=2)
    result = await hc.run_health_check_activity()
    assert result["status"] == "warn"


@pytest.mark.asyncio
async def test_refresh_run_completed_with_failures_warn(configured, monkeypatch):
    client = _temporal_client(
        recent_actions=[_action()],
        wf_result={"users_total": 3, "users_successful": 2, "users_failed": 1},
    )
    monkeypatch.setattr(hc, "_connect_temporal", AsyncMock(return_value=client))
    monkeypatch.setattr(hc, "ResendClient", lambda: _FakeResend())
    await _seed(configured, snapshots_24h=2)
    result = await hc.run_health_check_activity()
    assert result["status"] == "warn"


@pytest.mark.asyncio
async def test_refresh_run_failed_status_is_fail(configured, monkeypatch):
    client = _temporal_client(recent_actions=[_action()], wf_status="FAILED")
    monkeypatch.setattr(hc, "_connect_temporal", AsyncMock(return_value=client))
    monkeypatch.setattr(hc, "ResendClient", lambda: _FakeResend())
    await _seed(configured, snapshots_24h=2)
    result = await hc.run_health_check_activity()
    assert result["status"] == "fail"


def test_rollup_precedence():
    mk = lambda s: {"name": "x", "status": s, "summary": "", "detail": None}  # noqa: E731
    assert hc._rollup([mk("ok"), mk("fail"), mk("warn")]) == "fail"
    assert hc._rollup([mk("ok"), mk("warn")]) == "warn"
    assert hc._rollup([mk("unknown"), mk("unknown")]) == "unknown"
    assert hc._rollup([mk("ok"), mk("unknown")]) == "ok"


@pytest.mark.asyncio
async def test_refresh_run_running_is_ok(configured, monkeypatch):
    client = _temporal_client(recent_actions=[_action()], wf_status="RUNNING")
    monkeypatch.setattr(hc, "_connect_temporal", AsyncMock(return_value=client))
    monkeypatch.setattr(hc, "ResendClient", lambda: _FakeResend())
    await _seed(configured, snapshots_24h=2)
    assert (await hc.run_health_check_activity())["status"] == "ok"


@pytest.mark.asyncio
async def test_refresh_run_completed_non_dict_result(configured, monkeypatch):
    client = _temporal_client(recent_actions=[_action()], wf_status="COMPLETED", wf_result=None)
    monkeypatch.setattr(hc, "_connect_temporal", AsyncMock(return_value=client))
    monkeypatch.setattr(hc, "ResendClient", lambda: _FakeResend())
    await _seed(configured, snapshots_24h=2)
    assert (await hc.run_health_check_activity())["status"] == "ok"


@pytest.mark.asyncio
async def test_temporal_down_marks_fail_and_refresh_unknown(configured, monkeypatch):
    monkeypatch.setattr(hc, "_connect_temporal", AsyncMock(return_value=None))
    monkeypatch.setattr(hc, "ResendClient", lambda: _FakeResend())
    await _seed(configured, snapshots_24h=2)
    result = await hc.run_health_check_activity()
    assert result["status"] == "fail"  # temporal check fails
    assert result["unknown"] >= 1  # refresh_run + error_volume unknown


@pytest.mark.asyncio
async def test_db_check_errors_handled(configured, monkeypatch):
    monkeypatch.setattr(hc, "AsyncSessionLocal", lambda: _BoomSession())
    monkeypatch.setattr(hc, "ResendClient", lambda: _FakeResend())
    result = await hc.run_health_check_activity()
    assert result["status"] == "fail"  # database/data_freshness/etc. all fail gracefully


@pytest.mark.asyncio
async def test_budget_read_error_is_unknown(configured, monkeypatch):
    monkeypatch.setattr(hc, "redis_client", _RaisingGetRedis())
    monkeypatch.setattr(hc, "ResendClient", lambda: _FakeResend())
    await _seed(configured, snapshots_24h=2)
    result = await hc.run_health_check_activity()
    assert result["unknown"] >= 2  # both budget checks → unknown


@pytest.mark.asyncio
async def test_error_volume_query_failure_is_unknown(configured, monkeypatch):
    monkeypatch.setattr(hc.settings, "axiom_query_token", "tok")
    monkeypatch.setattr(hc.settings, "axiom_org_id", "org")
    monkeypatch.setattr(hc.settings, "axiom_dataset", "ds")
    monkeypatch.setattr(hc, "query_count", AsyncMock(return_value=None))
    monkeypatch.setattr(hc, "ResendClient", lambda: _FakeResend())
    await _seed(configured, snapshots_24h=2)
    result = await hc.run_health_check_activity()
    assert result["unknown"] >= 1


@pytest.mark.asyncio
async def test_connect_temporal_returns_none_on_error(monkeypatch):
    monkeypatch.setattr(hc.Client, "connect", AsyncMock(side_effect=RuntimeError("no temporal")))
    assert await hc._connect_temporal() is None


@pytest.mark.asyncio
async def test_refresh_run_from_temporal_history(configured, monkeypatch):
    # Fake a completed scheduled-refresh run with no failures.
    action = SimpleNamespace(
        action=SimpleNamespace(workflow_id="scheduled-refresh-all-users", first_execution_run_id="r1")
    )
    sched = SimpleNamespace(info=SimpleNamespace(recent_actions=[action]))
    wf = SimpleNamespace(
        describe=AsyncMock(return_value=SimpleNamespace(status=SimpleNamespace(name="COMPLETED"))),
        result=AsyncMock(return_value={"users_total": 3, "users_successful": 3, "users_failed": 0}),
    )
    client = SimpleNamespace(
        get_schedule_handle=lambda _id: SimpleNamespace(describe=AsyncMock(return_value=sched)),
        get_workflow_handle=lambda *_a, **_k: wf,
    )
    monkeypatch.setattr(hc, "_connect_temporal", AsyncMock(return_value=client))
    monkeypatch.setattr(hc, "ResendClient", lambda: _FakeResend())
    await _seed(configured, snapshots_24h=2)

    result = await hc.run_health_check_activity()
    # database/redis/temporal/data_freshness/failed_trips/notifications/budgets/refresh_run ok,
    # error_volume unknown → rollup ok.
    assert result["status"] == "ok"
