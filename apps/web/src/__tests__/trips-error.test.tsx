import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TripsError from "../app/trips/error";

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
    const user = userEvent.setup();

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
});
