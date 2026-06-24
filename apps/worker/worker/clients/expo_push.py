"""Expo push-notification client.

A thin async wrapper over Expo's push API
(https://docs.expo.dev/push-notifications/sending-notifications/) built on
``httpx`` — the same transport the API's Resend client uses. Expo's endpoint is
unauthenticated for tokens minted by the project; it accepts a JSON array of
messages and returns a ``data`` array of per-message tickets.
"""

import logging
from typing import TypedDict

import httpx

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
DEFAULT_TIMEOUT_SECONDS = 15.0


class ExpoPushError(Exception):
    """Raised when Expo rejects a push send or the request fails."""


class ExpoPushMessage(TypedDict):
    to: str
    title: str
    body: str
    data: dict


class ExpoPushClient:
    """Sends push notifications via the Expo push service."""

    def __init__(self, timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS) -> None:
        self._timeout = httpx.Timeout(timeout_seconds)

    async def send(self, messages: list[ExpoPushMessage]) -> list[dict]:
        """POST a batch of push messages. Returns Expo's per-message tickets.

        An empty list is a no-op (returns ``[]`` without a network call). Raises
        ``ExpoPushError`` on any transport or HTTP failure.
        """
        if not messages:
            return []
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.post(
                    EXPO_PUSH_URL,
                    json=list(messages),
                    headers={
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                    },
                )
                response.raise_for_status()
                payload = response.json()
        except httpx.HTTPError as exc:
            raise ExpoPushError(f"Expo push request failed: {exc}") from exc
        tickets = payload.get("data", []) if isinstance(payload, dict) else []
        return tickets
