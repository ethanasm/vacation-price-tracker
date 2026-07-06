"""Tests for Temporal service helpers."""

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from app.core.errors import PriceCheckWorkflowStartFailed
from app.services import temporal as temporal_service
from temporalio import client as temporal_client
from temporalio import exceptions as temporal_exceptions


@pytest.mark.asyncio
async def test_trigger_price_check_workflow_already_started(monkeypatch):
    trip_id = uuid.uuid4()
    client = MagicMock()
    client.start_workflow = AsyncMock(
        side_effect=temporal_exceptions.WorkflowAlreadyStartedError("workflow-id", "PriceCheckWorkflow")
    )
    monkeypatch.setattr(temporal_service, "get_temporal_client", lambda: client)

    await temporal_service.trigger_price_check_workflow(trip_id)


@pytest.mark.asyncio
async def test_trigger_price_check_workflow_failure(monkeypatch):
    trip_id = uuid.uuid4()
    client = MagicMock()
    client.start_workflow = AsyncMock(side_effect=RuntimeError("boom"))
    monkeypatch.setattr(temporal_service, "get_temporal_client", lambda: client)

    with pytest.raises(PriceCheckWorkflowStartFailed) as exc_info:
        await temporal_service.trigger_price_check_workflow(trip_id)

    assert exc_info.value.extra["trip_id"] == str(trip_id)


@pytest.mark.asyncio
async def test_start_refresh_all_workflow(monkeypatch):
    user_id = uuid.uuid4()
    client = MagicMock()
    client.start_workflow = AsyncMock()
    monkeypatch.setattr(temporal_service, "get_temporal_client", lambda: client)

    await temporal_service.start_refresh_all_workflow(user_id, "refresh-1")

    client.start_workflow.assert_awaited_once()


@pytest.mark.asyncio
async def test_get_refresh_progress_running(monkeypatch):
    handle = MagicMock()
    handle.query = AsyncMock(return_value={"total": 3, "completed": 1, "failed": 0, "in_progress": 2})
    client = MagicMock()
    client.get_workflow_handle = MagicMock(return_value=handle)
    monkeypatch.setattr(temporal_service, "get_temporal_client", lambda: client)

    result = await temporal_service.get_refresh_progress("refresh-1")

    assert result["status"] == "running"
    assert result["completed"] == 1


@pytest.mark.asyncio
async def test_get_refresh_progress_completed(monkeypatch):
    handle = MagicMock()
    handle.query = AsyncMock(
        side_effect=temporal_client.WorkflowQueryRejectedError(
            temporal_client.WorkflowExecutionStatus.COMPLETED
        )
    )
    handle.result = AsyncMock(return_value={"total": 5, "failed": 1, "successful": 3})
    client = MagicMock()
    client.get_workflow_handle = MagicMock(return_value=handle)
    monkeypatch.setattr(temporal_service, "get_temporal_client", lambda: client)

    result = await temporal_service.get_refresh_progress("refresh-1")

    assert result["status"] == "completed"
    assert result["completed"] == 4
    assert result["failed"] == 1


@pytest.mark.asyncio
async def test_get_refresh_progress_with_status(monkeypatch):
    handle = MagicMock()
    handle.query = AsyncMock(
        side_effect=temporal_client.WorkflowQueryRejectedError(
            temporal_client.WorkflowExecutionStatus.TERMINATED
        )
    )
    client = MagicMock()
    client.get_workflow_handle = MagicMock(return_value=handle)
    monkeypatch.setattr(temporal_service, "get_temporal_client", lambda: client)

    result = await temporal_service.get_refresh_progress("refresh-1")

    assert result["status"] == "terminated"
    assert result["total"] == 0


@pytest.mark.asyncio
async def test_get_refresh_progress_query_failed_running(monkeypatch):
    """PriceCheckWorkflow has no refresh_progress query — the server fails the
    query and the SDK raises WorkflowQueryFailedError; we fall back to describe().
    (Regression: this surfaced as 500s on /v1/trips/refresh-status in prod.)"""
    handle = MagicMock()
    handle.query = AsyncMock(
        side_effect=temporal_client.WorkflowQueryFailedError(
            "Query handler for 'refresh_progress' expected but not found"
        )
    )
    description = MagicMock()
    description.status = temporal_client.WorkflowExecutionStatus.RUNNING
    handle.describe = AsyncMock(return_value=description)
    client = MagicMock()
    client.get_workflow_handle = MagicMock(return_value=handle)
    monkeypatch.setattr(temporal_service, "get_temporal_client", lambda: client)

    result = await temporal_service.get_refresh_progress("price-check-abc")

    assert result["status"] == "running"
    handle.describe.assert_awaited_once()


@pytest.mark.asyncio
async def test_get_refresh_progress_query_failed_other_reason_reraises(monkeypatch):
    """A runtime failure inside RefreshAllTripsWorkflow's real query handler
    must surface, not silently degrade to a describe() status."""
    handle = MagicMock()
    handle.query = AsyncMock(
        side_effect=temporal_client.WorkflowQueryFailedError("KeyError: 'total'")
    )
    handle.describe = AsyncMock()
    client = MagicMock()
    client.get_workflow_handle = MagicMock(return_value=handle)
    monkeypatch.setattr(temporal_service, "get_temporal_client", lambda: client)

    with pytest.raises(temporal_client.WorkflowQueryFailedError):
        await temporal_service.get_refresh_progress("refresh-1")
    handle.describe.assert_not_awaited()


@pytest.mark.asyncio
async def test_get_refresh_progress_query_failed_completed(monkeypatch):
    handle = MagicMock()
    handle.query = AsyncMock(
        side_effect=temporal_client.WorkflowQueryFailedError(
            "Query handler for 'refresh_progress' expected but not found"
        )
    )
    description = MagicMock()
    description.status = temporal_client.WorkflowExecutionStatus.COMPLETED
    handle.describe = AsyncMock(return_value=description)
    handle.result = AsyncMock(return_value={"total": 1, "failed": 0, "successful": 1})
    client = MagicMock()
    client.get_workflow_handle = MagicMock(return_value=handle)
    monkeypatch.setattr(temporal_service, "get_temporal_client", lambda: client)

    result = await temporal_service.get_refresh_progress("price-check-abc")

    assert result["status"] == "completed"
    assert result["failed"] == 0


@pytest.mark.asyncio
async def test_get_refresh_progress_reraises_without_status(monkeypatch):
    handle = MagicMock()
    handle.query = AsyncMock(side_effect=temporal_client.WorkflowQueryRejectedError(None))
    client = MagicMock()
    client.get_workflow_handle = MagicMock(return_value=handle)
    monkeypatch.setattr(temporal_service, "get_temporal_client", lambda: client)

    with pytest.raises(temporal_client.WorkflowQueryRejectedError):
        await temporal_service.get_refresh_progress("refresh-1")
