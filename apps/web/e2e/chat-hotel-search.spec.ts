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

    // Assert prices appear (the LLM chooses how to format — "$XXX", "$XXX/night",
    // "$XXX per night", etc. — so we accept any USD amount as evidence of results).
    await expect(page.getByText(/\$[\d,.]+/).first()).toBeVisible({ timeout: 30_000 });
  });
});
