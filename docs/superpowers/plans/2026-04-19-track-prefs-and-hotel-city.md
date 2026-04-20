# Track Flight/Hotel Preferences & Hotel City Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users explicitly opt in/out of flight and hotel tracking per trip via two checkboxes, gate the corresponding preferences sections behind those checkboxes, disable the Create button when neither is selected, and add a free-text `city` field to Hotel Preferences that is fed to Skiplagged's hotel search instead of the destination airport code.

**Architecture:** Add two boolean columns (`track_flights`, `track_hotels`) to `trips` and a nullable `city` column to `trip_hotel_prefs`. Require at least one track flag on create (Pydantic model validator). The Temporal workflow branches on the flags so `fetch_flights_activity` / `fetch_hotels_activity` only run when their flag is true. The hotel activity prefers `hotel_prefs.city` and falls back to `destination_code` when `city` is blank. On the frontend, add a shadcn `Checkbox` primitive, extend `TripFormData`/`TripPayload` with `trackFlights`/`trackHotels`/`hotelPrefs.city`, gate `FlightPrefsSection` and `HotelPrefsSection` inputs behind the checkboxes (using the `disabled` prop on every shadcn control), and disable the Create button when neither checkbox is checked. `getPayload()` sets `flight_prefs = null` and `hotel_prefs = null` when the respective flag is false (worker uses flags directly; payload shape stays backwards-compatible).

**Tech Stack:** FastAPI + SQLModel + Alembic (backend); Temporal Python SDK (worker); Next.js 14 + shadcn/ui + React Testing Library + Jest (frontend); Playwright (E2E).

---

## File Structure

### Files to Create

- `apps/api/migrations/versions/20260419_000000_track_flags_and_hotel_city.py` — Alembic migration: adds `track_flights BOOLEAN NOT NULL DEFAULT true`, `track_hotels BOOLEAN NOT NULL DEFAULT true` to `trips`; adds `city VARCHAR(200) NULL` to `trip_hotel_prefs`.
- `apps/web/src/components/ui/checkbox.tsx` — shadcn `Checkbox` primitive (Radix wrapper), matches existing UI library style.
- `apps/web/src/__tests__/trip-form-hotel-prefs-section.test.tsx` — Jest/RTL tests for the updated hotel section (checkbox gating, city field, disabled states).
- `apps/web/src/__tests__/trip-form-flight-prefs-section-tracking.test.tsx` — Jest/RTL tests for the updated flight section (checkbox gating).
- `apps/web/e2e/track-prefs-hotel-city.spec.ts` — Playwright E2E spec exercising checkbox/city flow end-to-end.

### Files to Modify

- `apps/api/app/models/trip.py` — add `track_flights`, `track_hotels` SQLModel fields.
- `apps/api/app/models/trip_prefs.py` — add `city: str | None` field to `TripHotelPrefs`.
- `apps/api/app/schemas/trip.py` — add `city` to `HotelPrefs`; add `track_flights`/`track_hotels` to `TripCreate` + `TripDetail` + `TripResponse`; add model validator enforcing `track_flights or track_hotels == True` and `hotel_prefs required when track_hotels == True` / `flight_prefs required when track_flights == True`.
- `apps/api/app/routers/trips.py` — persist the new fields in `create_trip`; reflect them in `_build_trip_detail` / `_build_trip_response` / `_hotel_prefs_to_schema`.
- `apps/api/tests/test_trips.py` — add coverage for: both flags true, flights-only, hotels-only (with city), both false rejection, city round-trip.
- `apps/worker/worker/types.py` — add `track_flights`, `track_hotels` to `TripDetails`; add `city: str | None` to `HotelPrefsData`.
- `apps/worker/worker/activities/price_check.py` — `load_trip_details` returns the new fields; `fetch_hotels_activity` prefers `hotel_prefs["city"]` and falls back to `destination_code`.
- `apps/worker/worker/workflows/price_check.py` — conditionally schedule `fetch_flights_activity` / `fetch_hotels_activity` based on `trip["track_flights"]` / `trip["track_hotels"]`.
- `apps/worker/tests/test_price_check_activities.py` — add `track_*` / `city` to existing trip fixtures; add tests for city fallback.
- `apps/worker/tests/test_workflows.py` — add tests for flag-gated activity scheduling.
- `apps/web/src/components/trip-form/types.ts` — add `trackFlights`/`trackHotels` to `TripFormData`, `hotelPrefs.city` to `HotelPrefsData`, add matching setters to `TripFormSetters`, add `hotelCity` to `TripFormErrors`, add `track_flights`/`track_hotels`/`hotel_prefs.city` to `TripPayload`.
- `apps/web/src/components/trip-form/validation.ts` — add `validateHotelCity`; `validateTripForm` requires city when `trackHotels` is true and requires at least one of `trackFlights`/`trackHotels`.
- `apps/web/src/components/trip-form/flight-prefs-section.tsx` — add `Track Flight Prices` checkbox at the top; disable Cabin/Stops/Airlines controls when unchecked.
- `apps/web/src/components/trip-form/hotel-prefs-section.tsx` — add `Track Hotel Prices` checkbox at the top; add `City` text field; disable all section controls when unchecked.
- `apps/web/src/components/trip-form/hotel-prefs-section.module.css` — add `.checkboxRow` / `.disabledSection` styles.
- `apps/web/src/components/trip-form/flight-prefs-section.module.css` — add `.checkboxRow` / `.disabledSection` styles.
- `apps/web/src/lib/hooks/use-trip-form.ts` — default `trackFlights: true`, `trackHotels: true`, `hotelPrefs.city: ""`; add setters; `getPayload()` uses `trackFlights`/`trackHotels` (replacing the old heuristic); `tripDetailToFormData` reads the new fields; `validate()` + `isValid` reflect the new rules.
- `apps/web/src/app/trips/new/page.tsx` — pass the new props to `FlightPrefsSection` and `HotelPrefsSection`; Create button already uses `isValid` which now encodes the "both-off" rule.
- `apps/web/src/app/trips/[tripId]/edit/page.tsx` — set `trackFlights`/`trackHotels` / hotel `city` from loaded trip.
- `apps/web/src/components/trip-form/chat-trip-form.tsx` — pass the new props.
- `apps/web/src/lib/api.ts` — add `track_flights`/`track_hotels` to `UpdateTripRequest` and `hotel_prefs.city`.
- `apps/web/src/__tests__/use-trip-form.test.tsx` — extend to assert new payload fields and default values.
- `apps/web/src/__tests__/trip-form-validation.test.ts` — extend for new rules.

---

## Task 1: Alembic migration for track flags and hotel city

**Files:**
- Create: `apps/api/migrations/versions/20260419_000000_track_flags_and_hotel_city.py`

- [ ] **Step 1: Inspect the most recent migration to know the `down_revision`**

Run: `ls apps/api/migrations/versions/`
Expected: includes `20260416_000000_one_way_trips.py`.

Run: `head -20 apps/api/migrations/versions/20260416_000000_one_way_trips.py`
Expected: `revision: str = "004_one_way_trips"`

- [ ] **Step 2: Create the new migration file**

Create `apps/api/migrations/versions/20260419_000000_track_flags_and_hotel_city.py`:

```python
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
```

- [ ] **Step 3: Apply the migration**

Run: `pnpm db:migrate`
Expected: `Running upgrade 004_one_way_trips -> 005_track_flags_and_hotel_city`. Exit 0.

- [ ] **Step 4: Verify columns exist**

Run: `docker exec db psql -U postgres -d vacation_tracker -c "\d trips"`
Expected: output includes `track_flights | boolean | not null | default true` and `track_hotels | boolean | not null | default true`.

Run: `docker exec db psql -U postgres -d vacation_tracker -c "\d trip_hotel_prefs"`
Expected: output includes `city | character varying(200) |` (nullable, no default).

- [ ] **Step 5: Commit**

```bash
git add apps/api/migrations/versions/20260419_000000_track_flags_and_hotel_city.py
git commit -m "feat(api): migration for trip track flags and hotel city"
```

---

## Task 2: Backend model fields

**Files:**
- Modify: `apps/api/app/models/trip.py`
- Modify: `apps/api/app/models/trip_prefs.py`

- [ ] **Step 1: Add the tracking fields to `Trip`**

In `apps/api/app/models/trip.py`, after the existing `adults` field (line 24) and before `status`, add the two track fields:

Find:
```python
    adults: int = Field(default=1, ge=1, le=9, nullable=False)
    status: TripStatus = Field(default=TripStatus.ACTIVE, nullable=False)
```

Replace with:
```python
    adults: int = Field(default=1, ge=1, le=9, nullable=False)
    track_flights: bool = Field(default=True, nullable=False)
    track_hotels: bool = Field(default=True, nullable=False)
    status: TripStatus = Field(default=TripStatus.ACTIVE, nullable=False)
```

- [ ] **Step 2: Add `city` to `TripHotelPrefs`**

In `apps/api/app/models/trip_prefs.py`, after the `adults_per_room` field (line 46), add a nullable `city` field:

Find:
```python
    rooms: int = Field(default=1, ge=1, le=9, nullable=False)
    adults_per_room: int = Field(default=2, ge=1, le=4, nullable=False)
    room_selection_mode: RoomSelectionMode = Field(default=RoomSelectionMode.CHEAPEST, nullable=False)
```

Replace with:
```python
    rooms: int = Field(default=1, ge=1, le=9, nullable=False)
    adults_per_room: int = Field(default=2, ge=1, le=4, nullable=False)
    city: str | None = Field(default=None, max_length=200, nullable=True)
    room_selection_mode: RoomSelectionMode = Field(default=RoomSelectionMode.CHEAPEST, nullable=False)
```

- [ ] **Step 3: Run API tests to confirm models still load**

Run: `uv run pytest apps/api/tests/test_models.py -v`
Expected: all existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/api/app/models/trip.py apps/api/app/models/trip_prefs.py
git commit -m "feat(api): add track flags to Trip and city to TripHotelPrefs models"
```

---

## Task 3: Backend Pydantic schemas with validation

**Files:**
- Modify: `apps/api/app/schemas/trip.py`
- Test: `apps/api/tests/test_trip_schemas.py` (create if missing, else extend)

- [ ] **Step 1: Write failing tests for new schema rules**

Check whether `apps/api/tests/test_trip_schemas.py` exists:

Run: `ls apps/api/tests/test_trip_schemas.py 2>/dev/null || echo "missing"`

If missing, create `apps/api/tests/test_trip_schemas.py`:

```python
"""Tests for Pydantic schema validation rules added for track flags and hotel city."""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.schemas.trip import HotelPrefs, NotificationPrefs, TripCreate


def _base_payload(**overrides):
    today = date.today()
    base = {
        "name": "Test Trip",
        "origin_airport": "SFO",
        "destination_code": "HNL",
        "depart_date": today + timedelta(days=30),
        "return_date": today + timedelta(days=37),
        "notification_prefs": NotificationPrefs(threshold_value=Decimal("2000.00")),
        "track_flights": True,
        "track_hotels": True,
    }
    base.update(overrides)
    return base


def test_track_flights_only_requires_no_hotel_prefs():
    trip = TripCreate(**_base_payload(track_hotels=False))
    assert trip.track_flights is True
    assert trip.track_hotels is False
    assert trip.hotel_prefs is None


def test_track_hotels_only_with_city():
    payload = _base_payload(
        track_flights=False,
        hotel_prefs=HotelPrefs(city="Downtown Orlando"),
    )
    trip = TripCreate(**payload)
    assert trip.track_flights is False
    assert trip.track_hotels is True
    assert trip.hotel_prefs.city == "Downtown Orlando"


def test_neither_flag_rejected():
    with pytest.raises(ValidationError) as exc:
        TripCreate(**_base_payload(track_flights=False, track_hotels=False))
    assert "at least one of track_flights or track_hotels" in str(exc.value).lower()


