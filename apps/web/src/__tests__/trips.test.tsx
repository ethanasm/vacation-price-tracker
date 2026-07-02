import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DashboardLayout from "../app/trips/layout";

// Mock next/navigation
const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
}));

// Mock useAuth hook
const mockLogout = jest.fn();
const mockUseAuth = jest.fn();

jest.mock("../context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock ThemeContext
jest.mock("../context/ThemeContext", () => ({
  useTheme: () => ({
    mode: "system",
    theme: "light",
    setMode: jest.fn(),
  }),
}));

// Mock CSS modules
jest.mock("../app/trips/page.module.css", () => ({
  main: "main",
  loadingState: "loadingState",
  header: "header",
  brandSection: "brandSection",
  brandIcon: "brandIcon",
  brandName: "brandName",
  userSection: "userSection",
  userCard: "userCard",
  avatar: "avatar",
  userDetails: "userDetails",
  greeting: "greeting",
  userName: "userName",
}));

// Mock PlaneLoader component
jest.mock("../components/ui/plane-loader", () => ({
  PlaneLoader: ({ message }: { message?: string }) => (
    <div data-testid="plane-loader">{message || "Loading..."}</div>
  ),
}));

describe("DashboardLayout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLogout.mockResolvedValue(undefined);
  });

  it("shows skeleton avatar while auth is loading", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: true,
      logout: mockLogout,
    });

    render(
      <DashboardLayout>
        <div>Child content</div>
      </DashboardLayout>,
    );

    // Shows skeleton avatar with "--" placeholder while loading
    expect(screen.getByText("--")).toBeInTheDocument();
    // Children are still rendered (loading state is handled by individual pages)
    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("displays user name when authenticated", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "123", email: "test.user@example.com" },
      isLoading: false,
      logout: mockLogout,
    });

    render(
      <DashboardLayout>
        <div>Child content</div>
      </DashboardLayout>,
    );

    await waitFor(() => {
      // getDisplayName converts "test.user" to "Test User"
      expect(screen.getByText("Test User")).toBeInTheDocument();
    });
  });

  it("shows Settings and Sign out in the account menu", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      user: { id: "123", email: "test@example.com" },
      isLoading: false,
      logout: mockLogout,
    });

    render(
      <DashboardLayout>
        <div>Child content</div>
      </DashboardLayout>,
    );

    await user.click(screen.getByTitle("Account menu"));

    expect(await screen.findByRole("menuitem", { name: /settings/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /sign out/i })).toBeInTheDocument();
  });

  it("navigates to settings from the account menu", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      user: { id: "123", email: "test@example.com" },
      isLoading: false,
      logout: mockLogout,
    });

    render(
      <DashboardLayout>
        <div>Child content</div>
      </DashboardLayout>,
    );

    await user.click(screen.getByTitle("Account menu"));
    await user.click(await screen.findByRole("menuitem", { name: /settings/i }));

    expect(mockPush).toHaveBeenCalledWith("/trips/settings");
  });

  it("calls logout and redirects when sign out clicked", async () => {
    const user = userEvent.setup();

    mockUseAuth.mockReturnValue({
      user: { id: "123", email: "test@example.com" },
      isLoading: false,
      logout: mockLogout,
    });

    render(
      <DashboardLayout>
        <div>Child content</div>
      </DashboardLayout>,
    );

    await user.click(screen.getByTitle("Account menu"));
    await user.click(await screen.findByRole("menuitem", { name: /sign out/i }));

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  it("clears the dead session and returns to landing when auth resolves signed-out", async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      logout: mockLogout,
    });

    render(
      <DashboardLayout>
        <div>Child content</div>
      </DashboardLayout>,
    );

    // Component shows the skeleton shell while the self-heal kicks in
    expect(screen.getByText("--")).toBeInTheDocument();

    // The middleware let the request through on a cookie the server had
    // revoked; the layout clears it and sends the visitor back to landing.
    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith("/");
    });
  });

  it("returns to landing even when the logout call fails", async () => {
    mockLogout.mockRejectedValue(new Error("network down"));
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      logout: mockLogout,
    });

    render(
      <DashboardLayout>
        <div>Child content</div>
      </DashboardLayout>,
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/");
    });
  });

  it("does not self-heal while auth is still loading", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: true,
      logout: mockLogout,
    });

    render(
      <DashboardLayout>
        <div>Child content</div>
      </DashboardLayout>,
    );

    expect(mockLogout).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("renders children when authenticated", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "123", email: "test@example.com" },
      isLoading: false,
      logout: mockLogout,
    });

    render(
      <DashboardLayout>
        <div>Child content</div>
      </DashboardLayout>,
    );

    expect(screen.getByText("Child content")).toBeInTheDocument();
  });
});
