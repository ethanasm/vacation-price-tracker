#!/usr/bin/env bash
# CI test for 013_enum_cols_to_varchar's CONVERSION branch.
#
# The "Migrations against Postgres" step runs the chain on an empty database,
# which only exercises 013's skip path (columns already VARCHAR). This script
# rebuilds the create_all-era shape the migration actually exists for — native
# enum types whose labels and stored data are the StrEnum member NAMES, as
# verified on prod — at revision 012, then runs `upgrade head` and asserts the
# columns became VARCHAR, the data was normalized (including the one mapping
# where lower(name) != value: ONE_STOP -> '1-stop'), and the types are gone.
set -euo pipefail

PGURL="${PGURL:-postgresql://postgres:postgres@localhost:5432}"
DB="vpt_migrate_legacy"

psql "${PGURL}/postgres" -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE IF EXISTS ${DB}" \
  -c "CREATE DATABASE ${DB}"

export DATABASE_URL="postgresql+asyncpg://${PGURL#postgresql://}/${DB}"

uv run alembic upgrade 012_purge_failed_snapshots

psql "${PGURL}/${DB}" -v ON_ERROR_STOP=1 <<'SQL'
-- Recreate the create_all-era shape: native enum types labeled with the
-- member NAMES (what SQLModel's bare-enum columns produced), then flip the
-- five columns onto them. The view from 002 blocks ALTER COLUMN TYPE, so it
-- is dropped and recreated around the flips — leaving the DB in the hybrid
-- enum-columns-plus-view shape that exercises 013's own view handling.
DROP VIEW trip_form_view;
CREATE TYPE tripstatus AS ENUM ('ACTIVE','PAUSED','ERROR','EXPIRED');
CREATE TYPE stopsmode AS ENUM ('NONSTOP','ONE_STOP','ANY');
CREATE TYPE cabinclass AS ENUM ('ECONOMY','PREMIUM_ECONOMY','BUSINESS','FIRST');
CREATE TYPE roomselectionmode AS ENUM ('CHEAPEST','PREFERRED');
CREATE TYPE thresholdtype AS ENUM ('TRIP_TOTAL','FLIGHT_TOTAL','HOTEL_TOTAL');
ALTER TABLE trips
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE tripstatus USING upper(status)::tripstatus;
ALTER TABLE trip_flight_prefs
  ALTER COLUMN stops_mode DROP DEFAULT,
  ALTER COLUMN stops_mode TYPE stopsmode
    USING (CASE stops_mode WHEN '1-stop' THEN 'ONE_STOP' ELSE upper(stops_mode) END)::stopsmode,
  ALTER COLUMN cabin DROP DEFAULT,
  ALTER COLUMN cabin TYPE cabinclass USING upper(cabin)::cabinclass;
ALTER TABLE trip_hotel_prefs
  ALTER COLUMN room_selection_mode DROP DEFAULT,
  ALTER COLUMN room_selection_mode TYPE roomselectionmode
    USING upper(room_selection_mode)::roomselectionmode;
ALTER TABLE notification_rules
  ALTER COLUMN threshold_type DROP DEFAULT,
  ALTER COLUMN threshold_type TYPE thresholdtype USING upper(threshold_type)::thresholdtype;

-- Restore the view (verbatim from 002) so the fixture DB has BOTH the enum
-- columns and the dependent view — the shape that blocks a naive migration.
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
LEFT JOIN notification_rules ON notification_rules.trip_id = trips.id;

-- Seed rows storing the member NAMES, exactly like prod (ONE_STOP included —
-- the one value where a blanket lower() would corrupt data).
INSERT INTO users (id, email, google_sub)
  VALUES ('00000000-0000-0000-0000-000000000001', 'fixture@test', 'fixture-sub');
INSERT INTO trips (id, user_id, name, origin_airport, destination_code, depart_date, status)
  VALUES ('00000000-0000-0000-0000-000000000002',
          '00000000-0000-0000-0000-000000000001',
          'Fixture', 'SFO', 'CDG', '2027-01-01', 'ERROR');
INSERT INTO trip_flight_prefs (id, trip_id, stops_mode, cabin)
  VALUES ('00000000-0000-0000-0000-000000000003',
          '00000000-0000-0000-0000-000000000002', 'ONE_STOP', 'PREMIUM_ECONOMY');
INSERT INTO trip_hotel_prefs (id, trip_id, room_selection_mode)
  VALUES ('00000000-0000-0000-0000-000000000004',
          '00000000-0000-0000-0000-000000000002', 'CHEAPEST');
INSERT INTO notification_rules (id, trip_id, threshold_type, threshold_value)
  VALUES ('00000000-0000-0000-0000-000000000005',
          '00000000-0000-0000-0000-000000000002', 'TRIP_TOTAL', 100.00);
SQL

uv run alembic upgrade head

fail=0
check() {
  local got
  got="$(psql "${PGURL}/${DB}" -tAc "$1")"
  if [ "${got}" != "$2" ]; then
    echo "FAIL: $1 -> '${got}' (expected '$2')"
    fail=1
  fi
}

check "SELECT udt_name FROM information_schema.columns WHERE table_name='trips' AND column_name='status'" "varchar"
check "SELECT udt_name FROM information_schema.columns WHERE table_name='trip_flight_prefs' AND column_name='stops_mode'" "varchar"
check "SELECT status FROM trips" "error"
check "SELECT stops_mode FROM trip_flight_prefs" "1-stop"
check "SELECT cabin FROM trip_flight_prefs" "premium_economy"
check "SELECT room_selection_mode FROM trip_hotel_prefs" "cheapest"
check "SELECT threshold_type FROM notification_rules" "trip_total"
check "SELECT count(*) FROM pg_type WHERE typname IN ('tripstatus','stopsmode','cabinclass','roomselectionmode','thresholdtype')" "0"
check "SELECT version_num FROM alembic_version" "013_enum_cols_to_varchar"
# The migration must drop and faithfully recreate trip_form_view around the
# ALTERs — a dependent view blocks ALTER COLUMN TYPE outright.
check "SELECT count(*) FROM information_schema.views WHERE table_name='trip_form_view'" "1"
check "SELECT flight_stops_mode FROM trip_form_view" "1-stop"

if [ "${fail}" -eq 0 ]; then
  echo "migration 013 conversion-path assertions all passed"
fi
exit "${fail}"