def test_track_hotels_requires_hotel_prefs_with_city():
    # hotel_prefs omitted
    with pytest.raises(ValidationError) as exc:
        TripCreate(**_base_payload(track_flights=False, hotel_prefs=None))
    assert "hotel_prefs" in str(exc.value).lower()

    # hotel_prefs present but city blank
    with pytest.raises(ValidationError) as exc:
        TripCreate(**_base_payload(hotel_prefs=HotelPrefs(city="")))
    assert "city" in str(exc.value).lower()

    # hotel_prefs present but city None
    with pytest.raises(ValidationError) as exc:
        TripCreate(**_base_payload(hotel_prefs=HotelPrefs(city=None)))
    assert "city" in str(exc.value).lower()


def test_hotel_prefs_allows_city_up_to_200_chars():
    prefs = HotelPrefs(city="A" * 200)
    assert len(prefs.city) == 200
    with pytest.raises(ValidationError):
        HotelPrefs(city="A" * 201)


def test_defaults_both_flags_true():
    payload = _base_payload()
    payload.pop("track_flights")
    payload.pop("track_hotels")
    trip = TripCreate(**payload)
    assert trip.track_flights is True
    assert trip.track_hotels is True
```

- [ ] **Step 2: Run the new tests and confirm they fail**

Run: `uv run pytest apps/api/tests/test_trip_schemas.py -v`
Expected: FAIL (`TripCreate.__init__() got an unexpected keyword argument 'track_flights'` or similar).

- [ ] **Step 3: Extend `HotelPrefs` and `TripCreate` schemas**

In `apps/api/app/schemas/trip.py`, replace `HotelPrefs` (lines 51-73):

```python
class HotelPrefs(BaseModel):
    """Hotel preferences for a trip."""

    rooms: Annotated[int, Field(ge=1, le=9)] = Field(
        default=1,
        description="Number of rooms needed",
    )
    adults_per_room: Annotated[int, Field(ge=1, le=4)] = Field(
        default=2,
        description="Number of adults per room",
    )
    city: Annotated[str | None, Field(max_length=200)] = Field(
        default=None,
        description="Free-text city name sent to the Skiplagged hotel search (overrides destination airport)",
    )
    room_selection_mode: RoomSelectionMode = Field(
        default=RoomSelectionMode.CHEAPEST,
        description="How to select rooms: cheapest or preferred",
    )
    preferred_room_types: list[str] = Field(
        default_factory=list,
        description="Preferred room types (e.g., ['King', 'Suite'])",
    )
    preferred_views: list[str] = Field(
        default_factory=list,
        description="Preferred views (e.g., ['Ocean', 'City'])",
    )
```

In the same file, replace `TripCreate` (lines 102-164) with:

```python
class TripCreate(BaseModel):
    """Schema for creating a new trip."""

    name: Annotated[str, Field(min_length=1, max_length=100)] = Field(
        description="Trip name (must be unique per user)",
    )
    origin_airport: str = Field(
        pattern=r"^[A-Z]{3}$",
        description="Origin airport IATA code (e.g., 'SFO')",
    )
    destination_code: str = Field(
        pattern=r"^[A-Z]{3}$",
        description="Destination airport IATA code (e.g., 'MCO')",
    )
    is_round_trip: bool = Field(
        default=True,
        description="Whether this is a round trip",
    )
    depart_date: date = Field(
        description="Departure date",
    )
    return_date: date | None = Field(
        default=None,
        description="Return date (omit or null for one-way trips)",
    )
    adults: Annotated[int, Field(ge=1, le=9)] = Field(
        default=1,
        description="Number of adult travelers",
    )
    track_flights: bool = Field(
        default=True,
        description="Track flight prices for this trip",
    )
    track_hotels: bool = Field(
        default=True,
        description="Track hotel prices for this trip",
    )
    flight_prefs: FlightPrefs | None = Field(
        default=None,
        description="Flight preferences (optional)",
    )
    hotel_prefs: HotelPrefs | None = Field(
        default=None,
        description="Hotel preferences (required when track_hotels is True)",
    )
    notification_prefs: NotificationPrefs = Field(
        description="Notification settings (required)",
    )

    @field_validator("depart_date", "return_date")
    @classmethod
    def validate_date_within_range(cls, v: date | None) -> date | None:
        """Ensure dates are not in the past and within a 359-day booking window."""
        if v is not None:
            max_date = date.today() + timedelta(days=359)
            if v > max_date:
                raise ValueError(f"Date cannot be more than 359 days out. Maximum: {max_date}")
            if v < date.today():
                raise ValueError("Date cannot be in the past")
        return v

    @model_validator(mode="after")
    def validate_return_after_depart(self) -> "TripCreate":
        """Ensure return date is after departure date, and matches is_round_trip."""
        if self.is_round_trip and self.return_date is None:
            raise ValueError("return_date is required for round trips")
        if not self.is_round_trip and self.return_date is not None:
            raise ValueError("return_date must be omitted for one-way trips")
        if self.return_date is not None and self.return_date <= self.depart_date:
            raise ValueError("return_date must be after depart_date")
        return self

    @model_validator(mode="after")
    def validate_tracking_selection(self) -> "TripCreate":
        """Enforce tracking flag rules: at least one on, hotel city required when tracking hotels."""
        if not self.track_flights and not self.track_hotels:
            raise ValueError("At least one of track_flights or track_hotels must be True")
        if self.track_hotels:
            if self.hotel_prefs is None:
                raise ValueError("hotel_prefs is required when track_hotels is True")
            if not self.hotel_prefs.city or not self.hotel_prefs.city.strip():
                raise ValueError("hotel_prefs.city is required when track_hotels is True")
        return self
```

Also update `TripResponse` (line 167) and `TripDetail` (line 185) to expose the tracking flags so clients can read them back. Replace `TripResponse`:

```python
class TripResponse(BaseModel):
    """Schema for trip list response."""

    id: uuid.UUID
    name: str
    origin_airport: str
    destination_code: str
    depart_date: date
    return_date: date | None = None
    status: TripStatus
    track_flights: bool = True
    track_hotels: bool = True
    current_flight_price: Decimal | None = None
    current_hotel_price: Decimal | None = None
    total_price: Decimal | None = None
    last_refreshed: datetime | None = None

    model_config = {"from_attributes": True}
```

- [ ] **Step 4: Run the schema tests and confirm they pass**

Run: `uv run pytest apps/api/tests/test_trip_schemas.py -v`
Expected: all 6 tests PASS.

- [ ] **Step 5: Run the full api suite to confirm no regressions**

Run: `uv run pytest apps/api/tests -v`
Expected: all tests PASS (existing create-trip tests may need payload updates in Task 4 — if any fail here, note the failure list and fix in Task 4).

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/schemas/trip.py apps/api/tests/test_trip_schemas.py
git commit -m "feat(api): add track flags and hotel city to trip schemas"
```

---

## Task 4: Wire create endpoint & update existing trip tests

**Files:**
- Modify: `apps/api/app/routers/trips.py`
- Modify: `apps/api/tests/test_trips.py`

- [ ] **Step 1: Write failing endpoint-level tests**

Append to `apps/api/tests/test_trips.py` (end of file). First confirm the structure by checking the existing helpers at the top of the file. Then add:

```python
@pytest.mark.asyncio
async def test_create_trip_track_flags_default_to_true(
    client_with_csrf, test_session, mock_redis, monkeypatch
):
    user = await _create_user(test_session, email="track-default@example.com")
    _authorize_client(client_with_csrf, user)
    monkeypatch.setattr(trips_module, "redis_client", mock_redis)
    monkeypatch.setattr(trips_module, "trigger_price_check_workflow", AsyncMock())

    payload = _build_trip_payload(name="Track default trip")
    payload["hotel_prefs"] = {"city": "Honolulu"}
    response = _create_trip(client_with_csrf, payload, "trip-track-default-1")

    assert response.status_code == 201
    data = response.json()["data"]
    assert data["track_flights"] is True
    assert data["track_hotels"] is True
    assert data["hotel_prefs"]["city"] == "Honolulu"


@pytest.mark.asyncio
async def test_create_trip_flights_only(
    client_with_csrf, test_session, mock_redis, monkeypatch
):
    user = await _create_user(test_session, email="flights-only@example.com")
    _authorize_client(client_with_csrf, user)
    monkeypatch.setattr(trips_module, "redis_client", mock_redis)
    monkeypatch.setattr(trips_module, "trigger_price_check_workflow", AsyncMock())

    payload = _build_trip_payload(name="Flights only trip")
    payload["track_flights"] = True
    payload["track_hotels"] = False
    response = _create_trip(client_with_csrf, payload, "trip-flights-only-1")

    assert response.status_code == 201
    data = response.json()["data"]
    assert data["track_flights"] is True
    assert data["track_hotels"] is False
    assert data["hotel_prefs"] is None


@pytest.mark.asyncio
async def test_create_trip_hotels_only_requires_city(
    client_with_csrf, test_session, mock_redis, monkeypatch
):
    user = await _create_user(test_session, email="hotels-only@example.com")
    _authorize_client(client_with_csrf, user)
    monkeypatch.setattr(trips_module, "redis_client", mock_redis)
    monkeypatch.setattr(trips_module, "trigger_price_check_workflow", AsyncMock())

    payload = _build_trip_payload(name="Hotels only trip")
    payload["track_flights"] = False
    payload["track_hotels"] = True
    # Missing hotel_prefs -> 422
    response = _create_trip(client_with_csrf, payload, "trip-hotels-only-1")
    assert response.status_code == 422

    # With hotel_prefs including city -> 201
    payload["hotel_prefs"] = {"city": "Waikiki"}
    response = _create_trip(client_with_csrf, payload, "trip-hotels-only-2")
    assert response.status_code == 201
    data = response.json()["data"]
    assert data["track_flights"] is False
    assert data["track_hotels"] is True
    assert data["hotel_prefs"]["city"] == "Waikiki"


@pytest.mark.asyncio
async def test_create_trip_neither_flag_rejected(
    client_with_csrf, test_session, mock_redis, monkeypatch
):
    user = await _create_user(test_session, email="neither@example.com")
    _authorize_client(client_with_csrf, user)
    monkeypatch.setattr(trips_module, "redis_client", mock_redis)
    monkeypatch.setattr(trips_module, "trigger_price_check_workflow", AsyncMock())

    payload = _build_trip_payload(name="No tracking trip")
    payload["track_flights"] = False
    payload["track_hotels"] = False
    response = _create_trip(client_with_csrf, payload, "trip-neither-1")

    assert response.status_code == 422
```

- [ ] **Step 2: Run the new tests and confirm they fail**

