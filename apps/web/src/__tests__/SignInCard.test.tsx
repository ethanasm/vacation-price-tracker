import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignInCard } from "../components/SignInCard";

jest.mock("../components/SignInCard.module.css", () => ({}));

describe("SignInCard", () => {
  const mockSignInUrl = "https://example.com/auth/google/start";

  it("renders the sign in text", () => {
    render(<SignInCard signInUrl={mockSignInUrl} />);

    expect(screen.getByText("Sign in to start tracking")).toBeInTheDocument();
    expect(
      screen.getByText("Google OAuth only. We never store passwords.")
    ).toBeInTheDocument();
  });

  it("calls onNavigate with signInUrl when Google button is clicked", async () => {
    const mockNavigate = jest.fn();
    const user = userEvent.setup();

    render(<SignInCard signInUrl={mockSignInUrl} onNavigate={mockNavigate} />);
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(mockNavigate).toHaveBeenCalledWith(mockSignInUrl);
  });

  it("renders the helper text", () => {
    render(<SignInCard signInUrl={mockSignInUrl} />);

    expect(
      screen.getByText(
        "Scan thousands of flight and hotel combinations to find your cheapest vacation window."
      )
    ).toBeInTheDocument();
  });
});
