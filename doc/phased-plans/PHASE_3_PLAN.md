# Phase 3: Reliability & Hosting

**Goal:** Stable daily price tracking on a home server with email notifications.

**Prerequisites:** Phase 1 and 2 complete (Dashboard, Workflows, Chat)

---

## 1. Hosting Infrastructure

### 1.1 Home Server Setup
- [ ] Document minimum hardware requirements:
  - 4GB RAM minimum (8GB recommended)
  - 20GB disk space
  - Stable internet connection
- [ ] Install Docker and Docker Compose on host
- [ ] Configure Docker daemon for production:
  ```json
  {
    "log-driver": "json-file",
    "log-opts": {
      "max-size": "10m",
      "max-file": "3"
    }
  }
  ```
- [ ] Set up automatic container restart on system boot
- [ ] Configure resource limits in docker-compose.yml:
  ```yaml
  services:
    api:
      deploy:
        resources:
          limits:
            memory: 512M
          reservations:
            memory: 256M
    worker:
      deploy:
        resources:
          limits:
            memory: 1G
  ```

### 1.2 Cloudflare Tunnel Configuration
- [ ] Install `cloudflared` on host machine
- [ ] Create Cloudflare Tunnel:
  ```bash
  cloudflared tunnel create vacation-price-tracker
  ```
- [ ] Configure tunnel routing in `config.yml`:
  ```yaml
  tunnel: <TUNNEL_ID>
  credentials-file: /root/.cloudflared/<TUNNEL_ID>.json

  ingress:
    - hostname: app.yourdomain.com
      service: http://localhost:3000
    - hostname: api.yourdomain.com
      service: http://localhost:8000
    - service: http_status:404
  ```
- [ ] Set up cloudflared as systemd service:
  ```bash
  cloudflared service install
  systemctl enable cloudflared
  systemctl start cloudflared
  ```
- [ ] Configure DNS records in Cloudflare dashboard
- [ ] Enable Cloudflare SSL/TLS (Full Strict mode)

### 1.3 Google OAuth Configuration
- [ ] Add Cloudflare domain to Google Cloud Console authorized origins
- [ ] Update callback URL: `https://api.yourdomain.com/v1/auth/google/callback`
- [ ] Update frontend environment: `NEXT_PUBLIC_API_URL=https://api.yourdomain.com`
- [ ] Test OAuth flow through tunnel

---

## 2. Scheduled Price Tracking

### 2.1 Temporal Schedules
- [ ] Create scheduled workflow for daily price checks:
  ```python
  # Schedule configuration
  schedule = Schedule(
      action=ScheduleActionStartWorkflow(
          RefreshAllTripsWorkflow.run,
          args=[],  # All users
          id="daily-refresh",
          task_queue="main-queue"
      ),
      spec=ScheduleSpec(
          cron_expressions=["0 6 * * *"]  # 6 AM daily
      ),
      policy=SchedulePolicy(
          overlap=ScheduleOverlapPolicy.SKIP  # Skip if previous still running
      )
  )

  await client.create_schedule(
      "daily-price-refresh",
      schedule
  )
  ```

### 2.2 User-Level Scheduling
- [ ] Add `refresh_frequency` column to User model:
  ```python
  class User(SQLModel, table=True):
      # ... existing fields
      refresh_frequency: str = "daily"  # daily, every_3_days, weekly
      refresh_hour_utc: int = 6  # Hour to run refresh (0-23)
  ```
- [ ] Create schedule management endpoints:
  - `GET /v1/users/me/schedule` - Get current schedule
  - `PATCH /v1/users/me/schedule` - Update schedule preferences
- [ ] Modify `RefreshAllTripsWorkflow` to filter by user schedule:
  ```python
  @workflow.defn
  class ScheduledRefreshWorkflow:
      @workflow.run
      async def run(self) -> None:
          # Get users due for refresh
          users = await workflow.execute_activity(
              get_users_due_for_refresh,
              start_to_close_timeout=timedelta(seconds=30)
          )

          # Refresh each user's trips
          for user in users:
              await workflow.execute_child_workflow(
                  RefreshAllTripsWorkflow.run,
                  user.id
              )
  ```

