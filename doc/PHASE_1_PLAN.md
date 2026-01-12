# Phase 1: MVP Core (Manual Refresh)

**Goal:** A working dashboard running locally with manual price refresh capability.

---

## 1. Infrastructure Setup

### 1.1 Docker Compose Environment
- [ ] Create `docker-compose.yml` with services:
  - `db`: PostgreSQL 15 with health check
  - `redis`: Redis 7 for caching and idempotency keys
  - `temporal`: Temporal server (temporalio/auto-setup)
  - `temporal-ui`: Temporal Web UI on port 8080
  - `api`: FastAPI backend
  - `worker`: Temporal worker process
  - `web`: Next.js frontend
- [ ] Configure shared network for inter-service communication
- [ ] Set up volume mounts for database persistence
- [ ] Create `docker-compose.override.yml` for development hot-reload

### 1.2 Environment Configuration
- [ ] Validate `.env.example` has all required variables
- [ ] Create startup script that fails fast on missing required env vars
- [ ] Document minimum required variables for Phase 1:
  - `DATABASE_URL`
  - `REDIS_URL`
  - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
  - `SECRET_KEY`
  - `AMADEUS_API_KEY` / `AMADEUS_API_SECRET`

### 1.3 MCP Server Configuration
- [ ] Add Amadeus MCP server as sidecar container
- [ ] Document Kiwi MCP connection options (Claude.ai connector or self-hosted)
- [ ] Create MCP router configuration in FastAPI for tool dispatching

---

## 2. Authentication (Google OAuth 2.0)

### 2.1 Backend OAuth Implementation
- [ ] Install dependencies: `authlib`, `python-jose[cryptography]`
- [ ] Create `/v1/auth/google/start` endpoint:
  - Generate state parameter, store in Redis (5-min TTL)
  - Redirect to Google consent screen with scopes: `openid`, `email`, `profile`
- [ ] Create `/v1/auth/google/callback` endpoint:
  - Validate state parameter from Redis
  - Exchange code for tokens via Google token endpoint
  - Extract `google_sub` and `email` from ID token
  - Create or update User record in database
  - Issue JWT access token (15-min expiry) and refresh token (7-day expiry)
  - Set HTTP-only, Secure, SameSite=Lax cookies
- [ ] Create `/v1/auth/refresh` endpoint:
  - Validate refresh token
  - Issue new access/refresh token pair
  - Implement token rotation (invalidate old refresh token)
- [ ] Create `/v1/auth/logout` endpoint:
  - Clear cookies
  - Invalidate refresh token in Redis blacklist

### 2.2 Frontend OAuth Integration
- [ ] Create "Sign in with Google" button component
- [ ] Implement OAuth redirect flow
- [ ] Handle callback and token storage
- [ ] Create auth context/provider for session state
- [ ] Implement automatic token refresh on 401 responses

### 2.3 Auth Middleware
- [ ] Create FastAPI dependency `get_current_user`:
  - Extract JWT from cookie
  - Validate signature and expiration
  - Return User object or raise 401
- [ ] Apply middleware to all protected routes

---

## 3. Data Layer

### 3.1 SQLModel/SQLAlchemy Models

```python
# Core entities to implement:

class User(SQLModel, table=True):
    id: uuid.UUID (PK, default=uuid4)
    email: str (unique, indexed)
    google_sub: str (unique, indexed)
    created_at: datetime
    updated_at: datetime

class Trip(SQLModel, table=True):
    id: uuid.UUID (PK)
    user_id: uuid.UUID (FK -> User, indexed)
    name: str
    origin_airport: str (IATA code)
    destination_code: str (IATA code)
    is_round_trip: bool
    depart_date: date
    return_date: date
    adults: int
    status: TrackingStatus (enum: ACTIVE, PAUSED, ERROR)
    created_at: datetime
    updated_at: datetime

    # Composite unique: (user_id, name)

class TripFlightPrefs(SQLModel, table=True):
    id: uuid.UUID (PK)
    trip_id: uuid.UUID (FK -> Trip, unique)
    airlines: List[str] (ARRAY)
    stops_mode: str
    max_stops: Optional[int]
    cabin: str

class TripHotelPrefs(SQLModel, table=True):
    id: uuid.UUID (PK)
    trip_id: uuid.UUID (FK -> Trip, unique)
    rooms: int
    adults_per_room: int
    room_selection_mode: str
    preferred_room_types: List[str] (ARRAY)
    preferred_views: List[str] (ARRAY)

class PriceSnapshot(SQLModel, table=True):
    id: uuid.UUID (PK)
    trip_id: uuid.UUID (FK -> Trip, indexed)
    flight_price: Optional[Decimal]
    hotel_price: Optional[Decimal]
    total_price: Optional[Decimal]
    raw_data: dict (JSONB)
    created_at: datetime (indexed)

class NotificationRule(SQLModel, table=True):
    id: uuid.UUID (PK)
    trip_id: uuid.UUID (FK -> Trip, unique)
    threshold_type: ThresholdType (enum)
    threshold_value: Decimal
    email_enabled: bool
    sms_enabled: bool
```

