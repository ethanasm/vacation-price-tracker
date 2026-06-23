"""Add notification outbox table, rule dedup columns, and email opt-out.

Revision ID: 007_notification_outbox
Revises: 006_hotel_min_star_rating
Create Date: 2026-06-23 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "007_notification_outbox"
down_revision: str | None = "006_hotel_min_star_rating"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Global email opt-out (unsubscribe target). server_default backfills
    # existing rows so the NOT NULL column is valid immediately.
    op.add_column(
        "users",
        sa.Column(
            "email_notifications_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )

    # Price-drop dedup state on the per-trip rule.
    op.add_column(
        "notification_rules",
        sa.Column("last_notified_price", sa.Numeric(precision=10, scale=2), nullable=True),
    )
    op.add_column(
        "notification_rules",
        sa.Column("last_notified_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Transactional outbox of queued notifications (one row per triggering
    # snapshot; unique on snapshot_id makes enqueueing idempotent).
    op.create_table(
        "notification_outbox",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("trip_id", sa.UUID(), nullable=False),
        sa.Column("snapshot_id", sa.UUID(), nullable=False),
        sa.Column(
            "threshold_type",
            sa.String(length=20),
            nullable=False,
            server_default="trip_total",
        ),
        sa.Column("old_price", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column("new_price", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("threshold_value", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_notification_outbox_user_id", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["trip_id"], ["trips.id"], name="fk_notification_outbox_trip_id", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["snapshot_id"],
            ["price_snapshots.id"],
            name="fk_notification_outbox_snapshot_id",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("snapshot_id", name="uq_notification_outbox_snapshot_id"),
    )
    op.create_index(
        "ix_notification_outbox_status_user",
        "notification_outbox",
        ["status", "user_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_notification_outbox_status_user", table_name="notification_outbox")
    op.drop_table("notification_outbox")
    op.drop_column("notification_rules", "last_notified_at")
    op.drop_column("notification_rules", "last_notified_price")
    op.drop_column("users", "email_notifications_enabled")
