import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(
  join(__dirname, "..", "app", "globals.css"),
  "utf8",
);

describe("Aurora design tokens in globals.css", () => {
  it.each([
    ["--aurora-violet", "#7C3AED"],
    ["--aurora-violet-deep", "#6D28D9"],
    ["--aurora-pink", "#EC4899"],
    ["--aurora-cyan", "#22D3EE"],
    ["--aurora-page", "#FAF8FF"],
    ["--aurora-surface", "#F4F1FC"],
    ["--aurora-surface-2", "#F8F5FE"],
    ["--aurora-chip", "#EDE9FE"],
    ["--aurora-hairline", "#F1EEF8"],
    ["--aurora-selected-border", "#C9B8F5"],
    ["--aurora-ink", "#1A1A2E"],
    ["--aurora-success", "#059669"],
    ["--aurora-warn", "#9A7B18"],
    ["--aurora-layover", "#C98A3A"],
    ["--aurora-star", "#F5A623"],
  ])("defines %s = %s", (name, hex) => {
    const re = new RegExp(`${name}:\\s*${hex}`, "i");
    expect(css).toMatch(re);
  });

  it("defines the primary and total gradients", () => {
    expect(css).toMatch(/--aurora-grad-primary:\s*linear-gradient\(135deg,\s*#A78BFA,\s*#7C3AED\)/i);
    expect(css).toMatch(/--aurora-grad-total:\s*linear-gradient\(135deg,\s*#7C3AED,\s*#9333EA\)/i);
  });

  it("defines the card-on-canvas shadow", () => {
    expect(css).toMatch(/--aurora-shadow-card:\s*0 16px 50px rgba\(60,\s*40,\s*120,\s*\.13\)/i);
  });

  it.each([
    ".aurora-logo",
    ".aurora-avatar",
    ".aurora-total-card",
    ".aurora-chip-active",
    ".aurora-chip-paused",
    ".aurora-chip-nonstop",
    ".aurora-chip-stop",
    ".aurora-card",
    ".aurora-hairline",
    ".aurora-layover-pill",
  ])("defines utility class %s", (cls) => {
    expect(css).toContain(cls);
  });
});
