# Phase 2: Chat & LLM Integration

**Goal:** Conversational trip management using Groq (Llama 3.3) with MCP tool integration.

**Prerequisites:** Phase 1 complete (OAuth, Trip CRUD, Dashboard, Temporal workflows)

---

## 1. LLM Infrastructure

### 1.1 Groq Client Setup
- [X] Install dependencies: `groq`, `httpx`
- [X] Create Groq client wrapper with configuration:
  ```python
  class GroqClient:
      def __init__(self):
          self.client = Groq(api_key=settings.GROQ_API_KEY)
          self.model = settings.GROQ_MODEL  # llama-3.3-70b-versatile

      async def chat(
          self,
          messages: List[Message],
          tools: List[Tool],
          stream: bool = True
      ) -> AsyncGenerator[ChatChunk, None]:
          ...
  ```
- [X] Implement streaming response handling
- [X] Add retry logic with exponential backoff for rate limits
- [X] Create token counting utility for usage tracking

### 1.2 Conversation Management
- [X] Create `Conversation` model in database:
  ```python
  class Conversation(SQLModel, table=True):
      id: uuid.UUID (PK)
      user_id: uuid.UUID (FK -> User, indexed)
      created_at: datetime
      updated_at: datetime

  class Message(SQLModel, table=True):
      id: uuid.UUID (PK)
      conversation_id: uuid.UUID (FK -> Conversation, indexed)
      role: str  # "user", "assistant", "tool"
      content: str
      tool_calls: Optional[dict] (JSONB)
      tool_call_id: Optional[str]
      created_at: datetime
  ```
- [X] Implement conversation context window management
- [X] Add message persistence for conversation history
- [X] Create conversation pruning for context limits

### 1.3 System Prompt Design
- [X] Create travel assistant persona prompt:
  ```
  You are a helpful travel assistant for Vacation Price Tracker.
  You help users track flight and hotel prices for their vacations.

  Your capabilities:
  - Create new price tracking trips
  - List and manage existing trips
  - Set price alert thresholds
  - Trigger price refreshes
  - Search for airports and destinations

  When creating trips, always confirm:
  - Origin and destination airports (use IATA codes)
  - Travel dates (departure and return)
  - Number of travelers
  - Flight preferences (airlines, cabin, stops)
  - Hotel preferences (room type, view)
  - Notification threshold

  Be conversational and helpful. Ask clarifying questions when needed.
  ```
- [X] Add context about current user's trips
- [X] Include examples of successful tool calls

---

## 2. MCP Tool Architecture

### 2.1 MCP Router Implementation
- [ ] Create unified MCP router in FastAPI:
  ```python
  class MCPRouter:
      def __init__(self):
          self.tools = {
              # External MCP servers
              "search-flight": KiwiMCPClient(),
              "amadeus_hotel_list": AmadeusMCPClient(),
              "amadeus_hotel_search": AmadeusMCPClient(),
              "amadeus_hotel_offer": AmadeusMCPClient(),

              # Internal tools
              "create_trip": CreateTripTool(),
              "list_trips": ListTripsTool(),
              "get_trip_details": GetTripDetailsTool(),
              "set_notification": SetNotificationTool(),
              "pause_trip": PauseTripTool(),
              "resume_trip": ResumeTripTool(),
              "trigger_refresh": TriggerRefreshTool(),
          }

      async def execute(
          self,
          tool_name: str,
          arguments: dict,
          user_id: str
      ) -> ToolResult:
          ...
  ```
- [ ] Implement tool call validation
- [ ] Add user context injection for authorization
- [ ] Create tool result formatting for LLM consumption

### 2.2 Tool Schema Definitions
Define OpenAI-compatible tool schemas for Groq:

```python
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "create_trip",
            "description": "Create a new vacation price tracking trip",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "Friendly name for the trip (e.g., 'Hawaii Spring 2026')"
                    },
                    "origin_airport": {
                        "type": "string",
                        "description": "Origin airport IATA code (e.g., 'SFO')"
                    },
                    "destination_code": {
                        "type": "string",
                        "description": "Destination airport IATA code (e.g., 'HNL')"
                    },
                    # ... full schema
                },
                "required": ["name", "origin_airport", "destination_code", "depart_date", "return_date"]
            }
        }
    },
    # ... other tools
]
```

