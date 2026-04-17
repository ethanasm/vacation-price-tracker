"""Allow NULL return_date on trips for one-way support.

Revision ID: 004_one_way_trips
Revises: 003_conversations
Create Date: 2026-04-16 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "004_one_way_trips"
down_revision: str | None = "003_conversations"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("trips", "return_date", existing_type=sa.Date(), nullable=True)


def downgrade() -> None:
    op.execute(
        "UPDATE trips SET return_date = depart_date + INTERVAL '1 day' "
        "WHERE return_date IS NULL"
    )
    op.alter_column("trips", "return_date", existing_type=sa.Date(), nullable=False)
