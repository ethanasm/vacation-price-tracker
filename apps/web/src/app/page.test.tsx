import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HomePage from "./page";

const mockRedirectTo = jest.fn();

jest.mock("./page.module.css", () => ({}));
jest.mock("../lib/navigation", () => ({
  redirectTo: (url: string) => mockRedirectTo(url),
}));

describe("HomePage", () => {
  beforeEach(() => {
    mockRedirectTo.mockClear();
  });

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

  it("renders the CTA card with Google sign-in button", () => {
    render(<HomePage />);

    expect(screen.getByText("Ready to get started?")).toBeInTheDocument();
    expect(
      screen.getByText("Sign in to create your first trip and start tracking prices."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
    expect(
      screen.getByText("Google OAuth only. We never store passwords."),
    ).toBeInTheDocument();
  });

  it("calls redirectTo when Google button is clicked", async () => {
    const user = userEvent.setup();

    render(<HomePage />);
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(mockRedirectTo).toHaveBeenCalledWith(
      "https://localhost:8000/v1/auth/google/start",
    );
  });
});
