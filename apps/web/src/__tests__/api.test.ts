import { AuthError, api, fetchWithAuth } from "../lib/api";

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
});
