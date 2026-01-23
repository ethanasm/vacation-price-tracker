/**
 * @jest-environment node
 *
 * This test file runs in Node environment (no jsdom) to test SSR-specific behavior
 * where `document` is undefined.
 */

// Mock fetch before importing the module
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Now import the module - document will be undefined in Node environment
import { fetchWithAuth } from "../lib/api";

describe("API Client SSR (Node environment)", () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it("handles POST requests without CSRF token when document is undefined", async () => {
    // Verify we're in Node environment where document is undefined
    expect(typeof document).toBe("undefined");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: {} }),
    });

    await fetchWithAuth("/v1/test", { method: "POST" });

    expect(mockFetch).toHaveBeenCalled();

    // No CSRF header should be present since document is undefined
    const callArgs = mockFetch.mock.calls[0][1];
    if (callArgs.headers instanceof Headers) {
      expect(callArgs.headers.has("X-CSRF-Token")).toBe(false);
    } else {
      // Headers might not be a Headers object, which is fine
      expect(callArgs.headers?.["X-CSRF-Token"]).toBeUndefined();
    }
  });

  it("handles DELETE requests without CSRF token when document is undefined", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
    });

    await fetchWithAuth("/v1/trips/1", { method: "DELETE" });

    expect(mockFetch).toHaveBeenCalled();

    const callArgs = mockFetch.mock.calls[0][1];
    if (callArgs.headers instanceof Headers) {
      expect(callArgs.headers.has("X-CSRF-Token")).toBe(false);
    }
  });

  it("handles PATCH requests without CSRF token when document is undefined", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    await fetchWithAuth("/v1/trips/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test" }),
    });

    expect(mockFetch).toHaveBeenCalled();

    const callArgs = mockFetch.mock.calls[0][1];
    if (callArgs.headers instanceof Headers) {
      expect(callArgs.headers.has("X-CSRF-Token")).toBe(false);
    }
  });
});
