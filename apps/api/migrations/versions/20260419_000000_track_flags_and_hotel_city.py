"""Add track_flights/track_hotels flags and hotel city field.

Revision ID: 005_track_flags_and_hotel_city
Revises: 004_one_way_trips
Create Date: 2026-04-19 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "005_track_flags_and_hotel_city"
down_revision: str | None = "004_one_way_trips"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "trips",
        sa.Column(
            "track_flights",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )
    op.add_column(
        "trips",
        sa.Column(
            "track_hotels",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )
    op.add_column(
        "trip_hotel_prefs",
        sa.Column("city", sa.String(length=200), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("trip_hotel_prefs", "city")
    op.drop_column("trips", "track_hotels")
    op.drop_column("trips", "track_flights")
