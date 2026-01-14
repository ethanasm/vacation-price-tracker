import { render, screen } from "@testing-library/react";
import { SiteFooter } from "../components/SiteFooter";

// Mock CSS modules
jest.mock("../components/SiteFooter.module.css", () => ({}));

describe("SiteFooter", () => {
  it("renders the footer tagline", () => {
    render(<SiteFooter />);

    expect(
      screen.getByText(
        "Track flight and hotel prices without the spreadsheet sprawl.",
      ),
    ).toBeInTheDocument();
  });

  it("renders as a footer element", () => {
    render(<SiteFooter />);

    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });
});
