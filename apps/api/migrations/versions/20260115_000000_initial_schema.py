"""Initial schema with all Phase 1 tables.

Revision ID: 001_initial
Revises:
Create Date: 2026-01-15 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create users table
    op.create_table(
        "users",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("google_sub", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_google_sub"), "users", ["google_sub"], unique=True)

    # Create trips table
    op.create_table(
        "trips",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("origin_airport", sa.String(length=3), nullable=False),
        sa.Column("destination_code", sa.String(length=3), nullable=False),
        sa.Column("is_round_trip", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("depart_date", sa.Date(), nullable=False),
        sa.Column("return_date", sa.Date(), nullable=False),
        sa.Column("adults", sa.Integer(), nullable=False, server_default="1"),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="active",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_trips_user_id",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "name", name="uq_trip_user_name"),
    )
    op.create_index(op.f("ix_trips_user_id"), "trips", ["user_id"])
    op.create_index(op.f("ix_trips_status"), "trips", ["status"])

    # Create trip_flight_prefs table
    # Note: Using JSON type for arrays to support both PostgreSQL and SQLite
    op.create_table(
        "trip_flight_prefs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("trip_id", sa.UUID(), nullable=False),
        sa.Column(
            "airlines",
            sa.JSON(),
            nullable=False,
            server_default="[]",
        ),
        sa.Column(
            "stops_mode",
            sa.String(length=20),
            nullable=False,
            server_default="any",
        ),
        sa.Column("max_stops", sa.Integer(), nullable=True),
        sa.Column(
            "cabin",
            sa.String(length=20),
            nullable=False,
            server_default="economy",
        ),
        sa.ForeignKeyConstraint(
            ["trip_id"],
            ["trips.id"],
            name="fk_trip_flight_prefs_trip_id",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("trip_id", name="uq_trip_flight_prefs_trip_id"),
    )

    # Create trip_hotel_prefs table
    op.create_table(
        "trip_hotel_prefs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("trip_id", sa.UUID(), nullable=False),
        sa.Column("rooms", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("adults_per_room", sa.Integer(), nullable=False, server_default="2"),
        sa.Column(
            "room_selection_mode",
            sa.String(length=20),
            nullable=False,
            server_default="cheapest",
        ),
        sa.Column(
            "preferred_room_types",
            sa.JSON(),
            nullable=False,
            server_default="[]",
        ),
        sa.Column(
            "preferred_views",
            sa.JSON(),
            nullable=False,
            server_default="[]",
        ),
        sa.ForeignKeyConstraint(
            ["trip_id"],
            ["trips.id"],
            name="fk_trip_hotel_prefs_trip_id",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("trip_id", name="uq_trip_hotel_prefs_trip_id"),
    )

    # Create price_snapshots table
    op.create_table(
        "price_snapshots",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("trip_id", sa.UUID(), nullable=False),
        sa.Column("flight_price", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column("hotel_price", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column("total_price", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column(
            "raw_data",
            sa.JSON(),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["trip_id"],
            ["trips.id"],
            name="fk_price_snapshots_trip_id",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_price_snapshots_trip_id"), "price_snapshots", ["trip_id"])
    op.create_index(op.f("ix_price_snapshots_created_at"), "price_snapshots", ["created_at"])

    # Create notification_rules table
    op.create_table(
        "notification_rules",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("trip_id", sa.UUID(), nullable=False),
        sa.Column(
            "threshold_type",
            sa.String(length=20),
            nullable=False,
            server_default="trip_total",
        ),
        sa.Column("threshold_value", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column(
            "notify_without_threshold",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
        sa.Column("email_enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("sms_enabled", sa.Boolean(), nullable=False, server_default="false"),
        sa.ForeignKeyConstraint(
            ["trip_id"],
            ["trips.id"],
            name="fk_notification_rules_trip_id",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("trip_id", name="uq_notification_rules_trip_id"),
    )


def downgrade() -> None:
    op.drop_table("notification_rules")
    op.drop_index(op.f("ix_price_snapshots_created_at"), table_name="price_snapshots")
    op.drop_index(op.f("ix_price_snapshots_trip_id"), table_name="price_snapshots")
    op.drop_table("price_snapshots")
    op.drop_table("trip_hotel_prefs")
    op.drop_table("trip_flight_prefs")
    op.drop_index(op.f("ix_trips_status"), table_name="trips")
    op.drop_index(op.f("ix_trips_user_id"), table_name="trips")
    op.drop_table("trips")
    op.drop_index(op.f("ix_users_google_sub"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
