"""Location search endpoints."""

import json
import logging

from fastapi import APIRouter, Query

from app.clients.amadeus import AmadeusClientError, amadeus_client
from app.core.cache_keys import CacheKeys, CacheTTL
from app.core.errors import LocationSearchFailed, UnprocessableEntityError
from app.db.redis import redis_client
from app.schemas.base import APIResponse
from app.schemas.location import LocationResult

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/v1/locations/search", response_model=APIResponse[list[LocationResult]])
async def search_locations(q: str = Query(..., min_length=2, max_length=50)) -> APIResponse[list[LocationResult]]:
    """Search airports and cities by keyword."""
    query = q.strip()
    if not query:
        raise UnprocessableEntityError("Query cannot be blank.")

    cache_key = CacheKeys.location_search(query)
    try:
        cached = await redis_client.get(cache_key)
        if cached:
            return APIResponse(data=json.loads(cached))
    except (json.JSONDecodeError, TypeError) as exc:
        logger.warning("Failed to decode cached locations for query '%s': %s", query, exc)
    except Exception as exc:  # pragma: no cover - defensive cache failure
        logger.warning("Failed to read location cache for query '%s': %s", query, exc)

    try:
        results = await amadeus_client.search_locations(query)
    except AmadeusClientError as exc:
        logger.exception("Failed to fetch location data from Amadeus")
        raise LocationSearchFailed() from exc

    try:
        await redis_client.set(cache_key, json.dumps(results), ex=CacheTTL.LOCATION_SEARCH)
    except Exception as exc:  # pragma: no cover - defensive cache failure
        logger.warning("Failed to cache locations for query '%s': %s", query, exc)

    return APIResponse(data=results)
