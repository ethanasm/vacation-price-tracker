from __future__ import annotations

from types import SimpleNamespace

import pytest
from worker.activities.price_check import (
    fetch_flights_activity,
    fetch_hotels_activity,
    filter_results_activity,
    load_trip_details,
    save_snapshot_activity,
)
from worker.workflows.price_check import PriceCheckWorkflow
from worker.workflows.refresh_all_trips import RefreshAllTripsWorkflow


@pytest.mark.asyncio
async def test_price_check_workflow_handles_fetch_errors(monkeypatch):
    import worker.workflows.price_check as price_check_module

    trip = {
        "trip_id": "trip-123",
        "flight_prefs": {"airlines": []},
        "hotel_prefs": {"preferred_room_types": [], "preferred_views": []},
    }
    flight_result = {"offers": [{"price": "100"}], "raw": {"ok": True}, "error": None}
    filtered = {"flights": [{"price": "100"}], "hotels": [], "raw_data": {"ok": True}}

    async def fake_execute_activity(activity, *args, **_kwargs):
        if activity is load_trip_details:
            return trip
        if activity is fetch_flights_activity:
            return flight_result
        if activity is fetch_hotels_activity:
            raise ValueError("boom")
        if activity is filter_results_activity:
            payload = args[0]
            assert payload["flight_result"] == flight_result
            assert payload["hotel_result"]["error"] == "boom"
            return filtered
        if activity is save_snapshot_activity:
            return "snapshot-1"
        raise AssertionError("Unexpected activity")

    monkeypatch.setattr(price_check_module.workflow, "execute_activity", fake_execute_activity)

    result = await PriceCheckWorkflow().run("trip-123")

    assert result["success"] is True
    assert result["snapshot_id"] == "snapshot-1"
    assert result["hotel_error"] == "boom"
    assert result["flight_error"] is None


@pytest.mark.asyncio
async def test_refresh_all_trips_workflow(monkeypatch):
    import worker.workflows.refresh_all_trips as refresh_module

    trip_ids = ["trip-1", "trip-2", "trip-3"]
    called_ids: list[str] = []

    async def fake_execute_activity(_activity, *_args, **_kwargs):
        return trip_ids

    async def fake_execute_child_workflow(_name, trip_id, *, id=None):
        called_ids.append(id or "")
        if trip_id == "trip-2":
            raise RuntimeError("fail")
        return {"success": True}

    monkeypatch.setattr(refresh_module.workflow, "execute_activity", fake_execute_activity)
    monkeypatch.setattr(refresh_module.workflow, "execute_child_workflow", fake_execute_child_workflow)
    monkeypatch.setattr(refresh_module.workflow, "info", lambda: SimpleNamespace(run_id="run-1"))

    workflow = RefreshAllTripsWorkflow()
    result = await workflow.run("user-1")

    assert result["total"] == 3
    assert result["successful"] == 2
    assert result["failed"] == 1
    assert all("run-1" in call_id for call_id in called_ids)

    progress = workflow.refresh_progress()
    assert progress["total"] == 3
    assert progress["completed"] == 3
    assert progress["failed"] == 1


@pytest.mark.asyncio
async def test_refresh_all_trips_returns_empty(monkeypatch):
    import worker.workflows.refresh_all_trips as refresh_module

    async def fake_execute_activity(_activity, *_args, **_kwargs):
        return []

    monkeypatch.setattr(refresh_module.workflow, "execute_activity", fake_execute_activity)

    workflow = RefreshAllTripsWorkflow()
    result = await workflow.run("user-2")

    assert result == {"total": 0, "successful": 0, "failed": 0}
