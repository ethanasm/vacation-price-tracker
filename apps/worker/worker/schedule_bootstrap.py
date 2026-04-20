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

logger = logging.getLogger(__name__)


def _build_schedule() -> Schedule:
    return Schedule(
        action=ScheduleActionStartWorkflow(
            WORKFLOW_NAME,
            id=WORKFLOW_ID,
            task_queue=settings.temporal_task_queue,
        ),
        spec=ScheduleSpec(cron_expressions=[settings.daily_refresh_cron]),
        policy=SchedulePolicy(overlap=ScheduleOverlapPolicy.SKIP),
    )


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
    schedule = _build_schedule()
    try:
        await client.create_schedule(SCHEDULE_ID, schedule)
        logger.info(
            "Created schedule %s with cron %r", SCHEDULE_ID, settings.daily_refresh_cron
        )
        langfuse_context.update_current_observation(output={"action": "created"})
        return
    except ScheduleAlreadyRunningError:
        pass

    handle = client.get_schedule_handle(SCHEDULE_ID)

    def _updater(_input: ScheduleUpdateInput) -> ScheduleUpdate:
        return ScheduleUpdate(schedule=schedule)

    await handle.update(_updater)
    logger.info(
        "Updated schedule %s with cron %r", SCHEDULE_ID, settings.daily_refresh_cron
    )
    langfuse_context.update_current_observation(output={"action": "updated"})
