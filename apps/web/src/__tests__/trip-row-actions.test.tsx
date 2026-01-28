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
const mockUpdateStatus = jest.fn();

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
        updateStatus: (...args: unknown[]) => mockUpdateStatus(...args),
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
  tripStatus: "ACTIVE" as const,
  onRefresh: jest.fn(),
  onDeleted: jest.fn(),
  onStatusChange: jest.fn(),
  onUpdatedAtChange: jest.fn(),
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
      expect(screen.getByText("Pause")).toBeInTheDocument();
      expect(screen.getByText("Edit")).toBeInTheDocument();
      expect(screen.getByText("Delete")).toBeInTheDocument();
    });
  });

  it("shows Resume instead of Pause when trip is paused", async () => {
    jest.useRealTimers();
    const user = userEvent.setup();
    render(
      <table><tbody><tr>
        <TripRowKebab {...defaultProps} tripStatus="PAUSED" />
      </tr></tbody></table>
    );
    await user.click(screen.getByLabelText("Trip actions"));
    await waitFor(() => {
      expect(screen.getByText("Resume")).toBeInTheDocument();
      expect(screen.queryByText("Pause")).not.toBeInTheDocument();
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

    // Poll completes and calls onRefresh + onUpdatedAtChange
    await waitFor(() => {
      expect(defaultProps.onUpdatedAtChange).toHaveBeenCalledWith("trip-1", expect.any(String));
      expect(defaultProps.onRefresh).toHaveBeenCalled();
    }, { timeout: 5000 });
  });

  it("handles poll error gracefully and calls onRefresh", async () => {
    jest.useRealTimers();
    const user = userEvent.setup();
    mockRefresh.mockResolvedValue({ data: { refresh_group_id: "rg-1" } });
    mockGetRefreshStatus.mockRejectedValue(new Error("Poll failed"));

    render(
      <table><tbody><tr>
        <TripRowKebab {...defaultProps} />
      </tr></tbody></table>
    );
    await user.click(screen.getByLabelText("Trip actions"));
    await waitFor(() => screen.getByText("Refresh"));
    await user.click(screen.getByText("Refresh"));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Refresh started");
    });

    // Poll fails, should still call onRefresh
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

  describe("pause/resume", () => {
    it("pauses an active trip", async () => {
      jest.useRealTimers();
      const user = userEvent.setup();
      mockUpdateStatus.mockResolvedValue(undefined);

      render(
        <table><tbody><tr>
          <TripRowKebab {...defaultProps} tripStatus="ACTIVE" />
        </tr></tbody></table>
      );
      await user.click(screen.getByLabelText("Trip actions"));
      await waitFor(() => screen.getByText("Pause"));
      await user.click(screen.getByText("Pause"));

      await waitFor(() => {
        expect(mockUpdateStatus).toHaveBeenCalledWith("trip-1", "paused");
        expect(defaultProps.onStatusChange).toHaveBeenCalledWith("trip-1", "PAUSED");
        expect(toast.success).toHaveBeenCalledWith("Trip paused");
      });
    });

    it("resumes a paused trip", async () => {
      jest.useRealTimers();
      const user = userEvent.setup();
      mockUpdateStatus.mockResolvedValue(undefined);

      render(
        <table><tbody><tr>
          <TripRowKebab {...defaultProps} tripStatus="PAUSED" />
        </tr></tbody></table>
      );
      await user.click(screen.getByLabelText("Trip actions"));
      await waitFor(() => screen.getByText("Resume"));
      await user.click(screen.getByText("Resume"));

      await waitFor(() => {
        expect(mockUpdateStatus).toHaveBeenCalledWith("trip-1", "active");
        expect(defaultProps.onStatusChange).toHaveBeenCalledWith("trip-1", "ACTIVE");
        expect(toast.success).toHaveBeenCalledWith("Trip resumed");
      });
    });

    it("shows error toast on pause ApiError", async () => {
      jest.useRealTimers();
      const user = userEvent.setup();
      mockUpdateStatus.mockRejectedValue(new ApiError(500, "Server error", "Cannot pause"));

      render(
        <table><tbody><tr>
          <TripRowKebab {...defaultProps} tripStatus="ACTIVE" />
        </tr></tbody></table>
      );
      await user.click(screen.getByLabelText("Trip actions"));
      await waitFor(() => screen.getByText("Pause"));
      await user.click(screen.getByText("Pause"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Cannot pause");
      });
    });

    it("shows generic error toast on pause non-ApiError", async () => {
      jest.useRealTimers();
      const user = userEvent.setup();
      mockUpdateStatus.mockRejectedValue(new Error("Network error"));

      render(
        <table><tbody><tr>
          <TripRowKebab {...defaultProps} tripStatus="ACTIVE" />
        </tr></tbody></table>
      );
      await user.click(screen.getByLabelText("Trip actions"));
      await waitFor(() => screen.getByText("Pause"));
      await user.click(screen.getByText("Pause"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to pause trip");
      });
    });

    it("shows generic error toast on resume non-ApiError", async () => {
      jest.useRealTimers();
      const user = userEvent.setup();
      mockUpdateStatus.mockRejectedValue(new Error("Network error"));

      render(
        <table><tbody><tr>
          <TripRowKebab {...defaultProps} tripStatus="PAUSED" />
        </tr></tbody></table>
      );
      await user.click(screen.getByLabelText("Trip actions"));
      await waitFor(() => screen.getByText("Resume"));
      await user.click(screen.getByText("Resume"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to resume trip");
      });
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
