import asyncio
import logging
from datetime import timedelta
from typing import TypedDict

from temporalio import workflow
from temporalio.common import RetryPolicy
from temporalio.workflow import ParentClosePolicy

from worker.wf_logging import wf_logger

with workflow.unsafe.imports_passed_through():
    from worker.activities.trips import (
        expire_past_trips,
        get_all_user_ids_with_active_trips,
    )

REFRESH_ALL_TRIPS_WORKFLOW_NAME = "RefreshAllTripsWorkflow"
SEND_DAILY_DIGESTS_WORKFLOW_NAME = "SendDailyDigestsWorkflow"
RUN_HEALTH_CHECK_WORKFLOW_NAME = "RunHealthCheckWorkflow"
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

        # Send the daily digest only after every per-user refresh (and thus every
        # snapshot + outbox enqueue) has completed, so digests are never partial.
        digest_result = await self._send_daily_digests()

        wf_logger(logger).info(
            "Scheduled refresh complete (%d/%d users ok)",
            successful,
            len(user_ids),
            extra={
                "event": "workflow.scheduled_refresh.summary",
                "users_total": len(user_ids),
                "users_successful": successful,
                "users_failed": failed,
            },
        )
        summary: ScheduledRefreshResult = {
            "users_total": len(user_ids),
            "users_successful": successful,
            "users_failed": failed,
        }
        # Chain the health check so it runs after (and reports on) THIS run,
        # regardless of how long the refresh took. The 07:00 UTC cron schedule
        # stays as a fallback for the day the refresh never fires; the email's
        # per-day idempotency key collapses the duplicate send.
        await self._run_health_check(summary, digest_result)
        return summary

    async def _send_daily_digests(self) -> dict | None:
        run_id = workflow.info().run_id
        try:
            return await workflow.execute_child_workflow(
                SEND_DAILY_DIGESTS_WORKFLOW_NAME,
                id=f"daily-digest-{run_id}",
            )
        except Exception as exc:
            wf_logger(logger).error(
                "Daily digest dispatch failed",
                exc_info=exc,
                extra={"event": "workflow.scheduled_refresh.digest_dispatch_failed"},
            )
            return None

    async def _run_health_check(
        self, summary: ScheduledRefreshResult, digest_result: dict | None
    ) -> None:
        refresh_summary: dict = dict(summary)
        if digest_result is not None:
            refresh_summary["digests"] = digest_result
        try:
            await workflow.start_child_workflow(
                RUN_HEALTH_CHECK_WORKFLOW_NAME,
                refresh_summary,
                id=f"health-check-{workflow.info().run_id}",
                parent_close_policy=ParentClosePolicy.ABANDON,
            )
        except Exception as exc:
            wf_logger(logger).error(
                "Health check dispatch failed",
                exc_info=exc,
                extra={"event": "workflow.scheduled_refresh.health_dispatch_failed"},
            )

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
            wf_logger(logger).error(
                "Scheduled child RefreshAllTripsWorkflow failed for user_id=%s",
                user_id,
                exc_info=exc,
                extra={"event": "workflow.scheduled_refresh.failed", "user_id": user_id},
            )
            raise
