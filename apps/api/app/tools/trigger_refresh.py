"""MCP tool for triggering price refresh."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache_keys import CacheKeys, CacheTTL
from app.db.redis import redis_client
from app.schemas.mcp import ToolResult
from app.services.temporal import start_refresh_all_workflow
from app.tools.base import BaseTool


class TriggerRefreshTool(BaseTool):
    """Trigger an immediate price refresh for all active trips.

    This will fetch the latest flight and hotel prices.
    """

    name = "trigger_refresh"
    description = (
        "Trigger an immediate price refresh for all active trips. This will fetch the latest flight and hotel prices."
    )

    async def execute(
        self,
        args: dict[str, Any],
        user_id: str,
        db: AsyncSession,
    ) -> ToolResult:
        """Trigger refresh workflow for all active trips.

        Args:
            args: No required arguments.
            user_id: UUID string of the authenticated user.
            db: Database session (not used but required by interface).

        Returns:
            ToolResult with workflow ID or error if refresh is in progress.
        """
        user_uuid = uuid.UUID(user_id)
        lock_key = CacheKeys.refresh_lock(user_id)

        # Check for existing refresh in progress
        lock_set = await redis_client.set(
            lock_key,
            f"refresh-{user_id}-{datetime.now().isoformat()}",
            ex=CacheTTL.REFRESH_LOCK,
            nx=True,
        )

        if not lock_set:
            existing = await redis_client.get(lock_key)
            if isinstance(existing, (bytes, bytearray)):
                existing = existing.decode("utf-8")
            return self.error(f"A refresh is already in progress. Please wait. (ID: {existing})")

        # Generate workflow ID
        workflow_id = f"refresh-{user_id}-{datetime.now().isoformat()}"

        try:
            await start_refresh_all_workflow(user_uuid, workflow_id)
        except Exception as exc:
            # Release lock on failure
            await redis_client.delete(lock_key)
            return self.error(f"Failed to start refresh workflow: {str(exc)}")

        return self.success(
            {
                "message": "Refreshing prices for all active trips...",
                "workflow_id": workflow_id,
            }
        )
