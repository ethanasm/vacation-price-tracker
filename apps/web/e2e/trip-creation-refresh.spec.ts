import { test, expect } from "@playwright/test";

test.describe("Trip Creation and Price Refresh", () => {
  test("creates a trip, refreshes prices, and shows results", async ({ page }, testInfo) => {
    // Navigate to create trip
    await page.goto("/trips/new");

    // Use a unique trip name per run/project so the (user_id, name) unique
    // constraint doesn't cause 409 Conflict between light/dark projects or repeats.
    const tripName = `Paris E2E ${testInfo.project.name} ${Date.now()}`;
    await page.locator("#name").fill(tripName);

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

    // Departure/Return dates are pre-filled with sensible defaults (tomorrow / +8 days),
    // so we don't need to interact with the date pickers. The test focuses on
    // trip creation + refresh, not date picking UX.

    // Submit the form
    await page.getByRole("button", { name: /create trip/i }).click();

    // Should redirect to /trips list after successful creation
    await expect(page).toHaveURL(/\/trips$/, { timeout: 15_000 });

    // The new trip should appear in the list — find by its unique name and click
    const tripLink = page.getByRole("link", { name: tripName });
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