### 2.3 Smart Refresh Scheduling
Implement tiered refresh frequency based on trip proximity:
- [ ] Add logic to `get_active_trips` activity:
  ```python
  def get_refresh_priority(trip: Trip) -> str:
      days_until_departure = (trip.depart_date - date.today()).days

      if days_until_departure <= 30:
          return "daily"  # Active trips: daily
      elif days_until_departure <= 90:
          return "every_3_days"  # Near-term: every 3 days
      else:
          return "weekly"  # Far future: weekly
  ```
- [ ] Filter trips by refresh priority in scheduled workflow
- [ ] Track `last_refreshed_at` on Trip model

---

## 3. Pause/Unpause Functionality

### 3.1 Database Changes
- [ ] Ensure `Trip.status` enum includes: `ACTIVE`, `PAUSED`, `ERROR`
- [ ] Add `paused_at` timestamp for tracking:
  ```python
  class Trip(SQLModel, table=True):
      # ... existing fields
      paused_at: Optional[datetime] = None
  ```

### 3.2 API Endpoints
Already implemented in Phase 1:
- [ ] Verify `PATCH /v1/trips/{id}/status` works correctly
- [ ] Add to chat tools (Phase 2)

### 3.3 Workflow Integration
- [ ] Update `get_active_trips` activity to filter paused trips:
  ```python
  async def get_active_trips(user_id: str) -> List[Trip]:
      return await db.query(Trip).where(
          Trip.user_id == user_id,
          Trip.status == TrackingStatus.ACTIVE
      ).all()
  ```
- [ ] On resume, trigger immediate price check:
  ```python
  async def resume_trip(trip_id: str, user_id: str) -> Trip:
      trip = await db.update_trip(
          trip_id,
          user_id,
          status=TrackingStatus.ACTIVE,
          paused_at=None
      )

      # Trigger immediate refresh
      await temporal_client.start_workflow(
          PriceCheckWorkflow.run,
          trip.id
      )

      return trip
  ```

### 3.4 UI Components
- [ ] Add pause/resume toggle in trip table row actions
- [ ] Add pause/resume button in trip detail modal
- [ ] Show "Paused" badge on paused trips
- [ ] Dim paused trip rows in table

---

## 4. Email Notifications

### 4.1 SMTP Configuration
- [ ] Configure SMTP2GO (free tier: 1,000 emails/month):
  ```python
  # settings.py
  class Settings(BaseSettings):
      SMTP_HOST: str = "smtp.smtp2go.com"
      SMTP_PORT: int = 587
      SMTP_USER: str
      SMTP_PASS: str
      EMAIL_FROM: str = "notifications@yourdomain.com"
  ```
- [ ] Create email client wrapper:
  ```python
  class EmailClient:
      def __init__(self):
          self.smtp = aiosmtplib.SMTP(
              hostname=settings.SMTP_HOST,
              port=settings.SMTP_PORT,
              use_tls=True
          )

      async def send(
          self,
          to: str,
          subject: str,
          html_body: str
      ) -> bool:
          message = MIMEMultipart("alternative")
          message["From"] = settings.EMAIL_FROM
          message["To"] = to
          message["Subject"] = subject
          message.attach(MIMEText(html_body, "html"))

          await self.smtp.connect()
          await self.smtp.login(settings.SMTP_USER, settings.SMTP_PASS)
          await self.smtp.send_message(message)
          await self.smtp.quit()
          return True
  ```

### 4.2 Notification Threshold Logic
- [ ] Implement threshold comparison in `check_notifications_activity`:
  ```python
  @activity.defn
  async def check_notifications_activity(
      trip_id: str,
      snapshot: PriceSnapshot
  ) -> Optional[NotificationEvent]:
      trip = await db.get_trip_with_notification(trip_id)

      if not trip.notification_rule:
          return None

      rule = trip.notification_rule
      current_value = get_threshold_value(snapshot, rule.threshold_type)

      if current_value is None:
          return None

      if current_value <= rule.threshold_value:
          return NotificationEvent(
              trip_id=trip.id,
              user_id=trip.user_id,
              threshold_type=rule.threshold_type,
              threshold_value=rule.threshold_value,
              current_value=current_value,
              trip_name=trip.name
          )

      return None

  def get_threshold_value(
      snapshot: PriceSnapshot,
      threshold_type: ThresholdType
  ) -> Optional[float]:
      if threshold_type == ThresholdType.TRIP_TOTAL:
          return snapshot.total_price
      elif threshold_type == ThresholdType.FLIGHT_TOTAL:
          return snapshot.flight_price
      elif threshold_type == ThresholdType.HOTEL_TOTAL:
          return snapshot.hotel_price
      return None
  ```