Run: `uv run pytest apps/api/tests/test_trips.py::test_create_trip_track_flags_default_to_true apps/api/tests/test_trips.py::test_create_trip_flights_only apps/api/tests/test_trips.py::test_create_trip_hotels_only_requires_city apps/api/tests/test_trips.py::test_create_trip_neither_flag_rejected -v`
Expected: FAIL (422 on default test because existing `_build_trip_payload` won't include city, or KeyError on `data["track_flights"]`).

- [ ] **Step 3: Update existing `_build_trip_payload` helper to include required hotel city**

In `apps/api/tests/test_trips.py`, locate `_build_trip_payload` (line 51) and extend it:

Find:
```python
def _build_trip_payload(name: str = "Hawaii Vacation") -> dict:
    today = date.today()
    return {
        "name": name,
        "origin_airport": "SFO",
        "destination_code": "HNL",
        "depart_date": (today + timedelta(days=30)).isoformat(),
        "return_date": (today + timedelta(days=37)).isoformat(),
        "notification_prefs": {"threshold_value": "2000.00"},
    }
```

Replace with:
```python
def _build_trip_payload(name: str = "Hawaii Vacation") -> dict:
    today = date.today()
    return {
        "name": name,
        "origin_airport": "SFO",
        "destination_code": "HNL",
        "depart_date": (today + timedelta(days=30)).isoformat(),
        "return_date": (today + timedelta(days=37)).isoformat(),
        "track_flights": True,
        "track_hotels": True,
        "hotel_prefs": {"city": "Honolulu"},
        "notification_prefs": {"threshold_value": "2000.00"},
    }
```

The `test_create_trip_one_way_success` test uses this helper and also passes `is_round_trip=False` with no return date. Leave that test as-is — one-way with `track_hotels=True` is still valid because the hotel dates use `depart_date` → but the worker's `fetch_hotels_activity` skips one-way trips (`if not trip.get("return_date")`). That's preserved behavior; the schema change doesn't break it.

- [ ] **Step 4: Wire flags into `create_trip` endpoint and response builders**

In `apps/api/app/routers/trips.py`, replace the trip creation block in `create_trip` (lines 447-458):

Find:
```python
    trip = Trip(
        user_id=user_id,
        name=payload.name,
        origin_airport=payload.origin_airport,
        destination_code=payload.destination_code,
        is_round_trip=payload.is_round_trip,
        depart_date=payload.depart_date,
        return_date=payload.return_date,
        adults=payload.adults,
    )
    db.add(trip)
    await db.flush()

    flight_prefs = None
    if payload.flight_prefs:
        flight_prefs = TripFlightPrefs(trip_id=trip.id, **payload.flight_prefs.model_dump())
        db.add(flight_prefs)

    hotel_prefs = None
    if payload.hotel_prefs:
        hotel_prefs = TripHotelPrefs(trip_id=trip.id, **payload.hotel_prefs.model_dump())
        db.add(hotel_prefs)
```

Replace with:
```python
    trip = Trip(
        user_id=user_id,
        name=payload.name,
        origin_airport=payload.origin_airport,
        destination_code=payload.destination_code,
        is_round_trip=payload.is_round_trip,
        depart_date=payload.depart_date,
        return_date=payload.return_date,
        adults=payload.adults,
        track_flights=payload.track_flights,
        track_hotels=payload.track_hotels,
    )
    db.add(trip)
    await db.flush()

    flight_prefs = None
    if payload.track_flights and payload.flight_prefs:
        flight_prefs = TripFlightPrefs(trip_id=trip.id, **payload.flight_prefs.model_dump())
        db.add(flight_prefs)

    hotel_prefs = None
    if payload.track_hotels and payload.hotel_prefs:
        hotel_prefs = TripHotelPrefs(trip_id=trip.id, **payload.hotel_prefs.model_dump())
        db.add(hotel_prefs)
```

Then update `_hotel_prefs_to_schema` (line 76) to include `city`:

Find:
```python
def _hotel_prefs_to_schema(prefs: TripHotelPrefs | None) -> HotelPrefs | None:
    if not prefs:
        return None
    return HotelPrefs(
        rooms=prefs.rooms,
        adults_per_room=prefs.adults_per_room,
        room_selection_mode=prefs.room_selection_mode,
        preferred_room_types=prefs.preferred_room_types,
        preferred_views=prefs.preferred_views,
    )
```

Replace with:
```python
def _hotel_prefs_to_schema(prefs: TripHotelPrefs | None) -> HotelPrefs | None:
    if not prefs:
        return None
    return HotelPrefs(
        rooms=prefs.rooms,
        adults_per_room=prefs.adults_per_room,
        city=prefs.city,
        room_selection_mode=prefs.room_selection_mode,
        preferred_room_types=prefs.preferred_room_types,
        preferred_views=prefs.preferred_views,
    )
```

Update `_build_trip_response` (line 100) to include the new flags:

Find:
```python
def _build_trip_response(trip: Trip, snapshot: PriceSnapshot | None) -> TripResponse:
    return TripResponse(
        id=trip.id,
        name=trip.name,
        origin_airport=trip.origin_airport,
        destination_code=trip.destination_code,
        depart_date=trip.depart_date,
        return_date=trip.return_date,
        status=trip.status,
        current_flight_price=snapshot.flight_price if snapshot else None,
        current_hotel_price=snapshot.hotel_price if snapshot else None,
        total_price=snapshot.total_price if snapshot else None,
        last_refreshed=snapshot.created_at if snapshot else None,
    )
```

Replace with:
```python
def _build_trip_response(trip: Trip, snapshot: PriceSnapshot | None) -> TripResponse:
    return TripResponse(
        id=trip.id,
        name=trip.name,
        origin_airport=trip.origin_airport,
        destination_code=trip.destination_code,
        depart_date=trip.depart_date,
        return_date=trip.return_date,
        status=trip.status,
        track_flights=trip.track_flights,
        track_hotels=trip.track_hotels,
        current_flight_price=snapshot.flight_price if snapshot else None,
        current_hotel_price=snapshot.hotel_price if snapshot else None,
        total_price=snapshot.total_price if snapshot else None,
        last_refreshed=snapshot.created_at if snapshot else None,
    )
```

- [ ] **Step 5: Run the full api test suite**

Run: `uv run pytest apps/api/tests -v`
Expected: all tests PASS, including the four new tests from Step 1.

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/routers/trips.py apps/api/tests/test_trips.py
git commit -m "feat(api): persist and expose trip track flags + hotel city on create"
```

---

## Task 5: Worker types + `load_trip_details`

**Files:**
- Modify: `apps/worker/worker/types.py`
- Modify: `apps/worker/worker/activities/price_check.py`
- Modify: `apps/worker/tests/test_price_check_activities.py`

- [ ] **Step 1: Write a failing test for `load_trip_details` exposing the new fields**

Open `apps/worker/tests/test_price_check_activities.py` and locate the existing `test_load_trip_details` test. Append a new test immediately after it:

```python
@pytest.mark.asyncio
async def test_load_trip_details_returns_track_flags_and_city(monkeypatch):
    trip_id = uuid.uuid4()
    trip = SimpleNamespace(
        id=trip_id,
        origin_airport="SFO",
        destination_code="MCO",
        is_round_trip=True,
        depart_date=date(2026, 5, 1),
        return_date=date(2026, 5, 8),
        adults=2,
        track_flights=False,
        track_hotels=True,
    )
    hotel_prefs = SimpleNamespace(
        rooms=1,
        adults_per_room=2,
        city="Downtown Orlando",
        room_selection_mode=SimpleNamespace(value="cheapest"),
        preferred_room_types=[],
        preferred_views=[],
    )

    async def fake_get(model, key):
        return trip

    class FakeResult:
        def __init__(self, value):
            self._value = value

        def scalars(self):
            class _S:
                def __init__(self, v):
                    self._v = v

                def first(self_inner):
                    return self_inner._v

            return _S(self._value)

    async def fake_execute(stmt):
        # First call returns flight_prefs (None), second returns hotel_prefs
        if fake_execute.calls == 0:
            fake_execute.calls += 1
            return FakeResult(None)
        return FakeResult(hotel_prefs)

    fake_execute.calls = 0

    class FakeSession:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def get(self, model, key):
            return trip

        async def execute(self, stmt):
            return await fake_execute(stmt)

    monkeypatch.setattr(
        "worker.activities.price_check.AsyncSessionLocal",
        lambda: FakeSession(),
    )

    result = await load_trip_details.__wrapped__(str(trip_id))
    assert result["track_flights"] is False
    assert result["track_hotels"] is True
    assert result["hotel_prefs"]["city"] == "Downtown Orlando"
```

Also import `load_trip_details` at the top of the file if not already imported. Verify existing test has the fixture pattern — if it does, mirror whatever the existing test uses.

- [ ] **Step 2: Run the new test and confirm it fails**

Run: `uv run pytest apps/worker/tests/test_price_check_activities.py::test_load_trip_details_returns_track_flags_and_city -v`
Expected: FAIL with `KeyError: 'track_flights'` or similar.

- [ ] **Step 3: Extend `TripDetails` and `HotelPrefsData` TypedDicts**

In `apps/worker/worker/types.py`, replace the full file content:

```python
from typing import Any, TypedDict


class FlightPrefsData(TypedDict):
    airlines: list[str]
    stops_mode: str
    max_stops: int | None
    cabin: str


class HotelPrefsData(TypedDict):
    rooms: int
    adults_per_room: int
    city: str | None
    room_selection_mode: str
    preferred_room_types: list[str]
    preferred_views: list[str]


class TripDetails(TypedDict):
    trip_id: str
    origin_airport: str
    destination_code: str
    is_round_trip: bool
    depart_date: str
    return_date: str | None
    adults: int
    track_flights: bool
    track_hotels: bool
    flight_prefs: FlightPrefsData
    hotel_prefs: HotelPrefsData | None


class FetchResult(TypedDict):
    offers: list[dict[str, Any]]
    raw: dict[str, Any]
    error: str | None


class FilterInput(TypedDict):
    flight_result: FetchResult
    hotel_result: FetchResult
    flight_prefs: FlightPrefsData
    hotel_prefs: HotelPrefsData | None


class FilterOutput(TypedDict):
    flights: list[dict[str, Any]]
    hotels: list[dict[str, Any]]
    raw_data: dict[str, Any]


class SaveSnapshotInput(TypedDict):
    trip_id: str
    flights: list[dict[str, Any]]
    hotels: list[dict[str, Any]]
    raw_data: dict[str, Any]


class PriceCheckResult(TypedDict):
    success: bool
    snapshot_id: str | None
    flight_error: str | None
    hotel_error: str | None
```

- [ ] **Step 4: Extend `load_trip_details` to return the new fields**

In `apps/worker/worker/activities/price_check.py`, replace the return block inside `load_trip_details` (lines 52-73):

Find:
```python
        return {
            "trip_id": str(trip.id),
            "origin_airport": trip.origin_airport,
            "destination_code": trip.destination_code,
            "is_round_trip": trip.is_round_trip,
            "depart_date": trip.depart_date.isoformat(),
            "return_date": trip.return_date.isoformat() if trip.return_date else None,
            "adults": trip.adults,
            "flight_prefs": {
                "airlines": flight_prefs.airlines if flight_prefs else [],
                "stops_mode": (flight_prefs.stops_mode.value if flight_prefs else "any"),
                "max_stops": flight_prefs.max_stops if flight_prefs else None,
                "cabin": flight_prefs.cabin.value if flight_prefs else "economy",
            },
            "hotel_prefs": {
                "rooms": hotel_prefs.rooms,
                "adults_per_room": hotel_prefs.adults_per_room,
                "room_selection_mode": hotel_prefs.room_selection_mode.value,
                "preferred_room_types": hotel_prefs.preferred_room_types,
                "preferred_views": hotel_prefs.preferred_views,
            } if hotel_prefs else None,
        }
```

Replace with:
```python
        return {
            "trip_id": str(trip.id),
            "origin_airport": trip.origin_airport,
            "destination_code": trip.destination_code,
            "is_round_trip": trip.is_round_trip,
            "depart_date": trip.depart_date.isoformat(),
            "return_date": trip.return_date.isoformat() if trip.return_date else None,
            "adults": trip.adults,
            "track_flights": trip.track_flights,
            "track_hotels": trip.track_hotels,
            "flight_prefs": {
                "airlines": flight_prefs.airlines if flight_prefs else [],
                "stops_mode": (flight_prefs.stops_mode.value if flight_prefs else "any"),
                "max_stops": flight_prefs.max_stops if flight_prefs else None,
                "cabin": flight_prefs.cabin.value if flight_prefs else "economy",
            },
            "hotel_prefs": {
                "rooms": hotel_prefs.rooms,
                "adults_per_room": hotel_prefs.adults_per_room,
                "city": hotel_prefs.city,
                "room_selection_mode": hotel_prefs.room_selection_mode.value,
                "preferred_room_types": hotel_prefs.preferred_room_types,
                "preferred_views": hotel_prefs.preferred_views,
            } if hotel_prefs else None,
        }
```

- [ ] **Step 5: Update existing worker-test trip fixtures to include the new fields**

In `apps/worker/tests/test_price_check_activities.py`, find every occurrence of a `TripDetails` dict literal (search for `"trip_id":` in the file) and add `"track_flights": True, "track_hotels": True` to each. For hotel_prefs dicts, add `"city": None` so defaults match the production schema. This keeps pre-existing tests green.

Run: `grep -n '"trip_id":' apps/worker/tests/test_price_check_activities.py` — audit each match and add the new keys. (Do this as a focused scan, not a blind sed.)

- [ ] **Step 6: Run worker tests and confirm they pass**

Run: `uv run pytest apps/worker/tests/test_price_check_activities.py -v`
Expected: all tests PASS, including the new `test_load_trip_details_returns_track_flags_and_city`.

- [ ] **Step 7: Commit**

```bash
git add apps/worker/worker/types.py apps/worker/worker/activities/price_check.py apps/worker/tests/test_price_check_activities.py
git commit -m "feat(worker): expose track flags and hotel city in TripDetails"
```

---

## Task 6: Hotel activity uses city (with fallback)

**Files:**
- Modify: `apps/worker/worker/activities/price_check.py`
- Modify: `apps/worker/tests/test_price_check_activities.py`

- [ ] **Step 1: Write a failing test for city usage in `fetch_hotels_activity`**

Append to `apps/worker/tests/test_price_check_activities.py`:

```python
@pytest.mark.asyncio
async def test_fetch_hotels_activity_uses_city_field(monkeypatch):
    trip: TripDetails = {
        "trip_id": "t-city",
        "origin_airport": "SFO",
        "destination_code": "MCO",
        "is_round_trip": True,
        "depart_date": "2026-06-01",
        "return_date": "2026-06-08",
        "adults": 2,
        "track_flights": True,
        "track_hotels": True,
        "flight_prefs": {
            "airlines": [], "stops_mode": "any", "max_stops": None, "cabin": "economy",
        },
        "hotel_prefs": {
            "rooms": 1,
            "adults_per_room": 2,
            "city": "Downtown Orlando",
            "room_selection_mode": "cheapest",
            "preferred_room_types": [],
            "preferred_views": [],
        },
    }

    captured: dict = {}

    class FakeClient:
        async def search_hotels_all(self, *, city, checkin, checkout, adults, rooms, max_pages):
            captured["city"] = city
            return SimpleNamespace(hotels=[], total_results=0)

        async def get_hotel_details(self, **kwargs):
            raise AssertionError("Should not be called when no hotels are returned")

    monkeypatch.setattr("worker.activities.price_check.SkiplaggedClient", lambda: FakeClient())
    monkeypatch.setattr("worker.activities.price_check.settings.mock_skiplagged_api", False)

    await fetch_hotels_activity.__wrapped__(trip)

    assert captured["city"] == "Downtown Orlando"


@pytest.mark.asyncio
async def test_fetch_hotels_activity_falls_back_to_destination_code(monkeypatch):
    trip: TripDetails = {
        "trip_id": "t-fallback",
        "origin_airport": "SFO",
        "destination_code": "MCO",
        "is_round_trip": True,
        "depart_date": "2026-06-01",
        "return_date": "2026-06-08",
        "adults": 2,
        "track_flights": True,
        "track_hotels": True,
        "flight_prefs": {
            "airlines": [], "stops_mode": "any", "max_stops": None, "cabin": "economy",
        },
        "hotel_prefs": {
            "rooms": 1,
            "adults_per_room": 2,
            "city": None,
            "room_selection_mode": "cheapest",
            "preferred_room_types": [],
            "preferred_views": [],
        },
    }

    captured: dict = {}

    class FakeClient:
        async def search_hotels_all(self, *, city, checkin, checkout, adults, rooms, max_pages):
            captured["city"] = city
            return SimpleNamespace(hotels=[], total_results=0)

    monkeypatch.setattr("worker.activities.price_check.SkiplaggedClient", lambda: FakeClient())
    monkeypatch.setattr("worker.activities.price_check.settings.mock_skiplagged_api", False)

    await fetch_hotels_activity.__wrapped__(trip)

    assert captured["city"] == "MCO"
```

Add `fetch_hotels_activity` to the top-of-file imports if absent. Also confirm that `SimpleNamespace` and `TripDetails` are imported in this file.

- [ ] **Step 2: Run the new tests and confirm they fail**

Run: `uv run pytest apps/worker/tests/test_price_check_activities.py::test_fetch_hotels_activity_uses_city_field apps/worker/tests/test_price_check_activities.py::test_fetch_hotels_activity_falls_back_to_destination_code -v`
Expected: FAIL — production code still passes `trip["destination_code"]`.

- [ ] **Step 3: Route the city field through `fetch_hotels_activity`**

In `apps/worker/worker/activities/price_check.py`, find the live Skiplagged call (lines 224-236):

Find:
```python
    logger.info("Fetching hotels for trip_id=%s via Skiplagged MCP", trip["trip_id"])
    adults = hotel_prefs["adults_per_room"]

    try:
        client = SkiplaggedClient()
        hotel_result = await client.search_hotels_all(
            city=trip["destination_code"],
            checkin=trip["depart_date"],
            checkout=trip["return_date"],
            adults=adults,
            rooms=hotel_prefs["rooms"],
            max_pages=4,
        )
```

Replace with:
```python
    logger.info("Fetching hotels for trip_id=%s via Skiplagged MCP", trip["trip_id"])
    adults = hotel_prefs["adults_per_room"]
    city_query = (hotel_prefs.get("city") or "").strip() or trip["destination_code"]

    try:
        client = SkiplaggedClient()
        hotel_result = await client.search_hotels_all(
            city=city_query,
            checkin=trip["depart_date"],
            checkout=trip["return_date"],
            adults=adults,
            rooms=hotel_prefs["rooms"],
            max_pages=4,
        )
```

Also update the mock-mode branch (line 210) to use the same fallback, since the mock path is what tests hit when `MOCK_SKIPLAGGED_API=true`. Find:

```python
        response = mock_hotel_search(
            city=trip["destination_code"],
            checkin=trip["depart_date"],
            checkout=trip["return_date"],
            adults=adults,
            rooms=hotel_prefs["rooms"],
        )
```

Replace with:
```python
        mock_city = (hotel_prefs.get("city") or "").strip() or trip["destination_code"]
        response = mock_hotel_search(
            city=mock_city,
            checkin=trip["depart_date"],
            checkout=trip["return_date"],
            adults=adults,
            rooms=hotel_prefs["rooms"],
        )
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `uv run pytest apps/worker/tests/test_price_check_activities.py -v`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/worker/worker/activities/price_check.py apps/worker/tests/test_price_check_activities.py
git commit -m "feat(worker): use hotel_prefs.city for Skiplagged with destination_code fallback"
```

---

## Task 7: Workflow gates activities on track flags

**Files:**
- Modify: `apps/worker/worker/workflows/price_check.py`
- Modify: `apps/worker/tests/test_workflows.py`

- [ ] **Step 1: Read the existing workflow test file to find the harness pattern**

Run: `grep -n "PriceCheckWorkflow\|execute_activity\|test_" apps/worker/tests/test_workflows.py | head -40`
Read the top ~80 lines of the file so the new test uses the same harness (likely `WorkflowEnvironment` or activity mocking).

- [ ] **Step 2: Write failing workflow tests for flag gating**

Append two tests to `apps/worker/tests/test_workflows.py` that follow whatever harness the existing tests use. Example (adjust the mocking pattern to match the file's convention):

```python
@pytest.mark.asyncio
async def test_workflow_skips_flights_when_track_flights_false(monkeypatch):
    calls = {"flights": 0, "hotels": 0}

    async def fake_load(trip_id):
        return {
            "trip_id": trip_id,
            "origin_airport": "SFO",
            "destination_code": "MCO",
            "is_round_trip": True,
            "depart_date": "2026-06-01",
            "return_date": "2026-06-08",
            "adults": 2,
            "track_flights": False,
            "track_hotels": True,
            "flight_prefs": {
                "airlines": [], "stops_mode": "any", "max_stops": None, "cabin": "economy",
            },
            "hotel_prefs": {
                "rooms": 1, "adults_per_room": 2, "city": "Downtown Orlando",
                "room_selection_mode": "cheapest",
                "preferred_room_types": [], "preferred_views": [],
            },
        }

    async def fake_fetch_flights(trip):
        calls["flights"] += 1
        return {"offers": [], "raw": {}, "error": None}

    async def fake_fetch_hotels(trip):
        calls["hotels"] += 1
        return {"offers": [], "raw": {}, "error": None}

    async def fake_filter(payload):
        return {"flights": [], "hotels": [], "raw_data": {}}

    async def fake_save(payload):
        return "snapshot-id"

    # Wire mocks into the Temporal test environment (use the file's existing helper).
    env = await _make_test_env(
        monkeypatch,
        load_trip_details=fake_load,
        fetch_flights_activity=fake_fetch_flights,
        fetch_hotels_activity=fake_fetch_hotels,
        filter_results_activity=fake_filter,
        save_snapshot_activity=fake_save,
    )
    result = await env.run_workflow(PriceCheckWorkflow, "trip-1")

    assert result["success"] is True
    assert calls["flights"] == 0
    assert calls["hotels"] == 1
    assert result["flight_error"] is None


@pytest.mark.asyncio
async def test_workflow_skips_hotels_when_track_hotels_false(monkeypatch):
    calls = {"flights": 0, "hotels": 0}

    async def fake_load(trip_id):
        return {
            "trip_id": trip_id,
            "origin_airport": "SFO",
            "destination_code": "MCO",
            "is_round_trip": True,
            "depart_date": "2026-06-01",
            "return_date": "2026-06-08",
            "adults": 2,
            "track_flights": True,
            "track_hotels": False,
            "flight_prefs": {
                "airlines": [], "stops_mode": "any", "max_stops": None, "cabin": "economy",
            },
            "hotel_prefs": None,
        }

    async def fake_fetch_flights(trip):
        calls["flights"] += 1
        return {"offers": [], "raw": {}, "error": None}

    async def fake_fetch_hotels(trip):
        calls["hotels"] += 1
        return {"offers": [], "raw": {}, "error": None}

    async def fake_filter(payload):
        return {"flights": [], "hotels": [], "raw_data": {}}

    async def fake_save(payload):
        return "snapshot-id"

    env = await _make_test_env(
        monkeypatch,
        load_trip_details=fake_load,
        fetch_flights_activity=fake_fetch_flights,
        fetch_hotels_activity=fake_fetch_hotels,
        filter_results_activity=fake_filter,
        save_snapshot_activity=fake_save,
    )
    result = await env.run_workflow(PriceCheckWorkflow, "trip-2")

    assert result["success"] is True
    assert calls["flights"] == 1
    assert calls["hotels"] == 0
    assert result["hotel_error"] is None
```

If the existing file does not provide `_make_test_env`, mirror whatever existing workflow tests use (they already validate `PriceCheckWorkflow` — copy that wiring).

- [ ] **Step 3: Run the new tests and confirm they fail**

Run: `uv run pytest apps/worker/tests/test_workflows.py -v -k "skips_flights or skips_hotels"`
Expected: FAIL (both activities still invoked unconditionally).

- [ ] **Step 4: Gate activity scheduling in the workflow**

Replace the body of `PriceCheckWorkflow.run` in `apps/worker/worker/workflows/price_check.py`:

```python
    @workflow.run
    async def run(self, trip_id: str) -> PriceCheckResult:
        trip = await workflow.execute_activity(
            load_trip_details,
            trip_id,
            start_to_close_timeout=timedelta(seconds=10),
        )

        tasks: list[tuple[str, object]] = []
        if trip["track_flights"]:
            tasks.append(
                (
                    "flights",
                    workflow.execute_activity(
                        fetch_flights_activity,
                        trip,
                        start_to_close_timeout=timedelta(seconds=60),
                        retry_policy=RetryPolicy(maximum_attempts=3),
                    ),
                )
            )
        if trip["track_hotels"]:
            tasks.append(
                (
                    "hotels",
                    workflow.execute_activity(
                        fetch_hotels_activity,
                        trip,
                        start_to_close_timeout=timedelta(seconds=60),
                        retry_policy=RetryPolicy(maximum_attempts=3),
                    ),
                )
            )

        results = await asyncio.gather(
            *(coro for _, coro in tasks), return_exceptions=True
        )
        by_label: dict[str, object] = dict(zip((label for label, _ in tasks), results))

        normalized_flight = (
            _normalize_fetch_result(by_label["flights"], "flights")
            if "flights" in by_label
            else _skipped_fetch_result("flights")
        )
        normalized_hotel = (
            _normalize_fetch_result(by_label["hotels"], "hotels")
            if "hotels" in by_label
            else _skipped_fetch_result("hotels")
        )

        filtered = await workflow.execute_activity(
            filter_results_activity,
            {
                "flight_result": normalized_flight,
                "hotel_result": normalized_hotel,
                "flight_prefs": trip["flight_prefs"],
                "hotel_prefs": trip["hotel_prefs"],
            },
            start_to_close_timeout=timedelta(seconds=10),
        )

        snapshot_id = await workflow.execute_activity(
            save_snapshot_activity,
            {
                "trip_id": trip["trip_id"],
                "flights": filtered["flights"],
                "hotels": filtered["hotels"],
                "raw_data": filtered["raw_data"],
            },
            start_to_close_timeout=timedelta(seconds=10),
            retry_policy=RetryPolicy(maximum_attempts=1),
        )

        return {
            "success": True,
            "snapshot_id": snapshot_id,
            "flight_error": normalized_flight["error"],
            "hotel_error": normalized_hotel["error"],
        }
```

And add the helper at the bottom of the same file:

```python
def _skipped_fetch_result(label: str) -> FetchResult:
    return {
        "offers": [],
        "raw": {"status": "skipped", "label": label},
        "error": None,
    }
```

- [ ] **Step 5: Run the workflow tests and confirm they pass**

Run: `uv run pytest apps/worker/tests -v`
Expected: all tests PASS, including the two new gating tests and any pre-existing workflow tests.

- [ ] **Step 6: Commit**

```bash
git add apps/worker/worker/workflows/price_check.py apps/worker/tests/test_workflows.py
git commit -m "feat(worker): gate flight/hotel fetches on trip track flags"
```

---

## Task 8: shadcn Checkbox primitive

**Files:**
- Create: `apps/web/src/components/ui/checkbox.tsx`

- [ ] **Step 1: Confirm no existing checkbox**

Run: `ls apps/web/src/components/ui/ | grep -i checkbox`
Expected: empty (no existing file).

- [ ] **Step 2: Install the Radix checkbox dependency**

Run: `pnpm --filter vacation-price-tracker-web add @radix-ui/react-checkbox`
Expected: dependency added to `apps/web/package.json`; root lockfile updated (one line per CLAUDE.md — **do not** generate `apps/web/pnpm-lock.yaml`; run from repo root or with `--filter`).

- [ ] **Step 3: Create the shadcn `Checkbox` component**

Create `apps/web/src/components/ui/checkbox.tsx`:

```tsx
"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";

import { cn } from "../../lib/utils";

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn("flex items-center justify-center text-current")}
    >
      <Check className="h-4 w-4" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
