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
    async def run(self, refresh_summary: dict | None = None) -> dict:
        """Run the health checks and email the digest.

        ``refresh_summary`` is set when this workflow is chained off a
        ScheduledRefreshAllUsersWorkflow run — the digest then reports that
        run's actual results. The standalone cron firing passes nothing and
        the refresh outcome is read from Temporal schedule history instead.
        """
        return await workflow.execute_activity(
            run_health_check_activity,
            refresh_summary,
            start_to_close_timeout=timedelta(seconds=120),
            # The activity catches its own errors and is idempotent (Resend
            # collapses same-key sends within 24h), so a single retry is safe.
            retry_policy=RetryPolicy(maximum_attempts=2),
        )
