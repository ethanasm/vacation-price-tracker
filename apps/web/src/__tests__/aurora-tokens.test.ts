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

describe("Aurora dark-theme token overrides (issue #34)", () => {
  // The dark overrides live in a `.dark { ... }` block. Grab the block that
  // redefines the Aurora token set so we assert against dark values, not the
  // unrelated legacy `.dark` block.
  const darkBlock =
    css.slice(css.indexOf("AURORA DARK THEME")) || css;

  it.each([
    ["--aurora-page", "#15121E"],
    ["--aurora-surface", "#211C30"],
    ["--aurora-surface-2", "#2A2440"],
    ["--aurora-chip", "#2F2552"],
    ["--aurora-card", "#1A1A2E"],
    ["--aurora-hairline", "#322B46"],
    ["--aurora-ink", "#F2EEFB"],
    ["--aurora-success", "#34D399"],
    ["--aurora-warn", "#E0B84A"],
    ["--aurora-on-chip", "#C9B6FF"],
    ["--aurora-violet-text", "#A78BFA"],
    ["--aurora-row-tint", "#211C30"],
  ])("dark block redefines %s = %s", (name, hex) => {
    expect(darkBlock).toMatch(new RegExp(`${name}:\\s*${hex}`, "i"));
  });

  it("keeps the light indirection defaults so light theme is unchanged", () => {
    expect(css).toMatch(
      /--aurora-on-chip:\s*var\(--aurora-violet-deep\)/i,
    );
    expect(css).toMatch(/--aurora-violet-text:\s*var\(--aurora-violet\)/i);
    expect(css).toMatch(/--aurora-row-tint:\s*#FBFAFF/i);
  });
});
