"""Add users.push_notifications_enabled for per-user mobile push opt-out.

Revision ID: 010_user_push_pref
Revises: 009_device_tokens
Create Date: 2026-06-25 00:01:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "010_user_push_pref"
down_revision: str | None = "009_device_tokens"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "push_notifications_enabled",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "push_notifications_enabled")
