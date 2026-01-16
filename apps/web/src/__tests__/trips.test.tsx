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
  content: "content",
  header: "header",
  title: "title",
  subtitle: "subtitle",
}));

describe("DashboardLayout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLogout.mockResolvedValue(undefined);
  });

  it("shows loading state while auth is loading", () => {
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

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("displays user email when authenticated", async () => {
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

    await waitFor(() => {
      expect(screen.getByText("Welcome, test@example.com")).toBeInTheDocument();
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

    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
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

    await user.click(screen.getByRole("button", { name: /sign out/i }));

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  it("redirects to login when not authenticated", () => {
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

    expect(mockPush).toHaveBeenCalledWith("/login");
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
