import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { installMockCloudSync } from "./support/mockCloudSync";

const waitForMockConflictState = async (page: Page): Promise<void> => {
  await page.waitForFunction(() => {
    const state = (window as Window & {
      __SUOMISANAT_E2E_SYNC_STATE__?: {
        session?: { user?: { id?: string } } | null;
        getSessionCalls?: number;
      };
    }).__SUOMISANAT_E2E_SYNC_STATE__;

    return state?.session?.user?.id === "user-1" && (state.getSessionCalls ?? 0) > 0;
  });
};

const expectKnownWordsMetric = async (page: Page, knownCount: number): Promise<void> => {
  const knownWordsCard = page.locator("article").filter({ hasText: "Known Words" }).first();
  await expect(knownWordsCard).toContainText(new RegExp(`Known Words\\s*${knownCount}`));
};

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
  await waitForMockConflictState(page);

  const progressTab = page.getByRole("tab", { name: "Progress" });
  await expect(progressTab.locator("[data-sync-indicator='true']")).toHaveCount(1, { timeout: 10000 });
  await progressTab.click();

  const progressPanel = page.locator("#panel-progress");
  await expect(progressPanel.getByText("Browser and cloud snapshots differ")).toBeVisible({ timeout: 10000 });

  const snapshotCards = progressPanel.locator("#cloud-sync-panel article");
  await expect(snapshotCards).toHaveCount(2);
  await expect(snapshotCards.nth(0)).toContainText("1 known");
  await expect(snapshotCards.nth(0)).toContainText("0 practice");
  await expect(snapshotCards.nth(0)).toContainText("Today 0");
  await expect(snapshotCards.nth(1)).toContainText("0 known");
  await expect(snapshotCards.nth(1)).toContainText("1 practice");
  await expect(snapshotCards.nth(1)).toContainText("Today 0");

  await page.getByRole("button", { name: "Replace Browser with Cloud" }).click();

  await expect(progressPanel.getByRole("status")).toContainText("Cloud sync is up to date.");
  await expect(progressTab.locator("[data-sync-indicator='true']")).toHaveCount(0);
  await expectKnownWordsMetric(page, 0);
  await expect(page.getByLabel("Daily target")).toHaveValue("30");
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
  await waitForMockConflictState(page);

  const progressTab = page.getByRole("tab", { name: "Progress" });
  await expect(progressTab.locator("[data-sync-indicator='true']")).toHaveCount(1, { timeout: 10000 });
  await progressTab.click();

  const progressPanel = page.locator("#panel-progress");
  await expect(progressPanel.getByText("Browser and cloud snapshots differ")).toBeVisible({ timeout: 10000 });

  await page.getByRole("button", { name: "Overwrite Cloud with Browser" }).click();

  await expect(progressPanel.getByRole("status")).toContainText("Cloud sync is up to date.");
  await expect(progressTab.locator("[data-sync-indicator='true']")).toHaveCount(0);
  await expectKnownWordsMetric(page, 1);
  await expect(page.getByLabel("Daily target")).toHaveValue("15");
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

