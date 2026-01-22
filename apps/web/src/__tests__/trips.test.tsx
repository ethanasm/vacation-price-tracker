import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DashboardLayout from "../app/trips/layout";

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

  it("renders sign out button", () => {
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

    // Sign out button has title="Sign out"
    expect(screen.getByTitle("Sign out")).toBeInTheDocument();
  });

  it("calls logout and redirects when sign out button clicked", async () => {
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

    await user.click(screen.getByTitle("Sign out"));

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  it("shows skeleton avatar when not authenticated (middleware handles redirect)", () => {
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

    // Component shows skeleton avatar; middleware handles redirect to home
    expect(screen.getByText("--")).toBeInTheDocument();
    // Children are still rendered (middleware handles unauthenticated redirect at server level)
    expect(screen.getByText("Child content")).toBeInTheDocument();
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
