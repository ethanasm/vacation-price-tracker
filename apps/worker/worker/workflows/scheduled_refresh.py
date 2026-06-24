import asyncio
import logging
from datetime import timedelta
from typing import TypedDict

from temporalio import workflow
from temporalio.common import RetryPolicy
from temporalio.workflow import ParentClosePolicy

with workflow.unsafe.imports_passed_through():
    from worker.activities.trips import (
        expire_past_trips,
        get_all_user_ids_with_active_trips,
    )

REFRESH_ALL_TRIPS_WORKFLOW_NAME = "RefreshAllTripsWorkflow"
MAX_PARALLEL_USERS = 3
logger = logging.getLogger(__name__)


class ScheduledRefreshResult(TypedDict):
    users_total: int
    users_successful: int
    users_failed: int


@workflow.defn
class ScheduledRefreshAllUsersWorkflow:
    @workflow.run
    async def run(self) -> ScheduledRefreshResult:
        # Stop tracking trips whose travel dates have passed before fanning out,
        # so expired trips are both marked and excluded from this run.
        await workflow.execute_activity(
            expire_past_trips,
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=2),
        )

        user_ids = await workflow.execute_activity(
            get_all_user_ids_with_active_trips,
            start_to_close_timeout=timedelta(seconds=30),
        )

        if not user_ids:
            return {"users_total": 0, "users_successful": 0, "users_failed": 0}

        successful = 0
        failed = 0
        for start in range(0, len(user_ids), MAX_PARALLEL_USERS):
            batch = user_ids[start : start + MAX_PARALLEL_USERS]
            results = await asyncio.gather(
                *(self._run_child(user_id) for user_id in batch),
                return_exceptions=True,
            )
            for result in results:
                if isinstance(result, Exception):
                    failed += 1
                else:
                    successful += 1

        return {
            "users_total": len(user_ids),
            "users_successful": successful,
            "users_failed": failed,
        }

    async def _run_child(self, user_id: str) -> None:
        run_id = workflow.info().run_id
        try:
            await workflow.execute_child_workflow(
                REFRESH_ALL_TRIPS_WORKFLOW_NAME,
                user_id,
                id=f"scheduled-refresh-{user_id}-{run_id}",
                parent_close_policy=ParentClosePolicy.ABANDON,
            )
        except Exception as exc:
            logger.exception(
                "Scheduled child RefreshAllTripsWorkflow failed for user_id=%s",
                user_id,
                exc_info=exc,
                extra={"event": "workflow.scheduled_refresh.failed", "user_id": user_id},
            )
            raise
