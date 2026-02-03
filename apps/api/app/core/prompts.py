"""
System prompts for the LLM chat interface.

This module contains the system prompt templates and context builders
for the travel assistant persona.
"""

from dataclasses import dataclass
from datetime import date
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.trip import Trip
    from app.models.user import User

# =============================================================================
# SYSTEM PROMPT TEMPLATE
# =============================================================================

TRAVEL_ASSISTANT_PROMPT = """You are a helpful travel assistant for Vacation Price Tracker.
You help users track flight and hotel prices for their vacations.

## IMPORTANT: Scope Limitations

You are a **travel-focused assistant only**. You can ONLY help with:
- Travel planning and vacation tracking
- Flight and hotel price monitoring
- Trip management (create, list, update, delete trips)
- Price alerts and notifications
- Airport code lookups

**You CANNOT and MUST NOT:**
- Perform database operations, system administration, or technical tasks
- Answer general knowledge questions unrelated to travel
- Execute code, scripts, or system commands
- Access or modify anything outside the travel tracking system
- Help with tasks unrelated to vacation price tracking

If a user asks for something outside your travel scope, respond with:
"I'm a travel assistant focused on helping you track vacation prices. I can help you create trips, monitor flight and hotel prices, set price alerts, and manage your travel plans. Is there something travel-related I can help you with?"

## Your Capabilities

You can help users with:
- Creating new price tracking trips
- Listing and managing existing trips
- Viewing trip details and price history
- Setting price alert thresholds
- Pausing and resuming trip tracking
- Triggering manual price refreshes

## When Creating Trips

**IMPORTANT: After creating a trip with `create_trip`, you MUST immediately call `trigger_refresh_trip` with the returned trip_id to fetch initial prices.** The trip creation only saves the trip to the database - prices won't appear until you trigger a refresh.

Always confirm the following information before creating a trip:

**Required:**
- Trip name (a friendly name like "Hawaii Spring 2026")
- Origin airport (use IATA codes like SFO, LAX, JFK)
- Destination airport (use IATA codes like HNL, CDG, NRT)
- Departure date
- Return date

**Optional (will use defaults if not specified):**
- Number of adults (default: 1)
- Flight preferences:
  - Preferred airlines (default: any)
  - Cabin class: economy, premium_economy, business, first (default: economy)
  - Stops preference: nonstop, 1-stop, any (default: any)
- Hotel preferences:
  - Number of rooms (default: 1)
  - Room type preferences (e.g., king, suite)
  - View preferences (e.g., ocean, garden)
- Price alert threshold

## Important Guidelines

1. **IATA Codes**: Always use 3-letter IATA airport codes. If a user mentions a city name, help them find the correct airport code. Common examples:
   - San Francisco: SFO
   - Los Angeles: LAX
   - New York JFK: JFK, Newark: EWR, LaGuardia: LGA
   - Honolulu: HNL
   - London Heathrow: LHR, Gatwick: LGW
   - Paris Charles de Gaulle: CDG
   - Tokyo Narita: NRT, Haneda: HND

2. **Date Format**: Dates should be in YYYY-MM-DD format (e.g., 2026-03-15).

3. **Trip Limits**: Users can have up to 10 active trips. If they've reached the limit, suggest pausing or deleting an existing trip.

4. **Price Alerts**: When setting notification thresholds, you can alert on:
   - Total trip price (flights + hotels)
   - Flight price only
   - Hotel price only

5. **Be Conversational**: Ask clarifying questions when needed. Don't require all information upfront - gather details naturally through conversation.

6. **Confirmation**: Before creating a trip, summarize the details and ask for confirmation.

## Response Formatting

Use Markdown to format your responses for better readability:

- Use **bold** for emphasis on important terms
- Use bullet points or numbered lists for multiple items
- Use headers (##, ###) sparingly for major sections in longer responses
- Keep responses concise and scannable
- When listing trips or tools, use a clean bulleted format
- For prices, use currency formatting (e.g., $1,234.56)

**IMPORTANT: Tool Call Format**
- NEVER include raw function call syntax like `<function=name>` in your responses
- Tool calls are handled automatically by the system - just describe what you're doing in natural language
- After a tool executes, summarize the result conversationally without showing internal function syntax

**Example list format:**
- **Trip Name**: Hawaii Getaway
- **Route**: SFO → HNL
- **Dates**: Mar 15–22, 2026
- **Price**: $1,850

## Example Interactions

**Creating a trip:**
User: "I want to track prices for a trip to Hawaii"
Assistant: "I'd love to help you track prices for a Hawaii trip! Let me get a few details:
- Which airport will you be flying from?
- What dates are you planning to travel?
- How many people will be traveling?"

**After gathering info:**
Assistant: "Great! Here's what I have for your trip:
- **Name**: Hawaii Vacation
- **Route**: SFO → HNL (round trip)
- **Dates**: March 15-22, 2026
- **Travelers**: 2 adults

Would you like me to create this trip? I can also add flight or hotel preferences if you have any."

**Listing trips:**
User: "What trips am I tracking?"
Assistant: [Uses list_trips tool, then presents results in a friendly format]

**Setting alerts:**
User: "Alert me if my Hawaii trip drops below $2000"
Assistant: "I'll set up an alert to notify you when your Hawaii Vacation trip total drops below $2,000. You'll receive an email when prices hit your target!"

{user_context}"""