### 3.2 Database Setup
- [ ] Install dependencies: `sqlmodel`, `asyncpg`, `alembic`
- [ ] Configure async database engine with connection pooling (min=5, max=20)
- [ ] Create `alembic.ini` and migration environment
- [ ] Write initial migration with all Phase 1 tables
- [ ] Add indexes:
  - `ix_trip_user_id` on `trip.user_id`
  - `ix_trip_status` on `trip.status`
  - `ix_price_snapshot_trip_id` on `price_snapshot.trip_id`
  - `ix_price_snapshot_created_at` on `price_snapshot.created_at`
  - Composite unique on `(user_id, name)` for Trip
- [ ] Configure ON DELETE CASCADE for:
  - TripFlightPrefs, TripHotelPrefs, NotificationRule -> Trip
  - PriceSnapshot -> Trip

### 3.3 Pydantic Schemas
- [ ] Create request/response schemas matching API spec:
  - `TripCreate`, `TripResponse`, `TripDetail`
  - `FlightPrefs`, `HotelPrefs`, `NotificationPrefs`
  - `PriceSnapshotResponse`
- [ ] Implement envelope wrapper for all responses:
  ```python
  class APIResponse(BaseModel, Generic[T]):
      data: T
      meta: Optional[dict] = None
  ```
- [ ] Add validation constraints (max 10 trips, valid IATA codes, date ranges)

---

## 4. API Endpoints

### 4.1 Trip CRUD
- [ ] `GET /v1/trips` - List user's trips with pagination
  - Query params: `page`, `limit`, `status`
  - Include current prices from latest snapshot
  - Response: `{ "data": [...], "meta": { "page": 1, "total": 5 } }`
- [ ] `POST /v1/trips` - Create new trip
  - Require `X-Idempotency-Key` header
  - Store key in Redis with 24-hour TTL
  - Check trip count < `MAX_TRIPS_PER_USER`
  - Trigger initial `PriceCheckWorkflow`
  - Response: 201 with created trip
- [ ] `GET /v1/trips/{id}` - Get trip details with price history
  - Include flight/hotel prefs
  - Include last N price snapshots (paginated)
  - Include notification rules
- [ ] `DELETE /v1/trips/{id}` - Delete trip (hard delete)
  - Cascade delete all snapshots, prefs, rules
  - Verify ownership (user_id matches)
  - Response: 204 No Content
- [ ] `PATCH /v1/trips/{id}/status` - Pause/Resume tracking
  - Body: `{ "status": "PAUSED" | "ACTIVE" }`
  - Verify ownership

### 4.2 Refresh Endpoints
- [ ] `POST /v1/trips/refresh-all` - Trigger manual refresh
  - Check if refresh already in progress (Redis lock)
  - Start `RefreshAllTripsWorkflow` via Temporal client
  - Return `refresh_group_id` for tracking
  - Response: `{ "data": { "refresh_group_id": "..." } }`
- [ ] `GET /v1/trips/refresh-status` - Check refresh progress
  - Query Temporal workflow status
  - Return progress (X of Y trips completed)

### 4.3 Reference Data
- [ ] `GET /v1/locations/search` - Airport/city search
  - Query param: `q` (search term)
  - Use Amadeus location API or local database
  - Response: `{ "data": [{ "code": "SFO", "name": "...", "type": "AIRPORT" }] }`

### 4.4 Error Handling
- [ ] Create global exception handler middleware
- [ ] Return RFC 7807 Problem Details:
  ```json
  {
    "type": "https://api.example.com/errors/trip-limit-exceeded",
    "title": "Trip Limit Exceeded",
    "detail": "Maximum of 10 trips allowed per user",
    "status": 400,
    "instance": "/v1/trips"
  }
  ```
- [ ] Define custom exception classes:
  - `TripLimitExceeded`
  - `TripNotFound`
  - `DuplicateTripName`
  - `ExternalAPIError`
  - `RefreshInProgress`

### 4.5 Idempotency Implementation
- [ ] Create middleware to check `X-Idempotency-Key` header
- [ ] Store request hash and response in Redis (24h TTL)
- [ ] Return cached response on duplicate key
- [ ] Handle race conditions with Redis SETNX

