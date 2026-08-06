"""Delete snapshots whose flight fetch failed but were saved as complete rows.

When ``fetch_flights_activity`` errors, the workflow still writes a
``PriceSnapshot``. That row records the hotel leg normally but has
``flight_price = NULL`` and a ``total_price`` covering **hotels only** — while
``raw_data["errors"]["flights"]`` holds the failure ("Activity task timed out").

Nothing downstream knows that total is partial. On the price chart it draws as
a collapse, and `evaluate_notifications_activity` compares each snapshot's
total to the previous one with no awareness of a failed leg — so a
``TRIP_TOTAL`` rule with ``notify_without_threshold`` reads it as an enormous
price drop. In production one affected trip ran $1,183–$6,433 across working
snapshots and $319 on these, against a rule armed to alert on any drop.

This deletes the affected rows. It does **not** stop them being created — the
worker still persists a snapshot when the flight leg fails, and will do it
again on the next timeout. That fix is a behavioural change to the workflow and
belongs in its own change.

Predicate: ``flight_price IS NULL`` **and** a recorded flights error. Both
conditions together, so a hotels-only trip (which legitimately has no flight
price and no error) is never touched. Verified against production 2026-08-06:
2 of 33 snapshots match, and they are exactly the 2 with a flights error.

Revision ID: 012_purge_failed_flight_snapshots
Revises: 011_flight_provider
Create Date: 2026-08-06 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "012_purge_failed_flight_snapshots"
down_revision: str | None = "011_flight_provider"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        # raw_data is JSONB only on Postgres; the SQLite test DB is built from
        # models rather than migrations and has no rows to clean.
        return

    result = bind.execute(
        sa.text(
            """
            DELETE FROM price_snapshots
            WHERE flight_price IS NULL
              AND raw_data -> 'errors' ->> 'flights' IS NOT NULL
            """
        )
    )
    print(f"purged {result.rowcount} snapshot(s) whose flight fetch failed")


def downgrade() -> None:
    """Deliberately a no-op — deleted rows cannot be reconstructed.

    Better an honest no-op than a downgrade that silently pretends to restore
    data it does not have.
    """
