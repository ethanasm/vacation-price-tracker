/**
 * API client with automatic 401 retry via token refresh.
 *
 * Types are imported from the generated OpenAPI types where available.
 * Extended types for UI-specific features are defined here.
 */

// =============================================================================
// Re-export generated types for use throughout the app
// =============================================================================
export type {
  UserResponse as User,
  TripStatus,
  TripCreate,
  TripDetail,
  TripResponse,
  FlightPrefs,
  HotelPrefs,
  NotificationPrefsInput,
  NotificationPrefsOutput,
  PriceSnapshotResponse as PriceSnapshot,
  RefreshStartResponse,
  RefreshStatusResponse,
  TripStatusUpdate,
  CabinClass,
  StopsMode,
  RoomSelectionMode,
  ThresholdType,
  CreateTripRequest,
  CreateTripResponse,
  GetTripDetailsResponse,
  RefreshAllResponse,
  ListTripsResponse,
  ListTripsParams,
  FlightSegment as ApiFlightSegment,
  FlightItinerary as ApiFlightItinerary,
  FlightOffer as ApiFlightOffer,
  HotelOffer as ApiHotelOffer,
} from "./api/index";

import type {
  UserResponse,
  TripDetail,
  TripCreate,
  TripResponse,
  TripStatus,
  PriceSnapshotResponse,
  RefreshStartResponse,
  RefreshStatusResponse,
  TripStatusUpdate,
  CreateTripResponse as GeneratedCreateTripResponse,
  GetTripDetailsResponse as GeneratedGetTripDetailsResponse,
  RefreshAllResponse as GeneratedRefreshAllResponse,
  GetRefreshStatusResponse as GeneratedGetRefreshStatusResponse,
  ListTripsResponse as GeneratedListTripsResponse,
} from "./api/index";

import { airports, type Airport } from "../data/airports";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://localhost:8000";
const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "X-CSRF-Token";

// =============================================================================
// Error classes
// =============================================================================

export class AuthError extends Error {
  constructor(message = "Authentication failed") {
    super(message);
    this.name = "AuthError";
  }
}

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, message: string, detail?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail || message;
  }
}

// =============================================================================
// Extended types for UI features (not in OpenAPI spec yet)
// =============================================================================

// Location result for airport autocomplete
// Uses static airport data instead of API
export interface LocationResult {
  code: string;
  name: string;
  city: string;
  country: string;
  type: "AIRPORT";
}

// Flight offer from search results (Phase 2+ feature)
export interface FlightOffer {
  id: string;
  airline: string;
  airline_code: string;
  flight_number: string;
  departure_time: string;
  arrival_time: string;
  duration_minutes: number;
  stops: number;
  stop_cities?: string[];
  cabin: string;
  price: string;
  return_flight?: {
    flight_number: string;
    departure_time: string;
    arrival_time: string;
    duration_minutes: number;
    stops: number;
  };
}

// Hotel offer being tracked (Phase 2+ feature)
export interface HotelOffer {
  id: string;
  hotel_name: string;
  hotel_id: string;
  star_rating: number;
  room_type: string;
  room_description: string;
  price_per_night: string;
  total_price: string;
  amenities: string[];
  image_url?: string;
}

// Price history for a specific hotel (Phase 2+ feature)
export interface HotelPriceHistory {
  hotel_id: string;
  snapshots: Array<{
    date: string;
    price_per_night: string;
    total_price: string;
  }>;
}

// Extended trip detail response with flight/hotel offers (Phase 2+ feature)
export interface TripDetailResponseExtended {
  trip: TripDetail;
  top_flights: FlightOffer[];
  tracked_hotels: HotelOffer[];
  price_history: PriceSnapshotResponse[];
  hotel_price_histories: HotelPriceHistory[];
}

// Simple trip detail response matching current API
export interface TripDetailResponse {
  trip: TripDetail;
  price_history: PriceSnapshotResponse[];
}

// Generic API response wrapper
export interface ApiResponse<T> {
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    total_pages?: number;
    [key: string]: unknown;
  } | null;
}

