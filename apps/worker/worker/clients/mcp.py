import asyncio
import json
import logging
import os
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)


class MCPClientError(RuntimeError):
    """Raised when an MCP stdio call fails."""


class MCPClient:
    def __init__(
        self,
        name: str,
        command: str,
        args: list[str],
        env: dict[str, str] | None = None,
        timeout_seconds: float = 30,
        max_restart_attempts: int = 3,
    ) -> None:
        self._name = name
        self._command = command
        self._args = args
        self._env = env
        self._timeout = timeout_seconds
        self._max_restart_attempts = max_restart_attempts
        self._restart_attempts = 0
        self._started_once = False
        self._process: asyncio.subprocess.Process | None = None
        self._lock = asyncio.Lock()

    @property
    def is_configured(self) -> bool:
        return bool(self._command and self._args)

    async def call_tool(self, tool: str, arguments: dict[str, Any]) -> dict[str, Any]:
        if not self.is_configured:
            raise MCPClientError(f"{self._name} MCP server is not configured")

        async with self._lock:
            await self._ensure_process()
            if not self._process or not self._process.stdin or not self._process.stdout:
                raise MCPClientError(f"{self._name} MCP process is not available")

            request = json.dumps({"tool": tool, "arguments": arguments})
            self._process.stdin.write(request.encode("utf-8") + b"\n")
            await self._process.stdin.drain()

            try:
                response_line = await asyncio.wait_for(
                    self._process.stdout.readline(),
                    timeout=self._timeout,
                )
            except TimeoutError as exc:
                await self._handle_process_error("timeout")
                raise MCPClientError(f"{self._name} MCP response timed out") from exc

            if not response_line:
                await self._handle_process_error("empty response")
                raise MCPClientError(f"{self._name} MCP response was empty")

            try:
                response = json.loads(response_line.decode("utf-8"))
            except json.JSONDecodeError as exc:
                await self._handle_process_error("invalid json")
                raise MCPClientError(f"{self._name} MCP response was not valid JSON") from exc

            if not isinstance(response, dict):
                await self._handle_process_error("non-object response")
                raise MCPClientError(f"{self._name} MCP response is not an object")

            self._restart_attempts = 0
            return response

    async def _ensure_process(self) -> None:
        if self._process and self._process.returncode is None:
            return

        if self._started_once:
            if self._restart_attempts >= self._max_restart_attempts:
                raise MCPClientError(
                    f"{self._name} MCP restart limit exceeded ({self._max_restart_attempts})"
                )
            self._restart_attempts += 1

        env = os.environ.copy()
        if self._env:
            env.update(self._env)

        self._process = await asyncio.create_subprocess_exec(
            self._command,
            *self._args,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env,
        )
        self._started_once = True

    async def _handle_process_error(self, reason: str) -> None:
        await self._log_stderr(reason)
        await self._reset_process()

    async def _log_stderr(self, reason: str | None = None) -> None:
        if not self._process or not self._process.stderr:
            return
        try:
            line = await asyncio.wait_for(self._process.stderr.readline(), timeout=0.1)
        except TimeoutError:
            return
        if not line:
            return
        message = line.decode("utf-8", errors="replace").strip()
        if not message:
            return
        if reason:
            logger.warning("%s MCP stderr (%s): %s", self._name, reason, message)
        else:
            logger.warning("%s MCP stderr: %s", self._name, message)

    async def _reset_process(self) -> None:
        if self._process:
            self._process.kill()
            await self._process.wait()
        self._process = None


def build_amadeus_client() -> MCPClient | None:
    if not settings.amadeus_mcp_path:
        return None
    env = {
        "AMADEUS_API_KEY": settings.amadeus_api_key,
        "AMADEUS_API_SECRET": settings.amadeus_api_secret,
    }
    return MCPClient(
        name="Amadeus",
        command=settings.mcp_node_path,
        args=[settings.amadeus_mcp_path],
        env=env,
        timeout_seconds=settings.mcp_timeout_seconds,
        max_restart_attempts=settings.mcp_max_restart_attempts,
    )
