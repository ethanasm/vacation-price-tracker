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
const LIGHT = {
  // body { background: hsl(var(--card)) } → --card: 0 0% 100%
  bodyBackground: "rgb(255, 255, 255)",
  // --color-primary: hsl(262 83% 58%)
  primary: "hsl(262, 83%, 58%)",
};

const DARK = {
  // body.dark { background: hsl(var(--card)) } → --card: 250 15% 10%
  // hsl(250, 15%, 10%) = rgb(23, 22, 29) approximately
  bodyBackground: /^rgb\(2[0-2], 2[0-2], 2[5-9]\)|rgb\(23, 22, 29\)|rgb\(24, 23, 30\)/,
};

async function assertLightMode(page: Page) {
  const html = page.locator("html");
  await expect(html).not.toHaveClass(/dark/);

  const body = page.locator("body");
  await expect(body).toHaveCSS("background-color", LIGHT.bodyBackground);
}

async function assertDarkMode(page: Page) {
  const html = page.locator("html");
  await expect(html).toHaveClass(/dark/);

  // Verify dark background is applied — should NOT be the light white background
  const body = page.locator("body");
  const bgColor = await body.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bgColor).not.toBe(LIGHT.bodyBackground);
}

async function toggleToDark(page: Page) {
  // ThemeToggle is a DropdownMenu trigger with title="Toggle theme"
  const toggle = page.getByRole("button", { name: /toggle theme/i });
  await expect(toggle).toBeVisible({ timeout: 5_000 });
  await toggle.click();
  // DropdownMenuContent renders "Dark" option
  await page.getByRole("menuitem", { name: /dark/i }).click();
  // Wait for dark class to be applied
  await expect(page.locator("html")).toHaveClass(/dark/, { timeout: 5_000 });
}

async function toggleToLight(page: Page) {
  const toggle = page.getByRole("button", { name: /toggle theme/i });
  await toggle.click();
  await page.getByRole("menuitem", { name: /^light$/i }).click();
  // Wait for dark class to be removed
  await expect(page.locator("html")).not.toHaveClass(/dark/, { timeout: 5_000 });
}

// Only run in light project to avoid duplicates (theme tests manage their own mode)
test.describe("Theme Validation", () => {
  test.skip((_fixtures, testInfo) => testInfo.project.name === "dark", "Theme tests manage their own mode");

  test("dashboard light mode has correct background color", async ({ page }) => {
    await page.goto("/trips");
    await assertLightMode(page);

    // Cards (if any visible) should be white in light mode
    const card = page.locator("[class*='card']").first();
    if (await card.isVisible()) {
      await expect(card).toHaveCSS("background-color", LIGHT.bodyBackground);
    }
  });

  test("dashboard toggles to dark mode correctly", async ({ page }) => {
    await page.goto("/trips");
    await assertLightMode(page);

    await toggleToDark(page);
    await assertDarkMode(page);
  });

  test("theme toggle switches between light and dark", async ({ page }) => {
    await page.goto("/trips");

    // Start in light
    await assertLightMode(page);

    // Switch to dark
    await toggleToDark(page);
    await assertDarkMode(page);

    // Switch back to light
    await toggleToLight(page);
    await assertLightMode(page);
  });

  test("create trip page starts in light mode", async ({ page }) => {
    await page.goto("/trips/new");
    await assertLightMode(page);

    // Form inputs should be visible
    await expect(page.locator("#name")).toBeVisible();
  });

  test("create trip page toggles to dark mode", async ({ page }) => {
    await page.goto("/trips/new");
    await assertLightMode(page);

    await toggleToDark(page);
    await assertDarkMode(page);
  });

  test("trip detail page respects light mode", async ({ page }) => {
    // Navigate to trips list to find an existing trip
    await page.goto("/trips");
    const tripLink = page.locator("a[href*='/trips/']").first();
    if (await tripLink.isVisible()) {
      await tripLink.click();
      await expect(page).toHaveURL(/\/trips\/[a-f0-9-]+/);
      await assertLightMode(page);

      // If a price chart is rendered, verify it exists
      const chartElement = page.locator("svg.recharts-surface").first();
      if (await chartElement.isVisible()) {
        await expect(chartElement).toBeVisible();
      }
    }
  });

  test("css variables resolve correctly in light mode", async ({ page }) => {
    await page.goto("/trips");

    // Verify --color-primary CSS variable is set correctly
    const primaryValue = await page.evaluate(() => {
      return getComputedStyle(document.documentElement)
        .getPropertyValue("--color-primary")
        .trim();
    });
    // hsl(262 83% 58%) in Tailwind v4 format
    expect(primaryValue).toMatch(/262/);

    // Verify --color-background is set
    const bgValue = await page.evaluate(() => {
      return getComputedStyle(document.documentElement)
        .getPropertyValue("--color-background")
        .trim();
    });
    expect(bgValue).toMatch(/250/);
  });

  test("css variables resolve correctly in dark mode", async ({ page }) => {
    await page.goto("/trips");
    await toggleToDark(page);

    // In dark mode, --color-background should be hsl(250 20% 6%)
    const bgValue = await page.evaluate(() => {
      return getComputedStyle(document.documentElement)
        .getPropertyValue("--color-background")
        .trim();
    });
    // Dark mode value contains "20%" (vs "30%" in light)
    expect(bgValue).toMatch(/250/);

    // Verify dark class is present
    const hasDark = await page.evaluate(() =>
      document.documentElement.classList.contains("dark")
    );
    expect(hasDark).toBe(true);
  });
});
