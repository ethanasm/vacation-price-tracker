import { test, expect } from "@playwright/test";

test.describe("Chat Flight Search", () => {
  test("searches for flights and displays results", async ({ page }) => {
    await page.goto("/trips");

    // Find chat input (textarea with aria-label from ChatInput component)
    const chatInput = page.getByRole("textbox", { name: /message input/i });
    await chatInput.fill("Find flights from SFO to Paris June 15-22");
    await chatInput.press("Enter");

    // Wait for tool call indicator — tool name rendered as "Search Flights" (snake_case→Title Case)
    await expect(
      page.getByText(/Search Flights/i).first()
    ).toBeVisible({ timeout: 30_000 });

    // Wait for LLM response text to appear (flight results in chat message)
    await expect(
      page.getByText(/Air|airline|flight/i).first()
    ).toBeVisible({ timeout: 60_000 });

    // Assert prices in USD format appear somewhere in the conversation
    await expect(page.getByText(/\$[\d,]+/).first()).toBeVisible({ timeout: 60_000 });

    // Assert booking links contain skiplagged.com
    const bookingLink = page.locator("a[href*='skiplagged.com']").first();
    await expect(bookingLink).toBeVisible({ timeout: 30_000 });
  });
});
