/**
 * API client with automatic 401 retry via token refresh.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://localhost:8000";

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

export interface User {
  id: string;
  email: string;
}

// Trip-related types
export type TripStatus = "active" | "paused" | "error";

export interface FlightPrefs {
  airlines: string[];
  stops_mode: string;
  max_stops: number | null;
  cabin: string;
}

export interface HotelPrefs {
  rooms: number;
  adults_per_room: number;
  room_selection_mode: string;
  preferred_room_types: string[];
  preferred_views: string[];
}

export interface NotificationPrefs {
  threshold_type: string;
  threshold_value: string;
  notify_without_threshold: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
}

export interface TripDetail {
  id: string;
  name: string;
  origin_airport: string;
  destination_code: string;
  depart_date: string;
  return_date: string;
  is_round_trip: boolean;
  adults: number;
  status: TripStatus;
  current_flight_price: string | null;
  current_hotel_price: string | null;
  total_price: string | null;
  last_refreshed: string | null;
  flight_prefs: FlightPrefs | null;
  hotel_prefs: HotelPrefs | null;
  notification_prefs: NotificationPrefs | null;
  created_at: string;
  updated_at: string;
}

export interface PriceSnapshot {
  id: string;
  flight_price: string | null;
  hotel_price: string | null;
  total_price: string | null;
  created_at: string;
}

// Flight offer from search results
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

// Hotel offer being tracked
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

// Price history for a specific hotel
export interface HotelPriceHistory {
  hotel_id: string;
  snapshots: Array<{
    date: string;
    price_per_night: string;
    total_price: string;
  }>;
}

export interface TripDetailResponse {
  trip: TripDetail;
  top_flights: FlightOffer[];
  tracked_hotels: HotelOffer[];
  price_history: PriceSnapshot[];
  hotel_price_histories: HotelPriceHistory[];
}

export interface ApiResponse<T> {
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

/**
 * Attempts to refresh the access token.
 * Returns true if successful, false otherwise.
 */
async function refreshAccessToken(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/v1/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
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

  const fetchOptions: RequestInit = {
    ...options,
    credentials: "include",
  };

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
    async me(): Promise<User> {
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
      await fetch(`${API_BASE_URL}/v1/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    },
  },

  trips: {
    /**
     * Get trip details including preferences and price history.
     */
    async getDetails(
      tripId: string,
      page = 1,
      limit = 50
    ): Promise<ApiResponse<TripDetailResponse>> {
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
  },
};
