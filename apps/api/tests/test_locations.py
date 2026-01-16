"""Tests for location search endpoints."""

import json
from unittest.mock import AsyncMock

import app.routers.locations as locations_module
from app.clients.amadeus import AmadeusClientError
from app.core.cache_keys import CacheKeys, CacheTTL
from app.core.errors import LocationSearchFailed
from fastapi.testclient import TestClient


def test_location_search_returns_results(client: TestClient, monkeypatch):
    """Location search returns Amadeus data in the standard envelope."""
    mock_redis = AsyncMock()
    mock_redis.get = AsyncMock(return_value=None)
    mock_redis.set = AsyncMock(return_value=True)
    monkeypatch.setattr(locations_module, "redis_client", mock_redis)

    async def fake_search_locations(query: str, limit: int = 10):
        assert query == "San"
        assert limit == 10
        return [
            {
                "code": "SFO",
                "name": "San Francisco International Airport",
                "type": "AIRPORT",
            }
        ]

    monkeypatch.setattr(locations_module.amadeus_client, "search_locations", fake_search_locations)

    response = client.get("/v1/locations/search", params={"q": "San"})

    assert response.status_code == 200
    assert response.json() == {
        "data": [
            {
                "code": "SFO",
                "name": "San Francisco International Airport",
                "type": "AIRPORT",
            }
        ],
        "meta": None,
    }
    expected_key = CacheKeys.location_search("San")
    mock_redis.get.assert_awaited_once_with(expected_key)
    mock_redis.set.assert_awaited_once_with(
        expected_key,
        json.dumps(
            [
                {
                    "code": "SFO",
                    "name": "San Francisco International Airport",
                    "type": "AIRPORT",
                }
            ]
        ),
        ex=CacheTTL.LOCATION_SEARCH,
    )


def test_location_search_rejects_blank_query(client: TestClient):
    """Location search rejects blank queries after trimming."""
    response = client.get("/v1/locations/search", params={"q": "   "})

    assert response.status_code == 422


def test_location_search_uses_cache(client: TestClient, monkeypatch):
    """Location search returns cached results without calling Amadeus."""
    cached_payload = [
        {
            "code": "MCO",
            "name": "Orlando International Airport",
            "type": "AIRPORT",
        }
    ]
    mock_redis = AsyncMock()
    mock_redis.get = AsyncMock(return_value=json.dumps(cached_payload))
    mock_redis.set = AsyncMock(return_value=True)
    monkeypatch.setattr(locations_module, "redis_client", mock_redis)

    async def fail_search_locations(*_args, **_kwargs):
        raise AssertionError("Amadeus should not be called when cache is warm")

    monkeypatch.setattr(locations_module.amadeus_client, "search_locations", fail_search_locations)

    response = client.get("/v1/locations/search", params={"q": "Orlando"})

    assert response.status_code == 200
    assert response.json() == {"data": cached_payload, "meta": None}


def test_location_search_ignores_bad_cache_payload(client: TestClient, monkeypatch):
    """Location search falls back when cached payload is invalid JSON."""
    mock_redis = AsyncMock()
    mock_redis.get = AsyncMock(return_value="not-json")
    mock_redis.set = AsyncMock(return_value=True)
    monkeypatch.setattr(locations_module, "redis_client", mock_redis)
    monkeypatch.setattr(
        locations_module.amadeus_client,
        "search_locations",
        AsyncMock(return_value=[{"code": "LAX", "name": "Los Angeles", "type": "AIRPORT"}]),
    )

    response = client.get("/v1/locations/search", params={"q": "Los"})

    assert response.status_code == 200
    assert response.json()["data"][0]["code"] == "LAX"


def test_location_search_reports_amadeus_error(client: TestClient, monkeypatch):
    """Location search reports Amadeus errors as upstream failures."""
    mock_redis = AsyncMock()
    mock_redis.get = AsyncMock(return_value=None)
    mock_redis.set = AsyncMock(return_value=True)
    monkeypatch.setattr(locations_module, "redis_client", mock_redis)
    monkeypatch.setattr(
        locations_module.amadeus_client,
        "search_locations",
        AsyncMock(side_effect=AmadeusClientError("boom")),
    )

    response = client.get("/v1/locations/search", params={"q": "Los"})

    assert response.status_code == 502
    assert response.json()["detail"] == LocationSearchFailed.detail