```

Confirm `apps/web/src/lib/utils.ts` exports `cn` (it does; it's the standard shadcn utility). If it does not, run: `grep -n "export.*cn" apps/web/src/lib/utils.ts` to verify before adding the import.

- [ ] **Step 4: Run the web typecheck to confirm the component compiles**

Run: `pnpm --filter vacation-price-tracker-web typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json apps/web/src/components/ui/checkbox.tsx pnpm-lock.yaml
git commit -m "feat(web): add shadcn Checkbox primitive"
```

---

## Task 9: Frontend types, hook state, and payload

**Files:**
- Modify: `apps/web/src/components/trip-form/types.ts`
- Modify: `apps/web/src/lib/hooks/use-trip-form.ts`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/__tests__/use-trip-form.test.tsx`

- [ ] **Step 1: Write failing hook tests**

Append to `apps/web/src/__tests__/use-trip-form.test.tsx`:

```tsx
  it("defaults trackFlights and trackHotels to true with empty city", () => {
    const hookRef: HookRef = { current: null };
    render(<HookHarness hookRef={hookRef} />);
    expect(hookRef.current?.formData.trackFlights).toBe(true);
    expect(hookRef.current?.formData.trackHotels).toBe(true);
    expect(hookRef.current?.formData.hotelPrefs.city).toBe("");
  });

  it("emits track flags and hotel city in the payload", () => {
    const hookRef: HookRef = { current: null };
    render(<HookHarness hookRef={hookRef} />);

    act(() => {
      hookRef.current?.setters.setName("Miami Beach");
      hookRef.current?.setters.setOriginAirport("SFO");
      hookRef.current?.setters.setDestinationCode("MIA");
      hookRef.current?.setters.setCity("South Beach");
      hookRef.current?.setters.setTrackFlights(false);
      hookRef.current?.setters.setTrackHotels(true);
    });

    const payload = hookRef.current?.getPayload();
    expect(payload?.track_flights).toBe(false);
    expect(payload?.track_hotels).toBe(true);
    expect(payload?.flight_prefs).toBeNull();
    expect(payload?.hotel_prefs?.city).toBe("South Beach");
  });

  it("omits hotel_prefs when trackHotels is false", () => {
    const hookRef: HookRef = { current: null };
    render(<HookHarness hookRef={hookRef} />);

    act(() => {
      hookRef.current?.setters.setTrackFlights(true);
      hookRef.current?.setters.setTrackHotels(false);
    });

    const payload = hookRef.current?.getPayload();
    expect(payload?.track_flights).toBe(true);
    expect(payload?.track_hotels).toBe(false);
    expect(payload?.hotel_prefs).toBeNull();
  });

  it("isValid is false when both tracking flags are off", () => {
    const hookRef: HookRef = { current: null };
    render(<HookHarness hookRef={hookRef} />);

    act(() => {
      hookRef.current?.setters.setName("Trip");
      hookRef.current?.setters.setOriginAirport("SFO");
      hookRef.current?.setters.setDestinationCode("MIA");
      hookRef.current?.setters.setTrackFlights(false);
      hookRef.current?.setters.setTrackHotels(false);
    });

    expect(hookRef.current?.isValid).toBe(false);
  });
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `pnpm --filter vacation-price-tracker-web test --testPathPattern=use-trip-form`
Expected: FAIL (`setTrackFlights is not a function`, etc.).

- [ ] **Step 3: Update `types.ts`**

In `apps/web/src/components/trip-form/types.ts`, replace the existing type definitions block (lines 14-121) with:

```typescript
export interface FlightPrefsData {
  cabin: string;
  stopsMode: string;
  airlines: string[];
}

