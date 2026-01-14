import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignInCard } from "../components/SignInCard";

jest.mock("../components/SignInCard.module.css", () => ({}));

describe("SignInCard", () => {
  const mockSignInUrl = "https://example.com/auth/google/start";
  const mockOnSignIn = jest.fn();

  beforeEach(() => {
    mockOnSignIn.mockClear();
  });

  it("renders the sign in text", () => {
    render(<SignInCard signInUrl={mockSignInUrl} onSignIn={mockOnSignIn} />);

    expect(screen.getByText("Sign in to start tracking")).toBeInTheDocument();
    expect(
      screen.getByText("Google OAuth only. We never store passwords.")
    ).toBeInTheDocument();
  });

  it("calls onSignIn when Google button is clicked", async () => {
    const user = userEvent.setup();

    render(<SignInCard signInUrl={mockSignInUrl} onSignIn={mockOnSignIn} />);
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(mockOnSignIn).toHaveBeenCalledTimes(1);
  });

  it("renders the helper text", () => {
    render(<SignInCard signInUrl={mockSignInUrl} onSignIn={mockOnSignIn} />);

    expect(
      screen.getByText(
        "Scan thousands of flight and hotel combinations to find your cheapest vacation window."
      )
    ).toBeInTheDocument();
  });
});
