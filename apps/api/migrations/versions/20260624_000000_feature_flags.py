"""Add feature_flags table (operator-level runtime toggles).

Replaces the ENABLE_* env vars. Rows are seeded idempotently by
``ensure_feature_flags()`` at API startup, so no data migration is needed here.

Revision ID: 008_feature_flags
Revises: 007_notification_outbox
Create Date: 2026-06-24 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "008_feature_flags"
down_revision: str | None = "007_notification_outbox"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "feature_flags",
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("name"),
    )


def downgrade() -> None:
    op.drop_table("feature_flags")
