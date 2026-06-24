from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    # Pulls in the email/render/axiom/db stack; keep it passed through so the
    # workflow sandbox doesn't re-import those modules.
    from worker.activities.health_check import run_health_check_activity


@workflow.defn
class RunHealthCheckWorkflow:
    @workflow.run
    async def run(self) -> dict:
        return await workflow.execute_activity(
            run_health_check_activity,
            start_to_close_timeout=timedelta(seconds=120),
            # The activity catches its own errors and is idempotent (Resend
            # collapses same-key sends within 24h), so a single retry is safe.
            retry_policy=RetryPolicy(maximum_attempts=2),
        )