---

## 5. Temporal Worker

### 5.1 Worker Setup
- [ ] Install `temporalio` SDK
- [ ] Configure worker to connect to Temporal server
- [ ] Register workflows and activities
- [ ] Implement graceful shutdown handling

### 5.2 RefreshAllTripsWorkflow
```python
@workflow.defn
class RefreshAllTripsWorkflow:
    @workflow.run
    async def run(self, user_id: str) -> RefreshResult:
        # 1. Get all active (non-paused) trips for user
        trips = await workflow.execute_activity(
            get_active_trips,
            user_id,
            start_to_close_timeout=timedelta(seconds=30)
        )

        # 2. Execute PriceCheckWorkflow for each trip (parallel with limit)
        results = []
        for trip in trips:
            result = await workflow.execute_child_workflow(
                PriceCheckWorkflow.run,
                trip.id,
                id=f"price-check-{trip.id}-{workflow.now()}"
            )
            results.append(result)

        # 3. Return summary
        return RefreshResult(
            total=len(trips),
            successful=len([r for r in results if r.success]),
            failed=len([r for r in results if not r.success])
        )
```

### 5.3 PriceCheckWorkflow
```python
@workflow.defn
class PriceCheckWorkflow:
    @workflow.run
    async def run(self, trip_id: str) -> PriceCheckResult:
        # 1. Load trip details
        trip = await workflow.execute_activity(
            load_trip_details,
            trip_id,
            start_to_close_timeout=timedelta(seconds=10)
        )

        # 2. Fetch prices in parallel
        flight_task = workflow.execute_activity(
            fetch_flights_activity,
            trip,
            start_to_close_timeout=timedelta(seconds=60),
            retry_policy=RetryPolicy(max_attempts=3)
        )
        hotel_task = workflow.execute_activity(
            fetch_hotels_activity,
            trip,
            start_to_close_timeout=timedelta(seconds=60),
            retry_policy=RetryPolicy(max_attempts=3)
        )

        flight_result, hotel_result = await asyncio.gather(
            flight_task, hotel_task, return_exceptions=True
        )

        # 3. Apply post-fetch filters
        filtered = await workflow.execute_activity(
            filter_results_activity,
            FilterInput(flight_result, hotel_result, trip.prefs),
            start_to_close_timeout=timedelta(seconds=10)
        )

        # 4. Save snapshot
        snapshot = await workflow.execute_activity(
            save_snapshot_activity,
            SaveSnapshotInput(trip_id, filtered),
            start_to_close_timeout=timedelta(seconds=10)
        )

        # 5. Check notification thresholds (Phase 3)
        # await workflow.execute_activity(check_notifications_activity, ...)

        return PriceCheckResult(success=True, snapshot_id=snapshot.id)
```

### 5.4 Activities
- [ ] `get_active_trips` - Query database for non-paused trips
- [ ] `load_trip_details` - Load trip with flight/hotel prefs
- [ ] `fetch_flights_activity` - Call Kiwi MCP `search-flight`
  - Build request from trip details
  - Handle API errors, return partial result on failure
- [ ] `fetch_hotels_activity` - Call Amadeus MCP `amadeus_hotel_search`
  - Build request from trip details
  - Handle API errors, return partial result on failure
- [ ] `filter_results_activity` - Apply post-fetch filtering
  - Filter flights by preferred airlines
  - Filter hotels by room type keywords in description
  - Filter hotels by view keywords
- [ ] `save_snapshot_activity` - Persist PriceSnapshot to database
  - Store raw API responses in `raw_data` JSONB
  - Calculate totals

### 5.5 Post-Fetch Filtering Logic
```python
def filter_flights(flights: List[Flight], prefs: FlightPrefs) -> List[Flight]:
    if not prefs.airlines:
        return flights

    return [
        f for f in flights
        if any(airline in f.operating_carrier for airline in prefs.airlines)
    ]

def filter_rooms(rooms: List[Room], prefs: HotelPrefs) -> List[Room]:
    filtered = rooms

    if prefs.preferred_room_types:
        type_keywords = [t.lower() for t in prefs.preferred_room_types]
        filtered = [
            r for r in filtered
            if any(kw in r.description.lower() for kw in type_keywords)
        ]

    if prefs.preferred_views:
        view_mapping = {
            "ocean": ["ocean", "sea", "water", "beach"],
            "city": ["city", "skyline", "urban"],
            "garden": ["garden", "courtyard", "pool"]
        }
        filtered = [
            r for r in filtered
            if any(
                any(kw in r.description.lower() for kw in view_mapping.get(v.lower(), [v.lower()]))
                for v in prefs.preferred_views
            )
        ]

    return filtered
```

