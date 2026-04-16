import { test, expect, type Page } from "@playwright/test";

/**
 * Theme color expectations derived from apps/web/src/app/globals.css.
 *
 * body background-color comes from: background: hsl(var(--card))
 *   Light: --card: 0 0% 100%  → hsl(0, 0%, 100%) = rgb(255, 255, 255)
 *   Dark:  --card: 250 15% 10% → hsl(250, 15%, 10%) ≈ rgb(23, 22, 29)
 *
 * html.dark is detected by the `.dark` class on <html>.
 */
const LIGHT_BODY_BG = "rgb(255, 255, 255)";

type Mode = "light" | "dark";

function modeFor(testInfo: { project: { name: string } }): Mode {
  return testInfo.project.name === "dark" ? "dark" : "light";
}

async function assertLightMode(page: Page) {
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await expect(page.locator("body")).toHaveCSS("background-color", LIGHT_BODY_BG);
}

async function assertDarkMode(page: Page) {
  await expect(page.locator("html")).toHaveClass(/dark/);
  // Dark background should not equal the light white background
  const bgColor = await page
    .locator("body")
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bgColor).not.toBe(LIGHT_BODY_BG);
}

async function assertModeMatches(page: Page, mode: Mode) {
  if (mode === "dark") {
    await assertDarkMode(page);
  } else {
    await assertLightMode(page);
  }
}

async function openThemeMenu(page: Page) {
  const toggle = page.getByRole("button", { name: /toggle theme/i });
  await expect(toggle).toBeVisible({ timeout: 5_000 });
  await toggle.click();
}

async function toggleToDark(page: Page) {
  await openThemeMenu(page);
  await page.getByRole("menuitem", { name: /^dark$/i }).click();
  await expect(page.locator("html")).toHaveClass(/dark/, { timeout: 5_000 });
}

async function toggleToLight(page: Page) {
  await openThemeMenu(page);
  await page.getByRole("menuitem", { name: /^light$/i }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/, { timeout: 5_000 });
}

test.describe("Theme Validation", () => {
  // Each Playwright project (light/dark) runs every test below in that mode.
  // The app's "system" theme is time-based (dark 6pm–8am) and would make tests
  // flaky depending on wall-clock, so we explicitly seed `theme-mode` per project.
  test.beforeEach(async ({ context }, testInfo) => {
    const mode = modeFor(testInfo);
    await context.addInitScript((m) => {
      try {
        localStorage.setItem("theme-mode", m);
      } catch {}
    }, mode);
  });

  test("dashboard renders in the project's mode", async ({ page }, testInfo) => {
    const mode = modeFor(testInfo);
    await page.goto("/trips");
    await assertModeMatches(page, mode);

    // Cards (if any visible) should match the body background in light mode
    if (mode === "light") {
      const card = page.locator("[class*='card']").first();
      if (await card.isVisible()) {
        await expect(card).toHaveCSS("background-color", LIGHT_BODY_BG);
      }
    }
  });

  test("create trip page renders in the project's mode", async ({ page }, testInfo) => {
    const mode = modeFor(testInfo);
    await page.goto("/trips/new");
    await assertModeMatches(page, mode);

    // Form inputs should be visible regardless of theme
    await expect(page.locator("#name")).toBeVisible();
  });

  test("trip detail page respects the project's mode", async ({ page }, testInfo) => {
    const mode = modeFor(testInfo);
    // Navigate to trips list to find an existing trip detail link (UUID path,
    // excluding the "New Trip" button which links to /trips/new).
    await page.goto("/trips");
    const tripLink = page
      .locator("a[href*='/trips/']")
      .and(page.locator("a:not([href$='/new'])"))
      .first();
    if ((await tripLink.count()) > 0 && (await tripLink.isVisible())) {
      await tripLink.click();
      await expect(page).toHaveURL(/\/trips\/[a-f0-9-]+/);
      await assertModeMatches(page, mode);
    }
    // If no trips exist, the test is a no-op — the page-level mode is verified
    // by the other tests against /trips and /trips/new.
  });

  test("toggling theme switches modes correctly", async ({ page }, testInfo) => {
    const startingMode = modeFor(testInfo);
    await page.goto("/trips");
    await assertModeMatches(page, startingMode);

    // Toggle to the opposite mode and back, confirming each transition.
    if (startingMode === "light") {
      await toggleToDark(page);
      await assertDarkMode(page);
      await toggleToLight(page);
      await assertLightMode(page);
    } else {
      await toggleToLight(page);
      await assertLightMode(page);
      await toggleToDark(page);
      await assertDarkMode(page);
    }
  });

  test("css variables resolve to colors in the project's mode", async ({ page }, testInfo) => {
    const mode = modeFor(testInfo);
    await page.goto("/trips");
    await assertModeMatches(page, mode);

    const readVar = (name: string) =>
      page.evaluate(
        (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(),
        name,
      );

    // Tailwind v4 normalizes `hsl(...)` tokens to hex/rgb at build time, so we
    // assert the variables resolve to *some* color rather than matching the raw HSL string.
    const colorRegex = /^(#[0-9a-f]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))$/i;

    expect(await readVar("--color-primary")).toMatch(colorRegex);
    expect(await readVar("--color-background")).toMatch(colorRegex);
  });

  test("toggling between modes changes css variables", async ({ page }, testInfo) => {
    const startingMode = modeFor(testInfo);
    await page.goto("/trips");
    await assertModeMatches(page, startingMode);

    const readVar = (name: string) =>
      page.evaluate(
        (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(),
        name,
      );

    const startBg = await readVar("--color-background");
    const startPrimary = await readVar("--color-primary");

    if (startingMode === "light") {
      await toggleToDark(page);
    } else {
      await toggleToLight(page);
    }

    const endBg = await readVar("--color-background");
    const endPrimary = await readVar("--color-primary");

    expect(endBg).not.toBe(startBg);
    expect(endPrimary).not.toBe(startPrimary);
  });
});
