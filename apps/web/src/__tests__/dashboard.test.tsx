import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DashboardPage from "../app/dashboard/page";

// Mock next/navigation
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock useAuth hook
const mockLogout = jest.fn();
const mockUseAuth = jest.fn();

jest.mock("../context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock CSS modules
jest.mock("../app/dashboard/page.module.css", () => ({
  main: "main",
  content: "content",
  header: "header",
  title: "title",
  subtitle: "subtitle",
  footerWrap: "footerWrap",
}));

// Mock SiteFooter
jest.mock("../components/SiteFooter", () => ({
  SiteFooter: () => <footer data-testid="site-footer">Footer</footer>,
}));

describe("Dashboard Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLogout.mockResolvedValue(undefined);
  });

  it("shows loading spinner while auth is loading", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: true,
      logout: mockLogout,
    });

    render(<DashboardPage />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("displays user email when authenticated", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "123", email: "test@example.com" },
      isLoading: false,
      logout: mockLogout,
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/Welcome, test@example.com!/)).toBeInTheDocument();
    });
  });

  it("renders sign out button", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "123", email: "test@example.com" },
      isLoading: false,
      logout: mockLogout,
    });

    render(<DashboardPage />);

    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });

  it("calls logout when sign out button clicked", async () => {
    const user = userEvent.setup();

    mockUseAuth.mockReturnValue({
      user: { id: "123", email: "test@example.com" },
      isLoading: false,
      logout: mockLogout,
    });

    render(<DashboardPage />);

    await user.click(screen.getByRole("button", { name: /sign out/i }));

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });
});
