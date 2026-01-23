"""Create view for trip form fields.

Revision ID: 002_trip_form_view
Revises: 001_initial
Create Date: 2026-01-23 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "002_trip_form_view"
down_revision: str | None = "001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
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
    )


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS trip_form_view")