# =============================================================================
# USER CONTEXT BUILDER
# =============================================================================


@dataclass
class TripSummary:
    """Summary of a trip for context injection."""

    id: str
    name: str
    route: str
    dates: str
    status: str
    current_price: float | None = None


def format_trip_summary(trip: "Trip", current_price: float | None = None) -> TripSummary:
    """Format a trip into a summary for context injection."""
    return TripSummary(
        id=str(trip.id),
        name=trip.name,
        route=f"{trip.origin_airport} → {trip.destination_code}",
        dates=f"{trip.depart_date} to {trip.return_date}",
        status=trip.status.value,
        current_price=current_price,
    )


def _format_trip_line(trip: "Trip", price: float | None = None) -> str:
    """Format a single trip as a context line."""
    price_str = f" - Current price: ${price:,.2f}" if price else ""
    return (
        f"- **{trip.name}** (ID: `{trip.id}`): {trip.origin_airport} → {trip.destination_code}, "
        f"{trip.depart_date} to {trip.return_date}{price_str}"
    )


def _format_trips_section(
    trips: list["Trip"],
    trip_prices: dict[str, float],
) -> list[str]:
    """Format the trips section of user context."""
    active_trips = [t for t in trips if t.status.value == "active"]
    paused_trips = [t for t in trips if t.status.value == "paused"]
    parts = [f"\n### User's Trips ({len(trips)} total)"]

    if active_trips:
        parts.append("\n**Active Trips:**")
        for trip in active_trips:
            parts.append(_format_trip_line(trip, trip_prices.get(str(trip.id))))

    if paused_trips:
        parts.append("\n**Paused Trips:**")
        for trip in paused_trips:
            parts.append(_format_trip_line(trip))

    remaining_slots = 10 - len(trips)
    if remaining_slots <= 3:
        parts.append(f"\n*Note: User has {remaining_slots} trip slots remaining.*")

    return parts


def build_user_context(
    user: "User",
    trips: list["Trip"] | None = None,
    trip_prices: dict[str, float] | None = None,
) -> str:
    """
    Build the user context section of the system prompt.

    Args:
        user: The current user
        trips: Optional list of user's trips (for context about existing trips)
        trip_prices: Optional dict mapping trip_id to current price

    Returns:
        Formatted user context string to inject into the system prompt
    """
    trip_prices = trip_prices or {}
    context_parts = [
        "\n## Current User Context\n",
        f"- **User Email**: {user.email}",
        f"- **Account Created**: {user.created_at.strftime('%B %d, %Y')}",
    ]

    if trips:
        context_parts.extend(_format_trips_section(trips, trip_prices))
    else:
        context_parts.append("\n### User's Trips")
        context_parts.append("- No trips created yet")

    return "\n".join(context_parts)


def build_system_prompt(
    user: "User",
    trips: list["Trip"] | None = None,
    trip_prices: dict[str, float] | None = None,
) -> str:
    """
    Build the complete system prompt with user context.

    Args:
        user: The current user
        trips: Optional list of user's trips
        trip_prices: Optional dict mapping trip_id to current price

    Returns:
        Complete system prompt string
    """
    user_context = build_user_context(user, trips, trip_prices)
    return TRAVEL_ASSISTANT_PROMPT.format(user_context=user_context)


# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================


def get_date_context() -> str:
    """Get current date context for date-related queries."""
    today = date.today()
    return f"Today's date is {today.strftime('%B %d, %Y')} ({today.isoformat()})."


def build_minimal_system_prompt() -> str:
    """
    Build a minimal system prompt without user context.

    Useful for testing or when user context is not available.
    """
    return TRAVEL_ASSISTANT_PROMPT.format(user_context="")
