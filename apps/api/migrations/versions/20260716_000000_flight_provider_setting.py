"""Flight provider selection + snapshot provider marker.

1. Add the ``app_settings`` table (string-valued operator toggles — the
   multi-state cousin of ``feature_flags``). Rows are seeded idempotently by
   ``ensure_app_settings()`` at API startup; here we seed ``flight_provider``
   explicitly to carry over the state of the old boolean ``kiwi_flights``
   feature flag (enabled -> "kiwi"), then delete that flag row.
2. Add ``price_snapshots.provider`` — every snapshot carries a marker for the
   flight provider it was taken from. Existing rows are backfilled from the
   marker the worker has always written into ``raw_data["flights"]["provider"]``
   (Postgres only; the SQLite test DB is created from models, not migrations).

Revision ID: 011_flight_provider
Revises: 010_user_push_pref
Create Date: 2026-07-16 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "011_flight_provider"
down_revision: str | None = "010_user_push_pref"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "app_settings",
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=False),
        sa.Column("value", sa.String(length=64), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("name"),
    )

    # Carry the old kiwi_flights flag state into the new setting, then retire
    # the flag row (it is no longer in the code registry).
    op.execute(
        """
        INSERT INTO app_settings (name, description, value, updated_at)
        SELECT
            'flight_provider',
            'Which provider serves flight searches (hotels stay on Skiplagged).',
            CASE
                WHEN EXISTS (
                    SELECT 1 FROM feature_flags
                    WHERE name = 'kiwi_flights' AND enabled
                ) THEN 'kiwi'
                ELSE 'skiplagged'
            END,
            now()
        """
    )
    op.execute("DELETE FROM feature_flags WHERE name = 'kiwi_flights'")

    op.add_column(
        "price_snapshots",
        sa.Column("provider", sa.String(length=32), nullable=True),
    )
    # Backfill from the provider marker inside raw_data (JSON path syntax is
    # Postgres-specific; other dialects simply leave old rows NULL).
    if op.get_bind().dialect.name == "postgresql":
        op.execute(
            """
            UPDATE price_snapshots
            SET provider = raw_data #>> '{flights,provider}'
            WHERE provider IS NULL
              AND raw_data #>> '{flights,provider}' IS NOT NULL
            """
        )


def downgrade() -> None:
    op.drop_column("price_snapshots", "provider")
    op.execute(
        """
        INSERT INTO feature_flags (name, description, enabled, updated_at)
        SELECT
            'kiwi_flights',
            'Use Kiwi.com as the flight search provider instead of Skiplagged (hotels stay on Skiplagged).',
            EXISTS (
                SELECT 1 FROM app_settings
                WHERE name = 'flight_provider' AND value = 'kiwi'
            ),
            now()
        """
    )
    op.drop_table("app_settings")