export interface HotelPrefsData {
  rooms: string;
  adultsPerRoom: string;
  city: string;
  roomSelectionMode: string;
  roomTypes: string[];
  views: string[];
}

export interface NotificationPrefsData {
  thresholdType: string;
  thresholdValue: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
}

export interface TripFormData {
  // Basic info
  name: string;
  originAirport: string;
  destinationCode: string;
  isRoundTrip: boolean;
  departDate: Date | undefined;
  returnDate: Date | undefined;
  adults: string;

  // Tracking
  trackFlights: boolean;
  trackHotels: boolean;

  // Flight preferences
  flightPrefs: FlightPrefsData;

  // Hotel preferences
  hotelPrefs: HotelPrefsData;

  // Notification preferences
  notificationPrefs: NotificationPrefsData;

  // Section collapse state
  flightPrefsOpen: boolean;
  hotelPrefsOpen: boolean;
}

export interface TripFormErrors {
  name?: string;
  originAirport?: string;
  destinationCode?: string;
  departDate?: string;
  returnDate?: string;
  thresholdValue?: string;
  hotelCity?: string;
  tracking?: string;
}

export type TripFormTouched = Partial<Record<keyof TripFormErrors, boolean>>;

export interface TripFormSetters {
  setName: (value: string) => void;
  setOriginAirport: (value: string) => void;
  setDestinationCode: (value: string) => void;
  setIsRoundTrip: (value: boolean) => void;
  setDepartDate: (value: Date | undefined) => void;
  setReturnDate: (value: Date | undefined) => void;
  setAdults: (value: string) => void;
  setTrackFlights: (value: boolean) => void;
  setTrackHotels: (value: boolean) => void;
  setCabin: (value: string) => void;
  setStopsMode: (value: string) => void;
  setAirlines: (value: string[]) => void;
  setRooms: (value: string) => void;
  setAdultsPerRoom: (value: string) => void;
  setCity: (value: string) => void;
  setRoomSelectionMode: (value: string) => void;
  setRoomTypes: (value: string[]) => void;
  setViews: (value: string[]) => void;
  setThresholdType: (value: string) => void;
  setThresholdValue: (value: string) => void;
  setEmailEnabled: (value: boolean) => void;
  setSmsEnabled: (value: boolean) => void;
  setFlightPrefsOpen: (value: boolean) => void;
  setHotelPrefsOpen: (value: boolean) => void;
}

export interface TripPayload {
  name: string;
  origin_airport: string;
  destination_code: string;
  is_round_trip: boolean;
  depart_date: string;
  return_date: string | null;
  adults: number;
  track_flights: boolean;
  track_hotels: boolean;
  flight_prefs: {
    airlines: string[];
    stops_mode: StopsMode;
    max_stops: number | null;
    cabin: CabinClass;
  } | null;
  hotel_prefs: {
    rooms: number;
    adults_per_room: number;
    city: string;
    room_selection_mode: RoomSelectionMode;
    preferred_room_types: string[];
    preferred_views: string[];
  } | null;
  notification_prefs: {
    threshold_type: ThresholdType;
    threshold_value: number;
    notify_without_threshold: boolean;
    email_enabled: boolean;
    sms_enabled: boolean;
  };
}
```

- [ ] **Step 4: Update `UpdateTripRequest` in `api.ts`**

In `apps/web/src/lib/api.ts`, replace the `UpdateTripRequest` interface (lines 210-238):

```typescript
export interface UpdateTripRequest {
  name?: string;
  origin_airport?: string;
  destination_code?: string;
  is_round_trip?: boolean;
  depart_date?: string;
  return_date?: string | null;
  adults?: number;
  track_flights?: boolean;
  track_hotels?: boolean;
  flight_prefs?: {
    airlines: string[];
    stops_mode: string;
    max_stops: number | null;
    cabin: string;
  } | null;
  hotel_prefs?: {
    rooms: number;
    adults_per_room: number;
    city: string;
    room_selection_mode: string;
    preferred_room_types: string[];
    preferred_views: string[];
  } | null;
  notification_prefs?: {
    threshold_type: string;
    threshold_value: number;
    notify_without_threshold: boolean;
    email_enabled: boolean;
    sms_enabled: boolean;
  };
}
```

Also find the `hotel_prefs` field on `TripDetail` in `api.ts` (search for `preferred_room_types` in the file) and add `city: string | null;` to it so reads compile. Run: `grep -n "preferred_room_types" apps/web/src/lib/api.ts` to locate the interface, then add the field.

- [ ] **Step 5: Update `useTripForm` hook**

In `apps/web/src/lib/hooks/use-trip-form.ts`:

(a) Update `getDefaultFormData` (lines 25-62) — replace the returned object with:

```typescript
const getDefaultFormData = (): TripFormData => ({
  name: "",
  originAirport: "",
  destinationCode: "",
  isRoundTrip: true,
  departDate: addDays(new Date(), 1),
  returnDate: addDays(new Date(), 8),
  adults: "1",

  trackFlights: true,
  trackHotels: true,

  flightPrefs: {
    cabin: "economy",
    stopsMode: "any",
    airlines: [],
  },

  hotelPrefs: {
    rooms: "1",
    adultsPerRoom: "2",
    city: "",
    roomSelectionMode: "cheapest",
    roomTypes: [],
    views: [],
  },

  notificationPrefs: {
    thresholdType: "trip_total",
    thresholdValue: "",
    emailEnabled: false,
    smsEnabled: false,
  },

  flightPrefsOpen: false,
  hotelPrefsOpen: false,
});
```

(b) Update `tripDetailToFormData` — replace the `trackFlights/trackHotels/city` inputs. Find the return of `tripDetailToFormData` (lines 72-109) and replace with:

```typescript
  return {
    name: trip.name,
    originAirport: trip.origin_airport,
    destinationCode: trip.destination_code,
    isRoundTrip: trip.is_round_trip,
    departDate: trip.depart_date ? parseISO(trip.depart_date) : undefined,
    returnDate: trip.return_date ? parseISO(trip.return_date) : undefined,
    adults: String(trip.adults),

    trackFlights: trip.track_flights ?? hasFlightPrefs,
    trackHotels: trip.track_hotels ?? hasHotelPrefs,

    flightPrefs: {
      cabin: trip.flight_prefs?.cabin ?? "economy",
      stopsMode: trip.flight_prefs?.stops_mode ?? "any",
      airlines: trip.flight_prefs?.airlines ?? [],
    },

    hotelPrefs: {
      rooms: String(trip.hotel_prefs?.rooms ?? 1),
      adultsPerRoom: String(trip.hotel_prefs?.adults_per_room ?? 2),
      city: trip.hotel_prefs?.city ?? "",
      roomSelectionMode: trip.hotel_prefs?.room_selection_mode ?? "cheapest",
      roomTypes: trip.hotel_prefs?.preferred_room_types ?? [],
      views: trip.hotel_prefs?.preferred_views ?? [],
    },

    notificationPrefs: {
      thresholdType: trip.notification_prefs?.threshold_type ?? "trip_total",
      thresholdValue: trip.notification_prefs?.threshold_value ?? "",
      emailEnabled: trip.notification_prefs?.email_enabled ?? false,
      smsEnabled: trip.notification_prefs?.sms_enabled ?? false,
    },

    flightPrefsOpen: hasFlightPrefs,
    hotelPrefsOpen: hasHotelPrefs,
  };
