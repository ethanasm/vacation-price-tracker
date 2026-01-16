import { render, screen } from "@testing-library/react";
import HomePage from "./page";

jest.mock("./page.module.css", () => ({}));

describe("HomePage", () => {
  it("renders the main heading", () => {
    render(<HomePage />);

    expect(screen.getByText("Find Your Cheapest")).toBeInTheDocument();
    expect(screen.getByText("Vacation Window")).toBeInTheDocument();
  });

  it("renders the badge", () => {
    render(<HomePage />);

    expect(screen.getByText("Date-Range Optimizer")).toBeInTheDocument();
  });

  it("renders the tagline", () => {
    render(<HomePage />);

    expect(
      screen.getByText(
        "We scan every flight and hotel combination across your flexible dates to find when your entire trip costs the least.",
      ),
    ).toBeInTheDocument();
  });

  it("renders the feature items", () => {
    render(<HomePage />);

    expect(screen.getByText("Flight combinations")).toBeInTheDocument();
    expect(screen.getByText("Hotel matching")).toBeInTheDocument();
    expect(screen.getByText("Price alerts")).toBeInTheDocument();
  });

  it("renders the stats", () => {
    render(<HomePage />);

    expect(screen.getByText("$186")).toBeInTheDocument();
    expect(screen.getByText("avg. savings per trip")).toBeInTheDocument();
    expect(screen.getByText("90+")).toBeInTheDocument();
    expect(screen.getByText("date combinations checked")).toBeInTheDocument();
  });

  it("renders the CTA card with sign in link", () => {
    render(<HomePage />);

    expect(screen.getByText("Ready to get started?")).toBeInTheDocument();
    expect(
      screen.getByText("Sign in to create your first trip and start tracking prices."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute(
      "href",
      "/login",
    );
  });
});
