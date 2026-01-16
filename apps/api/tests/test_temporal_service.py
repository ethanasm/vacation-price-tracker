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
async def test_get_refresh_progress_reraises_without_status(monkeypatch):
    handle = MagicMock()
    handle.query = AsyncMock(side_effect=temporal_client.WorkflowQueryRejectedError(None))
    client = MagicMock()
    client.get_workflow_handle = MagicMock(return_value=handle)
    monkeypatch.setattr(temporal_service, "get_temporal_client", lambda: client)

    with pytest.raises(temporal_client.WorkflowQueryRejectedError):
        await temporal_service.get_refresh_progress("refresh-1")
