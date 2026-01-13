# MCP Router Architecture

**Status:** Architecture documentation for implementation in Phase 1 Section 4

The MCP router dispatches tool calls from the LLM to the appropriate MCP servers.

## Overview

The MCP Router:
1. Receives tool call requests from Groq (Llama 3.3) LLM
2. Routes requests to the correct MCP server based on tool name
3. Handles authentication, rate limiting, and error handling
4. Returns results back to the LLM for response generation

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                   │
│                   Chat Interface (Phase 2)               │
└─────────────────────────┬────────────────────────────────┘
                          │ HTTPS
                          ▼
┌──────────────────────────────────────────────────────────┐
│                   FastAPI Backend                        │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │          Chat Endpoint: /v1/chat/message         │   │
│  └──────────────────────┬───────────────────────────┘   │
│                         │                               │
│                         ▼                               │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Groq LLM Client                     │   │
│  │        (Llama 3.3 with tool calling)             │   │
│  └──────────────────────┬───────────────────────────┘   │
│                         │                               │
│                         ▼                               │
│  ┌──────────────────────────────────────────────────┐   │
│  │              MCP Router Module                   │   │
│  │  • Tool name matching                            │   │
│  │  • Server selection                              │   │
│  │  • Request transformation                        │   │
│  │  • Response normalization                        │   │
│  │  • Error handling                                │   │
│  └─────┬────────────────────┬────────────────┬──────┘   │
└────────┼────────────────────┼────────────────┼──────────┘
         │                    │                │
    ┌────▼─────┐      ┌───────▼──────┐  ┌─────▼──────┐
    │  Kiwi    │      │   Amadeus    │  │  Custom    │
    │   MCP    │      │     MCP      │  │    MCP     │
    └──────────┘      └──────────────┘  └────────────┘
```

## Component Design

### 1. MCP Router Module

**Location:** `apps/api/app/mcp/router.py`

**Responsibilities:**
- Maintain a registry of available tools and their corresponding MCP servers
- Dispatch tool calls to the appropriate server
- Transform requests/responses between LLM and MCP formats
- Handle errors gracefully with fallback behavior

**Interface:**

```python
from typing import Any, Dict, List
from pydantic import BaseModel

class ToolCall(BaseModel):
    tool_name: str
    arguments: Dict[str, Any]

class ToolResult(BaseModel):
    success: bool
    data: Any
    error: Optional[str] = None

class MCPRouter:
    def __init__(self, config: MCPConfig):
        self.servers = self._initialize_servers(config)
        self.tool_registry = self._build_tool_registry()

    async def execute_tool(self, tool_call: ToolCall, user_id: str) -> ToolResult:
        """Execute a tool call on the appropriate MCP server"""
        pass

    def list_available_tools(self) -> List[Dict[str, Any]]:
        """Return list of all available tools for LLM context"""
        pass
```

### 2. Tool Registry

Maps tool names to their MCP servers and configurations.

```python
TOOL_REGISTRY = {
    # Kiwi MCP (Flights)
    "search-flight": {
        "server": "kiwi",
        "description": "Search for flights between airports",
        "rate_limit": "10/minute",
        "cache_ttl": 86400,
    },

    # Amadeus MCP (Hotels)
    "amadeus_hotel_list": {
        "server": "amadeus",
        "description": "List hotels in a location",
        "rate_limit": "10/minute",
        "cache_ttl": 86400,
    },
    "amadeus_hotel_search": {
        "server": "amadeus",
        "description": "Search hotel availability and pricing",
        "rate_limit": "10/minute",
        "cache_ttl": 86400,
    },
    "amadeus_hotel_offer": {
        "server": "amadeus",
        "description": "Get specific hotel offer details",
        "rate_limit": "10/minute",
        "cache_ttl": 3600,
    },

    # Custom MCP (Trip Management)
    "create_trip": {
        "server": "custom",
        "description": "Create a new trip to track",
        "rate_limit": "5/minute",
        "cache_ttl": 0,
    },
    "list_trips": {
        "server": "custom",
        "description": "List user's tracked trips",
        "rate_limit": "20/minute",
        "cache_ttl": 60,
    },
    "get_trip_details": {
        "server": "custom",
        "description": "Get trip details including price history",
        "rate_limit": "20/minute",
        "cache_ttl": 60,
    },
    "set_notification": {
        "server": "custom",
        "description": "Update notification thresholds for a trip",
        "rate_limit": "5/minute",
        "cache_ttl": 0,
    },
    "pause_trip": {
        "server": "custom",
        "description": "Pause price tracking for a trip",
        "rate_limit": "5/minute",
        "cache_ttl": 0,
    },
    "resume_trip": {
        "server": "custom",
        "description": "Resume price tracking for a trip",
        "rate_limit": "5/minute",
        "cache_ttl": 0,
    },
    "trigger_refresh": {
        "server": "custom",
        "description": "Force price refresh for a trip",
        "rate_limit": "2/minute",
        "cache_ttl": 0,
    },
}
```

### 3. MCP Server Connectors

#### Amadeus MCP Connector

```python
import asyncio
import json
from typing import Dict, Any, List

