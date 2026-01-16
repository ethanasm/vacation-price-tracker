import asyncio
import json
import logging
from types import SimpleNamespace

import pytest
from app.core.config import settings
from worker.clients.mcp import MCPClient, MCPClientError, build_amadeus_client, build_kiwi_client


class DummyStdin:
    def __init__(self) -> None:
        self.writes: list[bytes] = []

    def write(self, data: bytes) -> None:
        self.writes.append(data)

    async def drain(self) -> None:
        return None


class DummyStream:
    def __init__(self, lines: list[bytes]) -> None:
        self._lines = lines

    async def readline(self) -> bytes:
        if self._lines:
            return self._lines.pop(0)
        return b""


class DummyProcess:
    def __init__(self, lines: list[bytes], stderr_lines: list[bytes] | None = None) -> None:
        self.stdin = DummyStdin()
        self.stdout = DummyStream(lines)
        self.stderr = DummyStream(stderr_lines or [])
        self.returncode = None
        self.killed = False

    def kill(self) -> None:
        self.killed = True

    async def wait(self) -> None:
        return None


@pytest.mark.asyncio
async def test_mcp_client_call_tool_success(monkeypatch):
    process = DummyProcess([b"{\"data\":[{\"price\":123}]}\n"])

    async def fake_create_subprocess_exec(*_args, **_kwargs):
        return process

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_create_subprocess_exec)

    client = MCPClient(name="Test", command="node", args=["server.js"], timeout_seconds=5)
    response = await client.call_tool("search-flight", {"flyFrom": "SFO"})

    assert response["data"][0]["price"] == 123
    payload = json.loads(process.stdin.writes[0].decode("utf-8"))
    assert payload["tool"] == "search-flight"
    assert payload["arguments"]["flyFrom"] == "SFO"


@pytest.mark.asyncio
async def test_mcp_client_requires_configuration():
    client = MCPClient(name="Test", command="", args=[])
    with pytest.raises(MCPClientError):
        await client.call_tool("search-flight", {})


@pytest.mark.asyncio
async def test_mcp_client_missing_streams(monkeypatch):
    client = MCPClient(name="Test", command="node", args=["server.js"])

    async def fake_ensure_process():
        client._process = SimpleNamespace(stdin=None, stdout=None, returncode=None)

    monkeypatch.setattr(client, "_ensure_process", fake_ensure_process)

    with pytest.raises(MCPClientError):
        await client.call_tool("search-flight", {})


@pytest.mark.asyncio
async def test_mcp_client_rejects_invalid_json(monkeypatch):
    process = DummyProcess([b"not-json\n"])

    async def fake_create_subprocess_exec(*_args, **_kwargs):
        return process

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_create_subprocess_exec)

    client = MCPClient(name="Test", command="node", args=["server.js"])

    with pytest.raises(MCPClientError):
        await client.call_tool("search-flight", {"flyFrom": "SFO"})


@pytest.mark.asyncio
async def test_mcp_client_empty_response_resets(monkeypatch):
    process = DummyProcess([b""])

    async def fake_ensure_process():
        client._process = process

    client = MCPClient(name="Test", command="node", args=["server.js"])
    monkeypatch.setattr(client, "_ensure_process", fake_ensure_process)

    with pytest.raises(MCPClientError):
        await client.call_tool("search-flight", {"flyFrom": "SFO"})

    assert process.killed is True
    assert client._process is None


@pytest.mark.asyncio
async def test_mcp_client_timeout_resets(monkeypatch):
    process = DummyProcess([b"{}"])
    client = MCPClient(name="Test", command="node", args=["server.js"])

    async def fake_ensure_process():
        client._process = process

    async def fake_wait_for(coro, *_args, **_kwargs):
        coro.close()
        raise TimeoutError("timeout")

    monkeypatch.setattr(client, "_ensure_process", fake_ensure_process)
    monkeypatch.setattr(asyncio, "wait_for", fake_wait_for)

    with pytest.raises(MCPClientError):
        await client.call_tool("search-flight", {"flyFrom": "SFO"})

    assert process.killed is True
    assert client._process is None


@pytest.mark.asyncio
async def test_mcp_client_rejects_non_object_response(monkeypatch):
    process = DummyProcess([b"[1, 2, 3]\n"])

    async def fake_create_subprocess_exec(*_args, **_kwargs):
        return process

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_create_subprocess_exec)

    client = MCPClient(name="Test", command="node", args=["server.js"])

    with pytest.raises(MCPClientError):
        await client.call_tool("search-flight", {"flyFrom": "SFO"})


@pytest.mark.asyncio
async def test_ensure_process_reuses_existing(monkeypatch):
    client = MCPClient(name="Test", command="node", args=["server.js"])
    client._process = SimpleNamespace(returncode=None)

    async def fail_create(*_args, **_kwargs):
        raise AssertionError("Should not spawn process")

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fail_create)

    await client._ensure_process()


@pytest.mark.asyncio
async def test_ensure_process_passes_env(monkeypatch):
    client = MCPClient(name="Test", command="node", args=["server.js"], env={"CUSTOM_ENV": "1"})
    captured = {}

    async def fake_create_subprocess_exec(*_args, **kwargs):
        captured.update(kwargs)
        return DummyProcess([b"{}"])

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_create_subprocess_exec)

    await client._ensure_process()

    assert captured["env"]["CUSTOM_ENV"] == "1"


def test_build_kiwi_client_none(monkeypatch):
    monkeypatch.setattr(settings, "kiwi_mcp_path", None)
    assert build_kiwi_client() is None


def test_build_mcp_clients(monkeypatch):
    monkeypatch.setattr(settings, "kiwi_mcp_path", "/tmp/kiwi.js")
    monkeypatch.setattr(settings, "amadeus_mcp_path", "/tmp/amadeus.js")

    kiwi_client = build_kiwi_client()
    amadeus_client = build_amadeus_client()

    assert kiwi_client is not None
    assert amadeus_client is not None
    assert kiwi_client.is_configured is True
    assert amadeus_client.is_configured is True


def test_build_amadeus_client_none(monkeypatch):
    monkeypatch.setattr(settings, "amadeus_mcp_path", None)
    assert build_amadeus_client() is None


@pytest.mark.asyncio
async def test_mcp_client_restart_limit_exceeded(monkeypatch):
    processes = [DummyProcess([b""]), DummyProcess([b""])]

    async def fake_create_subprocess_exec(*_args, **_kwargs):
        if not processes:
            raise AssertionError("Should not spawn extra process")
        return processes.pop(0)

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_create_subprocess_exec)

    client = MCPClient(
        name="Test",
        command="node",
        args=["server.js"],
        max_restart_attempts=1,
    )

    with pytest.raises(MCPClientError):
        await client.call_tool("search-flight", {"flyFrom": "SFO"})

    with pytest.raises(MCPClientError):
        await client.call_tool("search-flight", {"flyFrom": "SFO"})

    with pytest.raises(MCPClientError, match="restart limit exceeded"):
        await client.call_tool("search-flight", {"flyFrom": "SFO"})


@pytest.mark.asyncio
async def test_mcp_client_logs_stderr_on_error(monkeypatch, caplog):
    process = DummyProcess([b""], stderr_lines=[b"boom\n"])

    async def fake_create_subprocess_exec(*_args, **_kwargs):
        return process

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_create_subprocess_exec)

    client = MCPClient(name="Test", command="node", args=["server.js"])

    with caplog.at_level(logging.WARNING):
        with pytest.raises(MCPClientError):
            await client.call_tool("search-flight", {"flyFrom": "SFO"})

    assert "boom" in caplog.text
