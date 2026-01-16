import { render, screen } from "@testing-library/react";
import DashboardPage from "./page";

jest.mock("./page.module.css", () => ({
  content: "content",
  header: "header",
  title: "title",
}));

describe("DashboardPage", () => {
  it("renders the trips heading", () => {
    render(<DashboardPage />);

    expect(screen.getByRole("heading", { name: "Your Trips" })).toBeInTheDocument();
  });

  it("renders the refresh button", () => {
    render(<DashboardPage />);

    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
  });

  it("renders empty state message", () => {
    render(<DashboardPage />);

    expect(
      screen.getByText("No trips yet. Create your first trip to start tracking prices."),
    ).toBeInTheDocument();
  });
});
