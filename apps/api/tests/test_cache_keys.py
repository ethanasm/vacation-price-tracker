"""Tests for cache key helpers."""

from app.core.cache_keys import CacheKeys, CacheTTL


def test_cache_key_builders():
    assert CacheKeys.idempotency("abc") == "idempotency:abc"
    assert CacheKeys.price_cache("trip", "2024-01-01") == "price_cache:trip:2024-01-01"
    assert CacheKeys.flight_cache("SFO", "HNL", "2024-01-01") == "flight:SFO:HNL:2024-01-01"
    assert CacheKeys.hotel_cache("HNL", "2024-01-01", "2024-01-03") == "hotel:HNL:2024-01-01:2024-01-03"
    assert CacheKeys.location_search(" San Fran ") == "locations:search:san_fran"
    assert CacheKeys.user_session("user") == "session:user"
    assert CacheKeys.refresh_token("user") == "refresh_token:user"
    assert CacheKeys.refresh_lock("user") == "refresh:lock:user"
    assert CacheKeys.rate_limit("user", "price_check") == "rate_limit:user:price_check"

    assert CacheTTL.IDEMPOTENCY == 86400
