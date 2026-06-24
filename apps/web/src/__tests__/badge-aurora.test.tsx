import { render } from "@testing-library/react";
import { Badge } from "@/components/ui/badge";

describe("Badge Aurora variants", () => {
  it("active variant uses the violet chip class", () => {
    const { getByText } = render(<Badge variant="active">ACTIVE</Badge>);
    expect(getByText("ACTIVE")).toHaveClass("aurora-chip-active");
  });
  it("paused variant uses the amber chip class", () => {
    const { getByText } = render(<Badge variant="paused">PAUSED</Badge>);
    expect(getByText("PAUSED")).toHaveClass("aurora-chip-paused");
  });
  it("nonstop variant uses the green chip class", () => {
    const { getByText } = render(<Badge variant="nonstop">NON-STOP</Badge>);
    expect(getByText("NON-STOP")).toHaveClass("aurora-chip-nonstop");
  });
  it("stop variant uses the amber stop chip class", () => {
    const { getByText } = render(<Badge variant="stop">1 STOP</Badge>);
    expect(getByText("1 STOP")).toHaveClass("aurora-chip-stop");
  });
});
