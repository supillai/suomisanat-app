import { expect, test } from "@playwright/test";

test("desktop quiz keyboard shortcuts stay enabled", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Quiz" }).click();
  await expect(page.getByRole("button", { name: "Type Finnish" })).toBeVisible();
  await page.keyboard.press("t");

  const typingInput = page.locator("#quiz-typing-input");
  await expect(typingInput).toBeVisible();
  await expect(typingInput).toBeFocused();
});

test("desktop study actions do not auto-focus after mouse load", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: "Reveal Meaning" })).not.toBeFocused();
  await expect(page.locator("button:focus-visible")).toHaveCount(0);
});