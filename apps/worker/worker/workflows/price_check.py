import asyncio
from collections.abc import Awaitable
from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy
from temporalio.exceptions import ApplicationError

from worker.activities.price_check import (
    fetch_flights_activity,
    fetch_hotels_activity,
    filter_results_activity,
    load_trip_details,
    save_snapshot_activity,
)
from worker.types import FetchResult, PriceCheckResult


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

        # `return_exceptions=True` lets us observe which side failed so we can
        # build a descriptive ApplicationError below. If any tracked fetch fails
        # after retries, fail the workflow and do NOT persist a snapshot.
        results = await asyncio.gather(
            *(coro for _, coro in tasks), return_exceptions=True
        )
        by_label: dict[str, FetchResult | BaseException] = dict(
            zip((label for label, _ in tasks), results, strict=True)
        )

        failures: list[str] = [
            f"{label}: {result}"
            for label, result in by_label.items()
            if isinstance(result, BaseException)
        ]
        if failures:
            raise ApplicationError(
                "Upstream fetch failed: " + "; ".join(failures),
                type="UpstreamFetchFailed",
                non_retryable=True,
            )

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

        return {
            "success": True,
            "snapshot_id": snapshot_id,
            "flight_error": normalized_flight["error"],
            "hotel_error": normalized_hotel["error"],
        }


def _skipped_fetch_result(label: str) -> FetchResult:
    return {
        "offers": [],
        "raw": {"status": "skipped", "label": label},
        "error": None,
    }