```

(c) Add new memoized setters next to the existing ones (after `setAdults`, line 190). Paste:

```typescript
  const setTrackFlights = useCallback(
    (value: boolean) => setFormData((prev) => ({ ...prev, trackFlights: value })),
    []
  );
  const setTrackHotels = useCallback(
    (value: boolean) => setFormData((prev) => ({ ...prev, trackHotels: value })),
    []
  );
  const setCity = useCallback(
    (value: string) => {
      touch("hotelCity");
      setFormData((prev) => ({
        ...prev,
        hotelPrefs: { ...prev.hotelPrefs, city: value },
      }));
    },
    [touch]
  );
```

Add `setTrackFlights`, `setTrackHotels`, `setCity` to the `setters` memo block (both the object and the dep array) — the exact positions follow the order in the updated `TripFormSetters` interface from Step 3.

(d) Replace `getPayload` (lines 387-436) with:

```typescript
  const getPayload = useCallback((): TripPayload => {
    const {
      flightPrefs,
      hotelPrefs,
      notificationPrefs,
      trackFlights,
      trackHotels,
    } = formData;
    const notificationsEnabled =
      notificationPrefs.emailEnabled || notificationPrefs.smsEnabled;
    const thresholdValue = notificationsEnabled
      ? Number.parseFloat(notificationPrefs.thresholdValue)
      : 0;

    return {
      name: formData.name.trim(),
      origin_airport: formData.originAirport.trim().toUpperCase(),
      destination_code: formData.destinationCode.trim().toUpperCase(),
      is_round_trip: formData.isRoundTrip,
      depart_date: formatDateForApi(formData.departDate),
      return_date: formData.isRoundTrip
        ? formatDateForApi(formData.returnDate)
        : null,
      adults: parseNumber(formData.adults, 1),
      track_flights: trackFlights,
      track_hotels: trackHotels,
      flight_prefs: trackFlights
        ? {
            airlines: flightPrefs.airlines,
            stops_mode: flightPrefs.stopsMode as StopsMode,
            max_stops: null,
            cabin: flightPrefs.cabin as CabinClass,
          }
        : null,
      hotel_prefs: trackHotels
        ? {
            rooms: parseNumber(hotelPrefs.rooms, 1),
            adults_per_room: parseNumber(hotelPrefs.adultsPerRoom, 1),
            city: hotelPrefs.city.trim(),
            room_selection_mode: hotelPrefs.roomSelectionMode as RoomSelectionMode,
            preferred_room_types: hotelPrefs.roomTypes,
            preferred_views: hotelPrefs.views,
          }
        : null,
      notification_prefs: {
        threshold_type: notificationPrefs.thresholdType as ThresholdType,
        threshold_value: Number.isFinite(thresholdValue) ? thresholdValue : 0,
        notify_without_threshold: false,
        email_enabled: notificationPrefs.emailEnabled,
        sms_enabled: notificationPrefs.smsEnabled,
      },
    };
  }, [formData]);
```

- [ ] **Step 6: Run the hook tests again**

Run: `pnpm --filter vacation-price-tracker-web test --testPathPattern=use-trip-form`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/trip-form/types.ts apps/web/src/lib/hooks/use-trip-form.ts apps/web/src/lib/api.ts apps/web/src/__tests__/use-trip-form.test.tsx
git commit -m "feat(web): add trackFlights/trackHotels + hotel city to form state & payload"
```

---

## Task 10: Frontend validation rules

**Files:**
- Modify: `apps/web/src/components/trip-form/validation.ts`
- Modify: `apps/web/src/__tests__/trip-form-validation.test.ts`

- [ ] **Step 1: Write failing validation tests**

Append to `apps/web/src/__tests__/trip-form-validation.test.ts`:

```typescript
import { validateTripForm } from "../components/trip-form/validation";
import type { TripFormData } from "../components/trip-form/types";

function baseFormData(overrides: Partial<TripFormData> = {}): TripFormData {
  const depart = new Date();
  depart.setDate(depart.getDate() + 10);
  const ret = new Date();
  ret.setDate(ret.getDate() + 17);
  return {
    name: "Test",
    originAirport: "SFO",
    destinationCode: "MIA",
    isRoundTrip: true,
    departDate: depart,
    returnDate: ret,
    adults: "1",
    trackFlights: true,
    trackHotels: true,
    flightPrefs: { cabin: "economy", stopsMode: "any", airlines: [] },
    hotelPrefs: {
      rooms: "1",
      adultsPerRoom: "2",
      city: "Miami Beach",
      roomSelectionMode: "cheapest",
      roomTypes: [],
      views: [],
    },
    notificationPrefs: {
      thresholdType: "trip_total",
      thresholdValue: "",
      emailEnabled: false,
      smsEnabled: false,
    },
    flightPrefsOpen: false,
    hotelPrefsOpen: false,
    ...overrides,
  };
}

describe("validateTripForm — track flags and city", () => {
  it("requires city when trackHotels is true", () => {
    const errors = validateTripForm(
      baseFormData({
        hotelPrefs: {
          rooms: "1",
          adultsPerRoom: "2",
          city: "   ",
          roomSelectionMode: "cheapest",
          roomTypes: [],
          views: [],
        },
      })
    );
    expect(errors.hotelCity).toBeDefined();
  });

  it("does not require city when trackHotels is false", () => {
    const errors = validateTripForm(
      baseFormData({
        trackFlights: true,
        trackHotels: false,
        hotelPrefs: {
          rooms: "1",
          adultsPerRoom: "2",
          city: "",
          roomSelectionMode: "cheapest",
          roomTypes: [],
          views: [],
        },
      })
    );
    expect(errors.hotelCity).toBeUndefined();
  });

  it("rejects when both track flags are off", () => {
    const errors = validateTripForm(
      baseFormData({ trackFlights: false, trackHotels: false })
    );
    expect(errors.tracking).toBeDefined();
  });

  it("accepts flights-only selection", () => {
    const errors = validateTripForm(
      baseFormData({ trackFlights: true, trackHotels: false })
    );
    expect(errors.tracking).toBeUndefined();
    expect(errors.hotelCity).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run validation tests and confirm they fail**

Run: `pnpm --filter vacation-price-tracker-web test --testPathPattern=trip-form-validation`
Expected: FAIL.

- [ ] **Step 3: Extend `validation.ts`**

Replace `validateTripForm` (lines 74-102) and add the helper:

```typescript
export function validateHotelCity(city: string): string | undefined {
  if (!city.trim()) {
    return "City is required when tracking hotel prices";
  }
  if (city.length > 200) {
    return "City must be 200 characters or less";
  }
  return undefined;
}

export function validateTripForm(data: TripFormData): TripFormErrors {
  const errors: TripFormErrors = {};

  const nameError = validateName(data.name);
  if (nameError) errors.name = nameError;

  const originError = validateAirportCode(data.originAirport);
  if (originError) errors.originAirport = originError;

  const destinationError = validateAirportCode(data.destinationCode);
  if (destinationError) errors.destinationCode = destinationError;

  const departError = validateDepartDate(data.departDate);
  if (departError) errors.departDate = departError;

  if (data.isRoundTrip) {
    const returnError = validateReturnDate(data.returnDate, data.departDate);
    if (returnError) errors.returnDate = returnError;
  }

  if (!data.trackFlights && !data.trackHotels) {
    errors.tracking = "Select at least one of flight or hotel tracking";
  }

  if (data.trackHotels) {
    const cityError = validateHotelCity(data.hotelPrefs.city);
    if (cityError) errors.hotelCity = cityError;
  }

  if (data.notificationPrefs.emailEnabled || data.notificationPrefs.smsEnabled) {
    const thresholdError = validateThresholdValue(
      data.notificationPrefs.thresholdValue
    );
    if (thresholdError) errors.thresholdValue = thresholdError;
  }

  return errors;
}
```

- [ ] **Step 4: Run validation tests and confirm they pass**

Run: `pnpm --filter vacation-price-tracker-web test --testPathPattern=trip-form-validation`
Expected: PASS (new tests + all existing validation tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/trip-form/validation.ts apps/web/src/__tests__/trip-form-validation.test.ts
git commit -m "feat(web): validate track flag selection and require hotel city"
```

---

## Task 11: FlightPrefsSection with tracking checkbox

**Files:**
- Modify: `apps/web/src/components/trip-form/flight-prefs-section.tsx`
- Modify: `apps/web/src/components/trip-form/flight-prefs-section.module.css`
- Create: `apps/web/src/__tests__/trip-form-flight-prefs-section-tracking.test.tsx`

- [ ] **Step 1: Write failing section tests**

Create `apps/web/src/__tests__/trip-form-flight-prefs-section-tracking.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FlightPrefsSection } from "../components/trip-form/flight-prefs-section";

function setup(trackEnabled = true) {
  const onTrackChange = jest.fn();
  const onToggle = jest.fn();
  render(
    <FlightPrefsSection
      isOpen
      trackEnabled={trackEnabled}
      cabin="economy"
      stopsMode="any"
      airlines={[]}
      onTrackEnabledChange={onTrackChange}
      onToggle={onToggle}
      onCabinChange={jest.fn()}
      onStopsModeChange={jest.fn()}
      onAirlinesChange={jest.fn()}
    />
  );
  return { onTrackChange };
}

describe("FlightPrefsSection tracking checkbox", () => {
  it("renders a Track Flight Prices checkbox at the top", () => {
    setup(true);
    expect(
      screen.getByRole("checkbox", { name: /track flight prices/i })
    ).toBeInTheDocument();
  });

  it("calls onTrackEnabledChange when toggled", async () => {
    const user = userEvent.setup();
    const { onTrackChange } = setup(true);
    await user.click(screen.getByRole("checkbox", { name: /track flight prices/i }));
    expect(onTrackChange).toHaveBeenCalledWith(false);
  });

  it("disables inner controls when track is off", () => {
    setup(false);
    // The shadcn Select uses a button role for its trigger
    const triggers = screen.getAllByRole("combobox");
    for (const trigger of triggers) {
      expect(trigger).toBeDisabled();
    }
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm --filter vacation-price-tracker-web test --testPathPattern=flight-prefs-section-tracking`
Expected: FAIL — props don't exist yet.