test("cloud sync flushes a word change made before initial hydration finishes", async ({ page }) => {
  await installMockCloudSync(page, {
    session: {
      user: {
        id: "user-1",
        email: "learner@example.com"
      }
    },
    localProgress: {},
    localDailyGoal: 10,
    serverProgressRows: [],
    serverDailyGoal: 10
  });

  await page.addInitScript(() => {
    const statefulWindow = window as Window & {
      __SUOMISANAT_E2E_SUPABASE__?: {
        from: (table: "user_progress" | "user_settings") => {
          select: () => unknown;
        };
      };
    };

    const mockClient = statefulWindow.__SUOMISANAT_E2E_SUPABASE__;
    if (!mockClient) return;

    const originalFrom = mockClient.from.bind(mockClient);
    mockClient.from = (table) => {
      const result = originalFrom(table);

      if (table === "user_progress") {
        return {
          ...result,
          select: () => {
            const selectResult = result.select() as { eq: (...args: unknown[]) => Promise<unknown> | unknown };

            return {
              ...selectResult,
              eq: async (...args: unknown[]) => {
                await new Promise((resolve) => window.setTimeout(resolve, 1500));
                return selectResult.eq(...args);
              }
            };
          }
        };
      }

      return {
        ...result,
        select: () => {
          const selectResult = result.select() as { eq: (...args: unknown[]) => { maybeSingle: () => Promise<unknown> | unknown } };

          return {
            ...selectResult,
            eq: (...args: unknown[]) => {
              const eqResult = selectResult.eq(...args);

              return {
                ...eqResult,
                maybeSingle: async () => {
                  await new Promise((resolve) => window.setTimeout(resolve, 1500));
                  return eqResult.maybeSingle();
                }
              };
            }
          };
        }
      };
    };
  });

  await page.goto("/");
  await waitForMockConflictState(page);

  await page.getByRole("tab", { name: "Word List" }).click();
  await page.getByRole("button", { name: "Known" }).first().click();

  await page.waitForFunction(() => {
    const state = (
      window as Window & {
        __SUOMISANAT_E2E_SYNC_STATE__?: {
          serverProgressRows: Array<{ word_id: number; known: boolean | null }>;
          upsertLog: Array<{ table: string; payload: unknown }>;
        };
      }
    ).__SUOMISANAT_E2E_SYNC_STATE__;

    return (
      Boolean(state) &&
      state.serverProgressRows.length === 1 &&
      state.upsertLog.some((entry) => entry.table === "user_progress")
    );
  }, undefined, { timeout: 10000 });

  const cloudState = await page.evaluate(() => {
    const state = (
      window as Window & {
        __SUOMISANAT_E2E_SYNC_STATE__?: {
          serverProgressRows: Array<{ word_id: number; known: boolean | null; needs_practice: boolean | null }>;
          upsertLog: Array<{ table: string; payload: unknown }>;
        };
      }
    ).__SUOMISANAT_E2E_SYNC_STATE__;

    if (!state) return null;

    return {
      serverProgressRows: state.serverProgressRows,
      progressWrites: state.upsertLog.filter((entry) => entry.table === "user_progress").length
    };
  });

  expect(cloudState).not.toBeNull();
  expect(cloudState?.progressWrites).toBeGreaterThanOrEqual(1);
  expect(cloudState?.serverProgressRows).toHaveLength(1);
  expect(cloudState?.serverProgressRows[0]).toEqual(expect.objectContaining({ known: true, needs_practice: false }));
  expect(Number.isFinite(cloudState?.serverProgressRows[0]?.word_id)).toBe(true);
});

test("cloud sync flushes changes made while an earlier save is still running", async ({ page }) => {
  await installMockCloudSync(page, {
    session: {
      user: {
        id: "user-1",
        email: "learner@example.com"
      }
    },
    localProgress: {},
    localDailyGoal: 10,
    serverProgressRows: [],
    serverDailyGoal: 10,
    progressUpsertDelayMs: 1500
  });

  await page.goto("/");
  await waitForMockConflictState(page);

  await page.getByRole("tab", { name: "Word List" }).click();

  const knownButtons = page.getByRole("button", { name: "Known" });
  await knownButtons.nth(0).click();

  await page.waitForFunction(() => {
    const state = (
      window as Window & {
        __SUOMISANAT_E2E_SYNC_STATE__?: {
          pendingProgressUpserts: number;
        };
      }
    ).__SUOMISANAT_E2E_SYNC_STATE__;

    return state?.pendingProgressUpserts === 1;
  });

  await knownButtons.nth(1).click();

  await page.waitForFunction(() => {
    const state = (
      window as Window & {
        __SUOMISANAT_E2E_SYNC_STATE__?: {
          pendingProgressUpserts: number;
          serverProgressRows: Array<{ word_id: number; known: boolean | null }>;
          upsertLog: Array<{ table: string; payload: unknown }>;
        };
      }
    ).__SUOMISANAT_E2E_SYNC_STATE__;

    return (
      state?.pendingProgressUpserts === 0 &&
      state.serverProgressRows.length === 2 &&
      state.upsertLog.filter((entry) => entry.table === "user_progress").length >= 2
    );
  });

  const cloudState = await page.evaluate(() => {
    const state = (
      window as Window & {
        __SUOMISANAT_E2E_SYNC_STATE__?: {
          serverProgressRows: Array<{ word_id: number; known: boolean | null }>;
          upsertLog: Array<{ table: string; payload: unknown }>;
        };
      }
    ).__SUOMISANAT_E2E_SYNC_STATE__;

    if (!state) return null;

    return {
      serverProgressRows: state.serverProgressRows
        .map((row) => ({ word_id: row.word_id, known: row.known }))
        .sort((first, second) => first.word_id - second.word_id),
      progressWrites: state.upsertLog.filter((entry) => entry.table === "user_progress").length
    };
  });

  expect(cloudState).not.toBeNull();
  expect(cloudState?.serverProgressRows).toHaveLength(2);
  expect(cloudState?.serverProgressRows.every((row) => row.known === true)).toBe(true);
  expect(new Set(cloudState?.serverProgressRows.map((row) => row.word_id)).size).toBe(2);
  expect(cloudState?.progressWrites).toBeGreaterThanOrEqual(2);
});




