# Phase 4: Flexible Date Optimizer

**Goal:** "Find me cheaper dates" feature that surveys price ranges using SearchAPI.

**Prerequisites:** Phases 1-3 complete (Dashboard, Chat, Scheduled Refresh, Notifications)

---

## 1. SearchAPI Integration

### 1.1 Why SearchAPI?

| Aspect | Amadeus (Current) | SearchAPI (Optimizer) |
|:-------|:------------------|:----------------------|
| Free Tier | 2,000 calls/month | 100 calls (test only) |
| Paid Tier | €0.01-0.025/call | $40/mo for 10,000 |
| Best For | Individual lookups | Bulk date surveying |
| Date Survey (90 combos) | 4.5 months free tier | ~1% monthly quota |

**Decision:** Use SearchAPI exclusively for the date optimizer feature, keep Amadeus for regular price checks.

### 1.2 SearchAPI Account Setup
- [ ] Sign up at searchapi.io
- [ ] Choose Developer plan ($40/month, 10,000 searches)
- [ ] Generate API key
- [ ] Add to environment:
  ```
  SEARCHAPI_KEY=your_api_key_here
  ```
- [ ] Set feature flag:
  ```
  ENABLE_BETA_OPTIMIZER=true
  ```

### 1.3 SearchAPI Client Implementation
```python
# clients/searchapi.py
from httpx import AsyncClient
from pydantic import BaseModel
from typing import List, Optional

class HotelResult(BaseModel):
    name: str
    price: float
    currency: str
    rating: Optional[float]
    reviews_count: Optional[int]
    amenities: List[str]

class SearchAPIClient:
    BASE_URL = "https://www.searchapi.io/api/v1/search"

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.client = AsyncClient(timeout=30.0)

    async def search_hotels(
        self,
        location: str,
        check_in: str,  # YYYY-MM-DD
        check_out: str,
        adults: int = 2,
        currency: str = "USD"
    ) -> List[HotelResult]:
        params = {
            "engine": "google_hotels",
            "api_key": self.api_key,
            "q": location,
            "check_in_date": check_in,
            "check_out_date": check_out,
            "adults": adults,
            "currency": currency,
            "gl": "us",
            "hl": "en"
        }

        response = await self.client.get(self.BASE_URL, params=params)
        response.raise_for_status()

        data = response.json()
        properties = data.get("properties", [])

        return [
            HotelResult(
                name=p.get("name"),
                price=p.get("rate_per_night", {}).get("lowest"),
                currency=currency,
                rating=p.get("overall_rating"),
                reviews_count=p.get("reviews"),
                amenities=p.get("amenities", [])
            )
            for p in properties
            if p.get("rate_per_night", {}).get("lowest")
        ]
```

### 1.4 Rate Limit Management
- [ ] Implement hourly rate limiter (20% of plan = 2,000/hour):
  ```python
  class SearchAPIRateLimiter:
      HOURLY_LIMIT = 2000  # 20% of 10,000 monthly

      def __init__(self, redis: Redis):
          self.redis = redis

      async def can_make_request(self) -> bool:
          key = f"searchapi:hourly:{datetime.now().strftime('%Y%m%d%H')}"
          current = await self.redis.get(key) or 0
          return int(current) < self.HOURLY_LIMIT

      async def record_request(self):
          key = f"searchapi:hourly:{datetime.now().strftime('%Y%m%d%H')}"
          await self.redis.incr(key)
          await self.redis.expire(key, 3600)  # Expire after 1 hour

      async def get_remaining(self) -> int:
          key = f"searchapi:hourly:{datetime.now().strftime('%Y%m%d%H')}"
          current = await self.redis.get(key) or 0
          return max(0, self.HOURLY_LIMIT - int(current))
  ```