- [ ] `create_trip` - Full TripCreate schema
- [ ] `list_trips` - No parameters, returns user's trips
- [ ] `get_trip_details` - `trip_id` parameter
- [ ] `set_notification` - `trip_id`, `threshold_type`, `threshold_value`
- [ ] `pause_trip` - `trip_id` parameter
- [ ] `resume_trip` - `trip_id` parameter
- [ ] `trigger_refresh` - No parameters, refreshes all active trips
- [ ] `search_airports` - `query` parameter for IATA lookup

### 2.3 External MCP Server Integration
- [ ] Create Kiwi MCP client wrapper:
  ```python
  class KiwiMCPClient:
      async def search_flight(
          self,
          fly_from: str,
          fly_to: str,
          departure_date: str,
          return_date: Optional[str],
          adults: int,
          cabin: str
      ) -> FlightSearchResult:
          # Call Kiwi MCP server
          ...
  ```
- [ ] Create Amadeus MCP client wrapper for hotel tools
- [ ] Handle MCP server connection errors gracefully
- [ ] Implement response parsing and normalization

---

## 3. Custom MCP Tools Implementation

### 3.1 create_trip Tool
```python
class CreateTripTool:
    async def execute(self, args: dict, user_id: str) -> ToolResult:
        # 1. Validate input
        trip_create = TripCreate(**args)

        # 2. Check trip limit
        count = await db.count_user_trips(user_id)
        if count >= settings.MAX_TRIPS_PER_USER:
            return ToolResult(
                success=False,
                error=f"Trip limit reached ({settings.MAX_TRIPS_PER_USER})"
            )

        # 3. Create trip with prefs
        trip = await db.create_trip(user_id, trip_create)

        # 4. Trigger initial price check
        await temporal_client.start_workflow(
            PriceCheckWorkflow.run,
            trip.id,
            id=f"initial-check-{trip.id}"
        )

        # 5. Return confirmation
        return ToolResult(
            success=True,
            data={
                "trip_id": str(trip.id),
                "name": trip.name,
                "message": f"Created trip '{trip.name}'. Fetching initial prices..."
            }
        )
```

### 3.2 list_trips Tool
```python
class ListTripsTool:
    async def execute(self, args: dict, user_id: str) -> ToolResult:
        trips = await db.get_user_trips(user_id)

        return ToolResult(
            success=True,
            data={
                "trips": [
                    {
                        "id": str(t.id),
                        "name": t.name,
                        "route": f"{t.origin_airport} → {t.destination_code}",
                        "dates": f"{t.depart_date} - {t.return_date}",
                        "status": t.status,
                        "current_price": t.latest_snapshot.total_price if t.latest_snapshot else None
                    }
                    for t in trips
                ],
                "count": len(trips)
            }
        )
```

### 3.3 get_trip_details Tool
```python
class GetTripDetailsTool:
    async def execute(self, args: dict, user_id: str) -> ToolResult:
        trip_id = args["trip_id"]
        trip = await db.get_trip_with_details(trip_id, user_id)

        if not trip:
            return ToolResult(success=False, error="Trip not found")

        return ToolResult(
            success=True,
            data={
                "id": str(trip.id),
                "name": trip.name,
                "origin": trip.origin_airport,
                "destination": trip.destination_code,
                "dates": {
                    "depart": str(trip.depart_date),
                    "return": str(trip.return_date)
                },
                "flight_prefs": trip.flight_prefs.dict() if trip.flight_prefs else None,
                "hotel_prefs": trip.hotel_prefs.dict() if trip.hotel_prefs else None,
                "notification": trip.notification_rule.dict() if trip.notification_rule else None,
                "price_history": [
                    {
                        "date": str(s.created_at),
                        "flight": float(s.flight_price) if s.flight_price else None,
                        "hotel": float(s.hotel_price) if s.hotel_price else None,
                        "total": float(s.total_price) if s.total_price else None
                    }
                    for s in trip.snapshots[-10:]  # Last 10 snapshots
                ]
            }
        )
```

### 3.4 set_notification Tool
```python
class SetNotificationTool:
    async def execute(self, args: dict, user_id: str) -> ToolResult:
        trip_id = args["trip_id"]
        threshold_type = args.get("threshold_type", "trip_total")
        threshold_value = args["threshold_value"]

        trip = await db.get_trip(trip_id, user_id)
        if not trip:
            return ToolResult(success=False, error="Trip not found")

        await db.upsert_notification_rule(
            trip_id=trip_id,
            threshold_type=threshold_type,
            threshold_value=threshold_value
        )

        return ToolResult(
            success=True,
            data={
                "message": f"Alert set: Notify when {threshold_type} drops below ${threshold_value}"
            }
        )
```

