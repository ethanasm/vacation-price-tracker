"""Convert legacy native-enum columns to the VARCHAR(20) the migrations declare.

Five Phase-1 columns are ``sa.String(20)`` in ``001_initial`` but were born as
**native Postgres ENUM types** on databases created via SQLModel
``create_all`` (dev, prod, and the pre-reset e2e stack), because their model
fields used bare enum annotations. The models and migrations therefore
described two different schemas, and whichever side a given database matched,
the other failed:

- migration-built DB (rebuilt e2e): queries cast params to the enum type →
  ``type "tripstatus" does not exist``;
- create_all-built DB with the models fixed to VARCHAR: comparisons fail with
  ``operator does not exist: tripstatus = character varying`` (the exact
  error the e2e health check logged for ``notificationstatus`` for weeks).

This migration moves the create_all-born databases onto the declared VARCHAR
shape and drops the orphaned enum types. Values are normalized from the enum
labels (member *names*, e.g. ``ACTIVE``, ``ONE_STOP``) to the StrEnum *values*
the code and the fresh schema use (``active``, ``1-stop``) — note ONE_STOP is
why this is an explicit mapping and not a blanket ``lower()``. Columns that
are already VARCHAR (fresh migration-built DBs) are skipped. The paired model
change (``app/models/enum_column.py``) makes the models render VARCHAR too, so
the two schema sources agree from here on.

Revision ID: 013_enum_cols_to_varchar
Revises: 012_purge_failed_snapshots
Create Date: 2026-08-08 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "013_enum_cols_to_varchar"
down_revision: str | None = "012_purge_failed_snapshots"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# (table, column, native enum type name, label -> stored value, server default)
_COLUMNS: list[tuple[str, str, str, dict[str, str], str]] = [
    (
        "trips",
        "status",
        "tripstatus",
        {"ACTIVE": "active", "PAUSED": "paused", "ERROR": "error", "EXPIRED": "expired"},
        "active",
    ),
    (
        "trip_flight_prefs",
        "stops_mode",
        "stopsmode",
        {"NONSTOP": "nonstop", "ONE_STOP": "1-stop", "ANY": "any"},
        "any",
    ),
    (
        "trip_flight_prefs",
        "cabin",
        "cabinclass",
        {
            "ECONOMY": "economy",
            "PREMIUM_ECONOMY": "premium_economy",
            "BUSINESS": "business",
            "FIRST": "first",
        },
        "economy",
    ),
    (
        "trip_hotel_prefs",
        "room_selection_mode",
        "roomselectionmode",
        {"CHEAPEST": "cheapest", "PREFERRED": "preferred"},
        "cheapest",
    ),
    (
        "notification_rules",
        "threshold_type",
        "thresholdtype",
        {
            "TRIP_TOTAL": "trip_total",
            "FLIGHT_TOTAL": "flight_total",
            "HOTEL_TOTAL": "hotel_total",
        },
        "trip_total",
    ),
]


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        # Native enum types are a Postgres concept; the SQLite test DB is
        # built from the (now VARCHAR-rendering) models.
        return

    for table, column, typename, mapping, default in _COLUMNS:
        udt = bind.execute(
            sa.text(
                "SELECT udt_name FROM information_schema.columns"
                " WHERE table_name = :t AND column_name = :c"
            ),
            {"t": table, "c": column},
        ).scalar()
        if udt == typename:
            cases = " ".join(f"WHEN '{k}' THEN '{v}'" for k, v in mapping.items())
            # A default like 'ACTIVE'::tripstatus would block the TYPE change.
            op.execute(f"ALTER TABLE {table} ALTER COLUMN {column} DROP DEFAULT")
            op.execute(
                f"ALTER TABLE {table} ALTER COLUMN {column} TYPE VARCHAR(20)"
                f" USING CASE {column}::text {cases} ELSE lower({column}::text) END"
            )
            op.execute(
                f"ALTER TABLE {table} ALTER COLUMN {column} SET DEFAULT '{default}'"
            )
        # Fresh migration-built DBs never had the type; IF EXISTS makes the
        # drop a no-op there.
        op.execute(f"DROP TYPE IF EXISTS {typename}")


def downgrade() -> None:
    """Deliberately a no-op.

    The VARCHAR shape is what ``001_initial`` declared all along — downgrading
    to the accidental native-enum shape would reintroduce the model/migration
    divergence this revision exists to end.
    """