- [ ] Add monthly usage tracking:
  ```python
  MONTHLY_LIMIT = 10000

  async def get_monthly_usage() -> dict:
      key = f"searchapi:monthly:{datetime.now().strftime('%Y%m')}"
      current = await redis.get(key) or 0
      return {
          "used": int(current),
          "limit": MONTHLY_LIMIT,
          "remaining": MONTHLY_LIMIT - int(current),
          "percent_used": (int(current) / MONTHLY_LIMIT) * 100
      }
  ```
- [ ] Alert at 80% monthly usage

---

## 2. Date Combination Generation

### 2.1 Algorithm Design
```python
from datetime import date, timedelta
from typing import List, Tuple
from dataclasses import dataclass

@dataclass
class DateCandidate:
    depart_date: date
    return_date: date
    trip_length: int

def generate_date_combinations(
    range_start: date,
    range_end: date,
    trip_length_days: int,
    flexibility_days: int = 0
) -> List[DateCandidate]:
    """
    Generate all possible date combinations for the optimizer.

    Args:
        range_start: Earliest possible departure date
        range_end: Latest possible departure date
        trip_length_days: Base trip length
        flexibility_days: +/- days flexibility on trip length

    Returns:
        List of DateCandidate objects
    """
    candidates = []
    current = range_start

    while current <= range_end:
        # Generate candidates for each trip length variant
        for length_offset in range(-flexibility_days, flexibility_days + 1):
            trip_length = trip_length_days + length_offset
            if trip_length < 1:
                continue

            return_date = current + timedelta(days=trip_length)

            # Don't exceed practical limits
            if return_date <= range_end + timedelta(days=trip_length_days):
                candidates.append(DateCandidate(
                    depart_date=current,
                    return_date=return_date,
                    trip_length=trip_length
                ))

        current += timedelta(days=1)

    return candidates
```

### 2.2 Combination Limits
- [ ] Maximum date range: 90 days (`OPTIMIZER_MAX_DATE_RANGE_DAYS`)
- [ ] Maximum trip length flexibility: +/- 3 days
- [ ] Maximum candidates per job: 300 (90 days * ~3 length variants)
- [ ] Estimated API calls per job: 90-150 (hotels only, flights from cache)

### 2.3 Optimization Strategies
- [ ] **Skip weekends optionally**: Reduce combinations by 28%
- [ ] **Sample every N days**: For very long ranges, sample every 2-3 days
- [ ] **Prioritize shoulders**: Focus on shoulder season dates first
  ```python
  def prioritize_candidates(candidates: List[DateCandidate]) -> List[DateCandidate]:
      # Sort by likelihood of good prices
      # (mid-week departures, shoulder season, etc.)
      return sorted(candidates, key=lambda c: (
          c.depart_date.weekday() in [1, 2, 3],  # Tue-Thu
          c.depart_date.month in [4, 5, 9, 10],  # Shoulder season
      ), reverse=True)
  ```

---

## 3. Optimizer Workflow

### 3.1 Database Models
```python
class OptimizerJob(SQLModel, table=True):
    id: uuid.UUID (PK)
    trip_id: uuid.UUID (FK -> Trip, indexed)
    user_id: uuid.UUID (FK -> User, indexed)
    status: str  # "pending", "running", "completed", "failed"
    date_range_start: date
    date_range_end: date
    trip_length_days: int
    flexibility_days: int
    total_combinations: int
    processed_combinations: int = 0
    created_at: datetime
    completed_at: Optional[datetime]
    error_message: Optional[str]

class OptimizerCandidate(SQLModel, table=True):
    id: uuid.UUID (PK)
    job_id: uuid.UUID (FK -> OptimizerJob, indexed)
    depart_date: date
    return_date: date
    flight_price: Optional[Decimal]
    hotel_price: Optional[Decimal]
    total_price: Optional[Decimal]
    savings_vs_original: Optional[Decimal]
    rank: Optional[int]
    verified: bool = False
    created_at: datetime
```