---

## 6. Frontend (Next.js 14)

### 6.1 Project Setup
- [ ] Initialize Next.js 14 with App Router
- [ ] Configure Tailwind CSS
- [ ] Install and configure shadcn/ui components
- [ ] Set up project structure:
  ```
  apps/web/
  ├── app/
  │   ├── (auth)/
  │   │   ├── login/page.tsx
  │   │   └── callback/page.tsx
  │   ├── (dashboard)/
  │   │   ├── layout.tsx
  │   │   ├── page.tsx (trip list)
  │   │   └── trips/[id]/page.tsx
  │   ├── layout.tsx
  │   └── globals.css
  ├── components/
  │   ├── ui/ (shadcn)
  │   ├── trip-table.tsx
  │   ├── trip-detail-modal.tsx
  │   ├── price-chart.tsx
  │   └── refresh-button.tsx
  ├── lib/
  │   ├── api.ts (fetch wrapper)
  │   └── auth.ts (session helpers)
  └── hooks/
      └── use-trips.ts
  ```

### 6.2 Dashboard Layout
- [ ] Create 2-column responsive layout:
  - Left: Trip table (primary)
  - Right: Reserved for chat (Phase 2)
- [ ] Implement trip table with columns:
  - Trip Name
  - Route (SFO → MCO)
  - Dates
  - Flight Price
  - Hotel Price
  - Total
  - Status
  - Last Updated
- [ ] Add row click to open detail modal
- [ ] Implement "Refresh All" button with loading state

### 6.3 Trip Detail Modal/Page
- [ ] Display trip configuration details
- [ ] Show price history chart (line chart with date on X, price on Y)
- [ ] Display current best offers (flight and hotel)
- [ ] Add Pause/Resume toggle
- [ ] Add Delete button with confirmation dialog

### 6.4 Error Handling
- [ ] Create error boundary components
- [ ] Show toast notifications for transient errors (refresh failed)
- [ ] Show empty states for:
  - No trips yet
  - Failed to load trips
  - No price data available
- [ ] Handle 401 errors with redirect to login

### 6.5 Real-time Updates (SSE)
- [ ] Create SSE endpoint in FastAPI for price updates
- [ ] Connect to SSE stream on dashboard mount
- [ ] Update trip table when new snapshots arrive
- [ ] Show "refreshing" indicator during workflow execution

---

## 7. Security Checklist (Phase 1)

### Authentication & Authorization
- [ ] JWT tokens in HTTP-only cookies (not localStorage)
- [ ] CSRF token validation on all POST/PUT/PATCH/DELETE
- [ ] Row-level security: all queries filter by `user_id`
- [ ] Token expiration: access (15min), refresh (7 days)

### Input Validation
- [ ] Pydantic validation on all request bodies
- [ ] IATA code format validation (3 uppercase letters)
- [ ] Date range validation (return > depart, max 359 days out)
- [ ] Trip name length limits (1-100 chars)

### API Security
- [ ] CORS configured for Vercel frontend domain only
- [ ] Rate limiting: 100 requests/minute per user
- [ ] Request size limits (1MB max body)

---

## 8. Testing Checklist (Phase 1)

### Unit Tests
- [ ] Pydantic schema validation (valid/invalid inputs)
- [ ] Post-fetch filtering logic (airlines, room types, views)
- [ ] Date validation helpers
- [ ] JWT token generation/validation

### Integration Tests
- [ ] OAuth callback flow (mocked Google responses)
- [ ] Trip CRUD operations with test database
- [ ] Idempotency key deduplication
- [ ] Temporal workflow with mocked activities

### Manual Testing
- [ ] End-to-end OAuth login flow
- [ ] Create trip, verify in database
- [ ] Manual refresh, verify snapshot created
- [ ] Delete trip, verify cascade delete

---

## 9. Definition of Done

Phase 1 is complete when:
- [ ] User can sign in with Google OAuth
- [ ] User can create a trip with flight and hotel preferences
- [ ] User can view all their trips in a dashboard table
- [ ] User can manually trigger a price refresh
- [ ] Price snapshots are stored with raw API data
- [ ] User can view price history for a trip
- [ ] User can pause/resume trip tracking
- [ ] User can delete a trip
- [ ] All endpoints return envelope-wrapped responses
- [ ] Error responses follow RFC 7807 format
- [ ] Unit tests pass with >80% coverage on business logic
- [ ] Docker Compose brings up entire stack with one command
