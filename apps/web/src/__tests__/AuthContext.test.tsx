import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { api, AuthError } from "../lib/api";

// Mock the api module
jest.mock("../lib/api", () => ({
  api: {
    auth: {
      me: jest.fn(),
      logout: jest.fn(),
    },
  },
  AuthError: class AuthError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "AuthError";
    }
  },
}));

const mockAuthMe = api.auth.me as jest.MockedFunction<typeof api.auth.me>;
const mockAuthLogout = api.auth.logout as jest.MockedFunction<typeof api.auth.logout>;

// Test component that uses the auth context
function TestConsumer() {
  const { user, isLoading, isAuthenticated, logout, refreshUser } = useAuth();

  return (
    <div>
      <span data-testid="loading">{isLoading.toString()}</span>
      <span data-testid="authenticated">{isAuthenticated.toString()}</span>
      <span data-testid="email">{user?.email || "none"}</span>
      <button type="button" onClick={logout}>
        Logout
      </button>
      <button type="button" onClick={refreshUser}>
        Refresh
      </button>
    </div>
  );
}

describe("AuthContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("AuthProvider", () => {
    it("fetches user on mount", async () => {
      const mockUser = { id: "123", email: "test@example.com" };
      mockAuthMe.mockResolvedValueOnce(mockUser);

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(mockAuthMe).toHaveBeenCalledTimes(1);
      });
    });

    it("sets isLoading true during fetch", async () => {
      // Create a promise we can control
      let resolveMe: ((value: { id: string; email: string }) => void) | undefined;
      const mePromise = new Promise<{ id: string; email: string }>((resolve) => {
        resolveMe = resolve;
      });
      mockAuthMe.mockReturnValueOnce(mePromise);

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      // Initially loading
      expect(screen.getByTestId("loading")).toHaveTextContent("true");

      // Resolve the promise
      await act(async () => {
        resolveMe?.({ id: "123", email: "test@example.com" });
      });

      // No longer loading
      await waitFor(() => {
        expect(screen.getByTestId("loading")).toHaveTextContent("false");
      });
    });

    it("sets isAuthenticated true when user exists", async () => {
      const mockUser = { id: "123", email: "test@example.com" };
      mockAuthMe.mockResolvedValueOnce(mockUser);

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
        expect(screen.getByTestId("email")).toHaveTextContent("test@example.com");
      });
    });

    it("sets isAuthenticated false when no user", async () => {
      mockAuthMe.mockRejectedValueOnce(new AuthError("Not authenticated"));

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
        expect(screen.getByTestId("email")).toHaveTextContent("none");
      });
    });

    it("logs unexpected errors and clears user", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      mockAuthMe.mockRejectedValueOnce(new Error("Unexpected failure"));

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          "Unexpected error fetching user:",
          expect.any(Error),
        );
        expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
        expect(screen.getByTestId("email")).toHaveTextContent("none");
      });

      consoleSpy.mockRestore();
    });
  });

  describe("useAuth hook", () => {
    it("throws error when used outside provider", () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      expect(() => {
        render(<TestConsumer />);
      }).toThrow("useAuth must be used within an AuthProvider");

      consoleSpy.mockRestore();
    });

    it("returns auth context values", async () => {
      const mockUser = { id: "123", email: "test@example.com" };
      mockAuthMe.mockResolvedValueOnce(mockUser);

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading")).toHaveTextContent("false");
        expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
        expect(screen.getByTestId("email")).toHaveTextContent("test@example.com");
      });
    });
  });

  describe("logout", () => {
    it("calls api.auth.logout and clears user", async () => {
      const user = userEvent.setup();
      const mockUser = { id: "123", email: "test@example.com" };
      mockAuthMe.mockResolvedValueOnce(mockUser);
      mockAuthLogout.mockResolvedValueOnce(undefined);

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
      });

      // Click logout
      await user.click(screen.getByRole("button", { name: /logout/i }));

      await waitFor(() => {
        expect(mockAuthLogout).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
        expect(screen.getByTestId("email")).toHaveTextContent("none");
      });
    });
  });

  describe("refreshUser", () => {
    it("refetches user data", async () => {
      const user = userEvent.setup();
      const mockUser1 = { id: "123", email: "old@example.com" };
      const mockUser2 = { id: "123", email: "new@example.com" };

      mockAuthMe.mockResolvedValueOnce(mockUser1);

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByTestId("email")).toHaveTextContent("old@example.com");
      });

      // Setup mock for refresh
      mockAuthMe.mockResolvedValueOnce(mockUser2);

      // Click refresh
      await user.click(screen.getByRole("button", { name: /refresh/i }));

      await waitFor(() => {
        expect(mockAuthMe).toHaveBeenCalledTimes(2);
        expect(screen.getByTestId("email")).toHaveTextContent("new@example.com");
      });
    });
  });
});