### 3.5 pause_trip / resume_trip Tools
```python
class PauseTripTool:
    async def execute(self, args: dict, user_id: str) -> ToolResult:
        trip_id = args["trip_id"]
        trip = await db.update_trip_status(trip_id, user_id, TrackingStatus.PAUSED)

        if not trip:
            return ToolResult(success=False, error="Trip not found")

        return ToolResult(
            success=True,
            data={"message": f"Paused tracking for '{trip.name}'"}
        )

class ResumeTripTool:
    async def execute(self, args: dict, user_id: str) -> ToolResult:
        trip_id = args["trip_id"]
        trip = await db.update_trip_status(trip_id, user_id, TrackingStatus.ACTIVE)

        if not trip:
            return ToolResult(success=False, error="Trip not found")

        # Trigger immediate price check on resume
        await temporal_client.start_workflow(
            PriceCheckWorkflow.run,
            trip.id
        )

        return ToolResult(
            success=True,
            data={"message": f"Resumed tracking for '{trip.name}'. Fetching latest prices..."}
        )
```

### 3.6 trigger_refresh Tool
```python
class TriggerRefreshTool:
    async def execute(self, args: dict, user_id: str) -> ToolResult:
        # Check for existing refresh in progress
        lock_key = f"refresh:{user_id}"
        if await redis.exists(lock_key):
            return ToolResult(
                success=False,
                error="A refresh is already in progress. Please wait."
            )

        # Start workflow
        workflow_id = f"refresh-{user_id}-{datetime.now().isoformat()}"
        await temporal_client.start_workflow(
            RefreshAllTripsWorkflow.run,
            user_id,
            id=workflow_id
        )

        return ToolResult(
            success=True,
            data={
                "message": "Refreshing prices for all active trips...",
                "workflow_id": workflow_id
            }
        )
```

---

## 4. Chat API Endpoint

### 4.1 Streaming Chat Endpoint
```python
@router.post("/v1/chat/messages")
async def send_message(
    request: ChatRequest,
    user: User = Depends(get_current_user)
) -> StreamingResponse:
    # 1. Load or create conversation
    conversation = await get_or_create_conversation(
        request.thread_id,
        user.id
    )

    # 2. Save user message
    await save_message(conversation.id, "user", request.message)

    # 3. Build message history with context window
    messages = await build_message_history(conversation.id)

    # 4. Add system prompt with user context
    system_prompt = build_system_prompt(user)
    messages.insert(0, {"role": "system", "content": system_prompt})

    # 5. Stream response with tool handling
    async def generate():
        async for chunk in process_chat_with_tools(messages, user.id):
            yield f"data: {json.dumps(chunk)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream"
    )
```

### 4.2 Tool Call Loop
```python
async def process_chat_with_tools(
    messages: List[dict],
    user_id: str
) -> AsyncGenerator[dict, None]:
    while True:
        # Call Groq with tools
        response = await groq_client.chat(
            messages=messages,
            tools=TOOLS,
            stream=True
        )

        # Accumulate streamed response
        full_response = ""
        tool_calls = []

        async for chunk in response:
            if chunk.content:
                full_response += chunk.content
                yield {"type": "content", "content": chunk.content}

            if chunk.tool_calls:
                tool_calls.extend(chunk.tool_calls)

        # If no tool calls, we're done
        if not tool_calls:
            break

        # Execute tool calls
        messages.append({
            "role": "assistant",
            "content": full_response,
            "tool_calls": tool_calls
        })

        for tool_call in tool_calls:
            yield {
                "type": "tool_call",
                "name": tool_call.function.name,
                "arguments": tool_call.function.arguments
            }

            # Execute tool
            result = await mcp_router.execute(
                tool_call.function.name,
                json.loads(tool_call.function.arguments),
                user_id
            )

            yield {
                "type": "tool_result",
                "name": tool_call.function.name,
                "result": result.data
            }

            # Add tool result to messages
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": json.dumps(result.data)
            })

        # Continue loop to get final response after tool execution
```

---

## 5. Frontend Chat Integration