### 4.3 Outbox Pattern Implementation
- [ ] Create `NotificationOutbox` table:
  ```python
  class NotificationOutbox(SQLModel, table=True):
      id: uuid.UUID (PK)
      user_id: uuid.UUID (FK -> User)
      trip_id: uuid.UUID (FK -> Trip)
      event_type: str  # "price_alert"
      payload: dict (JSONB)
      status: str  # "pending", "sent", "failed"
      attempts: int = 0
      created_at: datetime
      processed_at: Optional[datetime]
  ```
- [ ] Queue notification in `save_snapshot_activity`:
  ```python
  @activity.defn
  async def save_snapshot_activity(input: SaveSnapshotInput) -> PriceSnapshot:
      # Save snapshot
      snapshot = await db.create_snapshot(input)

      # Check notification threshold
      event = await check_notification_threshold(input.trip_id, snapshot)

      if event:
          # Queue in outbox (transactional with snapshot save)
          await db.create_outbox_entry(event)

      return snapshot
  ```
- [ ] Create `ProcessNotificationsWorkflow`:
  ```python
  @workflow.defn
  class ProcessNotificationsWorkflow:
      @workflow.run
      async def run(self) -> int:
          # Get pending notifications
          pending = await workflow.execute_activity(
              get_pending_notifications,
              start_to_close_timeout=timedelta(seconds=30)
          )

          sent_count = 0
          for notification in pending:
              result = await workflow.execute_activity(
                  send_notification_activity,
                  notification,
                  start_to_close_timeout=timedelta(seconds=60),
                  retry_policy=RetryPolicy(max_attempts=3)
              )
              if result.success:
                  sent_count += 1

          return sent_count
  ```

### 4.4 Email Templates
- [ ] Create HTML email templates:
  - Price alert triggered
  - Weekly price summary (optional)
  - Trip reminder (X days until departure)
- [ ] Example price alert template:
  ```html
  <!DOCTYPE html>
  <html>
  <body style="font-family: Arial, sans-serif;">
    <h2>Price Alert: {{trip_name}}</h2>
    <p>Great news! The price for your trip has dropped below your threshold.</p>

    <table style="border-collapse: collapse; margin: 20px 0;">
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">Your Threshold</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${{threshold_value}}</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">Current Price</td>
        <td style="padding: 8px; border: 1px solid #ddd; color: green;">
          <strong>${{current_value}}</strong>
        </td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">You Save</td>
        <td style="padding: 8px; border: 1px solid #ddd;">
          ${{savings}}
        </td>
      </tr>
    </table>

    <p>
      <a href="{{dashboard_url}}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
        View Trip Details
      </a>
    </p>

    <hr style="margin: 20px 0;">
    <p style="color: #666; font-size: 12px;">
      You're receiving this because you set a price alert for "{{trip_name}}".
      <a href="{{unsubscribe_url}}">Unsubscribe</a>
    </p>
  </body>
  </html>
  ```

### 4.5 Notification History
- [ ] Track sent notifications:
  ```python
  class NotificationHistory(SQLModel, table=True):
      id: uuid.UUID (PK)
      user_id: uuid.UUID (FK -> User)
      trip_id: uuid.UUID (FK -> Trip)
      notification_type: str
      sent_at: datetime
      email_address: str
  ```
- [ ] Add endpoint to view notification history:
  - `GET /v1/notifications` - List user's notification history

### 4.6 Unsubscribe Handling
- [ ] Add `email_notifications_enabled` to User model
- [ ] Create unsubscribe endpoint:
  - `POST /v1/notifications/unsubscribe?token={token}`
- [ ] Generate signed unsubscribe tokens (JWT with user_id)
- [ ] Include unsubscribe link in all emails

---

## 5. Rate Limit Management

