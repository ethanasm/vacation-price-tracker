from __future__ import annotations

from types import SimpleNamespace

import pytest
from temporalio.exceptions import ApplicationError
from worker.activities.notifications import evaluate_notifications_activity
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
async def test_price_check_workflow_persists_partial_snapshot_when_one_side_fails(monkeypatch):
    """A partial fetch failure still saves a snapshot from the side that succeeded."""
    import worker.workflows.price_check as price_check_module

    trip = {
        "trip_id": "trip-123",
        "track_flights": True,
        "track_hotels": True,
        "flight_prefs": {"airlines": []},
        "hotel_prefs": {"preferred_room_types": [], "preferred_views": []},
    }
    flight_result = {"offers": [{"price": "100"}], "raw": {"ok": True}, "error": None}
    captured = {}

    async def fake_execute_activity(activity, *args, **_kwargs):
        if activity is load_trip_details:
            return trip
        if activity is fetch_flights_activity:
            return flight_result
        if activity is fetch_hotels_activity:
            raise ValueError("boom")
        if activity is filter_results_activity:
            captured["filter"] = args[0]
            return {"flights": [{"price": "100"}], "hotels": [], "raw_data": {"ok": True}}
        if activity is save_snapshot_activity:
            captured["save"] = args[0]
            return "snapshot-partial"
        if activity is evaluate_notifications_activity:
            captured["evaluate"] = args[0]
            return False
        raise AssertionError("Unexpected activity")

    monkeypatch.setattr(price_check_module.workflow, "execute_activity", fake_execute_activity)

    result = await PriceCheckWorkflow().run("trip-123")

    assert result["success"] is True
    assert result["snapshot_id"] == "snapshot-partial"
    # Flights succeeded; hotels degraded to an empty result carrying the error.
    assert captured["filter"]["flight_result"] == flight_result
    assert captured["filter"]["hotel_result"]["offers"] == []
    assert "boom" in captured["filter"]["hotel_result"]["error"]
    assert result["flight_error"] is None
    assert result["hotel_error"] is not None and "boom" in result["hotel_error"]


@pytest.mark.asyncio
async def test_price_check_workflow_fails_and_skips_snapshot_when_all_fetches_fail(monkeypatch):
    """When every tracked fetch fails, the workflow fails and saves no snapshot."""
    import worker.workflows.price_check as price_check_module

    trip = {
        "trip_id": "trip-123",
        "track_flights": True,
        "track_hotels": True,
        "flight_prefs": {"airlines": []},
        "hotel_prefs": {"preferred_room_types": [], "preferred_views": []},
    }
    save_called = False

    async def fake_execute_activity(activity, *_args, **_kwargs):
        nonlocal save_called
        if activity is load_trip_details:
            return trip
        if activity is fetch_flights_activity:
            raise ValueError("flights-boom")
        if activity is fetch_hotels_activity:
            raise ValueError("hotels-boom")
        if activity is filter_results_activity:
            raise AssertionError("filter_results_activity must not run when all fetches failed")
        if activity is save_snapshot_activity:
            save_called = True
            raise AssertionError("save_snapshot_activity must not run when all fetches failed")
        raise AssertionError("Unexpected activity")

    monkeypatch.setattr(price_check_module.workflow, "execute_activity", fake_execute_activity)

    with pytest.raises(ApplicationError, match="All upstream fetches failed"):
        await PriceCheckWorkflow().run("trip-123")

    assert save_called is False


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


@pytest.mark.asyncio
async def test_price_check_workflow_skips_flights_when_track_flights_false(monkeypatch):
    import worker.workflows.price_check as price_check_module

    trip = {
        "trip_id": "trip-no-flights",
        "track_flights": False,
        "track_hotels": True,
        "flight_prefs": {"airlines": []},
        "hotel_prefs": {"city": "Downtown Orlando", "preferred_room_types": [], "preferred_views": []},
    }
    hotel_result = {"offers": [{"price": "200"}], "raw": {"ok": True}, "error": None}
    filtered = {"flights": [], "hotels": [{"price": "200"}], "raw_data": {"ok": True}}
    hotels_called = 0

    async def fake_execute_activity(activity, *args, **_kwargs):
        nonlocal hotels_called
        if activity is load_trip_details:
            return trip
        if activity is fetch_flights_activity:
            raise AssertionError("fetch_flights_activity should not be called when track_flights=False")
        if activity is fetch_hotels_activity:
            hotels_called += 1
            return hotel_result
        if activity is filter_results_activity:
            payload = args[0]
            # Flights are skipped, so normalized_flight should be the 'skipped' sentinel
            assert payload["flight_result"]["raw"].get("status") == "skipped"
            assert payload["hotel_result"] == hotel_result
            return filtered
        if activity is save_snapshot_activity:
            return "snapshot-no-flights"
        if activity is evaluate_notifications_activity:
            return False
        raise AssertionError(f"Unexpected activity: {activity}")

    monkeypatch.setattr(price_check_module.workflow, "execute_activity", fake_execute_activity)

    result = await PriceCheckWorkflow().run("trip-no-flights")

    assert result["success"] is True
    assert result["snapshot_id"] == "snapshot-no-flights"
    assert hotels_called == 1
    assert result["flight_error"] is None


@pytest.mark.asyncio
async def test_price_check_workflow_skips_hotels_when_track_hotels_false(monkeypatch):
    import worker.workflows.price_check as price_check_module

    trip = {
        "trip_id": "trip-no-hotels",
        "track_flights": True,
        "track_hotels": False,
        "flight_prefs": {"airlines": []},
        "hotel_prefs": None,
    }
    flight_result = {"offers": [{"price": "100"}], "raw": {"ok": True}, "error": None}
    filtered = {"flights": [{"price": "100"}], "hotels": [], "raw_data": {"ok": True}}
    flights_called = 0

    async def fake_execute_activity(activity, *args, **_kwargs):
        nonlocal flights_called
        if activity is load_trip_details:
            return trip
        if activity is fetch_flights_activity:
            flights_called += 1
            return flight_result
        if activity is fetch_hotels_activity:
            raise AssertionError("fetch_hotels_activity should not be called when track_hotels=False")
        if activity is filter_results_activity:
            payload = args[0]
            assert payload["flight_result"] == flight_result
            assert payload["hotel_result"]["raw"].get("status") == "skipped"
            return filtered
        if activity is save_snapshot_activity:
            return "snapshot-no-hotels"
        if activity is evaluate_notifications_activity:
            return False
        raise AssertionError(f"Unexpected activity: {activity}")

    monkeypatch.setattr(price_check_module.workflow, "execute_activity", fake_execute_activity)

    result = await PriceCheckWorkflow().run("trip-no-hotels")

    assert result["success"] is True
    assert result["snapshot_id"] == "snapshot-no-hotels"
    assert flights_called == 1
    assert result["hotel_error"] is None
