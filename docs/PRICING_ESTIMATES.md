# Pricing & Usage Estimates

This document provides a cost analysis for running the Vacation Price Tracker for a small group of users (5–10) using the proposed architecture.

## 1. Tool-by-Tool Cost Breakdown

| Tool / API | Provider | Tier | Monthly Cost |
|:-----------|:---------|:-----|:-------------|
| **LLM (Chat)** | Groq | Free Tier | **$0.00** |
| **Flight Search** | Kiwi MCP | Free | **$0.00** |
| **Hotel Search (MVP)** | Amadeus MCP | Free Tier (2K calls) | **$0.00** |
| **Hotel Search (Optimizer)** | SearchAPI | Developer ($40/10K) | **$40.00** |
| **Workflows** | Temporal | Self-Hosted | **$0.00** |
| **Database** | PostgreSQL | Self-Hosted | **$0.00** |
| **Email** | SMTP2GO | Free Tier (1K/mo) | **$0.00** |
| **Hosting** | Home Server | Private | **$0.00** |
| **Public URL** | Cloudflare Tunnel | Free | **$0.00** |

### Phase-by-Phase Costs

| Phase | Features | Monthly Cost |
|:------|:---------|:-------------|
| **MVP (Phase 1-3)** | Manual refresh, chat, notifications | **$0.00** |
| **With Optimizer (Phase 4)** | + Flexible date optimization | **$40.00** |

---

## 2. Capacity Estimates (Per User)

Given the limits defined in the Design Spec (10 trips, 3 hotels each):

### Daily Refresh Consumption (1 User)
- **Max Trips:** 10
- **API Calls per Trip:** 1 Kiwi (flights) + 1 Amadeus (hotels) = 2 calls
- **Daily Total:** 20 API calls
- **Monthly Total:** ~600 API calls per user

### Chat Consumption (1 User)
- **LLM Tokens:** 5–10 queries per day
- **Groq Limit:** Millions of tokens/month (far exceeds needs)

### Optimizer Consumption (1 User per Job)
- **Date Range:** 3 months = ~90 days
- **Combinations:** ~90 departure dates × 1 trip length = 90 queries
- **SearchAPI Calls:** ~90 per optimizer job
- **Typical Usage:** 1-2 optimizer jobs per user per month

---

## 3. Scaling to 10 Users

### MVP (Phases 1-3): No Optimizer

| Metric | 10 Users/Month | Provider Limit | Status |
|:-------|:---------------|:---------------|:-------|
| **Amadeus Hotel Calls** | 6,000 | 2,000 (Free) | ⚠️ **Over Limit** |
| **Kiwi Flight Calls** | 6,000 | Unlimited (Free) | ✅ Safe |
| **Emails Sent** | ~300 | 1,000 (Free) | ✅ Safe |
| **Groq LLM Usage** | Negligible | Very High | ✅ Safe |

**Mitigation for Amadeus Overage:**
1. **Reduce refresh frequency:** Every 3 days instead of daily → 2,000 calls/month ✅
2. **Implement caching:** Cache results for 24 hours for same route/date
3. **Pay for overage:** €0.02/call × 4,000 extra = ~€80/month

### With Optimizer (Phase 4)

| Metric | 10 Users/Month | Provider Limit | Status |
|:-------|:---------------|:---------------|:-------|
| **SearchAPI Calls** | ~1,800 (20 jobs × 90) | 10,000 | ✅ Safe |
| **Amadeus Verification** | ~100 (top candidates) | Part of 2K | ✅ Safe |

---

## 4. SearchAPI Pricing Details

SearchAPI is the recommended provider for the Phase 4 Flexible Date Optimizer.

### Plans

| Plan | Monthly Cost | Searches | Cost per 1K |
|:-----|:-------------|:---------|:------------|
| Developer | $40 | 10,000 | $4.00 |
| Production | $100 | 35,000 | $2.86 |
| BigData | $250 | 100,000 | $2.50 |

### Rate Limits
- **Hourly Limit:** 20% of plan credits
- **Developer Plan:** Max 2,000 searches/hour
- **Implication:** An optimizer job (90 queries) can complete in ~3 minutes

### Why SearchAPI over Alternatives?

| Provider | Cost for 10K/mo | Room Data | Notes |
|:---------|:----------------|:----------|:------|
| **SearchAPI** | $40 | Property-level | Best value |
| SerpApi | $75-150 | Property-level | More expensive |
| Amadeus | €100-250 | Room-level | Overkill for surveying |
| Bright Data | $500+ | Full | Enterprise pricing |

---

## 5. Amadeus MCP Server Details

### Free Tier Limits
- **Test Environment:** ~2,000 calls/month across all endpoints
- **Hotel List API:** Part of quota
- **Hotel Search API:** Part of quota
- **Hotel Offer API:** Part of quota

### Production Pricing (If Free Tier Exceeded)
| Endpoint | Cost per Call |
|:---------|:--------------|
| Hotel List | €0.001 |
| Hotel Search | €0.010-0.025 |
| Hotel Booking | €0.025 |

### Cost Example: 10 Users, Daily Refresh
- **Calls:** 10 users × 10 trips × 30 days = 3,000 calls/month
- **Overage:** 3,000 - 2,000 = 1,000 extra calls
- **Cost:** 1,000 × €0.015 = **€15/month**

---

## 6. Cost Optimization Strategies

### Strategy 1: Aggressive Caching
Cache Amadeus responses for 24 hours when:
- Same destination city
- Same check-in/check-out dates
- Same number of guests

**Impact:** Reduces duplicate calls by ~40% for users tracking similar destinations.

### Strategy 2: Smart Refresh Scheduling
Instead of daily refreshes for all trips:
- **Active trips (< 30 days out):** Daily refresh
- **Future trips (30-90 days out):** Every 3 days
- **Far future trips (90+ days out):** Weekly refresh

**Impact:** Reduces API calls by ~60%.

### Strategy 3: Optimizer Batching
When multiple users run optimizer for same destination:
- Queue requests
- Batch identical date/destination combinations
- Share results across users

**Impact:** Reduces SearchAPI calls by ~30% for popular destinations.

---

## 7. Cost Comparison: Self-Hosted vs. Cloud

| Scenario | Monthly Cost |
|:---------|:-------------|
| **Self-Hosted (Home Server)** | $0-40 (electricity + Phase 4) |
| **Cloud VPS (DigitalOcean)** | $20-50 + API costs |
| **Cloud with GPU (for local LLM)** | $100-200 |

**Recommendation:** Start with home server + Cloudflare Tunnel. The only recurring cost is the optional $40/month SearchAPI subscription for the optimizer feature.

---

## 8. Break-Even Analysis

### When to Consider Paid Amadeus Tier

If your user base grows beyond 10 users with daily refresh:

| Users | Daily Calls | Monthly Calls | Free Tier Covers? | Overage Cost |
|:------|:------------|:--------------|:------------------|:-------------|
| 5 | 100 | 3,000 | ❌ | €15/mo |
| 10 | 200 | 6,000 | ❌ | €60/mo |
| 20 | 400 | 12,000 | ❌ | €150/mo |

**Decision Point:** At 20+ users, consider:
1. Moving to every-3-day refresh (stays in free tier)
2. Implementing aggressive caching
3. Accepting €150/month API cost as operational expense
