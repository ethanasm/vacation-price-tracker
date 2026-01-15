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

export interface User {
  id: string;
  email: string;
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
};
