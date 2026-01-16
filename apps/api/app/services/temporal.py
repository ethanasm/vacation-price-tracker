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
        logger.info("PriceCheckWorkflow already started for trip_id=%s", trip_id)
        return
    except Exception as exc:
        logger.exception("Failed to start PriceCheckWorkflow for trip_id=%s", trip_id, exc_info=exc)
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
    """Query refresh progress for a refresh group."""
    client = get_temporal_client()
    handle = client.get_workflow_handle(refresh_group_id)

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
        }
    except temporal_client.WorkflowQueryRejectedError as exc:
        status = exc.status
        if status == temporal_client.WorkflowExecutionStatus.COMPLETED:
            result = await handle.result(rpc_timeout=timedelta(seconds=2))
            total = result.get("total", 0)
            failed = result.get("failed", 0)
            successful = result.get("successful", 0)
            return {
                "status": "completed",
                "total": total,
                "completed": successful + failed,
                "failed": failed,
                "in_progress": 0,
            }
        if status:
            return {
                "status": status.name.lower(),
                "total": 0,
                "completed": 0,
                "failed": 0,
                "in_progress": 0,
            }
        raise