test("cloud sync keeps syncing after a same-user auth refresh", async ({ page }) => {
  await installMockCloudSync(page, {
    session: {
      user: {
        id: "user-1",
        email: "learner@example.com"
      }
    },
    localProgress: {},
    localDailyGoal: 10,
    serverProgressRows: [],
    serverDailyGoal: 10
  });

  await page.goto("/");
  await waitForMockConflictState(page);

  const progressTab = page.getByRole("tab", { name: "Progress" });
  await progressTab.click();

  const progressPanel = page.locator("#panel-progress");
  await expect(progressPanel.getByRole("status")).toContainText("Cloud sync is up to date.", { timeout: 10000 });

  await page.evaluate(() => {
    const state = (
      window as Window & {
        __SUOMISANAT_E2E_SYNC_STATE__?: {
          emitAuthStateChange: (event: string, session?: unknown) => void;
        };
      }
    ).__SUOMISANAT_E2E_SYNC_STATE__;

    state?.emitAuthStateChange("TOKEN_REFRESHED");
  });

  await expect(progressPanel.getByRole("status")).toContainText("Cloud sync is up to date.");

  await page.getByRole("tab", { name: "Word List" }).click();
  await page.getByRole("button", { name: "Known" }).first().click();

  await page.waitForFunction(() => {
    const state = (
      window as Window & {
        __SUOMISANAT_E2E_SYNC_STATE__?: {
          serverProgressRows: Array<{ word_id: number; known: boolean | null; needs_practice: boolean | null }>;
          upsertLog: Array<{ table: string; payload: unknown }>;
        };
      }
    ).__SUOMISANAT_E2E_SYNC_STATE__;

    return (
      Boolean(state) &&
      state.serverProgressRows.length === 1 &&
      state.upsertLog.some((entry) => entry.table === "user_progress")
    );
  }, undefined, { timeout: 10000 });

  const cloudState = await page.evaluate(() => {
    const state = (
      window as Window & {
        __SUOMISANAT_E2E_SYNC_STATE__?: {
          serverProgressRows: Array<{ word_id: number; known: boolean | null; needs_practice: boolean | null }>;
          upsertLog: Array<{ table: string; payload: unknown }>;
        };
      }
    ).__SUOMISANAT_E2E_SYNC_STATE__;

    if (!state) return null;

    return {
      serverProgressRows: state.serverProgressRows,
      progressWrites: state.upsertLog.filter((entry) => entry.table === "user_progress").length
    };
  });

  expect(cloudState).not.toBeNull();
  expect(cloudState?.progressWrites).toBeGreaterThanOrEqual(1);
  expect(cloudState?.serverProgressRows).toHaveLength(1);
  expect(cloudState?.serverProgressRows[0]).toEqual(expect.objectContaining({ known: true, needs_practice: false }));
  expect(Number.isFinite(cloudState?.serverProgressRows[0]?.word_id)).toBe(true);
});