### 3.2 RunOptimizerWorkflow
```python
@workflow.defn
class RunOptimizerWorkflow:
    def __init__(self):
        self.progress = 0
        self.total = 0

    @workflow.run
    async def run(self, job_id: str) -> OptimizerResult:
        # 1. Load job details
        job = await workflow.execute_activity(
            load_optimizer_job,
            job_id,
            start_to_close_timeout=timedelta(seconds=30)
        )

        # 2. Generate date combinations
        candidates = await workflow.execute_activity(
            generate_date_combinations_activity,
            GenerateCombinationsInput(
                range_start=job.date_range_start,
                range_end=job.date_range_end,
                trip_length_days=job.trip_length_days,
                flexibility_days=job.flexibility_days
            ),
            start_to_close_timeout=timedelta(seconds=30)
        )

        self.total = len(candidates)

        # 3. Fetch prices in batches with rate limiting
        BATCH_SIZE = 10
        all_results = []

        for i in range(0, len(candidates), BATCH_SIZE):
            batch = candidates[i:i + BATCH_SIZE]

            # Check rate limit before batch
            can_proceed = await workflow.execute_activity(
                check_searchapi_rate_limit,
                len(batch),
                start_to_close_timeout=timedelta(seconds=10)
            )

            if not can_proceed:
                # Wait for rate limit to reset
                await workflow.sleep(timedelta(minutes=5))

            # Fetch batch in parallel
            results = await workflow.execute_activity(
                fetch_prices_batch_activity,
                FetchBatchInput(
                    trip_id=job.trip_id,
                    candidates=batch
                ),
                start_to_close_timeout=timedelta(minutes=5),
                retry_policy=RetryPolicy(max_attempts=3)
            )

            all_results.extend(results)
            self.progress = len(all_results)

            # Update job progress
            await workflow.execute_activity(
                update_job_progress,
                UpdateProgressInput(job_id, self.progress, self.total),
                start_to_close_timeout=timedelta(seconds=10)
            )

        # 4. Rank candidates by total price
        ranked = sorted(all_results, key=lambda r: r.total_price or float('inf'))

        # 5. Verify top 5 with live Amadeus data
        top_candidates = ranked[:5]
        verified = await workflow.execute_activity(
            verify_candidates_activity,
            VerifyCandidatesInput(job.trip_id, top_candidates),
            start_to_close_timeout=timedelta(minutes=2)
        )

        # 6. Save results and complete job
        await workflow.execute_activity(
            save_optimizer_results,
            SaveResultsInput(job_id, verified),
            start_to_close_timeout=timedelta(seconds=30)
        )

        return OptimizerResult(
            job_id=job_id,
            candidates=verified,
            best_savings=verified[0].savings_vs_original if verified else None
        )

    @workflow.query
    def get_progress(self) -> dict:
        return {"progress": self.progress, "total": self.total}
```

### 3.3 Activities Implementation

#### fetch_prices_batch_activity
```python
@activity.defn
async def fetch_prices_batch_activity(
    input: FetchBatchInput
) -> List[CandidateResult]:
    trip = await db.get_trip(input.trip_id)
    results = []

    async with asyncio.TaskGroup() as tg:
        tasks = []
        for candidate in input.candidates:
            task = tg.create_task(
                fetch_candidate_price(trip, candidate)
            )
            tasks.append((candidate, task))

    for candidate, task in tasks:
        try:
            price_data = task.result()
            results.append(CandidateResult(
                depart_date=candidate.depart_date,
                return_date=candidate.return_date,
                flight_price=price_data.flight_price,
                hotel_price=price_data.hotel_price,
                total_price=price_data.total_price
            ))
        except Exception as e:
            # Log error but continue with other candidates
            logger.error("Failed to fetch price", candidate=candidate, error=str(e))

    return results

async def fetch_candidate_price(
    trip: Trip,
    candidate: DateCandidate
) -> PriceData:
    # Fetch flight price (use Kiwi, may be cached)
    flight_price = await fetch_flight_price(
        origin=trip.origin_airport,
        destination=trip.destination_code,
        depart_date=candidate.depart_date,
        return_date=candidate.return_date,
        adults=trip.adults
    )

    # Fetch hotel price (use SearchAPI for bulk queries)
    hotel_price = await fetch_hotel_price_searchapi(
        location=trip.destination_code,
        check_in=candidate.depart_date,
        check_out=candidate.return_date,
        adults=trip.adults
    )

    return PriceData(
        flight_price=flight_price,
        hotel_price=hotel_price,
        total_price=(flight_price or 0) + (hotel_price or 0)
    )
```

