import asyncio
import logging
import signal
from datetime import timedelta

from app.core.config import settings
from app.core.telemetry import flush as flush_telemetry
from temporalio.client import Client
from temporalio.worker import Worker
from temporalio.worker.workflow_sandbox import (
    SandboxedWorkflowRunner,
    SandboxRestrictions,
)

from worker.activities.notifications import (
    evaluate_notifications_activity,
    get_pending_digest_user_ids,
    send_user_digest_activity,
)
from worker.activities.price_check import (
    fetch_flights_activity,
    fetch_hotels_activity,
    filter_results_activity,
    load_trip_details,
    save_snapshot_activity,
)
from worker.activities.trips import (
    clear_refresh_lock,
    expire_past_trips,
    get_active_trips,
    get_all_user_ids_with_active_trips,
)
from worker.schedule_bootstrap import ensure_daily_refresh_schedule
from worker.workflows.price_check import PriceCheckWorkflow
from worker.workflows.refresh_all_trips import RefreshAllTripsWorkflow
from worker.workflows.scheduled_refresh import ScheduledRefreshAllUsersWorkflow
from worker.workflows.send_daily_digests import SendDailyDigestsWorkflow


async def main() -> None:
    logging.basicConfig(level=settings.log_level)
    client = await Client.connect(settings.temporal_address, namespace=settings.temporal_namespace)

    await ensure_daily_refresh_schedule(client)

    # Configure sandbox to pass through modules that are only used in activities
    sandbox_runner = SandboxedWorkflowRunner(
        restrictions=SandboxRestrictions.default.with_passthrough_modules(
            "app",
            "sqlmodel",
            "sqlalchemy",
        )
    )

    worker = Worker(
        client,
        task_queue=settings.temporal_task_queue,
        workflows=[
            RefreshAllTripsWorkflow,
            PriceCheckWorkflow,
            ScheduledRefreshAllUsersWorkflow,
            SendDailyDigestsWorkflow,
        ],
        activities=[
            get_active_trips,
            get_all_user_ids_with_active_trips,
            expire_past_trips,
            clear_refresh_lock,
            load_trip_details,
            fetch_flights_activity,
            fetch_hotels_activity,
            filter_results_activity,
            save_snapshot_activity,
            evaluate_notifications_activity,
            get_pending_digest_user_ids,
            send_user_digest_activity,
        ],
        graceful_shutdown_timeout=timedelta(seconds=30),
        workflow_runner=sandbox_runner,
    )

    stop_event = asyncio.Event()

    def _request_shutdown(signal_name: str) -> None:
        logging.getLogger(__name__).info("Received %s, shutting down worker.", signal_name)
        stop_event.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _request_shutdown, sig.name)
        except NotImplementedError:
            signal.signal(sig, lambda *_args, sig_name=sig.name: _request_shutdown(sig_name))

    worker_task = asyncio.create_task(worker.run())
    stop_task = asyncio.create_task(stop_event.wait())

    done, _pending = await asyncio.wait(
        {worker_task, stop_task},
        return_when=asyncio.FIRST_COMPLETED,
    )

    if stop_task in done and not worker_task.done():
        await worker.shutdown()
    elif stop_task not in done:
        stop_task.cancel()
        await asyncio.gather(stop_task, return_exceptions=True)

    await worker_task
    flush_telemetry()


if __name__ == "__main__":
    asyncio.run(main())
