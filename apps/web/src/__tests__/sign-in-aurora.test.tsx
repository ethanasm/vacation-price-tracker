import { render, screen } from "@testing-library/react";
import HomePage from "@/app/page";

jest.mock("@/lib/navigation", () => ({ redirectTo: jest.fn() }));

describe("Sign-in (Aurora)", () => {
  it("renders the eyebrow, gradient H1 line, feature row, two stats, and the no-passwords caption", () => {
    render(<HomePage />);
    expect(screen.getByText("Date-Range Optimizer")).toBeInTheDocument();
    expect(screen.getByText(/vacation window/i)).toBeInTheDocument();
    expect(screen.getByText("Flights")).toBeInTheDocument();
    expect(screen.getByText("Hotels")).toBeInTheDocument();
    expect(screen.getByText(/Price alerts/i)).toBeInTheDocument();
    expect(screen.getByText("$186")).toBeInTheDocument();
    expect(screen.getByText("90+")).toBeInTheDocument();
    expect(screen.getByText(/never store passwords/i)).toBeInTheDocument();
  });
});
