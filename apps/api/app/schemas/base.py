"""Base schemas for API responses."""

from pydantic import BaseModel


class APIResponse[T](BaseModel):
    """Standard API response envelope.

    All API responses are wrapped in this structure for consistency.

    Example:
        {
            "data": {...},
            "meta": {"page": 1, "total": 10}
        }
    """

    data: T
    meta: dict | None = None


class PaginationMeta(BaseModel):
    """Pagination metadata for list responses."""

    page: int
    limit: int
    total: int
    total_pages: int
