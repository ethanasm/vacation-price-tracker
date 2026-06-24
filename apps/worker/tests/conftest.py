from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

# Disable Langfuse telemetry for tests — must happen BEFORE any `app.*` import.
os.environ["LANGFUSE_PUBLIC_KEY"] = ""
os.environ["LANGFUSE_SECRET_KEY"] = ""

WORKER_ROOT = Path(__file__).resolve().parents[1]
if str(WORKER_ROOT) not in sys.path:
    sys.path.insert(0, str(WORKER_ROOT))


@pytest.fixture(autouse=True)
def _real_skiplagged_by_default(monkeypatch):
    """Pin ``mock_skiplagged_api`` off so the activity tests are deterministic
    regardless of the ambient ``MOCK_SKIPLAGGED_API``.

    The dev ``.env`` sets ``MOCK_SKIPLAGGED_API=true``, and Nx's ``run-commands``
    auto-loads ``.env`` — so ``pnpm verify`` / ``pnpm nx run worker:test:coverage``
    ran the activities down the *mock* branch, where the tests' patched
    ``SkiplaggedClient`` is never called (CI was green only because its fresh
    checkout has no ``.env``). Defaulting the flag off here makes the suite pass
    whether or not a ``.env`` is present; tests that exercise mock mode opt back
    in with their own ``monkeypatch.setattr(..., "mock_skiplagged_api", True)``,
    which runs after this fixture and wins.
    """
    from app.core.config import settings

    monkeypatch.setattr(settings, "mock_skiplagged_api", False)
