import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CollapsibleSection } from "../components/trip-form/collapsible-section";

jest.mock("../components/trip-form/collapsible-section.module.css", () => new Proxy({}, {
  get: (_target, prop) => prop,
}));

describe("CollapsibleSection", () => {
  it("renders title, badge, and content", () => {
    render(
      <CollapsibleSection
        title="Flight Preferences"
        icon={<span>icon</span>}
        badge="Optional"
        isOpen
        onToggle={jest.fn()}
      >
        <div>Section Body</div>
      </CollapsibleSection>
    );

    expect(screen.getByText("Flight Preferences")).toBeInTheDocument();
    expect(screen.getByText("Optional")).toBeInTheDocument();
    expect(screen.getByText("Section Body")).toBeInTheDocument();
  });

  it("calls onToggle on click and Enter", async () => {
    const onToggle = jest.fn();
    const user = userEvent.setup();

    render(
      <CollapsibleSection
        title="Details"
        icon={<span>icon</span>}
        isOpen={false}
        onToggle={onToggle}
      >
        <div>Content</div>
      </CollapsibleSection>
    );

    const header = screen.getByRole("button");
    await user.click(header);
    fireEvent.keyDown(header, { key: "Enter" });

    expect(onToggle).toHaveBeenCalledTimes(2);
    expect(header).toHaveAttribute("aria-expanded", "false");
  });
});
