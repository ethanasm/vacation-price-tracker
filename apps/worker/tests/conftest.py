from __future__ import annotations

import os
import sys
from pathlib import Path

# Disable Langfuse telemetry for tests — must happen BEFORE any `app.*` import.
os.environ["LANGFUSE_PUBLIC_KEY"] = ""
os.environ["LANGFUSE_SECRET_KEY"] = ""

WORKER_ROOT = Path(__file__).resolve().parents[1]
if str(WORKER_ROOT) not in sys.path:
    sys.path.insert(0, str(WORKER_ROOT))
