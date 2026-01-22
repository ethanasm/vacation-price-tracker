import { render, screen } from "@testing-library/react";
import DashboardPage from "./page";

// Mock next/navigation
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock("./page.module.css", () => ({
  pageHeader: "pageHeader",
  title: "title",
  columns: "columns",
  tablePanel: "tablePanel",
  tableWrapper: "tableWrapper",
  tripTable: "tripTable",
  clickableRow: "clickableRow",
  route: "route",
  routeArrow: "routeArrow",
  dates: "dates",
  price: "price",
  priceTotal: "priceTotal",
  timestamp: "timestamp",
  chatPanel: "chatPanel",
  chatPlaceholderIcon: "chatPlaceholderIcon",
  chatPlaceholderTitle: "chatPlaceholderTitle",
  chatPlaceholderText: "chatPlaceholderText",
  emptyState: "emptyState",
  emptyIcon: "emptyIcon",
  emptyTitle: "emptyTitle",
  emptyText: "emptyText",
  failedState: "failedState",
  failedIcon: "failedIcon",
  failedTitle: "failedTitle",
  failedText: "failedText",
  skeletonRow: "skeletonRow",
}));

describe("DashboardPage", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("renders the trips heading", () => {
    render(<DashboardPage />);

    expect(screen.getByRole("heading", { name: "Your Trips" })).toBeInTheDocument();
  });

  it("renders the refresh button", () => {
    render(<DashboardPage />);

    expect(screen.getByRole("button", { name: "Refresh All" })).toBeInTheDocument();
  });

  it("renders the trip table with mock data", () => {
    render(<DashboardPage />);

    // Check for mock trip names
    expect(screen.getByText("Orlando Family Vacation")).toBeInTheDocument();
    expect(screen.getByText("Hawaii Honeymoon")).toBeInTheDocument();
    expect(screen.getByText("NYC Weekend")).toBeInTheDocument();
  });

  it("renders the AI assistant placeholder", () => {
    render(<DashboardPage />);

    expect(screen.getByText("AI Assistant")).toBeInTheDocument();
    expect(screen.getByText(/Chat interface coming in Phase 2/)).toBeInTheDocument();
  });
});