- [ ] **Step 3: Update `flight-prefs-section.tsx`**

Replace the entire file with:

```tsx
"use client";

import { Plane } from "lucide-react";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { CollapsibleSection } from "./collapsible-section";
import { TagInput } from "./tag-input";
import { CABIN_CLASSES, STOPS_MODES } from "./constants";
import styles from "./flight-prefs-section.module.css";

export interface FlightPrefsSectionProps {
  isOpen: boolean;
  trackEnabled: boolean;
  cabin: string;
  stopsMode: string;
  airlines: string[];
  onToggle: () => void;
  onTrackEnabledChange: (value: boolean) => void;
  onCabinChange: (value: string) => void;
  onStopsModeChange: (value: string) => void;
  onAirlinesChange: (value: string[]) => void;
}

export function FlightPrefsSection({
  isOpen,
  trackEnabled,
  cabin,
  stopsMode,
  airlines,
  onToggle,
  onTrackEnabledChange,
  onCabinChange,
  onStopsModeChange,
  onAirlinesChange,
}: FlightPrefsSectionProps) {
  const disabled = !trackEnabled;
  return (
    <CollapsibleSection
      title="Flight Preferences"
      icon={<Plane size={20} />}
      badge={trackEnabled ? "Tracked" : "Not tracked"}
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <div className={styles.checkboxRow}>
        <Checkbox
          id="track-flights"
          checked={trackEnabled}
          onCheckedChange={(v) => onTrackEnabledChange(v === true)}
        />
        <Label htmlFor="track-flights" className={styles.checkboxLabel}>
          Track Flight Prices
        </Label>
      </div>
      <div
        className={disabled ? styles.disabledSection : undefined}
        aria-disabled={disabled}
      >
        <div className={styles.gridTwo}>
          <div className={styles.field}>
            <Label className={styles.fieldLabel}>Cabin Class</Label>
            <Select
              value={cabin}
              onValueChange={onCabinChange}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CABIN_CLASSES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className={styles.field}>
            <Label className={styles.fieldLabel}>Stops</Label>
            <Select
              value={stopsMode}
              onValueChange={onStopsModeChange}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STOPS_MODES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className={styles.field}>
          <Label className={styles.fieldLabel}>Preferred Airlines</Label>
          <TagInput
            tags={airlines}
            onTagsChange={onAirlinesChange}
            placeholder="Type airline codes (e.g., UA, AA, DL)"
            id="airlines"
            disabled={disabled}
          />
          <span className={styles.fieldHint}>
            Enter 2-letter airline codes, press Enter to add
          </span>
        </div>
      </div>
    </CollapsibleSection>
  );
}
```

Note: this requires `TagInput` to accept a `disabled` prop. Verify by running: `grep -n "disabled" apps/web/src/components/trip-form/tag-input.tsx`. If it does not already accept `disabled`, add an optional `disabled?: boolean` prop that disables the input and hides the `+` button. (Small, mechanical change — apply it in this same task.)

- [ ] **Step 4: Add CSS for the checkbox row and disabled state**

Append to `apps/web/src/components/trip-form/flight-prefs-section.module.css`:

```css
.checkboxRow {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.checkboxLabel {
  cursor: pointer;
  font-weight: 500;
}

.disabledSection {
  opacity: 0.5;
  pointer-events: none;
}
```

- [ ] **Step 5: Run section tests**

Run: `pnpm --filter vacation-price-tracker-web test --testPathPattern=flight-prefs-section`
Expected: PASS (new tracking tests + existing section tests — any that still reference the old prop shape will fail; fix them by threading `trackEnabled` / `onTrackEnabledChange` through the renders).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/trip-form/flight-prefs-section.tsx apps/web/src/components/trip-form/flight-prefs-section.module.css apps/web/src/components/trip-form/tag-input.tsx apps/web/src/__tests__/trip-form-flight-prefs-section-tracking.test.tsx apps/web/src/__tests__/trip-form-flight-prefs-section.test.tsx
git commit -m "feat(web): add Track Flight Prices checkbox gate to FlightPrefsSection"
```

---

## Task 12: HotelPrefsSection with tracking checkbox + city field

**Files:**
- Modify: `apps/web/src/components/trip-form/hotel-prefs-section.tsx`
- Modify: `apps/web/src/components/trip-form/hotel-prefs-section.module.css`
- Create: `apps/web/src/__tests__/trip-form-hotel-prefs-section.test.tsx`

- [ ] **Step 1: Write failing section tests**

Create `apps/web/src/__tests__/trip-form-hotel-prefs-section.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HotelPrefsSection } from "../components/trip-form/hotel-prefs-section";

function setup(trackEnabled = true, city = "Miami Beach") {
  const props = {
    isOpen: true,
    trackEnabled,
    rooms: "1",
    adultsPerRoom: "2",
    city,
    cityError: undefined as string | undefined,
    roomSelectionMode: "cheapest",
    roomTypes: [] as string[],
    views: [] as string[],
    onToggle: jest.fn(),
    onTrackEnabledChange: jest.fn(),
    onRoomsChange: jest.fn(),
    onAdultsPerRoomChange: jest.fn(),
    onCityChange: jest.fn(),
    onRoomSelectionModeChange: jest.fn(),
    onRoomTypesChange: jest.fn(),
    onViewsChange: jest.fn(),
  };
  render(<HotelPrefsSection {...props} />);
  return props;
}