// Conversation types for chat history
export interface ConversationSummary {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageResponse {
  id: string;
  role: string;
  content: string;
  tool_calls: Array<{
    id: string;
    name: string;
    arguments: string;
  }> | null;
  tool_call_id: string | null;
  name: string | null;
  created_at: string;
}

export interface ConversationDetail {
  conversation: ConversationSummary;
  messages: ChatMessageResponse[];
}

export interface ConversationListResponse {
  data: ConversationSummary[];
}

export interface ConversationDetailResponse {
  data: ConversationDetail;
}

// Trip update request (PATCH endpoint - not fully in OpenAPI spec)
export interface UpdateTripRequest {
  name?: string;
  origin_airport?: string;
  destination_code?: string;
  is_round_trip?: boolean;
  depart_date?: string;
  return_date?: string | null;
  adults?: number;
  flight_prefs?: {
    airlines: string[];
    stops_mode: string;
    max_stops: number | null;
    cabin: string;
  } | null;
  hotel_prefs?: {
    rooms: number;
    adults_per_room: number;
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

function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const cookies = document.cookie ? document.cookie.split("; ") : [];
  for (const cookie of cookies) {
    const [key, ...rest] = cookie.split("=");
    if (key === name) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
}

function withCsrfHeaders(options: RequestInit): RequestInit {
  const method = (options.method || "GET").toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return options;
  }

  const csrfToken = getCookieValue(CSRF_COOKIE_NAME);
  if (!csrfToken) {
    return options;
  }

  const headers = new Headers(options.headers || {});
  if (!headers.has(CSRF_HEADER_NAME)) {
    headers.set(CSRF_HEADER_NAME, csrfToken);
  }

  return { ...options, headers };
}

/**
 * Attempts to refresh the access token.
 * Returns true if successful, false otherwise.
 */
async function refreshAccessToken(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/v1/auth/refresh`, withCsrfHeaders({
      method: "POST",
      credentials: "include",
    }));
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch wrapper that automatically handles 401 responses by refreshing the token.
 * On successful refresh, retries the original request once.
 * On refresh failure or network error, throws AuthError.
 */
export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const fullUrl = url.startsWith("http") ? url : `${API_BASE_URL}${url}`;

  const fetchOptions: RequestInit = withCsrfHeaders({
    ...options,
    credentials: "include",
  });

  let response: Response;

  try {
    response = await fetch(fullUrl, fetchOptions);
  } catch {
    // Network error (server down, CORS, etc.)
    throw new AuthError("Unable to connect to server");
  }

  // If 401, try to refresh the token and retry once
  if (response.status === 401) {
    const refreshed = await refreshAccessToken();

    if (!refreshed) {
      throw new AuthError("Session expired. Please sign in again.");
    }

    // Retry the original request
    try {
      response = await fetch(fullUrl, fetchOptions);
    } catch {
      throw new AuthError("Unable to connect to server");
    }

    // If still 401 after refresh, throw AuthError
    if (response.status === 401) {
      throw new AuthError("Authentication failed after token refresh.");
    }
  }

  return response;
}

/**
 * Typed API client with auth endpoints.
 */
export const api = {
  auth: {
    /**
     * Get the current authenticated user's info.
     * Throws AuthError if not authenticated.
     */
    async me(): Promise<UserResponse> {
      const response = await fetchWithAuth("/v1/auth/me");

      if (!response.ok) {
        throw new AuthError("Failed to get user info");
      }

      return response.json();
    },

    /**
     * Log out the current user.
     */
    async logout(): Promise<void> {
      await fetch(`${API_BASE_URL}/v1/auth/logout`, withCsrfHeaders({
        method: "POST",
        credentials: "include",
      }));
    },
  },

  locations: {
    /**
     * Search airports using static data.
     * Filters locally from ~4500 large/medium airports.
     */
    search(query: string): LocationResult[] {
      if (query.length < 2) {
        return [];
      }

      const normalizedQuery = query.toLowerCase();

      // Collect all matches with a relevance score
      const scored: { airport: Airport; score: number }[] = [];

      for (const airport of airports) {
        const code = airport.code.toLowerCase();
        const name = airport.name.toLowerCase();
        const city = airport.city?.toLowerCase() ?? "";

        // Exact code match (highest priority)
        if (code === normalizedQuery) {
          scored.push({ airport, score: 0 });
        // Code starts with query
        } else if (code.startsWith(normalizedQuery)) {
          scored.push({ airport, score: 1 });
        // City exact match
        } else if (city === normalizedQuery) {
          scored.push({ airport, score: 2 });
        // City starts with query
        } else if (city.startsWith(normalizedQuery)) {
          scored.push({ airport, score: 3 });
        // City contains query
        } else if (city.includes(normalizedQuery)) {
          scored.push({ airport, score: 4 });
        // Airport name starts with query
        } else if (name.startsWith(normalizedQuery)) {
          scored.push({ airport, score: 5 });
        // Airport name contains query
        } else if (name.includes(normalizedQuery)) {
          scored.push({ airport, score: 6 });
        }
      }

      scored.sort((a, b) => a.score - b.score);

      return scored.slice(0, 8).map(({ airport }) => ({
        code: airport.code,
        name: airport.name,
        city: airport.city || "",
        country: airport.country,
        type: "AIRPORT" as const,
      }));
    },
  },

  trips: {
    /**
     * List trips for the current user.
     * @param page - Page number (1-indexed)
     * @param limit - Number of trips per page
     * @param status - Filter by trip status
     */
    async list(
      page = 1,
      limit = 20,
      status?: TripStatus
    ): Promise<GeneratedListTripsResponse> {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (status) {
        params.set("status", status);
      }

      const response = await fetchWithAuth(`/v1/trips?${params.toString()}`);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new ApiError(
          response.status,
          error.title || "Failed to load trips",
          error.detail
        );
      }

      return response.json();
    },

    /**
     * Create a new trip.
     * Requires X-Idempotency-Key header for duplicate prevention.
     */
    async create(
      data: TripCreate,
      idempotencyKey: string
    ): Promise<GeneratedCreateTripResponse> {
      const response = await fetchWithAuth("/v1/trips", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        if (response.status === 400) {
          throw new ApiError(
            400,
            error.title || "Invalid trip data",
            error.detail
          );
        }
        if (response.status === 409) {
          throw new ApiError(
            409,
            error.title || "Duplicate request",
            error.detail
          );
        }
        throw new ApiError(
          response.status,
          error.title || "Failed to create trip",
          error.detail
        );
      }

      return response.json();
    },

    /**
     * Get trip details including preferences and price history.
     */
    async getDetails(
      tripId: string,
      page = 1,
      limit = 50
    ): Promise<GeneratedGetTripDetailsResponse> {
      const response = await fetchWithAuth(
        `/v1/trips/${tripId}?page=${page}&limit=${limit}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new ApiError(404, "Trip not found");
        }
        const error = await response.json().catch(() => ({}));
        throw new ApiError(
          response.status,
          error.title || "Failed to load trip",
          error.detail
        );
      }

