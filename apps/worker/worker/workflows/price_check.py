import asyncio
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

        flight_task = workflow.execute_activity(
            fetch_flights_activity,
            trip,
            start_to_close_timeout=timedelta(seconds=60),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )
        hotel_task = workflow.execute_activity(
            fetch_hotels_activity,
            trip,
            start_to_close_timeout=timedelta(seconds=60),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )

        flight_result, hotel_result = await asyncio.gather(
            flight_task, hotel_task, return_exceptions=True
        )
        normalized_flight = _normalize_fetch_result(flight_result, "flights")
        normalized_hotel = _normalize_fetch_result(hotel_result, "hotels")

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
