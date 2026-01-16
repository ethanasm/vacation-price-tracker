import asyncio
from types import SimpleNamespace

import pytest
import worker.__main__ as worker_main


class DummyClient:
    @staticmethod
    async def connect(*_args, **_kwargs):
        return object()


class DummyWorker:
    def __init__(self, *, run_immediate: bool = False) -> None:
        self.run_called = False
        self.shutdown_called = False
        self._run_immediate = run_immediate
        self._shutdown_event = asyncio.Event()

    async def run(self) -> None:
        self.run_called = True
        if self._run_immediate:
            return
        await self._shutdown_event.wait()

    async def shutdown(self) -> None:
        self.shutdown_called = True
        self._shutdown_event.set()


@pytest.mark.asyncio
async def test_main_triggers_shutdown_on_signal(monkeypatch):
    dummy_worker = DummyWorker()
    monkeypatch.setattr(worker_main, "Worker", lambda *args, **kwargs: dummy_worker)
    monkeypatch.setattr(worker_main, "Client", SimpleNamespace(connect=DummyClient.connect))

    loop = asyncio.get_running_loop()

    def add_signal_handler(_sig, callback, *args):
        callback(*args)

    monkeypatch.setattr(loop, "add_signal_handler", add_signal_handler)

    await worker_main.main()

    assert dummy_worker.run_called is True
    assert dummy_worker.shutdown_called is True


@pytest.mark.asyncio
async def test_main_exits_when_worker_finishes(monkeypatch):
    dummy_worker = DummyWorker(run_immediate=True)
    monkeypatch.setattr(worker_main, "Worker", lambda *args, **kwargs: dummy_worker)
    monkeypatch.setattr(worker_main, "Client", SimpleNamespace(connect=DummyClient.connect))

    loop = asyncio.get_running_loop()

    def add_signal_handler(_sig, _callback, *_args):
        return None

    monkeypatch.setattr(loop, "add_signal_handler", add_signal_handler)

    await worker_main.main()

    assert dummy_worker.run_called is True
    assert dummy_worker.shutdown_called is False


@pytest.mark.asyncio
async def test_main_uses_signal_fallback(monkeypatch):
    dummy_worker = DummyWorker(run_immediate=True)
    monkeypatch.setattr(worker_main, "Worker", lambda *args, **kwargs: dummy_worker)
    monkeypatch.setattr(worker_main, "Client", SimpleNamespace(connect=DummyClient.connect))

    loop = asyncio.get_running_loop()

    def add_signal_handler(*_args, **_kwargs):
        raise NotImplementedError

    captured = []

    def fake_signal(sig, _handler):
        captured.append(sig)

    monkeypatch.setattr(loop, "add_signal_handler", add_signal_handler)
    monkeypatch.setattr(worker_main.signal, "signal", fake_signal)

    await worker_main.main()

    assert captured
