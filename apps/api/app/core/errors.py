from __future__ import annotations

from typing import Any

from fastapi import HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette import status

PROBLEM_TYPE_BASE = "https://vacation-price-tracker.dev/problems"
PROBLEM_JSON_MEDIA_TYPE = "application/problem+json"


def problem_type(slug: str) -> str:
    return f"{PROBLEM_TYPE_BASE}/{slug}"


class AppError(Exception):
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    title = "Internal Server Error"
    detail = "An unexpected error occurred."
    type = problem_type("internal-error")

    def __init__(self, detail: str | None = None, *, extra: dict[str, Any] | None = None) -> None:
        super().__init__(detail or self.detail)
        self.detail = detail or self.detail
        self.extra = extra or {}

    def to_problem_detail(self, instance: str | None = None) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "type": self.type,
            "title": self.title,
            "status": self.status_code,
            "detail": self.detail,
        }
        if instance:
            payload["instance"] = instance
        if self.extra:
            payload.update(self.extra)
        return payload


class BadRequestError(AppError):
    status_code = status.HTTP_400_BAD_REQUEST
    title = "Bad Request"
    type = problem_type("bad-request")
    detail = "The request could not be processed."


class UnauthorizedError(AppError):
    status_code = status.HTTP_401_UNAUTHORIZED
    title = "Unauthorized"
    type = problem_type("unauthorized")
    detail = "Authentication required."


class ForbiddenError(AppError):
    status_code = status.HTTP_403_FORBIDDEN
    title = "Forbidden"
    type = problem_type("forbidden")
    detail = "Access denied."


class NotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    title = "Not Found"
    type = problem_type("not-found")
    detail = "Resource not found."


class ConflictError(AppError):
    status_code = status.HTTP_409_CONFLICT
    title = "Conflict"
    type = problem_type("conflict")
    detail = "Resource conflict."


class UnprocessableEntityError(AppError):
    status_code = status.HTTP_422_UNPROCESSABLE_CONTENT
    title = "Unprocessable Entity"
    type = problem_type("unprocessable-entity")
    detail = "Validation failed."


class UpstreamServiceError(AppError):
    status_code = status.HTTP_502_BAD_GATEWAY
    title = "Bad Gateway"
    type = problem_type("bad-gateway")
    detail = "Upstream service error."


class ServiceUnavailableError(AppError):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    title = "Service Unavailable"
    type = problem_type("service-unavailable")
    detail = "Service unavailable."


class AuthenticationRequired(UnauthorizedError):
    type = problem_type("auth-required")
    detail = "Not authenticated."


class AccessDenied(ForbiddenError):
    type = problem_type("access-denied")


class IdempotencyKeyRequired(BadRequestError):
    type = problem_type("idempotency-key-required")
    detail = "X-Idempotency-Key header required."


class IdempotencyKeyConflict(ConflictError):
    type = problem_type("idempotency-key-conflict")
    detail = "Idempotency key already used."


class TripLimitExceeded(BadRequestError):
    type = problem_type("trip-limit-exceeded")
    detail = "Trip limit exceeded."


class TripNotFound(NotFoundError):
    type = problem_type("trip-not-found")
    detail = "Trip not found."


class DuplicateTripName(ConflictError):
    type = problem_type("duplicate-trip-name")
    detail = "Trip name already exists."


class ExternalAPIError(UpstreamServiceError):
    type = problem_type("external-api-error")
    detail = "External API error."


class RefreshInProgress(ConflictError):
    type = problem_type("refresh-in-progress")
    detail = "Refresh already in progress."


class RefreshGroupNotFound(NotFoundError):
    type = problem_type("refresh-group-not-found")
    detail = "Refresh group not found."


class RefreshWorkflowStartFailed(UpstreamServiceError):
    type = problem_type("refresh-workflow-start-failed")
    detail = "Failed to start refresh workflow."


class PriceCheckWorkflowStartFailed(UpstreamServiceError):
    type = problem_type("price-check-start-failed")
    detail = "Trip created, but initial price check failed to start."


class TemporalServiceError(UpstreamServiceError):
    type = problem_type("temporal-service-error")
    detail = "Temporal service error."


class LocationSearchFailed(UpstreamServiceError):
    type = problem_type("location-search-failed")
    detail = "Failed to fetch locations."


class MCPServerUnavailable(ServiceUnavailableError):
    type = problem_type("mcp-server-unavailable")
    detail = "MCP server is unavailable."


class MCPToolError(UpstreamServiceError):
    type = problem_type("mcp-tool-error")
    detail = "MCP tool failed."


class RateLimitExceeded(AppError):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    title = "Too Many Requests"
    type = problem_type("rate-limit-exceeded")
    detail = "Rate limit exceeded. Please retry later."

    def __init__(
        self,
        retry_after: int,
        detail: str | None = None,
        *,
        extra: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(detail, extra=extra)
        self.retry_after = retry_after

    def to_problem_detail(self, instance: str | None = None) -> dict[str, Any]:
        payload = super().to_problem_detail(instance)
        payload["retry_after"] = self.retry_after
        return payload


def problem_details_response(exc: AppError, request: Request) -> JSONResponse:
    headers = {}
    if isinstance(exc, RateLimitExceeded):
        headers["Retry-After"] = str(exc.retry_after)
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_problem_detail(request.url.path),
        media_type=PROBLEM_JSON_MEDIA_TYPE,
        headers=headers if headers else None,
    )


def http_exception_response(exc: HTTPException, request: Request) -> JSONResponse:
    detail = exc.detail
    detail_text = detail if isinstance(detail, str) else str(detail)
    payload = {
        "type": problem_type("http-exception"),
        "title": "HTTP Exception",
        "status": exc.status_code,
        "detail": detail_text,
        "instance": request.url.path,
    }
    return JSONResponse(
        status_code=exc.status_code,
        content=payload,
        media_type=PROBLEM_JSON_MEDIA_TYPE,
    )


def validation_exception_response(exc: RequestValidationError, request: Request) -> JSONResponse:
    payload = {
        "type": problem_type("validation-error"),
        "title": "Validation Error",
        "status": status.HTTP_422_UNPROCESSABLE_CONTENT,
        "detail": "Request validation failed.",
        "instance": request.url.path,
        "errors": exc.errors(),
    }
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content=payload,
        media_type=PROBLEM_JSON_MEDIA_TYPE,
    )


def unhandled_exception_response(request: Request) -> JSONResponse:
    payload = {
        "type": problem_type("internal-error"),
        "title": "Internal Server Error",
        "status": status.HTTP_500_INTERNAL_SERVER_ERROR,
        "detail": "An unexpected error occurred.",
        "instance": request.url.path,
    }
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=payload,
        media_type=PROBLEM_JSON_MEDIA_TYPE,
    )
