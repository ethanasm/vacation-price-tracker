"""Base class for MCP tools.

All MCP tools should inherit from BaseTool and implement the execute method.
"""

from abc import ABC, abstractmethod
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.mcp import ToolResult


class BaseTool(ABC):
    """Abstract base class for all MCP tools.

    Each tool must define:
    - name: Unique tool identifier
    - description: Human-readable description of what the tool does

    Each tool must implement:
    - execute(): Async method that performs the tool's action
    """

    name: str
    description: str

    @abstractmethod
    async def execute(
        self,
        args: dict[str, Any],
        user_id: str,
        db: AsyncSession,
    ) -> ToolResult:
        """Execute the tool with the given arguments.

        Args:
            args: Dictionary of arguments passed to the tool.
            user_id: UUID string of the authenticated user.
            db: Database session for queries.

        Returns:
            ToolResult with success status and data or error message.
        """
        pass

    def success(self, data: dict[str, Any]) -> ToolResult:
        """Helper to create a successful result."""
        return ToolResult(success=True, data=data)

    def error(self, message: str) -> ToolResult:
        """Helper to create an error result."""
        return ToolResult(success=False, error=message)
