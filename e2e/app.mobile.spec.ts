import { expect, test } from "@playwright/test";
import type { Locator } from "@playwright/test";

const expectMinimumTouchTarget = async (locator: Locator, minimumHeight: number): Promise<void> => {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(minimumHeight);
};

test("mobile tab bar stays reachable while browsing the word list", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Word List" }).click();

  const firstWordCard = page.locator("article").filter({ has: page.getByRole("button", { name: "Show clue" }) }).first();
  const showMoreButton = page.getByRole("button", { name: /Show \d+ More Words/ });

  await expect(page.getByRole("heading", { name: "Browse, sort, and queue your next review set" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Filters & Sort|Hide Filters/ })).toBeVisible();
  await expect(firstWordCard).toBeVisible();
  if (await showMoreButton.count()) {
    await expect(showMoreButton).toBeVisible();
  }

  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });

  const progressTab = page.getByRole("tab", { name: "Progress" });
  await expect(progressTab).toBeVisible();

  const tabBounds = await progressTab.boundingBox();
  const viewport = page.viewportSize();

  expect(tabBounds).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect((tabBounds?.y ?? 0) + (tabBounds?.height ?? 0)).toBeLessThanOrEqual((viewport?.height ?? 0) + 1);
});

test("mobile word list keeps clues collapsed until requested", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Word List" }).click();
  await expect(page.getByRole("heading", { name: "Browse, sort, and queue your next review set" })).toBeVisible();

  const firstWordCard = page.locator("article").filter({ has: page.getByRole("button", { name: "Show clue" }) }).first();
  const clueToggle = firstWordCard.locator('[aria-controls^="word-mobile-clue-"]').first();

  await expect(firstWordCard).toBeVisible();
  await expect(clueToggle).toHaveText("Show clue");
  await expect(clueToggle).toHaveAttribute("aria-expanded", "false");
  await expect(firstWordCard.getByRole("button", { name: "Known" })).toBeVisible();
  await expect(firstWordCard.getByRole("button", { name: "Practice" })).toBeVisible();
  await expect(firstWordCard.getByRole("button", { name: "Clear status" })).toHaveCount(0);

  const cluePanelId = await clueToggle.getAttribute("aria-controls");
  expect(cluePanelId).not.toBeNull();

  if (!cluePanelId) {
    throw new Error("Expected mobile word clue control to expose an aria-controls id");
  }

  const anchoredToggle = page.locator(`[aria-controls="${cluePanelId}"]`);
  await expect(page.locator(`#${cluePanelId}`)).toHaveCount(0);

  await anchoredToggle.click();

  await expect(anchoredToggle).toHaveText("Hide clue");
  await expect(anchoredToggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(`#${cluePanelId}`)).toBeVisible();
});

test("mobile controls keep accessible touch targets", async ({ page }) => {
  await page.goto("/");
  await expectMinimumTouchTarget(page.getByRole("button", { name: "Reveal Meaning" }), 48);
  await expectMinimumTouchTarget(page.getByRole("button", { name: "Show Hint" }), 48);

  await page.getByRole("tab", { name: "Word List" }).click();
  const firstWordCard = page.locator("article").filter({ has: page.getByRole("button", { name: "Show clue" }) }).first();
  await expect(firstWordCard).toBeVisible();
  await expectMinimumTouchTarget(firstWordCard.getByRole("button", { name: "Show clue" }), 44);
  await expectMinimumTouchTarget(firstWordCard.getByRole("button", { name: "Known" }), 44);
  await expectMinimumTouchTarget(firstWordCard.getByRole("button", { name: "Practice" }), 44);

  await page.getByRole("tab", { name: "Quiz" }).click();
  await page.getByRole("button", { name: "Type Finnish" }).click();
  await expectMinimumTouchTarget(page.locator("#quiz-typing-input"), 44);
  await expectMinimumTouchTarget(page.getByRole("button", { name: "Check" }), 44);
});

test("mobile study keeps example hidden until selected", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Reveal Meaning" }).click();

  const meaningTab = page.getByRole("button", { name: "Meaning", exact: true });
  const exampleTab = page.getByRole("button", { name: "Example", exact: true });
  const revealPanel = page.locator(".study-reveal-panel");

  await expect(meaningTab).toBeVisible();
  await expect(exampleTab).toBeVisible();
  await expect(meaningTab).toHaveAttribute("aria-pressed", "true");
  await expect(exampleTab).toHaveAttribute("aria-pressed", "false");
  await expect(revealPanel).toContainText("Meaning");
  await expect(revealPanel).not.toContainText("Example");

  await exampleTab.click();

  await expect(exampleTab).toHaveAttribute("aria-pressed", "true");
  await expect(meaningTab).toHaveAttribute("aria-pressed", "false");
  await expect(revealPanel).toContainText("Example");
});

test("mobile study keeps revealed meaning visible above the action tray", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Reveal Meaning" }).click();

  const revealPanel = page.locator(".study-reveal-panel");
  const revealBody = revealPanel.locator("p").nth(1);
  const revealTray = page.locator(".study-reveal-tray").first();

  await expect(revealPanel).toBeVisible();
  await expect(revealBody).toContainText("thank you");
  await expect(revealTray).toBeVisible();

  const [bodyBox, trayBox] = await Promise.all([revealBody.boundingBox(), revealTray.boundingBox()]);

  expect(bodyBox).not.toBeNull();
  expect(trayBox).not.toBeNull();
  expect((bodyBox?.y ?? 0) + (bodyBox?.height ?? 0)).toBeLessThanOrEqual((trayBox?.y ?? 0) + 1);
});

