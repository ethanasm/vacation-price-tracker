import logging
import uuid
from datetime import timedelta

from temporalio import client as temporal_client
from temporalio import common as temporal_common
from temporalio import exceptions as temporal_exceptions

from app.core.config import settings
from app.core.errors import PriceCheckWorkflowStartFailed
from app.db.temporal import get_temporal_client

logger = logging.getLogger(__name__)


async def trigger_price_check_workflow(trip_id: uuid.UUID) -> None:
    """Start the PriceCheckWorkflow for a newly created trip."""
    try:
        client = get_temporal_client()
        await client.start_workflow(
            "PriceCheckWorkflow",
            str(trip_id),
            id=f"price-check-{trip_id}",
            task_queue=settings.temporal_task_queue,
        )
    except temporal_exceptions.WorkflowAlreadyStartedError:
        logger.info(
            "PriceCheckWorkflow already started for trip_id=%s",
            trip_id,
            extra={
                "event": "temporal.workflow.already_started",
                "trip_id": str(trip_id),
            },
        )
        return
    except Exception as exc:
        logger.exception(
            "Failed to start PriceCheckWorkflow for trip_id=%s",
            trip_id,
            exc_info=exc,
            extra={
                "event": "temporal.workflow.start_failed",
                "trip_id": str(trip_id),
            },
        )
        raise PriceCheckWorkflowStartFailed(extra={"trip_id": str(trip_id)}) from exc


async def start_refresh_all_workflow(user_id: uuid.UUID, refresh_group_id: str) -> None:
    """Start the RefreshAllTripsWorkflow for a user."""
    client = get_temporal_client()
    await client.start_workflow(
        "RefreshAllTripsWorkflow",
        str(user_id),
        id=refresh_group_id,
        task_queue=settings.temporal_task_queue,
    )


async def get_refresh_progress(refresh_group_id: str) -> dict:
    """Query refresh progress for a workflow by id.

    Handles both `RefreshAllTripsWorkflow` (exposes a `refresh_progress` query)
    and `PriceCheckWorkflow` (no query — status is inferred from Temporal's
    execution state). On failure, extracts the workflow error message so the
    API can surface it to the UI.
    """
    client = get_temporal_client()
    handle = client.get_workflow_handle(refresh_group_id)

    # First try the batch-style progress query. This only works for
    # RefreshAllTripsWorkflow — for others it rejects and we fall through.
    try:
        progress = await handle.query(
            "refresh_progress",
            reject_condition=temporal_common.QueryRejectCondition.NOT_OPEN,
        )
        return {
            "status": "running",
            "total": progress["total"],
            "completed": progress["completed"],
            "failed": progress["failed"],
            "in_progress": progress["in_progress"],
            "error": None,
        }
    except temporal_client.WorkflowQueryRejectedError as exc:
        if exc.status is None:
            raise
        return await _status_from_execution(handle, exc.status)
    except temporal_client.WorkflowQueryFailedError:
        # PriceCheckWorkflow registers no refresh_progress query handler, so the
        # server fails the query ("Query handler ... expected but not found").
        # The SDK surfaces that as WorkflowQueryFailedError (a TemporalError,
        # NOT an RPCError) — fall back to describe().
        description = await handle.describe()
        return await _status_from_execution(handle, description.status)
    except temporal_client.RPCError as exc:
        # Older servers reject unknown queries with a generic RPC error
        # rather than WorkflowQueryFailedError; fall back to describe().
        if exc.status != temporal_client.RPCStatusCode.INVALID_ARGUMENT:
            raise
        description = await handle.describe()
        return await _status_from_execution(handle, description.status)


async def _status_from_execution(
    handle: temporal_client.WorkflowHandle,
    status: temporal_client.WorkflowExecutionStatus | None,
) -> dict:
    """Translate a Temporal execution status into our progress dict shape."""
    if status == temporal_client.WorkflowExecutionStatus.COMPLETED:
        try:
            result = await handle.result(rpc_timeout=timedelta(seconds=2))
        except Exception:
            result = {}
        if isinstance(result, dict):
            total = result.get("total", 1)
            failed = result.get("failed", 0)
            successful = result.get("successful", 1 if not failed else 0)
        else:
            # PriceCheckWorkflow returns a PriceCheckResult dict too, but guard anyway.
            total, failed, successful = 1, 0, 1
        return {
            "status": "completed",
            "total": total,
            "completed": successful + failed,
            "failed": failed,
            "in_progress": 0,
            "error": None,
        }

    if status == temporal_client.WorkflowExecutionStatus.FAILED:
        error_message = await _extract_failure_message(handle)
        return {
            "status": "failed",
            "total": 1,
            "completed": 1,
            "failed": 1,
            "in_progress": 0,
            "error": error_message,
        }

    if status:
        return {
            "status": status.name.lower(),
            "total": 0,
            "completed": 0,
            "failed": 0,
            "in_progress": 0,
            "error": None,
        }

    raise RuntimeError("Workflow status unavailable")


async def _extract_failure_message(handle: temporal_client.WorkflowHandle) -> str:
    """Pull the human-readable error from a failed workflow."""
    try:
        await handle.result(rpc_timeout=timedelta(seconds=2))
    except temporal_client.WorkflowFailureError as exc:
        cause = exc.cause if exc.cause is not None else exc
        return str(cause) or cause.__class__.__name__
    except Exception as exc:
        return str(exc) or exc.__class__.__name__
    return "Workflow failed without a message"
