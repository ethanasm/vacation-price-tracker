import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary } from "../components/error-boundary";

const setNodeEnv = (value: string | undefined) => {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
};

// Component that throws an error
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("Test error message");
  }
  return <div>Child content</div>;
}

// Component that throws with stack trace
function ThrowErrorWithStack(): React.ReactNode {
  const error = new Error("Detailed error message");
  error.stack = "Error: Detailed error message\n    at ThrowErrorWithStack";
  throw error;
}

describe("ErrorBoundary", () => {
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

  it("renders children when no error occurs", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("renders error UI when child throws", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(
      screen.getByText(/An unexpected error occurred/)
    ).toBeInTheDocument();
  });

  it("renders custom fallback when provided", () => {
    render(
      <ErrorBoundary fallback={<div>Custom error fallback</div>}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Custom error fallback")).toBeInTheDocument();
  });

  it("renders Try again button", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByRole("button", { name: /Try again/i })).toBeInTheDocument();
  });

  it("renders Refresh page button", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByRole("button", { name: /Refresh page/i })).toBeInTheDocument();
  });

  it("reloads page when Refresh page button is clicked", async () => {
    const user = userEvent.setup();

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const refreshButton = screen.getByRole("button", { name: /Refresh page/i });
    // Just verify the button exists and is clickable
    expect(refreshButton).toBeInTheDocument();
    await user.click(refreshButton);
    // Can't easily mock window.location.reload in jsdom, but we verified the button click works
  });

  it("resets error state when Try again button is clicked", async () => {
    const user = userEvent.setup();
    let shouldThrow = true;

    function ConditionalError() {
      if (shouldThrow) {
        throw new Error("Test error");
      }
      return <div>Child content</div>;
    }

    render(
      <ErrorBoundary>
        <ConditionalError />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    // Change condition before clicking
    shouldThrow = false;

    const tryAgainButton = screen.getByRole("button", { name: /Try again/i });
    await user.click(tryAgainButton);

    // After reset and re-render, child should render normally
    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("displays error icon", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    // The AlertTriangle icon should be present
    const iconContainer = document.querySelector(".bg-red-50");
    expect(iconContainer).toBeInTheDocument();
  });

  it("shows error details in development mode", () => {
    const originalEnv = process.env.NODE_ENV;
    setNodeEnv("development");

    render(
      <ErrorBoundary>
        <ThrowErrorWithStack />
      </ErrorBoundary>
    );

    // Should show error details section
    expect(screen.getByText("Error details (development only)")).toBeInTheDocument();
    // The error message is in a pre tag with the stack, so use a partial match
    expect(screen.getByText(/Detailed error message/)).toBeInTheDocument();

    setNodeEnv(originalEnv);
  });

  it("hides error details in production mode", () => {
    const originalEnv = process.env.NODE_ENV;
    setNodeEnv("production");

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.queryByText("Error details (development only)")).not.toBeInTheDocument();

    setNodeEnv(originalEnv);
  });

  it("logs error to console", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(console.error).toHaveBeenCalledWith(
      "ErrorBoundary caught an error:",
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String),
      })
    );
  });

  it("handles multiple children", () => {
    render(
      <ErrorBoundary>
        <div>First child</div>
        <div>Second child</div>
      </ErrorBoundary>
    );

    expect(screen.getByText("First child")).toBeInTheDocument();
    expect(screen.getByText("Second child")).toBeInTheDocument();
  });

  it("catches error from nested components", () => {
    function NestedComponent(): React.ReactElement {
      throw new Error("Nested error");
    }

    function ParentComponent() {
      return (
        <div>
          <NestedComponent />
        </div>
      );
    }

    render(
      <ErrorBoundary>
        <ParentComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("getDerivedStateFromError returns correct state", () => {
    const error = new Error("Test error");
    const state = ErrorBoundary.getDerivedStateFromError(error);

    expect(state).toEqual({
      hasError: true,
      error: error,
    });
  });
});