#### verify_candidates_activity
```python
@activity.defn
async def verify_candidates_activity(
    input: VerifyCandidatesInput
) -> List[VerifiedCandidate]:
    """
    Verify top candidates with live Amadeus data for accuracy.
    SearchAPI provides estimates; Amadeus provides bookable rates.
    """
    trip = await db.get_trip(input.trip_id)
    original_price = await get_original_trip_price(trip)
    verified = []

    for candidate in input.candidates:
        # Get live Amadeus hotel price
        amadeus_result = await amadeus_client.hotel_search(
            city_code=trip.destination_code,
            check_in=str(candidate.depart_date),
            check_out=str(candidate.return_date),
            adults=trip.adults
        )

        if amadeus_result.offers:
            best_offer = min(amadeus_result.offers, key=lambda o: o.price.total)
            verified_hotel_price = float(best_offer.price.total)
        else:
            verified_hotel_price = candidate.hotel_price  # Fall back to estimate

        # Calculate verified total and savings
        verified_total = (candidate.flight_price or 0) + verified_hotel_price
        savings = original_price - verified_total if original_price else None

        verified.append(VerifiedCandidate(
            depart_date=candidate.depart_date,
            return_date=candidate.return_date,
            flight_price=candidate.flight_price,
            hotel_price=verified_hotel_price,
            total_price=verified_total,
            savings_vs_original=savings,
            verified=True
        ))

    # Re-rank by verified price
    verified.sort(key=lambda c: c.total_price)

    # Assign ranks
    for i, candidate in enumerate(verified):
        candidate.rank = i + 1

    return verified
```

---

## 4. API Endpoints

