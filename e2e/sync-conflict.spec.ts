import { expect, test } from "@playwright/test";
import { installMockCloudSync } from "./support/mockCloudSync";

test("cloud sync conflict can be resolved in favor of cloud data", async ({ page }) => {
  await installMockCloudSync(page, {
    session: {
      user: {
        id: "user-1",
        email: "learner@example.com"
      }
    },
    localProgress: {
      1: {
        seen: 2,
        correct: 2,
        wrong: 0,
        known: true,
        needsPractice: false,
        lastReviewed: "2026-03-10",
        updatedAt: "2026-03-10T09:00:00.000Z"
      }
    },
    localDailyGoal: 15,
    serverProgressRows: [
      {
        word_id: 2,
        seen: 4,
        correct: 1,
        wrong: 3,
        known: false,
        needs_practice: true,
        last_reviewed: "2026-03-12",
        updated_at: "2026-03-12T09:00:00.000Z"
      }
    ],
    serverDailyGoal: 30
  });

  await page.goto("/");

  const syncButton = page.getByRole("button", { name: /Sync:/ });
  await expect(syncButton).toBeVisible();
  await syncButton.click();

  await expect(page.getByText("Browser and cloud snapshots differ")).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("1 known, 0 practice, 0 reviewed today")).toBeVisible();
  await expect(page.getByText("0 known, 1 practice, 0 reviewed today")).toBeVisible();

  await page.getByRole("button", { name: "Replace Browser with Cloud" }).click();

  await expect(syncButton).toContainText("Up to date");
  await expect(page.getByText(/^Known:/)).toContainText(/0\/\d+/);
  await expect(page.getByLabel("Daily goal")).toHaveValue("30");
  await expect(page.getByText("Browser and cloud snapshots differ")).toHaveCount(0);
});

test("cloud sync conflict can import browser data into the cloud", async ({ page }) => {
  await installMockCloudSync(page, {
    session: {
      user: {
        id: "user-1",
        email: "learner@example.com"
      }
    },
    localProgress: {
      1: {
        seen: 2,
        correct: 2,
        wrong: 0,
        known: true,
        needsPractice: false,
        lastReviewed: "2026-03-10",
        updatedAt: "2026-03-10T09:00:00.000Z"
      }
    },
    localDailyGoal: 15,
    serverProgressRows: [
      {
        word_id: 2,
        seen: 4,
        correct: 1,
        wrong: 3,
        known: false,
        needs_practice: true,
        last_reviewed: "2026-03-12",
        updated_at: "2026-03-12T09:00:00.000Z"
      }
    ],
    serverDailyGoal: 30
  });

  await page.goto("/");

  const syncButton = page.getByRole("button", { name: /Sync:/ });
  await expect(syncButton).toBeVisible();
  await syncButton.click();

  await expect(page.getByText("Browser and cloud snapshots differ")).toBeVisible({ timeout: 10000 });

  await page.getByRole("button", { name: "Overwrite Cloud with Browser" }).click();

  await expect(syncButton).toContainText("Up to date");
  await expect(page.getByText(/^Known:/)).toContainText(/1\/\d+/);
  await expect(page.getByLabel("Daily goal")).toHaveValue("15");
  await expect(page.getByText("Browser and cloud snapshots differ")).toHaveCount(0);

  const cloudState = await page.evaluate(() => {
    const state = (
      window as Window & {
        __SUOMISANAT_E2E_SYNC_STATE__?: {
          serverDailyGoal: number | null;
          serverProgressRows: Array<{
            word_id: number;
            known: boolean | null;
            needs_practice: boolean | null;
          }>;
          upsertLog: Array<{
            table: string;
            payload: unknown;
          }>;
        };
      }
    ).__SUOMISANAT_E2E_SYNC_STATE__;

    if (!state) return null;

    return {
      serverDailyGoal: state.serverDailyGoal,
      serverProgressRows: state.serverProgressRows
        .map((row) => ({
          word_id: row.word_id,
          known: row.known,
          needs_practice: row.needs_practice
        }))
        .sort((first, second) => first.word_id - second.word_id),
      progressWrites: state.upsertLog
        .filter((entry) => entry.table === "user_progress")
        .flatMap((entry) => entry.payload as Array<{ word_id: number; known: boolean; needs_practice: boolean }>),
      settingsWrites: state.upsertLog
        .filter((entry) => entry.table === "user_settings")
        .map((entry) => (entry.payload as { daily_goal: number }).daily_goal)
    };
  });

  expect(cloudState).not.toBeNull();
  expect(cloudState?.serverDailyGoal).toBe(15);
  expect(cloudState?.serverProgressRows).toEqual([{ word_id: 1, known: true, needs_practice: false }]);
  expect(cloudState?.progressWrites).toEqual([expect.objectContaining({ word_id: 1, known: true, needs_practice: false })]);
  expect(cloudState?.settingsWrites).toContain(15);
});
