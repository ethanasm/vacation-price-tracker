import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TripsError from "../app/trips/error";

// Mock next/navigation
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock CSS modules
jest.mock("../app/trips/page.module.css", () => ({
  errorState: "errorState",
  errorIcon: "errorIcon",
  errorTitle: "errorTitle",
  errorText: "errorText",
  errorActions: "errorActions",
  errorDetails: "errorDetails",
}));

const setNodeEnv = (value: string | undefined) => {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
};

describe("TripsError", () => {
  const mockReset = jest.fn();
  const mockError = new Error("Test error message") as Error & { digest?: string };

  // Suppress console.error during these tests
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalError;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockClear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders error message", () => {
    render(<TripsError error={mockError} reset={mockReset} />);

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(
      screen.getByText("We couldn't load your trips. This might be a temporary issue.")
    ).toBeInTheDocument();
  });

  it("renders Try again button", () => {
    render(<TripsError error={mockError} reset={mockReset} />);

    expect(screen.getByRole("button", { name: /Try again/i })).toBeInTheDocument();
  });

  it("renders Go home link", () => {
    render(<TripsError error={mockError} reset={mockReset} />);

    expect(screen.getByRole("link", { name: /Go home/i })).toBeInTheDocument();
  });

  it("calls reset when Try again button is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(<TripsError error={mockError} reset={mockReset} />);

    const tryAgainButton = screen.getByRole("button", { name: /Try again/i });
    await user.click(tryAgainButton);

    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it("Go home link points to root", () => {
    render(<TripsError error={mockError} reset={mockReset} />);

    const homeLink = screen.getByRole("link", { name: /Go home/i });
    expect(homeLink).toHaveAttribute("href", "/");
  });

  it("logs error to console on mount", () => {
    render(<TripsError error={mockError} reset={mockReset} />);

    expect(console.error).toHaveBeenCalledWith("Trips route error:", mockError);
  });

  it("shows error details in development mode", () => {
    const originalEnv = process.env.NODE_ENV;
    setNodeEnv("development");

    render(<TripsError error={mockError} reset={mockReset} />);

    expect(screen.getByText("Error details (development only)")).toBeInTheDocument();
    expect(screen.getByText("Test error message")).toBeInTheDocument();

    setNodeEnv(originalEnv);
  });

  it("hides error details in production mode", () => {
    const originalEnv = process.env.NODE_ENV;
    setNodeEnv("production");

    render(<TripsError error={mockError} reset={mockReset} />);

    expect(screen.queryByText("Error details (development only)")).not.toBeInTheDocument();

    setNodeEnv(originalEnv);
  });

  it("displays alert triangle icon", () => {
    render(<TripsError error={mockError} reset={mockReset} />);

    // The errorIcon div should contain the AlertTriangle icon
    const errorIconDiv = document.querySelector(".errorIcon");
    expect(errorIconDiv).toBeInTheDocument();
  });

  it("handles error with digest property", () => {
    const errorWithDigest = Object.assign(new Error("Error with digest"), {
      digest: "abc123",
    });

    render(<TripsError error={errorWithDigest} reset={mockReset} />);

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(console.error).toHaveBeenCalledWith("Trips route error:", errorWithDigest);
  });

  it("re-logs error when error prop changes", () => {
    const { rerender } = render(<TripsError error={mockError} reset={mockReset} />);

    expect(console.error).toHaveBeenCalledTimes(1);

    const newError = new Error("New error message") as Error & { digest?: string };
    rerender(<TripsError error={newError} reset={mockReset} />);

    expect(console.error).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenLastCalledWith("Trips route error:", newError);
  });

  it("renders RefreshCw and Home icons in buttons", () => {
    render(<TripsError error={mockError} reset={mockReset} />);

    // Check that buttons contain the expected SVG icons
    const tryAgainButton = screen.getByRole("button", { name: /Try again/i });
    const homeLink = screen.getByRole("link", { name: /Go home/i });

    expect(tryAgainButton.querySelector("svg")).toBeInTheDocument();
    expect(homeLink.querySelector("svg")).toBeInTheDocument();
  });

  describe("authentication error handling", () => {
    it("shows auth error UI for AuthError", () => {
      const authError = new Error("Session expired") as Error & { digest?: string };
      authError.name = "AuthError";

      render(<TripsError error={authError} reset={mockReset} />);

      expect(screen.getByText("Session Expired")).toBeInTheDocument();
      expect(
        screen.getByText(/Your session has expired. Please sign in again/)
      ).toBeInTheDocument();
    });

    it("shows auth error UI for ChatAuthError", () => {
      const chatAuthError = new Error("Authentication required") as Error & { digest?: string };
      chatAuthError.name = "ChatAuthError";

      render(<TripsError error={chatAuthError} reset={mockReset} />);

      expect(screen.getByText("Session Expired")).toBeInTheDocument();
    });

    it("shows auth error UI for 401 in error message", () => {
      const error401 = new Error("Request failed with status 401") as Error & { digest?: string };

      render(<TripsError error={error401} reset={mockReset} />);

      expect(screen.getByText("Session Expired")).toBeInTheDocument();
    });

    it("shows auth error UI for session expired message", () => {
      const expiredError = new Error("Session expired. Please sign in again.") as Error & { digest?: string };

      render(<TripsError error={expiredError} reset={mockReset} />);

      expect(screen.getByText("Session Expired")).toBeInTheDocument();
    });

    it("shows auth error UI for unauthorized message", () => {
      const unauthorizedError = new Error("Unauthorized access") as Error & { digest?: string };

      render(<TripsError error={unauthorizedError} reset={mockReset} />);

      expect(screen.getByText("Session Expired")).toBeInTheDocument();
    });

    it("shows Sign in button for auth errors", () => {
      const authError = new Error("Unauthorized") as Error & { digest?: string };

      render(<TripsError error={authError} reset={mockReset} />);

      expect(screen.getByRole("link", { name: /Sign in/i })).toBeInTheDocument();
    });

    it("Sign in link points to home page", () => {
      const authError = new Error("Authentication failed") as Error & { digest?: string };

      render(<TripsError error={authError} reset={mockReset} />);

      const signInLink = screen.getByRole("link", { name: /Sign in/i });
      expect(signInLink).toHaveAttribute("href", "/");
    });

    it("does not show Try again button for auth errors", () => {
      const authError = new Error("Session expired") as Error & { digest?: string };
      authError.name = "AuthError";

      render(<TripsError error={authError} reset={mockReset} />);

      expect(screen.queryByRole("button", { name: /Try again/i })).not.toBeInTheDocument();
    });

    it("automatically redirects to home after 3 seconds for auth errors", () => {
      const authError = new Error("Unauthorized") as Error & { digest?: string };

      render(<TripsError error={authError} reset={mockReset} />);

      expect(mockPush).not.toHaveBeenCalled();

      jest.advanceTimersByTime(3000);

      expect(mockPush).toHaveBeenCalledWith("/");
    });

    it("does not auto-redirect for non-auth errors", () => {
      render(<TripsError error={mockError} reset={mockReset} />);

      jest.advanceTimersByTime(5000);

      expect(mockPush).not.toHaveBeenCalled();
    });

    it("clears timeout on unmount to prevent memory leak", () => {
      const authError = new Error("Unauthorized") as Error & { digest?: string };

      const { unmount } = render(<TripsError error={authError} reset={mockReset} />);

      unmount();

      jest.advanceTimersByTime(5000);

      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});
