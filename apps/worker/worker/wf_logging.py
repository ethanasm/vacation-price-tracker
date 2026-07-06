"""Replay-safe logging for workflow code.

Inside a workflow event loop, ``temporalio.workflow.logger`` is the right tool:
it suppresses logs during history replay (a retried workflow task otherwise
re-fires every prior log event, which inflated ``workflow.refresh_all.failed``
counts ~10x in prod) and stamps workflow context onto the record. But its
``isEnabledFor`` requires a running workflow event loop, so it raises in unit
tests that call a workflow's ``run()`` directly. ``wf_logger`` returns the
appropriate logger for the current context.
"""

import logging

from temporalio import workflow


def wf_logger(fallback: logging.Logger) -> logging.Logger | logging.LoggerAdapter:
    """Return ``workflow.logger`` inside a workflow, ``fallback`` outside."""
    return workflow.logger if workflow.in_workflow() else fallback