describe("HotelPrefsSection", () => {
  it("renders Track Hotel Prices checkbox", () => {
    setup(true);
    expect(
      screen.getByRole("checkbox", { name: /track hotel prices/i })
    ).toBeInTheDocument();
  });

  it("renders a City text input with the current value", () => {
    setup(true, "Honolulu");
    const cityInput = screen.getByLabelText(/city/i) as HTMLInputElement;
    expect(cityInput.value).toBe("Honolulu");
  });

  it("calls onCityChange when the user types", async () => {
    const user = userEvent.setup();
    const props = setup(true, "");
    const cityInput = screen.getByLabelText(/city/i);
    await user.type(cityInput, "T");
    expect(props.onCityChange).toHaveBeenCalledWith("T");
  });

  it("disables all inner controls when trackEnabled is false", () => {
    setup(false);
    expect(screen.getByLabelText(/city/i)).toBeDisabled();
    const combos = screen.getAllByRole("combobox");
    for (const c of combos) expect(c).toBeDisabled();
  });

  it("calls onTrackEnabledChange when checkbox toggled", async () => {
    const user = userEvent.setup();
    const props = setup(true);
    await user.click(
      screen.getByRole("checkbox", { name: /track hotel prices/i })
    );
    expect(props.onTrackEnabledChange).toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm --filter vacation-price-tracker-web test --testPathPattern=hotel-prefs-section`
Expected: FAIL — section doesn't have the new props/inputs.

- [ ] **Step 3: Update `hotel-prefs-section.tsx`**

Replace the entire file with:

```tsx
"use client";

import { Hotel } from "lucide-react";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { CollapsibleSection } from "./collapsible-section";
import { TagInput } from "./tag-input";
import {
  ROOM_SELECTION_MODES,
  ROOM_TYPES,
  VIEW_TYPES,
  ROOM_COUNTS,
  ADULTS_PER_ROOM_COUNTS,
} from "./constants";
import styles from "./hotel-prefs-section.module.css";

export interface HotelPrefsSectionProps {
  isOpen: boolean;
  trackEnabled: boolean;
  rooms: string;
  adultsPerRoom: string;
  city: string;
  cityError?: string;
  roomSelectionMode: string;
  roomTypes: string[];
  views: string[];
  onToggle: () => void;
  onTrackEnabledChange: (value: boolean) => void;
  onRoomsChange: (value: string) => void;
  onAdultsPerRoomChange: (value: string) => void;
  onCityChange: (value: string) => void;
  onRoomSelectionModeChange: (value: string) => void;
  onRoomTypesChange: (value: string[]) => void;
  onViewsChange: (value: string[]) => void;
}

export function HotelPrefsSection({
  isOpen,
  trackEnabled,
  rooms,
  adultsPerRoom,
  city,
  cityError,
  roomSelectionMode,
  roomTypes,
  views,
  onToggle,
  onTrackEnabledChange,
  onRoomsChange,
  onAdultsPerRoomChange,
  onCityChange,
  onRoomSelectionModeChange,
  onRoomTypesChange,
  onViewsChange,
}: HotelPrefsSectionProps) {
  const disabled = !trackEnabled;
  return (
    <CollapsibleSection
      title="Hotel Preferences"
      icon={<Hotel size={20} />}
      badge={trackEnabled ? "Tracked" : "Not tracked"}
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <div className={styles.checkboxRow}>
        <Checkbox
          id="track-hotels"
          checked={trackEnabled}
          onCheckedChange={(v) => onTrackEnabledChange(v === true)}
        />
        <Label htmlFor="track-hotels" className={styles.checkboxLabel}>
          Track Hotel Prices
        </Label>
      </div>
      <div
        className={disabled ? styles.disabledSection : undefined}
        aria-disabled={disabled}
      >
        <div className={styles.field}>
          <Label htmlFor="hotel-city" className={styles.fieldLabel}>
            City
          </Label>
          <Input
            id="hotel-city"
            value={city}
            onChange={(e) => onCityChange(e.target.value)}
            placeholder="e.g., Downtown Orlando, Waikiki"
            disabled={disabled}
            aria-invalid={Boolean(cityError)}
          />
          {cityError && <span className={styles.errorText}>{cityError}</span>}
          <span className={styles.fieldHint}>
            Used instead of the destination airport when searching for hotels.
          </span>
        </div>
        <div className={styles.gridThree}>
          <div className={styles.field}>
            <Label className={styles.fieldLabel}>Rooms</Label>
            <Select value={rooms} onValueChange={onRoomsChange} disabled={disabled}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROOM_COUNTS.map((n) => (
                  <SelectItem key={n} value={n.toString()}>
                    {n} {n === 1 ? "Room" : "Rooms"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className={styles.field}>
            <Label className={styles.fieldLabel}>Adults per Room</Label>
            <Select
              value={adultsPerRoom}
              onValueChange={onAdultsPerRoomChange}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ADULTS_PER_ROOM_COUNTS.map((n) => (
                  <SelectItem key={n} value={n.toString()}>
                    {n} {n === 1 ? "Adult" : "Adults"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className={styles.field}>
            <Label className={styles.fieldLabel}>Room Selection</Label>
            <Select
              value={roomSelectionMode}
              onValueChange={onRoomSelectionModeChange}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROOM_SELECTION_MODES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className={styles.field}>
          <Label className={styles.fieldLabel}>Preferred Room Types</Label>
          <TagInput
            tags={roomTypes}
            onTagsChange={onRoomTypesChange}
            placeholder="e.g., King, Suite, Studio"
            suggestions={ROOM_TYPES}
            id="room-types"
            disabled={disabled}
          />
        </div>
        <div className={styles.field}>
          <Label className={styles.fieldLabel}>Preferred Views</Label>
          <TagInput
            tags={views}
            onTagsChange={onViewsChange}
            placeholder="e.g., Ocean, City, Garden"
            suggestions={VIEW_TYPES}
            id="views"
            disabled={disabled}
          />
        </div>
      </div>
    </CollapsibleSection>
  );
}
```

- [ ] **Step 4: Extend the CSS module**

Append to `apps/web/src/components/trip-form/hotel-prefs-section.module.css`:

```css
.checkboxRow {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.checkboxLabel {
  cursor: pointer;
  font-weight: 500;
}

.disabledSection {
  opacity: 0.5;
  pointer-events: none;
}

.errorText {
  color: var(--destructive, #dc2626);
  font-size: 0.75rem;
  margin-top: 0.25rem;
}
```

- [ ] **Step 5: Run section tests**

Run: `pnpm --filter vacation-price-tracker-web test --testPathPattern=hotel-prefs-section`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/trip-form/hotel-prefs-section.tsx apps/web/src/components/trip-form/hotel-prefs-section.module.css apps/web/src/__tests__/trip-form-hotel-prefs-section.test.tsx
git commit -m "feat(web): add Track Hotel Prices checkbox and City field to HotelPrefsSection"
```

---

## Task 13: Wire form pages

**Files:**
- Modify: `apps/web/src/app/trips/new/page.tsx`
- Modify: `apps/web/src/app/trips/[tripId]/edit/page.tsx`
- Modify: `apps/web/src/components/trip-form/chat-trip-form.tsx`

- [ ] **Step 1: Update `new/page.tsx`**

In `apps/web/src/app/trips/new/page.tsx`, locate the `<FlightPrefsSection>` call (line 109) and the `<HotelPrefsSection>` call (line 120). Replace them with:

```tsx
        <FlightPrefsSection
          isOpen={formData.flightPrefsOpen}
          trackEnabled={formData.trackFlights}
          cabin={formData.flightPrefs.cabin}
          stopsMode={formData.flightPrefs.stopsMode}
          airlines={formData.flightPrefs.airlines}
          onToggle={() => setters.setFlightPrefsOpen(!formData.flightPrefsOpen)}
          onTrackEnabledChange={setters.setTrackFlights}
          onCabinChange={setters.setCabin}
          onStopsModeChange={setters.setStopsMode}
          onAirlinesChange={setters.setAirlines}
        />

        <HotelPrefsSection
          isOpen={formData.hotelPrefsOpen}
          trackEnabled={formData.trackHotels}
          rooms={formData.hotelPrefs.rooms}
          adultsPerRoom={formData.hotelPrefs.adultsPerRoom}
          city={formData.hotelPrefs.city}
          cityError={errors.hotelCity}
          roomSelectionMode={formData.hotelPrefs.roomSelectionMode}
          roomTypes={formData.hotelPrefs.roomTypes}
          views={formData.hotelPrefs.views}
          onToggle={() => setters.setHotelPrefsOpen(!formData.hotelPrefsOpen)}
          onTrackEnabledChange={setters.setTrackHotels}
          onRoomsChange={setters.setRooms}
          onAdultsPerRoomChange={setters.setAdultsPerRoom}
          onCityChange={setters.setCity}
          onRoomSelectionModeChange={setters.setRoomSelectionMode}
          onRoomTypesChange={setters.setRoomTypes}
          onViewsChange={setters.setViews}
        />
```

The existing `<Button type="submit" disabled={isSubmitting || !isValid}>` already reflects the new validation rules — no change needed there.

- [ ] **Step 2: Update `edit/page.tsx`**

In `apps/web/src/app/trips/[tripId]/edit/page.tsx`, find the `loadTrip` block that restores form state (lines 54-74). Replace with:

```tsx
        setters.setName(formInitialData.name);
        setters.setOriginAirport(formInitialData.originAirport);
        setters.setDestinationCode(formInitialData.destinationCode);
        setters.setIsRoundTrip(formInitialData.isRoundTrip);
        setters.setDepartDate(formInitialData.departDate);
        setters.setReturnDate(formInitialData.returnDate);
        setters.setAdults(formInitialData.adults);
        setters.setTrackFlights(formInitialData.trackFlights);
        setters.setTrackHotels(formInitialData.trackHotels);
        setters.setCabin(formInitialData.flightPrefs.cabin);
        setters.setStopsMode(formInitialData.flightPrefs.stopsMode);
        setters.setAirlines(formInitialData.flightPrefs.airlines);
        setters.setRooms(formInitialData.hotelPrefs.rooms);
        setters.setAdultsPerRoom(formInitialData.hotelPrefs.adultsPerRoom);
        setters.setCity(formInitialData.hotelPrefs.city);
        setters.setRoomSelectionMode(formInitialData.hotelPrefs.roomSelectionMode);
        setters.setRoomTypes(formInitialData.hotelPrefs.roomTypes);
        setters.setViews(formInitialData.hotelPrefs.views);
        setters.setThresholdType(formInitialData.notificationPrefs.thresholdType);
        setters.setThresholdValue(formInitialData.notificationPrefs.thresholdValue);
        setters.setEmailEnabled(formInitialData.notificationPrefs.emailEnabled);
        setters.setSmsEnabled(formInitialData.notificationPrefs.smsEnabled);
        setters.setFlightPrefsOpen(formInitialData.flightPrefsOpen);
        setters.setHotelPrefsOpen(formInitialData.hotelPrefsOpen);
```

Then find the `<FlightPrefsSection>` and `<HotelPrefsSection>` renders in the same file and apply the same prop updates as in Step 1.

- [ ] **Step 3: Update `chat-trip-form.tsx`**

In `apps/web/src/components/trip-form/chat-trip-form.tsx`, update the two section renders (lines 168, 179). Use the same prop shape as in Step 1. Leave the `prefilledToFormData` mapping alone — in the chat flow, new trips inherit the defaults `trackFlights=true` / `trackHotels=true` / `city=""`, which is fine.

- [ ] **Step 4: Run full web unit tests**

Run: `pnpm --filter vacation-price-tracker-web test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/trips/new/page.tsx apps/web/src/app/trips/[tripId]/edit/page.tsx apps/web/src/components/trip-form/chat-trip-form.tsx
git commit -m "feat(web): wire track flags + hotel city through create, edit, chat forms"
```

---

## Task 14: Playwright E2E spec

**Files:**
- Create: `apps/web/e2e/track-prefs-hotel-city.spec.ts`

- [ ] **Step 1: Draft the Playwright spec**

Create `apps/web/e2e/track-prefs-hotel-city.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test.describe("Trip tracking preferences and hotel city", () => {
  test("disables Create button when both tracking checkboxes are off", async ({
    page,
  }, testInfo) => {
    await page.goto("/trips/new");

    await page.locator("#name").fill(`NoTrack ${testInfo.project.name} ${Date.now()}`);

    const originInput = page.locator("#origin");
    await originInput.fill("SFO");
    const originOption = page.locator("[role='option']").first();
    await originOption.waitFor({ timeout: 5_000 }).catch(() => null);
    if (await originOption.isVisible()) await originOption.click();

    const destInput = page.locator("#destination");
    await destInput.fill("HNL");
    const destOption = page.locator("[role='option']").first();
    await destOption.waitFor({ timeout: 5_000 }).catch(() => null);
    if (await destOption.isVisible()) await destOption.click();

    const flightCheckbox = page.getByRole("checkbox", {
      name: /track flight prices/i,
    });
    const hotelCheckbox = page.getByRole("checkbox", {
      name: /track hotel prices/i,
    });

    await flightCheckbox.click(); // was on, turn off
    await hotelCheckbox.click(); // was on, turn off

    const createButton = page.getByRole("button", { name: /create trip/i });
    await expect(createButton).toBeDisabled();
  });

  test("creates a hotels-only trip with a custom city", async ({
    page,
  }, testInfo) => {
    await page.goto("/trips/new");

    const tripName = `Hotels Only ${testInfo.project.name} ${Date.now()}`;
    await page.locator("#name").fill(tripName);

    const originInput = page.locator("#origin");
    await originInput.fill("SFO");
    const originOption = page.locator("[role='option']").first();
    await originOption.waitFor({ timeout: 5_000 }).catch(() => null);
    if (await originOption.isVisible()) await originOption.click();

    const destInput = page.locator("#destination");
    await destInput.fill("MCO");
    const destOption = page.locator("[role='option']").first();
    await destOption.waitFor({ timeout: 5_000 }).catch(() => null);
    if (await destOption.isVisible()) await destOption.click();

    // Turn off flight tracking
    await page.getByRole("checkbox", { name: /track flight prices/i }).click();

    // Hotel tracking should remain on by default; set city
    await page.locator("#hotel-city").fill("Downtown Orlando");

    const createButton = page.getByRole("button", { name: /create trip/i });
    await expect(createButton).toBeEnabled();
    await createButton.click();

    await expect(page).toHaveURL(/\/trips$/, { timeout: 15_000 });
    const tripLink = page.getByRole("link", { name: tripName });
    await expect(tripLink).toBeVisible({ timeout: 10_000 });
  });

  test("city field disables when Track Hotel Prices is unchecked", async ({
    page,
  }) => {
    await page.goto("/trips/new");

    const cityInput = page.locator("#hotel-city");
    await expect(cityInput).toBeEnabled();

    await page.getByRole("checkbox", { name: /track hotel prices/i }).click();
    await expect(cityInput).toBeDisabled();
  });
});
```

- [ ] **Step 2: Verify the Docker stack is running**

Run: `docker ps --format '{{.Names}}' | grep -E '^(web|api|db|temporal)$' | wc -l | tr -d ' '`
Expected: `4` (at minimum — web, api, db, temporal). If not, start: `docker compose -f infra/docker-compose.yml up -d`.

- [ ] **Step 3: Run the new Playwright spec**

Run: `pnpm --filter vacation-price-tracker-web test:e2e --grep "tracking preferences and hotel city"`
Expected: all three cases PASS. If any check fails because a selector doesn't match, update the spec (not the component) — the component is already test-locked in Tasks 11/12.

- [ ] **Step 4: Commit**

```bash
git add apps/web/e2e/track-prefs-hotel-city.spec.ts
git commit -m "test(web): playwright coverage for track flags and hotel city"
```

---

## Task 15: Final verification

**Files:**
- None (verification only)

- [ ] **Step 1: Run the full verify script**

Run: `pnpm verify`
Expected: steps 1–3 PASS (install, nx run-many -t build lint typecheck test:coverage, security audits). If anything fails, fix the root cause and re-run.

- [ ] **Step 2: Run the full E2E suite (requires Docker stack)**

Run: `RUN_E2E=1 pnpm verify` — OR — `pnpm --filter vacation-price-tracker-web test:e2e`
Expected: all existing specs (auth setup, trip-creation-refresh, chat flight/hotel, theme validation) plus the new `track-prefs-hotel-city` spec PASS.

- [ ] **Step 3: Manual sanity check in the browser**

Open `https://localhost:3000/trips/new` (HTTPS, per user-memory note) and visually confirm:
- Both `Track Flight Prices` and `Track Hotel Prices` checkboxes appear at the top of their sections.
- Unchecking one greys out its section (reduced opacity, controls disabled).
- Unchecking both disables the `Create Trip` button.
- The `City` input appears in Hotel Preferences with placeholder text.
- Typing in `City` does not affect the flight section.

- [ ] **Step 4: (No commit — verification only.)**

If any issue surfaces, fix it in a follow-up commit before declaring the feature complete.

---

## Self-review notes

**Spec coverage:**
- "Track Hotel Prices" checkbox at top of Hotel Preferences → Task 12 Step 3.
- "Track Flight Prices" checkbox at top of Flight Preferences → Task 11 Step 3.
- Section disabled until checkbox enabled → `disabled` prop on every control + `disabledSection` styling (Tasks 11/12 Step 3/4).
- Create button disabled if neither checkbox → validation rule (Task 10) flows through `isValid` (already wired on `new/page.tsx` line 157 and mirrored in `chat-trip-form.tsx` line 206).
- Hotel Preferences city field → Task 12 Step 3.
- City fed to Skiplagged instead of airport code → Task 6 Step 3 (with fallback to `destination_code` when blank).
- Test coverage → schema (Task 3), endpoint (Task 4), worker activity + workflow (Tasks 5-7), hook (Task 9), validation (Task 10), sections (Tasks 11-12), E2E (Task 14).
- `pnpm verify` + Playwright → Task 15.

**Type consistency:**
- `trackFlights`/`trackHotels` / `track_flights`/`track_hotels` used consistently — camelCase on the frontend, snake_case on payload/API/DB.
- `city` lives on `hotelPrefs.city` in form state and `hotel_prefs.city` in payload/API.
- `TripFormSetters` interface, hook setter definitions, and consumer wiring all reference the same three new setters (`setTrackFlights`, `setTrackHotels`, `setCity`).
