import { render, screen, fireEvent } from "@testing-library/react";
import { AirlineChip } from "@/components/aurora/airline-chip";

describe("AirlineChip", () => {
  it("renders the corpus carrier's logo from the Kiwi CDN", () => {
    const { container } = render(<AirlineChip carrierCode="AS" />);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("src", "https://images.kiwi.com/airlines/64x64/AS.png");
    expect(img).toHaveAttribute("referrerpolicy", "no-referrer");
  });

  it("falls back to the gradient monogram when the logo image errors", () => {
    const { container } = render(<AirlineChip carrierCode="AS" />);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    fireEvent.error(img as HTMLImageElement);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("AS")).toBeInTheDocument();
  });

  it("renders the monogram for a carrier outside the logo corpus", () => {
    const { container } = render(<AirlineChip carrierCode="ZZ" />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("ZZ")).toBeInTheDocument();
  });

  it("stacks a secondary chip behind the primary for multi-carrier offers", () => {
    const { container } = render(<AirlineChip carrierCode="UA" secondaryCode="AS" />);
    const srcs = Array.from(container.querySelectorAll("img")).map((i) => i.getAttribute("src"));
    expect(srcs).toEqual([
      "https://images.kiwi.com/airlines/64x64/AS.png",
      "https://images.kiwi.com/airlines/64x64/UA.png",
    ]);
  });
});
