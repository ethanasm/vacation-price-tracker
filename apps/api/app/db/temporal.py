"""Temporal client singleton."""

import logging

from temporalio.client import Client

from app.core.config import settings

logger = logging.getLogger(__name__)

# Module-level singleton (initialized in lifespan)
temporal_client: Client | None = None


async def init_temporal_client() -> Client:
    """Initialize the Temporal client singleton."""
    global temporal_client
    if temporal_client is None:
        logger.info("Connecting to Temporal at %s", settings.temporal_address)
        temporal_client = await Client.connect(
            settings.temporal_address,
            namespace=settings.temporal_namespace,
        )
        logger.info("Temporal client connected")
    return temporal_client


def close_temporal_client() -> None:
    """Close the Temporal client connection."""
    global temporal_client
    # Note: Temporal Python SDK Client doesn't have explicit close()
    # Setting to None allows reconnection if needed
    temporal_client = None
    logger.info("Temporal client disconnected")


def get_temporal_client() -> Client:
    """Get the Temporal client singleton. Raises if not initialized."""
    if temporal_client is None:
        raise RuntimeError(
            "Temporal client not initialized. Call init_temporal_client() first."
        )
    return temporal_client
