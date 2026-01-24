"""Amadeus API client for hotel data."""

from __future__ import annotations

import logging
import time

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

DEFAULT_BASE_URL = "https://test.api.amadeus.com"
TOKEN_EXPIRY_SAFETY_SECONDS = 30


class AmadeusClientError(Exception):
    """Base error for Amadeus client failures."""


class AmadeusAuthError(AmadeusClientError):
    """Raised when authentication with Amadeus fails."""


class AmadeusRequestError(AmadeusClientError):
    """Raised when an Amadeus API request fails."""


class AmadeusClient:
    """Amadeus client for hotel searches."""

    def __init__(self, base_url: str | None = None, timeout_seconds: float = 10.0) -> None:
        self._base_url = (base_url or settings.amadeus_base_url or DEFAULT_BASE_URL).rstrip("/")
        self._timeout = httpx.Timeout(timeout_seconds)
        self._access_token: str | None = None
        self._access_token_expiry: float = 0.0

    def _token_is_valid(self) -> bool:
        return self._access_token is not None and time.time() < self._access_token_expiry

    async def _fetch_access_token(self) -> str:
        if not settings.amadeus_api_key or not settings.amadeus_api_secret:
            raise AmadeusAuthError("Amadeus credentials are not configured")

        data = {
            "grant_type": "client_credentials",
            "client_id": settings.amadeus_api_key,
            "client_secret": settings.amadeus_api_secret,
        }
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                f"{self._base_url}/v1/security/oauth2/token",
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )

        if response.status_code >= 400:
            logger.warning(
                "Amadeus token request failed: status=%s body=%s",
                response.status_code,
                response.text,
            )
            raise AmadeusAuthError("Failed to fetch Amadeus access token")

        payload = response.json()
        access_token = payload.get("access_token")
        expires_in = payload.get("expires_in", 0)

        if not access_token:
            raise AmadeusAuthError("Missing access token in Amadeus response")

        expiry_buffer = max(int(expires_in) - TOKEN_EXPIRY_SAFETY_SECONDS, 0)
        self._access_token = access_token
        self._access_token_expiry = time.time() + expiry_buffer
        return access_token

    async def _get_access_token(self) -> str:
        if self._token_is_valid():
            return self._access_token
        return await self._fetch_access_token()

    async def _authorized_get(self, path: str, params: dict[str, str]) -> httpx.Response:
        token = await self._get_access_token()
        headers = {"Authorization": f"Bearer {token}"}

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(f"{self._base_url}{path}", params=params, headers=headers)

            if response.status_code == 401:
                token = await self._fetch_access_token()
                headers = {"Authorization": f"Bearer {token}"}
                response = await client.get(f"{self._base_url}{path}", params=params, headers=headers)

        if response.status_code >= 400:
            logger.warning(
                "Amadeus request failed: status=%s body=%s",
                response.status_code,
                response.text,
            )
            raise AmadeusRequestError("Amadeus request failed")

        return response


amadeus_client = AmadeusClient()