### 4.1 Optimizer Endpoints
```python
# POST /v1/optimizer/jobs
@router.post("/v1/optimizer/jobs")
async def start_optimizer_job(
    request: OptimizerJobCreate,
    user: User = Depends(get_current_user)
) -> APIResponse[OptimizerJobResponse]:
    # Validate trip ownership
    trip = await db.get_trip(request.trip_id, user.id)
    if not trip:
        raise TripNotFound()

    # Check feature flag
    if not settings.ENABLE_BETA_OPTIMIZER:
        raise FeatureDisabled("Flexible date optimizer is not enabled")

    # Check rate limits
    usage = await get_monthly_usage()
    if usage["percent_used"] > 95:
        raise RateLimitExceeded("Monthly SearchAPI quota nearly exhausted")

    # Create job
    job = await db.create_optimizer_job(
        trip_id=request.trip_id,
        user_id=user.id,
        date_range_start=request.date_range_start,
        date_range_end=request.date_range_end,
        trip_length_days=request.trip_length_days,
        flexibility_days=request.flexibility_days or 0
    )

    # Calculate total combinations
    candidates = generate_date_combinations(
        request.date_range_start,
        request.date_range_end,
        request.trip_length_days,
        request.flexibility_days or 0
    )
    job.total_combinations = len(candidates)
    await db.update_job(job)

    # Start workflow
    await temporal_client.start_workflow(
        RunOptimizerWorkflow.run,
        str(job.id),
        id=f"optimizer-{job.id}"
    )

    return APIResponse(data=OptimizerJobResponse(
        id=str(job.id),
        status="running",
        total_combinations=len(candidates),
        processed_combinations=0
    ))


# GET /v1/optimizer/jobs/{job_id}
@router.get("/v1/optimizer/jobs/{job_id}")
async def get_optimizer_job(
    job_id: str,
    user: User = Depends(get_current_user)
) -> APIResponse[OptimizerJobDetailResponse]:
    job = await db.get_optimizer_job(job_id, user.id)
    if not job:
        raise JobNotFound()

    candidates = await db.get_optimizer_candidates(job_id, limit=10)

    return APIResponse(data=OptimizerJobDetailResponse(
        id=str(job.id),
        trip_id=str(job.trip_id),
        status=job.status,
        date_range_start=str(job.date_range_start),
        date_range_end=str(job.date_range_end),
        trip_length_days=job.trip_length_days,
        total_combinations=job.total_combinations,
        processed_combinations=job.processed_combinations,
        candidates=[
            CandidateResponse(
                depart_date=str(c.depart_date),
                return_date=str(c.return_date),
                flight_price=float(c.flight_price) if c.flight_price else None,
                hotel_price=float(c.hotel_price) if c.hotel_price else None,
                total_price=float(c.total_price) if c.total_price else None,
                savings_vs_original=float(c.savings_vs_original) if c.savings_vs_original else None,
                rank=c.rank,
                verified=c.verified
            )
            for c in candidates
        ],
        created_at=job.created_at.isoformat(),
        completed_at=job.completed_at.isoformat() if job.completed_at else None
    ))


# DELETE /v1/optimizer/jobs/{job_id}
@router.delete("/v1/optimizer/jobs/{job_id}")
async def cancel_optimizer_job(
    job_id: str,
    user: User = Depends(get_current_user)
):
    job = await db.get_optimizer_job(job_id, user.id)
    if not job:
        raise JobNotFound()

    if job.status == "running":
        # Cancel Temporal workflow
        await temporal_client.get_workflow_handle(f"optimizer-{job_id}").cancel()

    await db.update_job_status(job_id, "cancelled")
    return Response(status_code=204)
```

### 4.2 Request/Response Schemas
```python
class OptimizerJobCreate(BaseModel):
    trip_id: str
    date_range_start: date
    date_range_end: date
    trip_length_days: int = Field(ge=1, le=30)
    flexibility_days: int = Field(default=0, ge=0, le=3)

    @validator("date_range_end")
    def validate_range(cls, v, values):
        start = values.get("date_range_start")
        if start and v:
            days = (v - start).days
            if days > 90:
                raise ValueError("Date range cannot exceed 90 days")
            if days < 7:
                raise ValueError("Date range must be at least 7 days")
        return v

class OptimizerJobResponse(BaseModel):
    id: str
    status: str
    total_combinations: int
    processed_combinations: int

class CandidateResponse(BaseModel):
    depart_date: str
    return_date: str
    flight_price: Optional[float]
    hotel_price: Optional[float]
    total_price: Optional[float]
    savings_vs_original: Optional[float]
    rank: Optional[int]
    verified: bool
```

---

## 5. Frontend Implementation

### 5.1 Optimizer UI Components

#### Find Cheaper Dates Button
```tsx
// components/optimizer/find-cheaper-button.tsx
export function FindCheaperDatesButton({ tripId }: { tripId: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setIsOpen(true)}
        disabled={!featureFlags.enableBetaOptimizer}
      >
        <CalendarSearch className="mr-2 h-4 w-4" />
        Find Cheaper Dates
      </Button>

      <OptimizerDialog
        tripId={tripId}
        open={isOpen}
        onOpenChange={setIsOpen}
      />
    </>
  );
}
```