test("mobile study keeps both decision buttons above the fixed nav", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Reveal Meaning" }).click();

  const knownButton = page.getByRole("button", { name: "Mark Known" });
  const practiceButton = page.getByRole("button", { name: "Needs Practice" });
  const tabBar = page.locator(".mobile-tab-bar");

  await expect(knownButton).toBeVisible();
  await expect(practiceButton).toBeVisible();
  await expect(tabBar).toBeVisible();

  const [knownBox, practiceBox, tabBarBox, viewport] = await Promise.all([
    knownButton.boundingBox(),
    practiceButton.boundingBox(),
    tabBar.boundingBox(),
    Promise.resolve(page.viewportSize())
  ]);

  expect(knownBox).not.toBeNull();
  expect(practiceBox).not.toBeNull();
  expect(tabBarBox).not.toBeNull();
  expect(viewport).not.toBeNull();

  const visibleBottom = Math.min(tabBarBox?.y ?? Number.MAX_SAFE_INTEGER, viewport?.height ?? Number.MAX_SAFE_INTEGER);
  expect((knownBox?.y ?? 0) + (knownBox?.height ?? 0)).toBeLessThanOrEqual(visibleBottom + 1);
  expect((practiceBox?.y ?? 0) + (practiceBox?.height ?? 0)).toBeLessThanOrEqual(visibleBottom + 1);
});

test("mobile word list shows active filter chips and can clear them", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Word List" }).click();
  await expect(page.getByRole("heading", { name: "Browse, sort, and queue your next review set" })).toBeVisible();

  const searchInput = page.locator("#word-search");
  await expect(searchInput).toBeVisible();
  await searchInput.fill("kii");

  await expect(page.getByText("Search: kii")).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear all" })).toBeVisible();

  await page.getByRole("button", { name: "Clear all" }).click();

  await expect(searchInput).toHaveValue("");
  await expect(page.getByText("Search: kii")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Filters & Sort|Hide Filters/ })).toHaveText("Filters & Sort");
});

test("mobile empty word list state offers a reset", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Word List" }).click();
  await expect(page.getByRole("heading", { name: "Browse, sort, and queue your next review set" })).toBeVisible();

  const searchInput = page.locator("#word-search");
  await expect(searchInput).toBeVisible();
  await searchInput.fill("zzzzzz");

  await expect(page.getByText("Nothing is due right now.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Show all words" })).toBeVisible();

  await page.getByRole("button", { name: "Show all words" }).click();

  await expect(searchInput).toHaveValue("");
  await expect(page.getByText("Nothing is due right now.")).toHaveCount(0);
});

test("mobile progress cloud sync summary stays visible", async ({ page }) => {
  await page.goto("/");
  const progressTab = page.getByRole("tab", { name: "Progress" });
  await expect(progressTab).toBeVisible();
  await progressTab.click();

  const progressPanel = page.locator("#panel-progress");
  await expect(progressPanel).toBeVisible();
  await expect(progressPanel.getByRole("button", { name: "Open Cloud Sync" })).toBeVisible();
  await expect(progressPanel.getByText(/Cloud sync is off for this build|Sign in to keep progress across browsers/).first()).toBeVisible();

  await progressPanel.getByRole("button", { name: "Open Cloud Sync" }).click();

  await expect(progressPanel.getByText("Last synced: Local browser only").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Hide Details" })).toBeVisible();
});

test("mobile progress tab owns the sync indicator", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: /Sync:/ })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Progress" }).locator("[data-sync-indicator='true']")).toHaveCount(1);
});

test("mobile quiz stays touch-first", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Space/Enter reveal, H hint, K known, P practice, N next")).toHaveCount(0);

  const quizTab = page.getByRole("tab", { name: "Quiz" });
  await expect(quizTab).toBeVisible();
  await quizTab.click();
  await expect(page.getByText("1-4 answer, M/T switch mode, N next, Esc exits mini drill")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Type Finnish" })).toBeVisible();

  await page.keyboard.press("t");
  await expect(page.locator("#quiz-typing-input")).toHaveCount(0);

  await page.getByRole("button", { name: "Type Finnish" }).click();
  await expect(page.locator("#quiz-typing-input")).toBeVisible();

  const activeElementId = await page.evaluate(() => document.activeElement?.id ?? "");
  expect(activeElementId).not.toBe("quiz-typing-input");
});

test("mobile progress keeps the sync summary above the fold", async ({ page }) => {
  await page.goto("/");
  const progressTab = page.getByRole("tab", { name: "Progress" });
  await expect(progressTab).toBeVisible();
  await progressTab.click();

  const progressPanel = page.locator("#panel-progress");
  const syncSummaryTitle = progressPanel.getByText(/Cloud sync is off for this build|Sign in to keep progress across browsers/).first();
  const syncAction = progressPanel.getByRole("button", { name: "Open Cloud Sync" });

  await expect(syncSummaryTitle).toBeVisible();
  await expect(syncAction).toBeVisible();

  const [summaryBox, actionBox, viewport] = await Promise.all([
    syncSummaryTitle.boundingBox(),
    syncAction.boundingBox(),
    Promise.resolve(page.viewportSize())
  ]);

  expect(summaryBox).not.toBeNull();
  expect(actionBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect((actionBox?.y ?? 0) + (actionBox?.height ?? 0)).toBeLessThanOrEqual((viewport?.height ?? 0) + 1);
});
