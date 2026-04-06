import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const expectKnownCountVisible = async (page: Page, knownCount: number): Promise<void> => {
  const progressTab = page.getByRole("tab", { name: "Progress" });
  await expect(progressTab).toBeVisible();
  await progressTab.click();
  const knownWordsCard = page.locator("article").filter({ hasText: "Known Words" }).first();
  await expect(knownWordsCard).toContainText(new RegExp(`Known Words\\s*${knownCount}`));
};

test("study progress persists after a reload", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "SuomiSanat" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Sync:/ })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Progress" }).locator("[data-sync-indicator='true']")).toHaveCount(1);

  await page.getByRole("button", { name: "Reveal Meaning" }).click();
  await page.getByRole("button", { name: "Mark Known" }).click();
  await expectKnownCountVisible(page, 1);

  await page.reload();
  await expectKnownCountVisible(page, 1);
});

test("typing quiz accepts the expected Finnish answer", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Quiz" }).click();
  await page.getByRole("button", { name: "Type Finnish" }).click();

  await expect(page.getByRole("heading", { name: "thank you" })).toBeVisible();
  await page.getByLabel("Type the Finnish word for thank you").fill("kiitos");
  await page.getByRole("button", { name: "Check" }).click();

  await expect(page.getByText("Correct.")).toBeVisible();
});

test("cloud sync details panel opens from progress", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Progress" }).click();

  const progressPanel = page.locator("#panel-progress");
  await progressPanel.getByRole("button", { name: "Open Cloud Sync" }).click();

  await expect(progressPanel.getByRole("status")).toContainText(/Cloud sync is disabled\.|Signed out\. Progress is saved locally in this browser\./);
  await expect(progressPanel.getByRole("button", { name: "Hide Details" })).toBeVisible();
});

test("footer links to the shipped privacy placeholder page", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: "Privacy Notice" }).click();

  await expect(page).toHaveURL(/\/privacy\.html$/);
  await expect(page.getByRole("heading", { name: "Privacy Notice Placeholder" })).toBeVisible();
});