#### Date Range Selector Dialog
```tsx
// components/optimizer/optimizer-dialog.tsx
export function OptimizerDialog({
  tripId,
  open,
  onOpenChange
}: OptimizerDialogProps) {
  const [dateRange, setDateRange] = useState<DateRange>();
  const [tripLength, setTripLength] = useState(7);
  const [flexibility, setFlexibility] = useState(0);
  const { mutate: startJob, isPending } = useStartOptimizerJob();

  const handleSubmit = () => {
    if (!dateRange?.from || !dateRange?.to) return;

    startJob({
      trip_id: tripId,
      date_range_start: format(dateRange.from, "yyyy-MM-dd"),
      date_range_end: format(dateRange.to, "yyyy-MM-dd"),
      trip_length_days: tripLength,
      flexibility_days: flexibility
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Find Cheaper Dates</DialogTitle>
          <DialogDescription>
            Survey prices across a date range to find the best deals.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Date Range (up to 3 months)</Label>
            <DateRangePicker
              value={dateRange}
              onChange={setDateRange}
              maxRange={90}
            />
          </div>

          <div>
            <Label>Trip Length (days)</Label>
            <Slider
              value={[tripLength]}
              onValueChange={([v]) => setTripLength(v)}
              min={1}
              max={21}
              step={1}
            />
            <span className="text-sm text-muted-foreground">
              {tripLength} days
            </span>
          </div>

          <div>
            <Label>Flexibility (+/- days)</Label>
            <Select
              value={String(flexibility)}
              onValueChange={(v) => setFlexibility(Number(v))}
            >
              <SelectItem value="0">Exact length only</SelectItem>
              <SelectItem value="1">+/- 1 day</SelectItem>
              <SelectItem value="2">+/- 2 days</SelectItem>
              <SelectItem value="3">+/- 3 days</SelectItem>
            </Select>
          </div>

          <div className="text-sm text-muted-foreground">
            This will check approximately {calculateCombinations(dateRange, tripLength, flexibility)} date combinations.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !dateRange}>
            {isPending ? "Starting..." : "Start Search"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

#### Progress Indicator
```tsx
// components/optimizer/optimizer-progress.tsx
export function OptimizerProgress({ jobId }: { jobId: string }) {
  const { data: job, isLoading } = useOptimizerJob(jobId, {
    refetchInterval: job?.status === "running" ? 2000 : false
  });

  if (isLoading || !job) return <Skeleton className="h-20" />;

  const progress = (job.processed_combinations / job.total_combinations) * 100;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Searching for better prices...</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} />
          <p className="text-xs text-muted-foreground">
            Checked {job.processed_combinations} of {job.total_combinations} date combinations
          </p>
        </div>

        {job.status === "completed" && (
          <div className="mt-4">
            <Badge variant="success">Complete</Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

#### Results Display
```tsx
// components/optimizer/optimizer-results.tsx
export function OptimizerResults({ jobId }: { jobId: string }) {
  const { data: job } = useOptimizerJob(jobId);

  if (!job || job.status !== "completed") return null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Best Date Options</h3>

      {job.candidates.length === 0 ? (
        <p className="text-muted-foreground">
          No cheaper dates found in this range.
        </p>
      ) : (
        <div className="space-y-2">
          {job.candidates.map((candidate, i) => (
            <Card key={i} className={i === 0 ? "border-green-500" : ""}>
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <p className="font-medium">
                    {format(new Date(candidate.depart_date), "MMM d")} -{" "}
                    {format(new Date(candidate.return_date), "MMM d, yyyy")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {differenceInDays(
                      new Date(candidate.return_date),
                      new Date(candidate.depart_date)
                    )}{" "}
                    nights
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-lg font-bold">
                    ${candidate.total_price?.toFixed(0)}
                  </p>
                  {candidate.savings_vs_original && candidate.savings_vs_original > 0 && (
                    <Badge variant="success">
                      Save ${candidate.savings_vs_original.toFixed(0)}
                    </Badge>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUpdateTripDates(candidate)}
                >
                  Use These Dates
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

### 5.2 Chat Integration
- [ ] Add optimizer tool to MCP:
  ```python
  {
      "name": "find_cheaper_dates",
      "description": "Search for cheaper travel dates across a date range",
      "parameters": {
          "trip_id": {"type": "string"},
          "date_range_start": {"type": "string", "format": "date"},
          "date_range_end": {"type": "string", "format": "date"},
          "flexibility_days": {"type": "integer", "default": 0}
      }
  }
  ```
- [ ] Handle long-running job in chat:
  - Start job, return "Searching..." message
  - Poll for completion
  - Return results when done

### 5.3 Trip Date Update
- [ ] Create endpoint to update trip dates:
  ```python
  @router.patch("/v1/trips/{trip_id}/dates")
  async def update_trip_dates(
      trip_id: str,
      request: UpdateDatesRequest,
      user: User = Depends(get_current_user)
  ):
      trip = await db.update_trip_dates(
          trip_id,
          user.id,
          depart_date=request.depart_date,
          return_date=request.return_date
      )

      # Trigger fresh price check with new dates
      await temporal_client.start_workflow(
          PriceCheckWorkflow.run,
          trip.id
      )

      return APIResponse(data=TripResponse.from_orm(trip))
  ```

---

## 6. Cost Management

### 6.1 Usage Dashboard
- [ ] Create admin endpoint for usage stats:
  ```python
  @router.get("/v1/admin/usage")
  async def get_usage_stats(
      admin: User = Depends(require_admin)
  ):
      return {
          "searchapi": await get_monthly_usage(),
          "amadeus": await get_amadeus_usage(),
          "optimizer_jobs": await get_optimizer_job_stats()
      }
  ```

### 6.2 User Quotas
- [ ] Limit optimizer jobs per user:
  ```python
  MAX_OPTIMIZER_JOBS_PER_MONTH = 5

  async def check_user_optimizer_quota(user_id: str) -> bool:
      count = await db.count_optimizer_jobs_this_month(user_id)
      return count < MAX_OPTIMIZER_JOBS_PER_MONTH
  ```

### 6.3 Cost Alerts
- [ ] Send alert at 80% SearchAPI usage
- [ ] Disable optimizer at 95% usage
- [ ] Weekly usage summary email to admin

---

## 7. Security Checklist (Phase 4)

### API Security
- [ ] Feature flag required (`ENABLE_BETA_OPTIMIZER=true`)
- [ ] Job ownership validation on all endpoints
- [ ] Rate limit optimizer job creation (5/month per user)
- [ ] Validate date range limits (max 90 days)

### Cost Protection
- [ ] Monthly quota enforcement
- [ ] Hourly rate limiting (20% of plan)
- [ ] Job cancellation support
- [ ] Admin override for quota

---

## 8. Testing Checklist (Phase 4)

### Unit Tests
- [ ] Date combination generation (edge cases)
- [ ] Rate limit calculation
- [ ] Candidate ranking algorithm
- [ ] Savings calculation

### Integration Tests
- [ ] SearchAPI client with mocked responses
- [ ] Optimizer workflow with mocked activities
- [ ] Job progress updates
- [ ] Candidate verification flow

### End-to-End Tests
- [ ] Start optimizer job from UI
- [ ] View progress updates
- [ ] Review results
- [ ] Update trip with new dates

### Load Tests
- [ ] Simulate 10 concurrent optimizer jobs
- [ ] Verify rate limiting works correctly
- [ ] Test workflow recovery from failure

---

## 9. Definition of Done

Phase 4 is complete when:
- [ ] SearchAPI client is implemented with rate limiting
- [ ] Date combination generator produces valid candidates
- [ ] RunOptimizerWorkflow executes and returns ranked results
- [ ] Top 5 candidates are verified with live Amadeus data
- [ ] "Find Cheaper Dates" button appears on trip detail
- [ ] Progress indicator shows real-time updates
- [ ] Results display with savings calculations
- [ ] Users can update trip dates from optimizer results
- [ ] Chat supports "find cheaper dates" command
- [ ] Monthly usage stays within SearchAPI quota
- [ ] User quota limits optimizer job frequency
- [ ] Feature can be disabled via feature flag
- [ ] Usage dashboard shows SearchAPI consumption
