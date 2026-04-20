import asyncio
from collections.abc import Awaitable
from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy

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
                        retry_policy=RetryPolicy(maximum_attempts=3),
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
                        start_to_close_timeout=timedelta(seconds=60),
                        retry_policy=RetryPolicy(maximum_attempts=3),
                    ),
                )
            )

        results = await asyncio.gather(
            *(coro for _, coro in tasks), return_exceptions=True
        )
        by_label: dict[str, FetchResult | BaseException] = dict(
            zip((label for label, _ in tasks), results, strict=True)
        )

        normalized_flight = (
            _normalize_fetch_result(by_label["flights"], "flights")
            if "flights" in by_label
            else _skipped_fetch_result("flights")
        )
        normalized_hotel = (
            _normalize_fetch_result(by_label["hotels"], "hotels")
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


def _normalize_fetch_result(result: object, label: str) -> FetchResult:
    if isinstance(result, Exception):
        return {
            "offers": [],
            "raw": {"status": "error", "label": label},
            "error": str(result),
        }
    return result  # type: ignore[return-value]


def _skipped_fetch_result(label: str) -> FetchResult:
    return {
        "offers": [],
        "raw": {"status": "skipped", "label": label},
        "error": None,
    }
