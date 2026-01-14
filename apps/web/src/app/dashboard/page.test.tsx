import { render, screen } from "@testing-library/react";
import DashboardPage from "./page";

// Mock CSS modules
jest.mock("./page.module.css", () => ({}));
jest.mock("../../components/SiteFooter.module.css", () => ({}));

describe("DashboardPage", () => {
  it("renders the dashboard heading", () => {
    render(<DashboardPage />);

    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  });

  it("renders the welcome message", () => {
    render(<DashboardPage />);

    expect(screen.getByText("Welcome! Your trips will appear here.")).toBeInTheDocument();
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
