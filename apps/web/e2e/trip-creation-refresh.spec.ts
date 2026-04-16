import { test, expect } from "@playwright/test";

test.describe("Trip Creation and Price Refresh", () => {
  test("creates a trip, refreshes prices, and shows results", async ({ page }) => {
    // Navigate to create trip
    await page.goto("/trips/new");

    // Fill trip name (input#name)
    await page.locator("#name").fill("Paris Vacation E2E");

    // Fill origin airport using the autocomplete (input inside the origin section)
    const originInput = page.locator("#origin");
    await originInput.fill("SFO");
    // Wait for autocomplete suggestion and pick first option
    const originOption = page.locator("[role='option']").first();
    await originOption.waitFor({ timeout: 5_000 }).catch(() => null);
    if (await originOption.isVisible()) {
      await originOption.click();
    }

    // Fill destination airport
    const destInput = page.locator("#destination");
    await destInput.fill("CDG");
    const destOption = page.locator("[role='option']").first();
    await destOption.waitFor({ timeout: 5_000 }).catch(() => null);
    if (await destOption.isVisible()) {
      await destOption.click();
    }

    // Select departure date via the DatePicker button (Departure Date section)
    const departureDateBtn = page.getByRole("button", { name: /select departure/i });
    await departureDateBtn.click();
    // Click a future date in the calendar (find any date cell with a number)
    await page.locator("[role='gridcell'] button:not([disabled])").first().click();

    // Select return date
    const returnDateBtn = page.getByRole("button", { name: /select return/i });
    await returnDateBtn.click();
    await page.locator("[role='gridcell'] button:not([disabled])").last().click();

    // Submit the form
    await page.getByRole("button", { name: /create trip/i }).click();

    // Should redirect to trips page after successful creation
    await expect(page).toHaveURL(/\/trips/, { timeout: 15_000 });

    // The new trip should appear in the list — click it to navigate to detail
    const tripLink = page.locator("a[href*='/trips/']").first();
    await expect(tripLink).toBeVisible({ timeout: 10_000 });
    await tripLink.click();

    // Should be on trip detail page
    await expect(page).toHaveURL(/\/trips\/[a-f0-9-]+/);

    // Click refresh button to trigger price check
    const refreshButton = page.getByRole("button", { name: /refresh/i });
    await expect(refreshButton).toBeVisible();
    await refreshButton.click();

    // Wait for refresh to complete (button re-enables or loading stops)
    await expect(refreshButton).toBeEnabled({ timeout: 120_000 });

    // Assert flight section is visible
    await expect(page.getByText(/flight/i).first()).toBeVisible();

    // Assert hotel section is visible
    await expect(page.getByText(/hotel/i).first()).toBeVisible();
  });
});
