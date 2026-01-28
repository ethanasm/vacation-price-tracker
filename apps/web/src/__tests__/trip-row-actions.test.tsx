import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";

// Mock next/navigation
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock sonner
jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock API
const mockRefresh = jest.fn();
const mockDelete = jest.fn();
const mockGetRefreshStatus = jest.fn();

jest.mock("../lib/api", () => {
  class ApiError extends Error {
    status: number;
    detail: string;
    constructor(status: number, message: string, detail?: string) {
      super(message);
      this.status = status;
      this.detail = detail || message;
    }
  }
  return {
    api: {
      trips: {
        refresh: (...args: unknown[]) => mockRefresh(...args),
        delete: (...args: unknown[]) => mockDelete(...args),
        getRefreshStatus: (...args: unknown[]) => mockGetRefreshStatus(...args),
      },
    },
    ApiError,
  };
});

import { ApiError } from "../lib/api";
import { TripRowKebab, TripRowContextMenu } from "../components/trip-row-actions";

// Mock UI table component
jest.mock("../components/ui/table", () => ({
  TableCell: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <td className={className}>{children}</td>
  ),
}));

const defaultProps = {
  tripId: "trip-1",
  tripName: "Test Trip",
  onRefresh: jest.fn(),
  onDeleted: jest.fn(),
};

describe("TripRowKebab", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders kebab menu button", () => {
    render(
      <table><tbody><tr>
        <TripRowKebab {...defaultProps} />
      </tr></tbody></table>
    );
    expect(screen.getByLabelText("Trip actions")).toBeInTheDocument();
  });

  it("opens dropdown and shows menu items on click", async () => {
    jest.useRealTimers();
    const user = userEvent.setup();
    render(
      <table><tbody><tr>
        <TripRowKebab {...defaultProps} />
      </tr></tbody></table>
    );
    await user.click(screen.getByLabelText("Trip actions"));
    await waitFor(() => {
      expect(screen.getByText("Refresh")).toBeInTheDocument();
      expect(screen.getByText("Edit")).toBeInTheDocument();
      expect(screen.getByText("Delete")).toBeInTheDocument();
    });
  });

  it("calls refresh and polls for completion", async () => {
    jest.useRealTimers();
    const user = userEvent.setup();
    mockRefresh.mockResolvedValue({ data: { refresh_group_id: "rg-1" } });
    mockGetRefreshStatus.mockResolvedValue({
      data: { status: "completed", total: 1, completed: 1, failed: 0 },
    });

    render(
      <table><tbody><tr>
        <TripRowKebab {...defaultProps} />
      </tr></tbody></table>
    );
    await user.click(screen.getByLabelText("Trip actions"));
    await waitFor(() => screen.getByText("Refresh"));
    await user.click(screen.getByText("Refresh"));

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalledWith("trip-1");
      expect(toast.success).toHaveBeenCalledWith("Refresh started");
    });

    // Poll completes and calls onRefresh
    await waitFor(() => {
      expect(defaultProps.onRefresh).toHaveBeenCalled();
    }, { timeout: 5000 });
  });

  it("shows error toast on refresh ApiError", async () => {
    jest.useRealTimers();
    const user = userEvent.setup();
    mockRefresh.mockRejectedValue(new ApiError(500, "Server error", "Refresh failed"));

    render(
      <table><tbody><tr>
        <TripRowKebab {...defaultProps} />
      </tr></tbody></table>
    );
    await user.click(screen.getByLabelText("Trip actions"));
    await waitFor(() => screen.getByText("Refresh"));
    await user.click(screen.getByText("Refresh"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Refresh failed");
    });
  });

  it("shows generic error toast on refresh non-ApiError", async () => {
    jest.useRealTimers();
    const user = userEvent.setup();
    mockRefresh.mockRejectedValue(new Error("Network error"));

    render(
      <table><tbody><tr>
        <TripRowKebab {...defaultProps} />
      </tr></tbody></table>
    );
    await user.click(screen.getByLabelText("Trip actions"));
    await waitFor(() => screen.getByText("Refresh"));
    await user.click(screen.getByText("Refresh"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to refresh trip");
    });
  });

  it("navigates to edit page on Edit click", async () => {
    jest.useRealTimers();
    const user = userEvent.setup();

    render(
      <table><tbody><tr>
        <TripRowKebab {...defaultProps} />
      </tr></tbody></table>
    );
    await user.click(screen.getByLabelText("Trip actions"));
    await waitFor(() => screen.getByText("Edit"));
    await user.click(screen.getByText("Edit"));

    expect(mockPush).toHaveBeenCalledWith("/trips/trip-1/edit");
  });

  it("shows delete dialog and deletes on confirm", async () => {
    jest.useRealTimers();
    const user = userEvent.setup();
    mockDelete.mockResolvedValue({});

    render(
      <table><tbody><tr>
        <TripRowKebab {...defaultProps} />
      </tr></tbody></table>
    );
    await user.click(screen.getByLabelText("Trip actions"));
    await waitFor(() => screen.getByText("Delete"));
    await user.click(screen.getByText("Delete"));

    await waitFor(() => {
      expect(screen.getByText("Delete this trip?")).toBeInTheDocument();
    });

    const confirmBtn = screen.getByRole("button", { name: "Delete" });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith("trip-1");
      expect(toast.success).toHaveBeenCalledWith("Trip deleted");
      expect(defaultProps.onDeleted).toHaveBeenCalled();
    });
  });

  it("shows error toast on delete ApiError", async () => {
    jest.useRealTimers();
    const user = userEvent.setup();
    mockDelete.mockRejectedValue(new ApiError(500, "Server error", "Delete failed"));

    render(
      <table><tbody><tr>
        <TripRowKebab {...defaultProps} />
      </tr></tbody></table>
    );
    await user.click(screen.getByLabelText("Trip actions"));
    await waitFor(() => screen.getByText("Delete"));
    await user.click(screen.getByText("Delete"));
    await waitFor(() => screen.getByText("Delete this trip?"));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Delete failed");
    });
  });

  it("shows generic error toast on delete non-ApiError", async () => {
    jest.useRealTimers();
    const user = userEvent.setup();
    mockDelete.mockRejectedValue(new Error("Network error"));

    render(
      <table><tbody><tr>
        <TripRowKebab {...defaultProps} />
      </tr></tbody></table>
    );
    await user.click(screen.getByLabelText("Trip actions"));
    await waitFor(() => screen.getByText("Delete"));
    await user.click(screen.getByText("Delete"));
    await waitFor(() => screen.getByText("Delete this trip?"));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to delete trip");
    });
  });
});

describe("TripRowContextMenu", () => {
  it("renders children", () => {
    render(
      <TripRowContextMenu {...defaultProps}>
        <div>Child content</div>
      </TripRowContextMenu>
    );
    expect(screen.getByText("Child content")).toBeInTheDocument();
  });
});
