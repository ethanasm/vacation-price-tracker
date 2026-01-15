import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HomePage from "./page";

const mockRedirectTo = jest.fn();

jest.mock("../app/page.module.css", () => ({}));
jest.mock("../lib/navigation", () => ({
  redirectTo: (url: string) => mockRedirectTo(url),
}));
jest.mock("../components/SignInCard", () => ({
  SignInCard: ({ onSignIn }: { onSignIn: () => void }) => (
    <div>
      <span>Sign in to start tracking</span>
      <button type="button" onClick={onSignIn}>
        Mock Sign In
      </button>
    </div>
  ),
}));
jest.mock("../components/SignInCard.module.css", () => ({}));
jest.mock("../components/SiteFooter.module.css", () => ({}));

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

  it("renders the SignInCard", () => {
    render(<HomePage />);

    expect(screen.getByText("Sign in to start tracking")).toBeInTheDocument();
  });

  it("renders the SiteFooter", () => {
    render(<HomePage />);

    expect(
      screen.getByText(
        "Track flight and hotel prices without the spreadsheet sprawl.",
      ),
    ).toBeInTheDocument();
  });

  it("redirects to google auth on sign in", async () => {
    const user = userEvent.setup();

    render(<HomePage />);

    await user.click(screen.getByRole("button", { name: "Mock Sign In" }));

    expect(mockRedirectTo).toHaveBeenCalledWith(
      "https://localhost:8000/v1/auth/google/start",
    );
  });
});
