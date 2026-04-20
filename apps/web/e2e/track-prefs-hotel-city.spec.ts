import { test, expect } from "@playwright/test";

test.describe("Trip tracking preferences and hotel city", () => {
  test("disables Create button when both tracking checkboxes are off", async ({
    page,
  }, testInfo) => {
    await page.goto("/trips/new");

    await page.locator("#name").fill(`NoTrack ${testInfo.project.name} ${Date.now()}`);

    const originInput = page.locator("#origin");
    await originInput.fill("SFO");
    const originOption = page.locator("[role='option']").first();
    await originOption.waitFor({ timeout: 5_000 }).catch(() => null);
    if (await originOption.isVisible()) await originOption.click();

    const destInput = page.locator("#destination");
    await destInput.fill("HNL");
    const destOption = page.locator("[role='option']").first();
    await destOption.waitFor({ timeout: 5_000 }).catch(() => null);
    if (await destOption.isVisible()) await destOption.click();

    // Expand Flight Preferences section to reveal the track checkbox
    await page.getByRole("button", { name: /flight preferences/i }).click();

    const flightCheckbox = page.getByRole("checkbox", {
      name: /track flight prices/i,
    });
    await expect(flightCheckbox).toBeVisible();
    await flightCheckbox.click(); // was on, turn off

    // Expand Hotel Preferences section to reveal the track checkbox
    await page.getByRole("button", { name: /hotel preferences/i }).click();

    const hotelCheckbox = page.getByRole("checkbox", {
      name: /track hotel prices/i,
    });
    await expect(hotelCheckbox).toBeVisible();
    await hotelCheckbox.click(); // was on, turn off

    const createButton = page.getByRole("button", { name: /create trip/i });
    await expect(createButton).toBeDisabled();
  });

  test("creates a hotels-only trip with a custom city", async ({
    page,
  }, testInfo) => {
    await page.goto("/trips/new");

    const tripName = `Hotels Only ${testInfo.project.name} ${Date.now()}`;
    await page.locator("#name").fill(tripName);

    const originInput = page.locator("#origin");
    await originInput.fill("SFO");
    const originOption = page.locator("[role='option']").first();
    await originOption.waitFor({ timeout: 5_000 }).catch(() => null);
    if (await originOption.isVisible()) await originOption.click();

    const destInput = page.locator("#destination");
    await destInput.fill("MCO");
    const destOption = page.locator("[role='option']").first();
    await destOption.waitFor({ timeout: 5_000 }).catch(() => null);
    if (await destOption.isVisible()) await destOption.click();

    // Expand Flight Preferences section and turn off flight tracking
    await page.getByRole("button", { name: /flight preferences/i }).click();
    await page.getByRole("checkbox", { name: /track flight prices/i }).click();

    // Expand Hotel Preferences section; hotel tracking is on by default
    await page.getByRole("button", { name: /hotel preferences/i }).click();

    // Set custom hotel city
    const cityInput = page.locator("#hotel-city");
    await expect(cityInput).toBeEnabled();
    await cityInput.fill("Downtown Orlando");

    const createButton = page.getByRole("button", { name: /create trip/i });
    await expect(createButton).toBeEnabled();
    await createButton.click();

    await expect(page).toHaveURL(/\/trips$/, { timeout: 15_000 });
    const tripLink = page.getByRole("link", { name: tripName });
    await expect(tripLink).toBeVisible({ timeout: 10_000 });
  });

  test("city field disables when Track Hotel Prices is unchecked", async ({
    page,
  }) => {
    await page.goto("/trips/new");

    // Expand Hotel Preferences section to access the city input and checkbox
    await page.getByRole("button", { name: /hotel preferences/i }).click();

    const cityInput = page.locator("#hotel-city");
    await expect(cityInput).toBeEnabled();

    await page.getByRole("checkbox", { name: /track hotel prices/i }).click();
    await expect(cityInput).toBeDisabled();
  });
});
