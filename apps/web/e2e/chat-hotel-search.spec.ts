import { test, expect } from "@playwright/test";

test.describe("Chat Hotel Search", () => {
  test("searches for hotels and displays results", async ({ page }) => {
    await page.goto("/trips");

    // Find chat input (textarea with aria-label from ChatInput component)
    const chatInput = page.getByRole("textbox", { name: /message input/i });
    await chatInput.fill("Find hotels in Paris June 15-18");
    await chatInput.press("Enter");

    // Wait for tool call indicator — tool name rendered as "Search Hotels" (snake_case→Title Case)
    await expect(
      page.getByText(/Search Hotels/i).first()
    ).toBeVisible({ timeout: 30_000 });

    // Wait for hotel results in LLM response
    await expect(
      page.getByText(/hotel/i).first()
    ).toBeVisible({ timeout: 60_000 });

    // Assert star rating or review info appears
    await expect(
      page.getByText(/star|\d+\s*★/i).first()
    ).toBeVisible({ timeout: 30_000 });

    // Assert price per night appears
    await expect(
      page.getByText(/\$[\d,.]+\s*(\/night|per night)/i).first()
    ).toBeVisible({ timeout: 30_000 });

    // Assert booking links contain skiplagged.com
    const bookingLink = page.locator("a[href*='skiplagged.com']").first();
    await expect(bookingLink).toBeVisible({ timeout: 30_000 });
  });
});
