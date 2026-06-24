import logging

from app.core.config import settings
from app.core.telemetry import langfuse_context, observe
from temporalio.client import (
    Client,
    Schedule,
    ScheduleActionStartWorkflow,
    ScheduleAlreadyRunningError,
    ScheduleOverlapPolicy,
    SchedulePolicy,
    ScheduleSpec,
    ScheduleUpdate,
    ScheduleUpdateInput,
)

SCHEDULE_ID = "daily-price-refresh"
WORKFLOW_NAME = "ScheduledRefreshAllUsersWorkflow"
WORKFLOW_ID = "scheduled-refresh-all-users"

HEALTH_SCHEDULE_ID = "daily-health-check"
HEALTH_WORKFLOW_NAME = "RunHealthCheckWorkflow"
HEALTH_WORKFLOW_ID = "daily-health-check-run"

logger = logging.getLogger(__name__)


def _build_schedule(workflow_name: str, workflow_id: str, cron: str) -> Schedule:
    return Schedule(
        action=ScheduleActionStartWorkflow(
            workflow_name,
            id=workflow_id,
            task_queue=settings.temporal_task_queue,
        ),
        spec=ScheduleSpec(cron_expressions=[cron]),
        policy=SchedulePolicy(overlap=ScheduleOverlapPolicy.SKIP),
    )


async def _create_or_update_schedule(
    client: Client, schedule_id: str, schedule: Schedule, cron: str
) -> str:
    """Idempotently create the schedule, or update it if it already exists."""
    try:
        await client.create_schedule(schedule_id, schedule)
        logger.info(
            "Created schedule %s with cron %r",
            schedule_id,
            cron,
            extra={"event": "schedule.bootstrap.ok", "schedule_id": schedule_id, "cron": str(cron)},
        )
        return "created"
    except ScheduleAlreadyRunningError:
        pass

    handle = client.get_schedule_handle(schedule_id)

    def _updater(_input: ScheduleUpdateInput) -> ScheduleUpdate:
        return ScheduleUpdate(schedule=schedule)

    await handle.update(_updater)
    logger.info(
        "Updated schedule %s with cron %r",
        schedule_id,
        cron,
        extra={"event": "schedule.bootstrap.exists", "schedule_id": schedule_id, "cron": str(cron)},
    )
    return "updated"


@observe(name="worker.ensure_daily_refresh_schedule")
async def ensure_daily_refresh_schedule(client: Client) -> None:
    langfuse_context.update_current_trace(
        name="schedule_bootstrap",
        tags=["worker", "schedule_bootstrap"],
    )
    langfuse_context.update_current_observation(
        input={
            "schedule_id": SCHEDULE_ID,
            "workflow_name": WORKFLOW_NAME,
            "cron": settings.daily_refresh_cron,
            "task_queue": settings.temporal_task_queue,
        },
    )
    schedule = _build_schedule(WORKFLOW_NAME, WORKFLOW_ID, settings.daily_refresh_cron)
    action = await _create_or_update_schedule(
        client, SCHEDULE_ID, schedule, settings.daily_refresh_cron
    )
    langfuse_context.update_current_observation(output={"action": action})


@observe(name="worker.ensure_daily_health_schedule")
async def ensure_daily_health_schedule(client: Client) -> None:
    """Create/update the daily system-health digest schedule (idempotent)."""
    langfuse_context.update_current_trace(
        name="schedule_bootstrap",
        tags=["worker", "schedule_bootstrap"],
    )
    langfuse_context.update_current_observation(
        input={
            "schedule_id": HEALTH_SCHEDULE_ID,
            "workflow_name": HEALTH_WORKFLOW_NAME,
            "cron": settings.daily_health_cron,
            "task_queue": settings.temporal_task_queue,
        },
    )
    schedule = _build_schedule(
        HEALTH_WORKFLOW_NAME, HEALTH_WORKFLOW_ID, settings.daily_health_cron
    )
    action = await _create_or_update_schedule(
        client, HEALTH_SCHEDULE_ID, schedule, settings.daily_health_cron
    )
    langfuse_context.update_current_observation(output={"action": action})
