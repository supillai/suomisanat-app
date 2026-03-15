import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { installMockCloudSync } from "./support/mockCloudSync";

const waitForMockConflictState = async (page: Page): Promise<void> => {
  await page.waitForFunction(() => {
    const state = (window as Window & {
      __SUOMISANAT_E2E_SYNC_STATE__?: {
        session?: { user?: { id?: string } } | null;
      };
    }).__SUOMISANAT_E2E_SYNC_STATE__;

    return state?.session?.user?.id === "user-1";
  });
};

test("cloud sync conflict can be resolved in favor of cloud data", async ({ page }, testInfo) => {
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
  await waitForMockConflictState(page);

  const syncButton = page.getByRole("button", { name: /Sync:/ });
  await expect(syncButton).toHaveAttribute("aria-label", /Sync: Action needed/, { timeout: 10000 });
  await syncButton.click();

  await expect(page.getByText("Browser and cloud snapshots differ")).toBeVisible({ timeout: 10000 });

  const snapshotCards = page.locator("#cloud-sync-panel article");
  await expect(snapshotCards).toHaveCount(2);
  await expect(snapshotCards.nth(0)).toContainText("1 known");
  await expect(snapshotCards.nth(0)).toContainText("0 practice");
  await expect(snapshotCards.nth(0)).toContainText("Today 0");
  await expect(snapshotCards.nth(1)).toContainText("0 known");
  await expect(snapshotCards.nth(1)).toContainText("1 practice");
  await expect(snapshotCards.nth(1)).toContainText("Today 0");

  const knownBadge = testInfo.project.use.isMobile
    ? page.getByText(/^Known[: ]\s*0\/\d+/).first()
    : page.getByText(/^Known[: ]\s*0\/\d+/).last();

  await page.getByRole("button", { name: "Replace Browser with Cloud" }).click();

  await expect(syncButton).toHaveAttribute("aria-label", /Sync: Up to date/);
  await expect(knownBadge).toBeVisible();
  await page.getByRole("tab", { name: "Progress" }).click();
  await expect(page.getByLabel("Daily goal")).toHaveValue("30");
  await expect(page.getByText("Browser and cloud snapshots differ")).toHaveCount(0);
});

test("cloud sync conflict can import browser data into the cloud", async ({ page }, testInfo) => {
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
  await waitForMockConflictState(page);

  const syncButton = page.getByRole("button", { name: /Sync:/ });
  await expect(syncButton).toHaveAttribute("aria-label", /Sync: Action needed/, { timeout: 10000 });
  await syncButton.click();

  await expect(page.getByText("Browser and cloud snapshots differ")).toBeVisible({ timeout: 10000 });

  const knownBadge = testInfo.project.use.isMobile
    ? page.getByText(/^Known[: ]\s*1\/\d+/).first()
    : page.getByText(/^Known[: ]\s*1\/\d+/).last();

  await page.getByRole("button", { name: "Overwrite Cloud with Browser" }).click();

  await expect(syncButton).toHaveAttribute("aria-label", /Sync: Up to date/);
  await expect(knownBadge).toBeVisible();
  await page.getByRole("tab", { name: "Progress" }).click();
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

