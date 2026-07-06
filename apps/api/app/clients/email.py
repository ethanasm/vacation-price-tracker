"""Resend email client.

A thin async wrapper over Resend's REST API (https://resend.com/docs) built on
``httpx`` — the same transport the Skiplagged client uses. When
``RESEND_API_KEY`` is unset the client runs in **dry-run** mode: it logs what it
would have sent and returns without making a network call, so the digest pipeline
is safe to run in dev/CI without credentials.
"""

import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"
DEFAULT_TIMEOUT_SECONDS = 15.0

# Sender domains that must never be used for real sends — the defaults shipped in
# the env templates. Mirrors showbook's EMAIL_FROM placeholder guard.
_PLACEHOLDER_SENDER_FRAGMENTS = ("yourdomain.com", "example.com")


class EmailError(Exception):
    """Base class for email delivery errors."""


class EmailConfigError(EmailError):
    """Raised when email configuration is unsafe for the current environment."""


class EmailSendError(EmailError):
    """Raised when Resend rejects a send or the request fails.

    ``status_code`` carries the HTTP status when Resend answered (None for
    transport failures) so callers can special-case rejections — e.g. the 409
    an idempotency-key reuse with a different payload returns.
    """

    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class ResendClient:
    """Sends transactional email via Resend, with a dry-run fallback."""

    def __init__(
        self,
        api_key: str | None = None,
        from_address: str | None = None,
        timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
    ) -> None:
        self._api_key = api_key if api_key is not None else settings.resend_api_key
        self._from = from_address if from_address is not None else settings.email_from
        self._timeout = httpx.Timeout(timeout_seconds)

    @property
    def dry_run(self) -> bool:
        """True when no API key is configured (logs instead of sending)."""
        return not self._api_key

    def _guard_sender(self) -> None:
        """Refuse to send from a placeholder domain in production."""
        if settings.is_production and any(
            fragment in self._from for fragment in _PLACEHOLDER_SENDER_FRAGMENTS
        ):
            raise EmailConfigError(
                f"EMAIL_FROM is a placeholder ({self._from!r}); set a verified Resend "
                "sender domain before sending in production."
            )

    async def send(
        self,
        *,
        to: str | list[str],
        subject: str,
        html: str,
        headers: dict[str, str] | None = None,
        idempotency_key: str | None = None,
    ) -> dict:
        """Send a single HTML email.

        ``to`` may be a single address or a list (Resend accepts a ``to`` array).
        Returns the parsed Resend response (``{"id": ...}``) on success, or a
        ``{"dry_run": True}`` marker when no API key is configured.
        """
        self._guard_sender()

        if self.dry_run:
            logger.info(
                "Email dry-run (no RESEND_API_KEY): would send to=%s subject=%r (%d bytes html)",
                to,
                subject,
                len(html),
            )
            return {"dry_run": True}

        payload: dict[str, object] = {
            "from": self._from,
            "to": to,
            "subject": subject,
            "html": html,
        }
        if headers:
            payload["headers"] = headers

        request_headers = {"Authorization": f"Bearer {self._api_key}"}
        if idempotency_key:
            request_headers["Idempotency-Key"] = idempotency_key

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.post(
                    RESEND_API_URL, json=payload, headers=request_headers
                )
                response.raise_for_status()
                return response.json()
        except httpx.HTTPStatusError as exc:  # pragma: no cover - network error path
            body = exc.response.text
            raise EmailSendError(
                f"Resend rejected send to {to}: {exc.response.status_code} {body}",
                status_code=exc.response.status_code,
            ) from exc
        except httpx.HTTPError as exc:  # pragma: no cover - network error path
            raise EmailSendError(f"Resend request failed for {to}: {exc}") from exc