### 5.1 API Call Tracking
- [ ] Create Redis-based rate limiter:
  ```python
  class RateLimiter:
      def __init__(self, redis: Redis):
          self.redis = redis

      async def check_limit(
          self,
          key: str,
          max_requests: int,
          window_seconds: int
      ) -> bool:
          current = await self.redis.incr(key)
          if current == 1:
              await self.redis.expire(key, window_seconds)
          return current <= max_requests

      async def get_remaining(self, key: str, max_requests: int) -> int:
          current = await self.redis.get(key) or 0
          return max(0, max_requests - int(current))
  ```

### 5.2 Amadeus Rate Limiting
- [ ] Track monthly Amadeus API usage:
  ```python
  AMADEUS_MONTHLY_LIMIT = 2000

  async def can_call_amadeus() -> bool:
      key = f"amadeus:calls:{datetime.now().strftime('%Y-%m')}"
      current = await redis.get(key) or 0
      return int(current) < AMADEUS_MONTHLY_LIMIT

  async def record_amadeus_call():
      key = f"amadeus:calls:{datetime.now().strftime('%Y-%m')}"
      await redis.incr(key)
      await redis.expireat(key, get_end_of_month())
  ```
- [ ] Add rate limit check to `fetch_hotels_activity`
- [ ] Log warning when approaching 80% of limit
- [ ] Return cached result if limit exceeded

### 5.3 Response Caching
- [ ] Implement 24-hour cache for identical queries:
  ```python
  def get_cache_key(
      provider: str,
      origin: str,
      destination: str,
      depart_date: date,
      return_date: date,
      adults: int
  ) -> str:
      return f"{provider}:{origin}:{destination}:{depart_date}:{return_date}:{adults}"

  async def get_cached_result(key: str) -> Optional[dict]:
      data = await redis.get(f"cache:{key}")
      return json.loads(data) if data else None

  async def cache_result(key: str, data: dict):
      await redis.setex(
          f"cache:{key}",
          timedelta(hours=24),
          json.dumps(data)
      )
  ```
- [ ] Check cache before API call in activities
- [ ] Store raw API response with timestamp

### 5.4 Per-User Rate Limiting
- [ ] Limit refresh requests per user:
  - Manual refresh: 10 per hour
  - Chat messages: 100 per hour
- [ ] Return 429 Too Many Requests with `Retry-After` header
- [ ] Show rate limit status in UI

---

## 6. Observability

### 6.1 Structured Logging
- [ ] Configure structlog for JSON output:
  ```python
  import structlog

  structlog.configure(
      processors=[
          structlog.contextvars.merge_contextvars,
          structlog.processors.add_log_level,
          structlog.processors.TimeStamper(fmt="iso"),
          structlog.processors.JSONRenderer()
      ],
      logger_factory=structlog.PrintLoggerFactory(),
  )

  logger = structlog.get_logger()
  ```
- [ ] Add request context middleware:
  ```python
  @app.middleware("http")
  async def add_request_context(request: Request, call_next):
      request_id = str(uuid.uuid4())
      structlog.contextvars.bind_contextvars(
          request_id=request_id,
          path=request.url.path,
          method=request.method
      )
      response = await call_next(request)
      response.headers["X-Request-ID"] = request_id
      return response
  ```
- [ ] Log key events:
  - Request start/end with duration
  - Authentication success/failure
  - Trip CRUD operations
  - Workflow start/complete
  - External API calls with latency
  - Notification sent/failed

### 6.2 Metrics Collection
- [ ] Install Prometheus client:
  ```python
  from prometheus_client import Counter, Histogram, generate_latest

  REQUEST_COUNT = Counter(
      "http_requests_total",
      "Total HTTP requests",
      ["method", "endpoint", "status"]
  )

  REQUEST_LATENCY = Histogram(
      "http_request_duration_seconds",
      "HTTP request latency",
      ["method", "endpoint"]
  )

  EXTERNAL_API_CALLS = Counter(
      "external_api_calls_total",
      "External API calls",
      ["provider", "endpoint", "status"]
  )

  TRIPS_CREATED = Counter("trips_created_total", "Total trips created")
  NOTIFICATIONS_SENT = Counter("notifications_sent_total", "Notifications sent")
  ```
- [ ] Create `/metrics` endpoint for Prometheus scraping
- [ ] Track business metrics:
  - Active users
  - Active trips
  - Price checks per day
  - API call counts per provider
  - Notification delivery rate