      return response.json();
    },

    /**
     * Update trip status (pause/resume).
     */
    async updateStatus(
      tripId: string,
      status: "active" | "paused"
    ): Promise<void> {
      const response = await fetchWithAuth(`/v1/trips/${tripId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new ApiError(404, "Trip not found");
        }
        const error = await response.json().catch(() => ({}));
        throw new ApiError(
          response.status,
          error.title || "Failed to update trip status",
          error.detail
        );
      }
    },

    /**
     * Delete a trip.
     */
    async delete(tripId: string): Promise<void> {
      const response = await fetchWithAuth(`/v1/trips/${tripId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new ApiError(404, "Trip not found");
        }
        const error = await response.json().catch(() => ({}));
        throw new ApiError(
          response.status,
          error.title || "Failed to delete trip",
          error.detail
        );
      }
    },

    /**
     * Delete all trips for the current user.
     */
    async deleteAll(): Promise<{ data: { deleted_count: number } }> {
      const response = await fetchWithAuth("/v1/trips", {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new ApiError(
          response.status,
          error.title || "Failed to delete trips",
          error.detail
        );
      }

      return response.json();
    },

    /**
     * Update an existing trip.
     */
    async update(
      tripId: string,
      data: UpdateTripRequest
    ): Promise<ApiResponse<TripDetail>> {
      const response = await fetchWithAuth(`/v1/trips/${tripId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new ApiError(404, "Trip not found");
        }
        const error = await response.json().catch(() => ({}));
        if (response.status === 400) {
          throw new ApiError(
            400,
            error.title || "Invalid trip data",
            error.detail
          );
        }
        if (response.status === 409) {
          throw new ApiError(
            409,
            error.title || "Duplicate trip name",
            error.detail
          );
        }
        throw new ApiError(
          response.status,
          error.title || "Failed to update trip",
          error.detail
        );
      }

      return response.json();
    },

    /**
     * Trigger a refresh of all active trips.
     * Returns a refresh_group_id for tracking progress.
     */
    async refreshAll(): Promise<GeneratedRefreshAllResponse> {
      const response = await fetchWithAuth("/v1/trips/refresh-all", {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        if (response.status === 409) {
          throw new ApiError(
            409,
            error.title || "Refresh already in progress",
            error.detail
          );
        }
        if (response.status === 502) {
          throw new ApiError(
            502,
            error.title || "Failed to start refresh workflow",
            error.detail
          );
        }
        throw new ApiError(
          response.status,
          error.title || "Failed to start refresh",
          error.detail
        );
      }

      return response.json();
    },

    /**
     * Get the status of a refresh operation.
     * @param refreshGroupId - The ID returned from refreshAll()
     */
    async getRefreshStatus(
      refreshGroupId: string
    ): Promise<GeneratedGetRefreshStatusResponse> {
      const url = `/v1/trips/refresh-status?refresh_group_id=${encodeURIComponent(refreshGroupId)}`;

      const response = await fetchWithAuth(url);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        if (response.status === 404) {
          throw new ApiError(
            404,
            error.title || "Refresh group not found",
            error.detail
          );
        }
        throw new ApiError(
          response.status,
          error.title || "Failed to get refresh status",
          error.detail
        );
      }

      return response.json();
    },

    /**
     * Trigger a refresh for a single trip.
     * @param tripId - The trip ID to refresh
     */
    async refresh(tripId: string): Promise<GeneratedRefreshAllResponse> {
      const response = await fetchWithAuth(`/v1/trips/${tripId}/refresh`, {
        method: "POST",
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new ApiError(404, "Trip not found");
        }
        const error = await response.json().catch(() => ({}));
        if (response.status === 502) {
          throw new ApiError(
            502,
            error.title || "Failed to start refresh workflow",
            error.detail
          );
        }
        throw new ApiError(
          response.status,
          error.title || "Failed to start refresh",
          error.detail
        );
      }

      return response.json();
    },
  },

  chat: {
    /**
     * List the current user's conversations.
     * @param limit - Maximum number of conversations to return (default: 20)
     */
    async listConversations(limit = 20): Promise<ConversationListResponse> {
      const params = new URLSearchParams();
      params.set("limit", String(limit));

      const response = await fetchWithAuth(`/v1/chat/conversations?${params.toString()}`);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new ApiError(
          response.status,
          error.title || "Failed to load conversations",
          error.detail
        );
      }

      return response.json();
    },

    /**
     * Get a conversation with its message history.
     * @param threadId - Conversation UUID
     */
    async getConversation(threadId: string): Promise<ConversationDetailResponse> {
      const response = await fetchWithAuth(`/v1/chat/conversations/${threadId}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new ApiError(404, "Conversation not found");
        }
        const error = await response.json().catch(() => ({}));
        throw new ApiError(
          response.status,
          error.title || "Failed to load conversation",
          error.detail
        );
      }

      return response.json();
    },
  },
};