class AmadeusMCPConnector:
    """Connector for Amadeus MCP Server (spawned subprocess)"""

    def __init__(self, config: AmadeusConfig):
        self.mcp_executable = config.mcp_path  # Path to node executable and amadeus-mcp
        self.env = {
            "AMADEUS_API_KEY": config.api_key,
            "AMADEUS_API_SECRET": config.api_secret,
        }
        self._process = None

    async def _call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Call an MCP tool via stdio"""
        # Spawn subprocess if not already running
        if not self._process:
            self._process = await asyncio.create_subprocess_exec(
                "node", self.mcp_executable,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=self.env,
            )

        # Send tool call request via stdin
        request = json.dumps({"tool": tool_name, "arguments": arguments})
        self._process.stdin.write(request.encode() + b"\n")
        await self._process.stdin.drain()

        # Read response from stdout
        response = await self._process.stdout.readline()
        return json.loads(response.decode())

    async def hotel_list(self, location: str, radius: int = 5, radius_unit: str = "KM") -> Dict[str, Any]:
        return await self._call_tool("amadeus_hotel_list", {
            "location": location,
            "radius": radius,
            "radius_unit": radius_unit,
        })

    async def hotel_search(self, hotel_ids: List[str], check_in: str, check_out: str, adults: int, rooms: int = 1) -> Dict[str, Any]:
        return await self._call_tool("amadeus_hotel_search", {
            "hotel_ids": hotel_ids,
            "check_in": check_in,
            "check_out": check_out,
            "adults": adults,
            "rooms": rooms,
        })
```

#### Custom MCP Connector

```python
class CustomMCPConnector:
    def __init__(self, db_session: AsyncSession):
        self.db = db_session

    async def create_trip(self, user_id: str, name: str, origin: str, destination: str, depart_date: str, return_date: str, flight_prefs: Dict[str, Any], hotel_prefs: Dict[str, Any]) -> Dict[str, Any]:
        pass

    async def list_trips(self, user_id: str) -> List[Dict[str, Any]]:
        pass
```

### 4. Caching Layer

Redis-backed cache to stay within API rate limits.

```python
from redis import asyncio as aioredis
import hashlib
import json

class MCPCache:
    def __init__(self, redis_client: aioredis.Redis):
        self.redis = redis_client

    def _cache_key(self, tool_name: str, arguments: Dict[str, Any]) -> str:
        args_str = json.dumps(arguments, sort_keys=True)
        hash_input = f"{tool_name}:{args_str}"
        return f"mcp:cache:{hashlib.sha256(hash_input.encode()).hexdigest()}"

    async def get(self, tool_name: str, arguments: Dict[str, Any]) -> Optional[Any]:
        key = self._cache_key(tool_name, arguments)
        cached = await self.redis.get(key)
        return json.loads(cached) if cached else None

    async def set(self, tool_name: str, arguments: Dict[str, Any], result: Any, ttl: int):
        if ttl > 0:
            key = self._cache_key(tool_name, arguments)
            await self.redis.setex(key, ttl, json.dumps(result))
```

### 5. Rate Limiting

Token bucket rate limiter per user per tool.

```python
from fastapi import HTTPException

class RateLimiter:
    def __init__(self, redis_client: aioredis.Redis):
        self.redis = redis_client

    async def check_limit(self, user_id: str, tool_name: str, limit: str):
        count, period = self._parse_limit(limit)
        key = f"ratelimit:{user_id}:{tool_name}"
        current = await self.redis.incr(key)

        if current == 1:
            await self.redis.expire(key, self._period_seconds(period))

        if current > count:
            raise HTTPException(status_code=429, detail=f"Rate limit exceeded for {tool_name}. Max {limit}.")

    def _parse_limit(self, limit: str) -> tuple[int, str]:
        count, period = limit.split("/")
        return int(count), period

    def _period_seconds(self, period: str) -> int:
        return {"second": 1, "minute": 60, "hour": 3600, "day": 86400}[period]
```

## Integration with LLM (Groq)

```python
from groq import AsyncGroq

async def chat_with_tools(message: str, user_id: str, mcp_router: MCPRouter) -> str:
    client = AsyncGroq(api_key=settings.GROQ_API_KEY)
    tools = mcp_router.list_available_tools()

    tool_definitions = [
        {
            "type": "function",
            "function": {
                "name": tool["name"],
                "description": tool["description"],
                "parameters": tool["parameters"],
            }
        }
        for tool in tools
    ]

    response = await client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": message}],
        tools=tool_definitions,
        tool_choice="auto",
    )

    if response.choices[0].message.tool_calls:
        tool_results = []
        for tool_call in response.choices[0].message.tool_calls:
            result = await mcp_router.execute_tool(
                ToolCall(
                    tool_name=tool_call.function.name,
                    arguments=json.loads(tool_call.function.arguments),
                ),
                user_id=user_id,
            )
            tool_results.append(result)
        # Send tool results back to LLM for final response

    return response.choices[0].message.content
```

## Error Handling

```python
# Tool Not Found
if tool_name not in TOOL_REGISTRY:
    return ToolResult(success=False, data=None, error=f"Tool '{tool_name}' is not available")

# MCP Server Unavailable
try:
    result = await connector.execute(tool_call)
except ConnectionError:
    return ToolResult(success=False, data=None, error="External service temporarily unavailable. Please try again.")

# Rate Limit Exceeded
try:
    await rate_limiter.check_limit(user_id, tool_name, limit)
except HTTPException as e:
    return ToolResult(success=False, data=None, error=e.detail)

# Invalid Arguments
try:
    validated = ToolArguments(**arguments)
except ValidationError as e:
    return ToolResult(success=False, data=None, error=f"Invalid arguments: {e}")
```

## Configuration

**Environment Variables:**

```bash
MCP_ROUTER_TIMEOUT=30
MCP_CACHE_ENABLED=true
MCP_RATE_LIMIT_ENABLED=true

# Amadeus MCP Server
AMADEUS_API_KEY=your_api_key
AMADEUS_API_SECRET=your_api_secret
AMADEUS_MCP_PATH=/path/to/amadeus-mcp/dist/index.js

# Kiwi MCP Server (configured in Phase 2)
KIWI_MCP_PATH=/path/to/kiwi-mcp/index.js

CUSTOM_MCP_ENABLED=true
```

**Settings Model:**

```python
from pydantic_settings import BaseSettings

class MCPSettings(BaseSettings):
    router_timeout: int = 30
    cache_enabled: bool = True
    rate_limit_enabled: bool = True

    # Amadeus MCP subprocess config
    amadeus_api_key: str
    amadeus_api_secret: str
    amadeus_mcp_path: str = "node_modules/@modelcontextprotocol/server-amadeus-travel/dist/index.js"

    # Kiwi MCP subprocess config
    kiwi_mcp_path: Optional[str] = None

    custom_mcp_enabled: bool = True
```

## Testing Strategy

**Unit Tests:**
- Tool registry lookup
- Cache key generation
- Rate limiter logic
- Error handling for each connector

**Integration Tests:**
- Mock MCP server responses
- Full tool execution flow
- Rate limiting with Redis
- Caching behavior

**End-to-End Tests:**
- LLM -> Router -> MCP -> Response flow
- Multi-tool conversations
- Error recovery

## Implementation Checklist (Phase 1 Section 4)

- [ ] Create `apps/api/app/mcp/router.py` with `MCPRouter` class
- [ ] Create `apps/api/app/mcp/registry.py` with `TOOL_REGISTRY`
- [ ] Create `apps/api/app/mcp/connectors/amadeus.py`
- [ ] Create `apps/api/app/mcp/connectors/custom.py`
- [ ] Create `apps/api/app/mcp/cache.py` with Redis caching
- [ ] Create `apps/api/app/mcp/rate_limiter.py`
- [ ] Add MCP router integration to chat endpoint
- [ ] Write unit and integration tests
- [ ] Document API usage in API_SPEC.md

## Future Enhancements (Post-Phase 1)

1. **Kiwi MCP Self-Hosting:** Add self-hosted Kiwi MCP if needed
2. **SearchAPI Integration:** Phase 4 flexible date optimizer
3. **Observability:** Add tracing for tool calls (OpenTelemetry)
4. **Analytics:** Track tool usage metrics per user
