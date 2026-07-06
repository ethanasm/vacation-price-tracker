import asyncio
import logging
from collections.abc import Awaitable
from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy
from temporalio.exceptions import ApplicationError

from worker.types import FetchResult, PriceCheckResult
from worker.wf_logging import wf_logger

logger = logging.getLogger(__name__)

with workflow.unsafe.imports_passed_through():
    # Activity imports pull in the DB/client stack (and, for notifications, the
    # email render stack — jinja2/httpx); keep them passed through so the
    # workflow sandbox doesn't re-import those modules under its restriction
    # checker. Re-importing worker.activities.price_check here unguarded was
    # the source of the workflow_sandbox._restrictions warning flood in prod.
    from worker.activities.notifications import (
        evaluate_notifications_activity,
        send_push_notification_activity,
    )
    from worker.activities.price_check import (
        fetch_flights_activity,
        fetch_hotels_activity,
        filter_results_activity,
        load_trip_details,
        save_snapshot_activity,
    )


@workflow.defn
class PriceCheckWorkflow:
    @workflow.run
    async def run(self, trip_id: str) -> PriceCheckResult:
        trip = await workflow.execute_activity(
            load_trip_details,
            trip_id,
            start_to_close_timeout=timedelta(seconds=10),
        )

        tasks: list[tuple[str, Awaitable[FetchResult]]] = []
        if trip["track_flights"]:
            tasks.append(
                (
                    "flights",
                    workflow.execute_activity(
                        fetch_flights_activity,
                        trip,
                        start_to_close_timeout=timedelta(seconds=60),
                        retry_policy=RetryPolicy(maximum_attempts=2),
                    ),
                )
            )
        if trip["track_hotels"]:
            tasks.append(
                (
                    "hotels",
                    workflow.execute_activity(
                        fetch_hotels_activity,
                        trip,
                        start_to_close_timeout=timedelta(seconds=120),
                        retry_policy=RetryPolicy(maximum_attempts=2),
                    ),
                )
            )

        # `return_exceptions=True` lets us observe which side failed. A partial
        # failure (e.g. flights throttled with 429 while hotels succeed) should
        # still persist a snapshot from the side that worked, with the failure
        # recorded. Only when EVERY tracked fetch fails do we abort without a
        # snapshot so the run can be retried later.
        results = await asyncio.gather(
            *(coro for _, coro in tasks), return_exceptions=True
        )
        by_label: dict[str, FetchResult | BaseException] = dict(
            zip((label for label, _ in tasks), results, strict=True)
        )

        failed_labels = [
            label for label, result in by_label.items() if isinstance(result, BaseException)
        ]
        succeeded_labels = [
            label for label, result in by_label.items() if not isinstance(result, BaseException)
        ]

        if failed_labels and not succeeded_labels:
            failures = [f"{label}: {by_label[label]}" for label in failed_labels]
            raise ApplicationError(
                "All upstream fetches failed: " + "; ".join(failures),
                type="UpstreamFetchFailed",
                non_retryable=True,
            )

        # Degrade each failed side to an empty result that carries its error
        # message, so downstream filter/save still run and the error is persisted
        # alongside whatever data the successful side returned.
        for label in failed_labels:
            by_label[label] = _failed_fetch_result(label, str(by_label[label]))

        normalized_flight: FetchResult = (
            by_label["flights"]  # type: ignore[assignment]
            if "flights" in by_label
            else _skipped_fetch_result("flights")
        )
        normalized_hotel: FetchResult = (
            by_label["hotels"]  # type: ignore[assignment]
            if "hotels" in by_label
            else _skipped_fetch_result("hotels")
        )

        filtered = await workflow.execute_activity(
            filter_results_activity,
            {
                "flight_result": normalized_flight,
                "hotel_result": normalized_hotel,
                "flight_prefs": trip["flight_prefs"],
                "hotel_prefs": trip["hotel_prefs"],
            },
            start_to_close_timeout=timedelta(seconds=10),
        )

        snapshot_id = await workflow.execute_activity(
            save_snapshot_activity,
            {
                "trip_id": trip["trip_id"],
                "flights": filtered["flights"],
                "hotels": filtered["hotels"],
                "raw_data": filtered["raw_data"],
            },
            start_to_close_timeout=timedelta(seconds=10),
            retry_policy=RetryPolicy(maximum_attempts=1),  # Prevent duplicate snapshots
        )

        # Evaluate notification rules against the new snapshot. Idempotent on
        # snapshot_id, so this activity is safe to retry (unlike save_snapshot).
        if snapshot_id:
            await workflow.execute_activity(
                evaluate_notifications_activity,
                snapshot_id,
                start_to_close_timeout=timedelta(seconds=15),
                retry_policy=RetryPolicy(maximum_attempts=3),
            )
            # Fire OS push notifications for the same crossing. Runs after the
            # eval activity (which commits the outbox row push reads from);
            # delivery failures are swallowed inside the activity so push never
            # fails the price-check run.
            await workflow.execute_activity(
                send_push_notification_activity,
                snapshot_id,
                start_to_close_timeout=timedelta(seconds=20),
                retry_policy=RetryPolicy(maximum_attempts=3),
            )

        result: PriceCheckResult = {
            "success": True,
            "snapshot_id": snapshot_id,
            "flight_error": normalized_flight["error"],
            "hotel_error": normalized_hotel["error"],
        }
        wf_logger(logger).info(
            "Price check complete for trip_id=%s",
            trip_id,
            extra={
                "event": "workflow.price_check.summary",
                "trip_id": trip_id,
                "snapshot_id": snapshot_id,
                "flight_error": normalized_flight["error"],
                "hotel_error": normalized_hotel["error"],
            },
        )
        return result


def _skipped_fetch_result(label: str) -> FetchResult:
    return {
        "offers": [],
        "raw": {"status": "skipped", "label": label},
        "error": None,
    }


def _failed_fetch_result(label: str, error: str) -> FetchResult:
    return {
        "offers": [],
        "raw": {"status": "error", "label": label, "provider": "skiplagged"},
        "error": error,
    }
