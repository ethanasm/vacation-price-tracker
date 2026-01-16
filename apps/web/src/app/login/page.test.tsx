import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "./page";

const mockRedirectTo = jest.fn();

jest.mock("./page.module.css", () => ({}));
jest.mock("../../lib/navigation", () => ({
  redirectTo: (url: string) => mockRedirectTo(url),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    mockRedirectTo.mockClear();
  });

  it("renders the sign in text", () => {
    render(<LoginPage />);

    expect(screen.getByText("Sign in to start tracking")).toBeInTheDocument();
    expect(
      screen.getByText("Google OAuth only. We never store passwords."),
    ).toBeInTheDocument();
  });

  it("calls redirectTo when Google button is clicked", async () => {
    const user = userEvent.setup();

    render(<LoginPage />);
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(mockRedirectTo).toHaveBeenCalledWith(
      "https://localhost:8000/v1/auth/google/start",
    );
  });

  it("renders the helper text", () => {
    render(<LoginPage />);

    expect(
      screen.getByText(
        "Scan thousands of flight and hotel combinations to find your cheapest vacation window.",
      ),
    ).toBeInTheDocument();
  });
});
