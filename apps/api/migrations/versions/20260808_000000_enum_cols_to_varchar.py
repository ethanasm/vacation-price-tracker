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


# Verbatim from 002_trip_form_view. ALTER COLUMN TYPE is blocked by dependent
# views ("cannot alter type of a column used by a view or rule"), and this
# view reads four of the five converted columns — so it is dropped before the
# conversions and recreated identically afterwards. Prod (create_all-born)
# has no views at all — create_all never ran 002 — so this only fires on a
# hybrid database that has both the enum columns and the view.
_TRIP_FORM_VIEW_SQL = """
    CREATE VIEW trip_form_view AS
    SELECT
        trips.name AS name,
        trips.origin_airport AS origin_airport,
        trips.destination_code AS destination_code,
        trips.is_round_trip AS is_round_trip,
        trips.depart_date AS depart_date,
        trips.return_date AS return_date,
        trips.adults AS adults,
        trip_flight_prefs.cabin AS flight_cabin,
        trip_flight_prefs.stops_mode AS flight_stops_mode,
        trip_flight_prefs.airlines AS flight_airlines,
        trip_hotel_prefs.rooms AS hotel_rooms,
        trip_hotel_prefs.adults_per_room AS hotel_adults_per_room,
        trip_hotel_prefs.room_selection_mode AS hotel_room_selection_mode,
        trip_hotel_prefs.preferred_room_types AS hotel_room_types,
        trip_hotel_prefs.preferred_views AS hotel_views,
        notification_rules.threshold_type AS notification_threshold_type,
        notification_rules.threshold_value AS notification_threshold_value,
        notification_rules.email_enabled AS notification_email_enabled,
        notification_rules.sms_enabled AS notification_sms_enabled
    FROM trips
    LEFT JOIN trip_flight_prefs ON trip_flight_prefs.trip_id = trips.id
    LEFT JOIN trip_hotel_prefs ON trip_hotel_prefs.trip_id = trips.id
    LEFT JOIN notification_rules ON notification_rules.trip_id = trips.id
"""


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        # Native enum types are a Postgres concept; the SQLite test DB is
        # built from the (now VARCHAR-rendering) models.
        return

    needs_conversion = bind.execute(
        sa.text(
            "SELECT count(*) FROM information_schema.columns"
            " WHERE udt_name IN ('tripstatus','stopsmode','cabinclass',"
            "'roomselectionmode','thresholdtype')"
        )
    ).scalar()
    had_view = False
    if needs_conversion:
        had_view = bool(
            bind.execute(
                sa.text(
                    "SELECT count(*) FROM information_schema.views"
                    " WHERE table_schema = 'public'"
                    " AND table_name = 'trip_form_view'"
                )
            ).scalar()
        )
        if had_view:
            op.execute("DROP VIEW trip_form_view")

    for table, column, typename, mapping, default in _COLUMNS:
        udt = bind.execute(
            sa.text(
                "SELECT udt_name FROM information_schema.columns"
                " WHERE table_name = :t AND column_name = :c"
            ),
            {"t": table, "c": column},
        ).scalar()
        if udt == typename:
            # No ELSE fallback: an enum label missing from the mapping yields
            # NULL and aborts on the NOT NULL constraint, rolling the revision
            # back — a loud stop beats silently storing a mislabeled value.
            # (Every label was verified against prod's pg_enum before this
            # shipped, so the branch should be unreachable.)
            cases = " ".join(f"WHEN '{k}' THEN '{v}'" for k, v in mapping.items())
            # A default like 'ACTIVE'::tripstatus would block the TYPE change.
            op.execute(f"ALTER TABLE {table} ALTER COLUMN {column} DROP DEFAULT")
            op.execute(
                f"ALTER TABLE {table} ALTER COLUMN {column} TYPE VARCHAR(20)"
                f" USING CASE {column}::text {cases} END"
            )
            op.execute(
                f"ALTER TABLE {table} ALTER COLUMN {column} SET DEFAULT '{default}'"
            )
        # Drop the orphaned type — but only when nothing still references it.
        # An unconditional drop would raise DependentObjectsStillExistError if
        # any column outside _COLUMNS used the type, rolling back the whole
        # revision *after* the deploy already put new images live (deploy.yml
        # brings the stack up before migrating) — a full outage rather than a
        # clean failure. IF EXISTS covers fresh migration-built DBs that never
        # had the type.
        refs = bind.execute(
            sa.text(
                "SELECT count(*) FROM pg_attribute a"
                " JOIN pg_type t ON t.oid = a.atttypid"
                " WHERE t.typname = :typ AND a.attnum > 0 AND NOT a.attisdropped"
            ),
            {"typ": typename},
        ).scalar()
        if refs == 0:
            op.execute(f"DROP TYPE IF EXISTS {typename}")
        else:
            print(
                f"NOT dropping type {typename}: still referenced by {refs} "
                f"column(s) outside this migration's list — investigate"
            )

    if had_view:
        op.execute(_TRIP_FORM_VIEW_SQL)


def downgrade() -> None:
    """Deliberately a no-op — and NOT a safe rollback path.

    The VARCHAR shape is what ``001_initial`` declared all along — downgrading
    to the accidental native-enum shape would reintroduce the model/migration
    divergence this revision exists to end.

    Operational note: once this revision has run, reverting the app image
    alone does NOT recover — the old (bare-enum) models query enum types that
    no longer exist. Roll forward, or restore the pre-migration dump that
    deploy.yml takes before every migrate ("Pre-migration DB backup").
    """
