import { render, screen } from "@testing-library/react";
import AccessDeniedPage from "../app/access-denied/page";

describe("AccessDeniedPage", () => {
  it("shows the allowlist denial message and a link home", () => {
    render(<AccessDeniedPage />);

    expect(
      screen.getByRole("heading", { name: /access denied/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/isn't on the allowlist/i),
    ).toBeInTheDocument();

    const back = screen.getByRole("link", { name: /back to sign in/i });
    expect(back).toHaveAttribute("href", "/");
  });
});
