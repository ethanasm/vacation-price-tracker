import { AuthError, ApiError, api, fetchWithAuth } from "../lib/api";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Helper to set document.cookie
function setCookie(name: string, value: string) {
  Object.defineProperty(document, "cookie", {
    writable: true,
    value: `${name}=${encodeURIComponent(value)}`,
  });
}

function clearCookie() {
  Object.defineProperty(document, "cookie", {
    writable: true,
    value: "",
  });
}

describe("API Client", () => {
  beforeEach(() => {
    mockFetch.mockClear();
    clearCookie();
  });

  describe("fetchWithAuth", () => {
    it("includes credentials in requests", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

      await fetchWithAuth("/v1/test");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://localhost:8000/v1/test",
        expect.objectContaining({
          credentials: "include",
        })
      );
    });

    it("retries request after 401 with successful refresh", async () => {
      // First call: 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      // Refresh call: success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      // Retry call: success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: "success" }),
      });

      const response = await fetchWithAuth("/v1/protected");

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(response.status).toBe(200);
    });

    it("throws AuthError when refresh fails", async () => {
      // First call: 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      // Refresh call: failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      await expect(fetchWithAuth("/v1/protected")).rejects.toThrow(AuthError);

      // Reset mock for second assertion
      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      await expect(fetchWithAuth("/v1/protected")).rejects.toThrow(
        "Session expired"
      );
    });

    it("throws AuthError when refresh request fails to reach server", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });
      mockFetch.mockRejectedValueOnce(new TypeError("Network down"));

      await expect(fetchWithAuth("/v1/protected")).rejects.toThrow(
        "Session expired"
      );
    });

    it("throws AuthError when retry request fails after refresh", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });
      mockFetch.mockRejectedValueOnce(new TypeError("Retry failed"));

      await expect(fetchWithAuth("/v1/protected")).rejects.toThrow(
        "Unable to connect to server"
      );
    });

    it("throws AuthError when retry still returns 401", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      await expect(fetchWithAuth("/v1/protected")).rejects.toThrow(
        "Authentication failed after token refresh."
      );
    });

    it("does not retry on non-401 errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const response = await fetchWithAuth("/v1/test");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(response.status).toBe(500);
    });

    it("throws AuthError on network failure", async () => {
      mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

      await expect(fetchWithAuth("/v1/test")).rejects.toThrow(AuthError);

      // Reset and test error message
      mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));
      await expect(fetchWithAuth("/v1/test")).rejects.toThrow(
        "Unable to connect to server"
      );
    });
  });

  describe("api.auth.me", () => {
    it("returns user data on success", async () => {
      const mockUser = { id: "123", email: "test@example.com" };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockUser,
      });

      const user = await api.auth.me();

      expect(user).toEqual(mockUser);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://localhost:8000/v1/auth/me",
        expect.objectContaining({
          credentials: "include",
        })
      );
    });

    it("throws on authentication failure", async () => {
      // First call: 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      // Refresh call: failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      await expect(api.auth.me()).rejects.toThrow(AuthError);
    });

    it("throws when user info response is not ok", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(api.auth.me()).rejects.toThrow(
        "Failed to get user info"
      );
    });
  });

  describe("api.auth.logout", () => {
    it("calls logout endpoint", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      await api.auth.logout();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://localhost:8000/v1/auth/logout",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
        })
      );
    });
  });

  describe("ApiError", () => {
    it("creates error with status and message", () => {
      const error = new ApiError(404, "Not Found");

      expect(error.status).toBe(404);
      expect(error.message).toBe("Not Found");
      expect(error.detail).toBe("Not Found");
      expect(error.name).toBe("ApiError");
    });

    it("creates error with custom detail", () => {
      const error = new ApiError(400, "Bad Request", "Invalid input");

      expect(error.status).toBe(400);
      expect(error.message).toBe("Bad Request");
      expect(error.detail).toBe("Invalid input");
    });

    it("is an instance of Error", () => {
      const error = new ApiError(500, "Server Error");

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ApiError);
    });
  });

  describe("AuthError", () => {
    it("creates error with default message when no message provided", () => {
      const error = new AuthError();

      expect(error.message).toBe("Authentication failed");
      expect(error.name).toBe("AuthError");
    });

    it("creates error with custom message when provided", () => {
      const error = new AuthError("Custom auth error");

      expect(error.message).toBe("Custom auth error");
      expect(error.name).toBe("AuthError");
    });

    it("is an instance of Error", () => {
      const error = new AuthError();

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AuthError);
    });
  });

  describe("fetchWithAuth URL handling", () => {
    it("uses full URL when provided with http prefix", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

      await fetchWithAuth("http://example.com/api/test");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://example.com/api/test",
        expect.any(Object)
      );
    });

    it("uses full URL when provided with https prefix", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

      await fetchWithAuth("https://example.com/api/test");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com/api/test",
        expect.any(Object)
      );
    });

    it("prepends API base URL to relative paths", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

      await fetchWithAuth("/v1/test");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://localhost:8000/v1/test",
        expect.any(Object)
      );
    });
  });

  describe("api.trips.getDetails", () => {
    it("returns trip details on success", async () => {
      const mockTripResponse = {
        data: {
          trip: { id: "1", name: "Test Trip" },
          top_flights: [],
          tracked_hotels: [],
          price_history: [],
          hotel_price_histories: [],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockTripResponse,
      });

      const result = await api.trips.getDetails("1");

      expect(result).toEqual(mockTripResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://localhost:8000/v1/trips/1?page=1&limit=50",
        expect.objectContaining({
          credentials: "include",
        })
      );
    });

    it("passes pagination parameters", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: {} }),
      });

      await api.trips.getDetails("1", 2, 25);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://localhost:8000/v1/trips/1?page=2&limit=25",
        expect.objectContaining({
          credentials: "include",
        })
      );
    });

    it("throws ApiError with 404 when trip not found", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({}),
      });

      await expect(api.trips.getDetails("invalid")).rejects.toThrow(ApiError);

      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({}),
      });

      await expect(api.trips.getDetails("invalid")).rejects.toThrow("Trip not found");
    });

    it("throws ApiError with detail from server response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ title: "Server Error", detail: "Database connection failed" }),
      });

      try {
        await api.trips.getDetails("1");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(500);
        expect((error as ApiError).message).toBe("Server Error");
        expect((error as ApiError).detail).toBe("Database connection failed");
      }
    });

    it("uses default message when server response has no title", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      });

      await expect(api.trips.getDetails("1")).rejects.toThrow("Failed to load trip");
    });

    it("handles JSON parse error in error response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => { throw new Error("JSON parse error"); },
      });

      await expect(api.trips.getDetails("1")).rejects.toThrow("Failed to load trip");
    });
  });

  describe("api.trips.updateStatus", () => {
    it("updates trip status successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      await api.trips.updateStatus("1", "paused");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://localhost:8000/v1/trips/1/status",
        expect.objectContaining({
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: "paused" }),
        })
      );
    });

    it("can set status to active", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      await api.trips.updateStatus("1", "active");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ status: "active" }),
        })
      );
    });

    it("throws ApiError when trip not found", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({}),
      });

      await expect(api.trips.updateStatus("invalid", "active")).rejects.toThrow("Trip not found");
    });

    it("throws ApiError with detail from server response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ title: "Bad Request", detail: "Invalid status" }),
      });

      try {
        await api.trips.updateStatus("1", "active");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).message).toBe("Bad Request");
        expect((error as ApiError).detail).toBe("Invalid status");
      }
    });

    it("uses default message when server response has no title", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      });

      await expect(api.trips.updateStatus("1", "active")).rejects.toThrow("Failed to update trip status");
    });

    it("handles JSON parse error in error response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => { throw new Error("JSON parse error"); },
      });

      await expect(api.trips.updateStatus("1", "active")).rejects.toThrow("Failed to update trip status");
    });
  });

  describe("api.trips.update", () => {
    it("updates trip successfully", async () => {
      const mockResponse = {
        data: {
          id: "1",
          name: "Updated Trip",
          origin_airport: "SFO",
          destination_code: "LAX",
          status: "active",
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const updateData = {
        name: "Updated Trip",
        origin_airport: "SFO",
        destination_code: "LAX",
      };

      const result = await api.trips.update("1", updateData);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://localhost:8000/v1/trips/1",
        expect.objectContaining({
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updateData),
        })
      );
    });

    it("throws ApiError when trip not found", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({}),
      });

      await expect(api.trips.update("invalid", { name: "Test" })).rejects.toThrow("Trip not found");
    });

    it("throws ApiError on 400 with detail from server", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ title: "Bad Request", detail: "Name is required" }),
      });

      try {
        await api.trips.update("1", {});
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(400);
        expect((error as ApiError).message).toBe("Bad Request");
        expect((error as ApiError).detail).toBe("Name is required");
      }
    });

    it("throws ApiError on 409 duplicate name", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ title: "Duplicate Trip Name", detail: "A trip with this name already exists" }),
      });

      try {
        await api.trips.update("1", { name: "Existing Name" });
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(409);
        expect((error as ApiError).message).toBe("Duplicate Trip Name");
      }
    });

    it("uses default message on 400 when server response has no title", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ detail: "Validation failed" }),
      });

      try {
        await api.trips.update("1", {});
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(400);
        expect((error as ApiError).message).toBe("Invalid trip data");
        expect((error as ApiError).detail).toBe("Validation failed");
      }
    });

    it("uses default message on 409 when server response has no title", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ detail: "Duplicate entry" }),
      });

      try {
        await api.trips.update("1", { name: "Existing" });
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(409);
        expect((error as ApiError).message).toBe("Duplicate trip name");
        expect((error as ApiError).detail).toBe("Duplicate entry");
      }
    });

    it("uses default message when server response has no title", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      });

      await expect(api.trips.update("1", { name: "Test" })).rejects.toThrow("Failed to update trip");
    });

    it("handles JSON parse error in error response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => { throw new Error("JSON parse error"); },
      });

      await expect(api.trips.update("1", { name: "Test" })).rejects.toThrow("Failed to update trip");
    });
  });

  describe("api.locations.search", () => {
    it("returns filtered locations matching query by code", () => {
      const results = api.locations.search("SFO");

      expect(results.length).toBeGreaterThan(0);
      expect(results.map(r => r.code)).toContain("SFO");
    });

    it("returns filtered locations matching query by name", () => {
      const results = api.locations.search("Heathrow");

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.code === "LHR")).toBe(true);
      expect(results.some(r => r.name.includes("Heathrow"))).toBe(true);
    });

    it("returns filtered locations matching query by city", () => {
      const results = api.locations.search("Tokyo");

      // Tokyo has multiple airports in the static data
      expect(results.length).toBeGreaterThan(0);
      const codes = results.map(r => r.code);
      // At least one Tokyo airport should be in results
      expect(codes.some(code => ["NRT", "HND", "TYO"].includes(code))).toBe(true);
    });

    it("returns empty array when no locations match", () => {
      const results = api.locations.search("ZZZZZ");

      expect(results).toEqual([]);
    });

    it("returns empty array when query is too short", () => {
      const results = api.locations.search("S");

      expect(results).toEqual([]);
    });

    it("limits results to 8 items", () => {
      // Search for something common that will return many results
      const results = api.locations.search("air");

      expect(results.length).toBeLessThanOrEqual(8);
    });

    it("performs case-insensitive search", () => {
      const results = api.locations.search("sfo");

      expect(results.length).toBeGreaterThan(0);
      expect(results.map(r => r.code)).toContain("SFO");
    });

    it("all results have type AIRPORT", () => {
      const results = api.locations.search("Los Angeles");

      expect(results.length).toBeGreaterThan(0);
      for (const result of results) {
        expect(result.type).toBe("AIRPORT");
      }
    });
  });

  describe("api.trips.list", () => {
    it("lists trips successfully", async () => {
      const mockResponse = {
        data: [
          { id: "1", name: "Trip 1", status: "active" },
          { id: "2", name: "Trip 2", status: "paused" },
        ],
        meta: { page: 1, total: 2 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await api.trips.list();

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://localhost:8000/v1/trips?page=1&limit=20",
        expect.objectContaining({
          credentials: "include",
        })
      );
    });

    it("passes pagination parameters", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [], meta: { page: 2, total: 0 } }),
      });

      await api.trips.list(2, 10);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://localhost:8000/v1/trips?page=2&limit=10",
        expect.any(Object)
      );
    });

    it("passes status filter when provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [], meta: { page: 1, total: 0 } }),
      });

      await api.trips.list(1, 20, "active");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://localhost:8000/v1/trips?page=1&limit=20&status=active",
        expect.any(Object)
      );
    });

    it("throws ApiError on server error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ title: "Server Error", detail: "Database connection failed" }),
      });

      try {
        await api.trips.list();
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(500);
        expect((error as ApiError).message).toBe("Server Error");
        expect((error as ApiError).detail).toBe("Database connection failed");
      }
    });

    it("uses default message when server response has no title", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      });

      await expect(api.trips.list()).rejects.toThrow("Failed to load trips");
    });

    it("handles JSON parse error in error response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => { throw new Error("JSON parse error"); },
      });

      await expect(api.trips.list()).rejects.toThrow("Failed to load trips");
    });
  });

  describe("api.trips.create", () => {
    const validTripData = {
      name: "Test Trip",
      origin_airport: "SFO",
      destination_code: "LAX",
      is_round_trip: true,
      depart_date: "2025-06-01",
      return_date: "2025-06-08",
      adults: 2,
      flight_prefs: null,
      hotel_prefs: null,
      notification_prefs: {
        threshold_type: "trip_total" as const,
        threshold_value: 1000,
        notify_without_threshold: false,
        email_enabled: true,
        sms_enabled: false,
      },
    };

    it("creates a trip successfully", async () => {
      const mockResponse = { data: { id: "trip-1", ...validTripData } };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockResponse,
      });

      const result = await api.trips.create(validTripData, "idempotency-key-123");

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://localhost:8000/v1/trips",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-Idempotency-Key": "idempotency-key-123",
          },
          body: JSON.stringify(validTripData),
        })
      );
    });

    it("throws ApiError on 400 with detail from server", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ title: "Validation Error", detail: "Name is required" }),
      });

      try {
        await api.trips.create(validTripData, "key");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(400);
        expect((error as ApiError).message).toBe("Validation Error");
        expect((error as ApiError).detail).toBe("Name is required");
      }
    });

    it("throws ApiError on 409 duplicate request", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ title: "Duplicate Request", detail: "Request already processed" }),
      });

      try {
        await api.trips.create(validTripData, "duplicate-key");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(409);
        expect((error as ApiError).message).toBe("Duplicate Request");
      }
    });

    it("uses default message on 400 when no title", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({}),
      });

      await expect(api.trips.create(validTripData, "key")).rejects.toThrow("Invalid trip data");
    });

    it("uses default message on 409 when no title", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({}),
      });

      await expect(api.trips.create(validTripData, "key")).rejects.toThrow("Duplicate request");
    });

    it("throws generic ApiError for other errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ title: "Server Error", detail: "Database down" }),
      });

      try {
        await api.trips.create(validTripData, "key");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(500);
        expect((error as ApiError).message).toBe("Server Error");
      }
    });

    it("uses default message when server response has no title", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      });

      await expect(api.trips.create(validTripData, "key")).rejects.toThrow("Failed to create trip");
    });

    it("handles JSON parse error in error response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => { throw new Error("JSON parse error"); },
      });

      await expect(api.trips.create(validTripData, "key")).rejects.toThrow("Failed to create trip");
    });
  });

  describe("api.trips.refreshAll", () => {
    it("starts refresh successfully", async () => {
      const mockResponse = { data: { refresh_group_id: "refresh-123", trip_count: 5 } };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await api.trips.refreshAll();

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://localhost:8000/v1/trips/refresh-all",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
        })
      );
    });

    it("throws ApiError on 409 refresh in progress", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ title: "Conflict", detail: "A refresh is already in progress" }),
      });

      try {
        await api.trips.refreshAll();
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(409);
        expect((error as ApiError).message).toBe("Conflict");
      }
    });

    it("uses default message on 409 when no title", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({}),
      });

      await expect(api.trips.refreshAll()).rejects.toThrow("Refresh already in progress");
    });

    it("throws ApiError on 502 workflow failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => ({ title: "Bad Gateway", detail: "Temporal workflow failed" }),
      });

      try {
        await api.trips.refreshAll();
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(502);
        expect((error as ApiError).message).toBe("Bad Gateway");
      }
    });

    it("uses default message on 502 when no title", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => ({}),
      });

      await expect(api.trips.refreshAll()).rejects.toThrow("Failed to start refresh workflow");
    });

    it("throws generic ApiError for other errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ title: "Server Error", detail: "Internal error" }),
      });

      try {
        await api.trips.refreshAll();
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(500);
        expect((error as ApiError).message).toBe("Server Error");
      }
    });

    it("uses default message when server response has no title", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      });

      await expect(api.trips.refreshAll()).rejects.toThrow("Failed to start refresh");
    });

    it("handles JSON parse error in error response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => { throw new Error("JSON parse error"); },
      });

      await expect(api.trips.refreshAll()).rejects.toThrow("Failed to start refresh");
    });
  });

  describe("api.trips.getRefreshStatus", () => {
    it("returns refresh status successfully", async () => {
      const mockResponse = {
        data: {
          refresh_group_id: "refresh-123",
          status: "completed",
          total_trips: 5,
          completed_trips: 5,
          failed_trips: 0,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await api.trips.getRefreshStatus("refresh-123");

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://localhost:8000/v1/trips/refresh-status?refresh_group_id=refresh-123",
        expect.objectContaining({
          credentials: "include",
        })
      );
    });

    it("encodes refresh group id in URL", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: {} }),
      });

      await api.trips.getRefreshStatus("id with spaces");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://localhost:8000/v1/trips/refresh-status?refresh_group_id=id%20with%20spaces",
        expect.any(Object)
      );
    });

    it("throws ApiError on 404 when refresh group not found", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ title: "Not Found", detail: "Refresh group not found" }),
      });

      try {
        await api.trips.getRefreshStatus("invalid-id");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(404);
        expect((error as ApiError).message).toBe("Not Found");
      }
    });

    it("uses default message on 404 when no title", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({}),
      });

      await expect(api.trips.getRefreshStatus("invalid")).rejects.toThrow("Refresh group not found");
    });

    it("throws generic ApiError for other errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ title: "Server Error", detail: "Database error" }),
      });

      try {
        await api.trips.getRefreshStatus("id");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(500);
        expect((error as ApiError).message).toBe("Server Error");
      }
    });

    it("uses default message when server response has no title", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      });

      await expect(api.trips.getRefreshStatus("id")).rejects.toThrow("Failed to get refresh status");
    });

    it("handles JSON parse error in error response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => { throw new Error("JSON parse error"); },
      });

      await expect(api.trips.getRefreshStatus("id")).rejects.toThrow("Failed to get refresh status");
    });
  });

  describe("api.trips.delete", () => {
    it("deletes trip successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      await api.trips.delete("1");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://localhost:8000/v1/trips/1",
        expect.objectContaining({
          method: "DELETE",
          credentials: "include",
        })
      );
    });

    it("throws ApiError when trip not found", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({}),
      });

      await expect(api.trips.delete("invalid")).rejects.toThrow("Trip not found");
    });

    it("throws ApiError with detail from server response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ title: "Forbidden", detail: "Cannot delete active trip" }),
      });

      try {
        await api.trips.delete("1");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(403);
        expect((error as ApiError).message).toBe("Forbidden");
        expect((error as ApiError).detail).toBe("Cannot delete active trip");
      }
    });

    it("uses default message when server response has no title", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      });

      await expect(api.trips.delete("1")).rejects.toThrow("Failed to delete trip");
    });

    it("handles JSON parse error in error response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => { throw new Error("JSON parse error"); },
      });

      await expect(api.trips.delete("1")).rejects.toThrow("Failed to delete trip");
    });
  });

  describe("api.trips.refresh", () => {
    it("triggers refresh successfully", async () => {
      const mockResponse = { data: { refresh_group_id: "refresh-trip-123" } };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await api.trips.refresh("trip-123");

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://localhost:8000/v1/trips/trip-123/refresh",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
        })
      );
    });

    it("throws ApiError when trip not found", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({}),
      });

      await expect(api.trips.refresh("invalid")).rejects.toThrow("Trip not found");
    });

    it("throws ApiError on 502 workflow failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => ({ title: "Bad Gateway", detail: "Temporal workflow failed" }),
      });

      try {
        await api.trips.refresh("1");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(502);
        expect((error as ApiError).message).toBe("Bad Gateway");
      }
    });

    it("uses default message on 502 when no title", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => ({}),
      });

      await expect(api.trips.refresh("1")).rejects.toThrow("Failed to start refresh workflow");
    });

    it("throws generic ApiError for other errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ title: "Server Error", detail: "Internal error" }),
      });

      try {
        await api.trips.refresh("1");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(500);
        expect((error as ApiError).message).toBe("Server Error");
      }
    });

    it("uses default message when server response has no title", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      });

      await expect(api.trips.refresh("1")).rejects.toThrow("Failed to start refresh");
    });

    it("handles JSON parse error in error response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => { throw new Error("JSON parse error"); },
      });

      await expect(api.trips.refresh("1")).rejects.toThrow("Failed to start refresh");
    });
  });

  describe("CSRF token handling", () => {
    it("adds CSRF token header to POST requests when cookie exists", async () => {
      setCookie("csrf_token", "test-csrf-token");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: {} }),
      });

      await api.trips.refreshAll();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "POST",
          headers: expect.any(Headers),
        })
      );

      // Verify the CSRF header was added
      const callArgs = mockFetch.mock.calls[0][1];
      const headers = callArgs.headers as Headers;
      expect(headers.get("X-CSRF-Token")).toBe("test-csrf-token");
    });

    it("adds CSRF token header to PATCH requests when cookie exists", async () => {
      setCookie("csrf_token", "test-csrf-token");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      await api.trips.updateStatus("1", "paused");

      const callArgs = mockFetch.mock.calls[0][1];
      const headers = callArgs.headers as Headers;
      expect(headers.get("X-CSRF-Token")).toBe("test-csrf-token");
    });

    it("adds CSRF token header to DELETE requests when cookie exists", async () => {
      setCookie("csrf_token", "test-csrf-token");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      await api.trips.delete("1");

      const callArgs = mockFetch.mock.calls[0][1];
      const headers = callArgs.headers as Headers;
      expect(headers.get("X-CSRF-Token")).toBe("test-csrf-token");
    });

    it("does not add CSRF token header to GET requests", async () => {
      setCookie("csrf_token", "test-csrf-token");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      });

      await api.trips.list();

      // GET requests should not have CSRF header added
      const callArgs = mockFetch.mock.calls[0][1];
      // For GET, we might not even have a Headers object, or it won't have CSRF
      if (callArgs.headers instanceof Headers) {
        expect(callArgs.headers.has("X-CSRF-Token")).toBe(false);
      }
    });

    it("does not overwrite existing CSRF token header", async () => {
      setCookie("csrf_token", "cookie-token");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: {} }),
      });

      // Make request with pre-set header
      await fetchWithAuth("/v1/test", {
        method: "POST",
        headers: {
          "X-CSRF-Token": "existing-token",
        },
      });

      const callArgs = mockFetch.mock.calls[0][1];
      const headers = callArgs.headers as Headers;
      expect(headers.get("X-CSRF-Token")).toBe("existing-token");
    });

    it("handles cookies with encoded values", async () => {
      setCookie("csrf_token", "token=with=equals");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: {} }),
      });

      await api.trips.refreshAll();

      const callArgs = mockFetch.mock.calls[0][1];
      const headers = callArgs.headers as Headers;
      expect(headers.get("X-CSRF-Token")).toBe("token=with=equals");
    });

    it("does not add CSRF header when cookie is not present", async () => {
      clearCookie();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: {} }),
      });

      await api.trips.refreshAll();

      const callArgs = mockFetch.mock.calls[0][1];
      // Headers should not contain X-CSRF-Token
      if (callArgs.headers instanceof Headers) {
        expect(callArgs.headers.has("X-CSRF-Token")).toBe(false);
      }
    });

    it("handles multiple cookies and finds the correct one", async () => {
      // Set multiple cookies
      Object.defineProperty(document, "cookie", {
        writable: true,
        value: "other_cookie=value1; csrf_token=the-right-token; another=value2",
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: {} }),
      });

      await api.trips.refreshAll();

      const callArgs = mockFetch.mock.calls[0][1];
      const headers = callArgs.headers as Headers;
      expect(headers.get("X-CSRF-Token")).toBe("the-right-token");
    });

    it("handles logout with CSRF token", async () => {
      setCookie("csrf_token", "logout-csrf-token");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      await api.auth.logout();

      const callArgs = mockFetch.mock.calls[0][1];
      const headers = callArgs.headers as Headers;
      expect(headers.get("X-CSRF-Token")).toBe("logout-csrf-token");
    });

  });
});
