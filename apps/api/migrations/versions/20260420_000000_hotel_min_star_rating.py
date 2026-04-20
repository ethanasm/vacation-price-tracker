"""Add min_star_rating column to trip_hotel_prefs.

Revision ID: 006_hotel_min_star_rating
Revises: 005_track_flags_and_hotel_city
Create Date: 2026-04-20 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "006_hotel_min_star_rating"
down_revision: str | None = "005_track_flags_and_hotel_city"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "trip_hotel_prefs",
        sa.Column("min_star_rating", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("trip_hotel_prefs", "min_star_rating")
