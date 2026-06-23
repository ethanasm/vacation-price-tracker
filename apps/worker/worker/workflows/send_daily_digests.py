import asyncio
import logging
from datetime import timedelta
from typing import TypedDict

from temporalio import workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    # Activity imports pull in the email render/client stack (jinja2/httpx);
    # keep them passed through so the workflow sandbox doesn't re-import them.
    from worker.activities.notifications import (
        get_pending_digest_user_ids,
        send_user_digest_activity,
    )

MAX_PARALLEL_DIGESTS = 5
logger = logging.getLogger(__name__)


class DigestResult(TypedDict):
    users_total: int
    sent: int
    skipped: int


@workflow.defn
class SendDailyDigestsWorkflow:
    @workflow.run
    async def run(self) -> DigestResult:
        user_ids = await workflow.execute_activity(
            get_pending_digest_user_ids,
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )

        if not user_ids:
            return {"users_total": 0, "sent": 0, "skipped": 0}

        sent = 0
        skipped = 0
        for start in range(0, len(user_ids), MAX_PARALLEL_DIGESTS):
            batch = user_ids[start : start + MAX_PARALLEL_DIGESTS]
            results = await asyncio.gather(
                *(self._send(user_id) for user_id in batch),
                return_exceptions=True,
            )
            for result in results:
                if isinstance(result, Exception):
                    skipped += 1
                elif result.get("sent"):
                    sent += 1
                else:
                    skipped += 1

        return {"users_total": len(user_ids), "sent": sent, "skipped": skipped}

    async def _send(self, user_id: str) -> dict:
        return await workflow.execute_activity(
            send_user_digest_activity,
            user_id,
            start_to_close_timeout=timedelta(seconds=60),
            retry_policy=RetryPolicy(maximum_attempts=2),
        )
