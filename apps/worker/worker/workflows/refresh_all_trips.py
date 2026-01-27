import asyncio
import logging
from datetime import timedelta
from typing import TypedDict

from temporalio import workflow

with workflow.unsafe.imports_passed_through():
    from worker.activities.trips import clear_refresh_lock, get_active_trips

PRICE_CHECK_WORKFLOW_NAME = "PriceCheckWorkflow"
MAX_PARALLEL_PRICE_CHECKS = 5
logger = logging.getLogger(__name__)


class RefreshProgress(TypedDict):
    total: int
    completed: int
    failed: int
    in_progress: int


class RefreshResult(TypedDict):
    total: int
    successful: int
    failed: int


@workflow.defn
class RefreshAllTripsWorkflow:
    def __init__(self) -> None:
        self._total = 0
        self._successful = 0
        self._failed = 0
        self._in_progress = 0

    @workflow.query
    def refresh_progress(self) -> RefreshProgress:
        completed = self._successful + self._failed
        return {
            "total": self._total,
            "completed": completed,
            "failed": self._failed,
            "in_progress": self._in_progress,
        }

    @workflow.run
    async def run(self, user_id: str) -> RefreshResult:
        try:
            trip_ids = await workflow.execute_activity(
                get_active_trips,
                user_id,
                start_to_close_timeout=timedelta(seconds=30),
            )

            self._total = len(trip_ids)
            if not trip_ids:
                return {"total": 0, "successful": 0, "failed": 0}

            for start in range(0, len(trip_ids), MAX_PARALLEL_PRICE_CHECKS):
                batch = trip_ids[start : start + MAX_PARALLEL_PRICE_CHECKS]
                await asyncio.gather(*(self._run_child(trip_id) for trip_id in batch))

            return {
                "total": self._total,
                "successful": self._successful,
                "failed": self._failed,
            }
        finally:
            # Always clear the refresh lock when workflow completes
            await workflow.execute_activity(
                clear_refresh_lock,
                user_id,
                start_to_close_timeout=timedelta(seconds=10),
            )

    async def _run_child(self, trip_id: str) -> None:
        self._in_progress += 1
        try:
            await workflow.execute_child_workflow(
                PRICE_CHECK_WORKFLOW_NAME,
                trip_id,
                id=self._child_workflow_id(trip_id),
            )
            self._successful += 1
        except Exception as exc:
            logger.exception(
                "Child workflow failed for trip_id=%s",
                trip_id,
                exc_info=exc,
            )
            self._failed += 1
        finally:
            self._in_progress -= 1

    def _child_workflow_id(self, trip_id: str) -> str:
        return f"price-check-{trip_id}-{workflow.info().run_id}"