### 6.3 Health Checks
- [ ] Create `/health` endpoint (liveness):
  ```python
  @app.get("/health")
  async def health():
      return {"status": "ok"}
  ```
- [ ] Create `/ready` endpoint (readiness):
  ```python
  @app.get("/ready")
  async def ready():
      checks = {
          "database": await check_database(),
          "redis": await check_redis(),
          "temporal": await check_temporal()
      }
      all_healthy = all(checks.values())
      return JSONResponse(
          {"status": "ready" if all_healthy else "not_ready", "checks": checks},
          status_code=200 if all_healthy else 503
      )
  ```
- [ ] Configure Docker health checks in compose file

### 6.4 Error Tracking
- [ ] Set up error aggregation (Sentry optional):
  ```python
  # If using Sentry
  import sentry_sdk
  sentry_sdk.init(dsn=settings.SENTRY_DSN)
  ```
- [ ] Create error notification for critical failures:
  - Database connection lost
  - Temporal worker disconnected
  - External API consistently failing

---

## 7. Backup & Recovery

### 7.1 Database Backups
- [ ] Create backup script:
  ```bash
  #!/bin/bash
  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  BACKUP_FILE="/backups/vacation_tracker_${TIMESTAMP}.sql.gz"

  pg_dump -h db -U postgres vacation_tracker | gzip > $BACKUP_FILE

  # Keep only last 7 days
  find /backups -name "*.sql.gz" -mtime +7 -delete
  ```
- [ ] Schedule daily backups via cron
- [ ] Document restore procedure:
  ```bash
  gunzip -c backup.sql.gz | psql -h db -U postgres vacation_tracker
  ```

### 7.2 Volume Persistence
- [ ] Configure named volumes in docker-compose:
  ```yaml
  volumes:
    postgres_data:
    redis_data:
    temporal_data:
  ```
- [ ] Document volume backup procedure
- [ ] Test recovery from backup

---

## 8. Security Hardening

### 8.1 Production Configuration
- [ ] Disable debug mode in production
- [ ] Set secure cookie attributes:
  ```python
  response.set_cookie(
      "access_token",
      token,
      httponly=True,
      secure=True,  # HTTPS only
      samesite="lax",
      max_age=900  # 15 minutes
  )
  ```
- [ ] Configure CORS for production domain only
- [ ] Enable request size limits

### 8.2 Secret Rotation
- [ ] Document secret rotation procedure:
  1. Generate new secret
  2. Add to environment (both old and new accepted)
  3. Deploy
  4. Remove old secret
- [ ] Create reminder for quarterly key rotation

### 8.3 Dependency Scanning
- [ ] Add Dependabot or Renovate for dependency updates
- [ ] Run `pip-audit` in CI pipeline
- [ ] Run `pnpm audit` for frontend dependencies in CI pipeline
- [ ] Document process for security patches

---

## 9. Testing Checklist (Phase 3)

### Unit Tests
- [ ] Notification threshold comparison logic
- [ ] Rate limiter behavior
- [ ] Cache key generation
- [ ] Email template rendering

### Integration Tests
- [ ] Scheduled workflow execution
- [ ] Notification outbox processing
- [ ] Email sending (mock SMTP)
- [ ] Rate limit enforcement

### End-to-End Tests
- [ ] Complete daily refresh cycle
- [ ] Notification triggered and email sent
- [ ] Pause/resume with schedule interaction
- [ ] Rate limit error handling in UI

### Manual Testing
- [ ] OAuth through Cloudflare Tunnel
- [ ] Email delivery to real inbox
- [ ] 24-hour operation without restart
- [ ] Recovery from container restart

---

## 10. Definition of Done

Phase 3 is complete when:
- [ ] Application runs on home server with Cloudflare Tunnel
- [ ] OAuth works through public URL
- [ ] Daily scheduled refresh runs automatically at configured time
- [ ] Paused trips are skipped in scheduled refresh
- [ ] Email notifications send when price drops below threshold
- [ ] Notification history is viewable
- [ ] Users can unsubscribe from emails
- [ ] API rate limits are enforced and tracked
- [ ] Response caching reduces API calls by >30%
- [ ] Structured logs output JSON
- [ ] Health check endpoints respond correctly
- [ ] Database backups run daily
- [ ] System recovers gracefully from container restart