### 5.1 assistant-ui Setup
- [ ] Install `assistant-ui` package
- [ ] Configure chat provider with API endpoint
- [ ] Style chat component to match application theme

### 5.2 Chat Component Implementation
```tsx
// components/chat/chat-panel.tsx
export function ChatPanel() {
  const { messages, sendMessage, isLoading } = useChat({
    api: "/api/chat",
    onToolCall: (toolCall) => {
      // Optional: Show tool call visualization
    }
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
      </div>
      <ChatInput
        onSend={sendMessage}
        disabled={isLoading}
        placeholder="Ask me to track a trip..."
      />
    </div>
  );
}
```

### 5.3 Tool Call Visualization (Optional)
- [ ] Show collapsible tool call details
- [ ] Display tool name and parameters
- [ ] Show loading state during tool execution
- [ ] Display tool results inline

### 5.4 Dashboard Integration
- [ ] Update 2-column layout to include chat panel on right
- [ ] Add collapse/expand toggle for chat panel
- [ ] Sync trip table updates from chat actions
- [ ] Show toast notifications for successful tool calls

### 5.5 Real-time Updates (SSE)
- [ ] Create SSE endpoint in FastAPI for price updates
- [ ] Connect to SSE stream on dashboard mount
- [ ] Update trip table when new snapshots arrive
- [ ] Show "refreshing" indicator during workflow execution

---

## 6. Elicitation Logic

### 6.1 Parameter Collection
When creating a trip, the LLM should elicit missing parameters conversationally:

**Required Parameters:**
- Trip name
- Origin airport (IATA code)
- Destination airport (IATA code)
- Departure date
- Return date

**Optional Parameters (with defaults):**
- Adults (default: 1)
- Flight preferences:
  - Airlines (default: any)
  - Cabin (default: economy)
  - Stops (default: any)
- Hotel preferences:
  - Rooms (default: 1)
  - Room type (default: any)
  - View (default: any)
- Notification threshold

### 6.2 Smart Defaults
- [ ] Infer return date from trip length if mentioned ("a week in Hawaii")
- [ ] Suggest nearby airports if city name given
- [ ] Recommend notification threshold based on current prices
- [ ] Pre-fill adults based on previous trips

### 6.3 Clarification Prompts
Add examples to system prompt for common clarifications:
```
Example clarifications:
- "What dates are you planning to travel?"
- "Would you prefer a specific airline, or any airline is fine?"
- "Do you have a room type preference, like a king bed or suite?"
- "What price would you like me to alert you at?"
```

---

## 7. Security Checklist (Phase 2)

### Tool Authorization
- [ ] All tool executions receive `user_id` from authenticated session
- [ ] Tools query database with `user_id` filter (row-level security)
- [ ] Trip operations verify ownership before modification
- [ ] Tool results never expose other users' data

### Input Validation
- [ ] Tool arguments validated against Pydantic schemas
- [ ] LLM-generated arguments sanitized before database queries
- [ ] Prevent prompt injection via input sanitization
- [ ] Rate limit chat messages (10/minute per user)

### Content Safety
- [ ] Log all tool calls for audit trail
- [ ] Monitor for abuse patterns (excessive trip creation)
- [ ] Implement conversation length limits

---

## 8. Testing Checklist (Phase 2)

### Unit Tests
- [ ] Tool schema validation
- [ ] Tool execution with mocked dependencies
- [ ] Message history building
- [ ] System prompt generation

### Integration Tests
- [ ] Full tool call loop with mocked Groq
- [ ] MCP router dispatching
- [ ] Conversation persistence
- [ ] Streaming response assembly

### Manual Testing
- [ ] Create trip via chat conversation
- [ ] List trips and get details
- [ ] Set notification threshold
- [ ] Pause and resume via chat
- [ ] Trigger refresh via chat
- [ ] Multi-turn conversation with context

---

## 9. Definition of Done

Phase 2 is complete when:
- [ ] Chat panel is integrated into dashboard
- [ ] User can create trips via natural language
- [ ] User can list and manage trips via chat
- [ ] User can set notification thresholds via chat
- [ ] Tool calls are executed correctly with authorization
- [ ] Streaming responses display in real-time
- [ ] Conversation history is persisted
- [ ] External MCP servers (Kiwi, Amadeus) are callable via chat
- [ ] Elicitation prompts guide users through missing parameters
- [ ] All tool operations respect user authorization
