import { render, screen } from "@testing-library/react";
import DashboardPage from "./page";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

// Mock useAuth hook
jest.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "123", email: "test@example.com" },
    isLoading: false,
    logout: jest.fn(),
  }),
}));

// Mock CSS modules
jest.mock("./page.module.css", () => ({
  main: "main",
  content: "content",
  header: "header",
  title: "title",
  subtitle: "subtitle",
  footerWrap: "footerWrap",
}));
jest.mock("../../components/SiteFooter.module.css", () => ({}));

describe("DashboardPage", () => {
  it("renders the dashboard heading", () => {
    render(<DashboardPage />);

    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  });

  it("renders the welcome message with email", () => {
    render(<DashboardPage />);

    expect(screen.getByText(/Welcome, test@example.com!/)).toBeInTheDocument();
  });

  it("renders the SiteFooter", () => {
    render(<DashboardPage />);

    expect(
      screen.getByText("Track flight and hotel prices without the spreadsheet sprawl."),
    ).toBeInTheDocument();
  });

  it("renders as a main element", () => {
    render(<DashboardPage />);

    expect(screen.getByRole("main")).toBeInTheDocument();
  });
});
