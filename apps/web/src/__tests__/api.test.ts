import { AuthError, ApiError, api, fetchWithAuth } from "../lib/api";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("API Client", () => {
  beforeEach(() => {
    mockFetch.mockClear();
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
});
