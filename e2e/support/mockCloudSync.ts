import type { Page } from "@playwright/test";

type MockSession = {
  user: {
    id: string;
    email: string;
  };
};

type MockProgressState = {
  seen: number;
  correct: number;
  wrong: number;
  known: boolean;
  needsPractice: boolean;
  lastReviewed: string | null;
  updatedAt: string | null;
};

type MockServerProgressRow = {
  word_id: number;
  seen: number | null;
  correct: number | null;
  wrong: number | null;
  known: boolean | null;
  needs_practice: boolean | null;
  last_reviewed: string | null;
  updated_at: string | null;
};

type MockSyncScenario = {
  session: MockSession;
  localProgress: Record<number, MockProgressState>;
  localDailyGoal: number;
  serverProgressRows: MockServerProgressRow[];
  serverDailyGoal: number | null;
  progressUpsertDelayMs?: number;
};

export const installMockCloudSync = async (page: Page, scenario: MockSyncScenario): Promise<void> => {
  await page.addInitScript((initialScenario) => {
    const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
    const authListeners: Array<(event: string, session: unknown) => void> = [];
    const compareTimestamps = (first: string | null | undefined, second: string | null | undefined): number => {
      if (!first && !second) return 0;
      if (!first) return -1;
      if (!second) return 1;
      return first.localeCompare(second);
    };
    const normalizeProgressRow = (row: {
      word_id: number;
      seen: number;
      correct: number;
      wrong: number;
      known: boolean;
      needs_practice: boolean;
      last_reviewed: string | null;
      updated_at: string;
    }) => ({
      word_id: row.word_id,
      seen: row.seen,
      correct: row.correct,
      wrong: row.wrong,
      known: row.known,
      needs_practice: row.needs_practice,
      last_reviewed: row.last_reviewed,
      updated_at: row.updated_at
    });

    const state = {
      session: clone(initialScenario.session),
      serverProgressRows: clone(initialScenario.serverProgressRows),
      serverDailyGoal: initialScenario.serverDailyGoal,
      serverDailyGoalUpdatedAt: initialScenario.serverDailyGoal === null ? null : new Date().toISOString(),
      getSessionCalls: 0,
      pendingProgressUpserts: 0,
      upsertLog: [] as Array<{ table: string; payload: unknown }>,
      emitAuthStateChange: (event: string, session?: unknown) => {
        if (typeof session !== "undefined") {
          state.session = clone(session as typeof state.session);
        }

        authListeners.forEach((callback) => callback(event, state.session));
      }
    };

    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem("suomisanat-progress-v1", JSON.stringify(initialScenario.localProgress));
    window.localStorage.setItem("suomisanat-daily-goal-v1", String(initialScenario.localDailyGoal));

    const ok = <T,>(data: T) => Promise.resolve({ data: clone(data), error: null });

    const applyProgressRows = async (
      rows: Array<{
        word_id: number;
        seen: number;
        correct: number;
        wrong: number;
        known: boolean;
        needs_practice: boolean;
        last_reviewed: string | null;
        updated_at: string;
      }>,
      mode: "delta" | "overwrite"
    ): Promise<{ acceptedCount: number; staleCount: number }> => {
      state.pendingProgressUpserts += 1;

      try {
        if (typeof initialScenario.progressUpsertDelayMs === "number" && initialScenario.progressUpsertDelayMs > 0) {
          await new Promise((resolve) => window.setTimeout(resolve, initialScenario.progressUpsertDelayMs));
        }

        const nextRows = new Map(state.serverProgressRows.map((row) => [row.word_id, row]));
        let acceptedCount = 0;
        let staleCount = 0;

        for (const row of rows) {
          const currentRow = nextRows.get(row.word_id);
          const shouldApply =
            mode === "overwrite" ||
            !currentRow ||
            compareTimestamps(row.updated_at, currentRow.updated_at) >= 0;

          if (!shouldApply) {
            staleCount += 1;
            continue;
          }

          nextRows.set(row.word_id, normalizeProgressRow(row));
          acceptedCount += 1;
        }

        state.serverProgressRows = [...nextRows.values()];
        state.upsertLog.push({ table: "user_progress", payload: clone(rows) });

        return { acceptedCount, staleCount };
      } finally {
        state.pendingProgressUpserts -= 1;
      }
    };

    const applySettingsRow = (
      row: { daily_goal: number; updated_at: string } | null,
      mode: "delta" | "overwrite"
    ): { applied: boolean; stale: boolean } => {
      if (!row) {
        return { applied: false, stale: false };
      }

      const shouldApply =
        mode === "overwrite" ||
        !state.serverDailyGoalUpdatedAt ||
        compareTimestamps(row.updated_at, state.serverDailyGoalUpdatedAt) >= 0;

      if (!shouldApply) {
        return { applied: false, stale: true };
      }

      state.serverDailyGoal = row.daily_goal;
      state.serverDailyGoalUpdatedAt = row.updated_at;
      state.upsertLog.push({ table: "user_settings", payload: clone(row) });
      return { applied: true, stale: false };
    };

    const buildSyncResponse = (
      progressAcceptedCount: number,
      progressStaleCount: number,
      settingsApplied: boolean,
      settingsStale: boolean,
      deletedCount: number
    ) =>
      ok({
        progress_accepted_count: progressAcceptedCount,
        progress_stale_count: progressStaleCount,
        settings_applied: settingsApplied,
        settings_stale: settingsStale,
        deleted_count: deletedCount,
        synced_at: new Date().toISOString()
      });

    const supabase = {
      auth: {
        getSession: async () => {
          state.getSessionCalls += 1;
          return ok({ session: state.session });
        },
        onAuthStateChange: (callback: (event: string, session: unknown) => void) => {
          authListeners.push(callback);

          return {
            data: {
              subscription: {
                unsubscribe: () => {
                  const index = authListeners.indexOf(callback);
                  if (index >= 0) {
                    authListeners.splice(index, 1);
                  }
                }
              }
            }
          };
        },
        signInWithOtp: async () => ({ error: null }),
        signOut: async () => {
          state.session = null;
          state.emitAuthStateChange("SIGNED_OUT", null);
          return { error: null };
        }
      },
      rpc: async (
        fn: "pull_user_sync_state" | "push_user_sync_batch" | "overwrite_user_sync_snapshot",
        args?: {
          progress_rows?: Array<{
            word_id: number;
            seen: number;
            correct: number;
            wrong: number;
            known: boolean;
            needs_practice: boolean;
            last_reviewed: string | null;
            updated_at: string;
          }>;
          settings_row?: { daily_goal: number; updated_at: string } | null;
          deleted_word_ids?: number[];
        }
      ) => {
        if (fn === "pull_user_sync_state") {
          return ok({
            settings:
              state.serverDailyGoal === null
                ? null
                : {
                    daily_goal: state.serverDailyGoal,
                    updated_at: state.serverDailyGoalUpdatedAt
                  },
            progress: state.serverProgressRows
          });
        }

        const progressRows = args?.progress_rows ?? [];
        const settingsRow = args?.settings_row ?? null;
        const deletedWordIds = args?.deleted_word_ids ?? [];
        const deletedCount = deletedWordIds.length;

        if (deletedWordIds.length > 0) {
          state.serverProgressRows = state.serverProgressRows.filter((row) => !deletedWordIds.includes(row.word_id));
        }

        const mode = fn === "overwrite_user_sync_snapshot" ? "overwrite" : "delta";
        const progressResult = await applyProgressRows(progressRows, mode);
        const settingsResult = applySettingsRow(settingsRow ?? null, mode);

        return buildSyncResponse(
          progressResult.acceptedCount,
          progressResult.staleCount,
          settingsResult.applied,
          settingsResult.stale,
          deletedCount
        );
      },
      from: (table: "user_progress" | "user_settings") => {
        if (table === "user_progress") {
          return {
            select: () => ({
              eq: () => ok(state.serverProgressRows)
            }),
            delete: () => ({
              eq: () => ({
                in: async (_column: string, wordIds: number[]) => {
                  state.serverProgressRows = state.serverProgressRows.filter((row) => !wordIds.includes(row.word_id));
                  return { error: null };
                }
              })
            }),
            upsert: async (rows: Array<{
              word_id: number;
              seen: number;
              correct: number;
              wrong: number;
              known: boolean;
              needs_practice: boolean;
              last_reviewed: string | null;
              updated_at: string;
            }>) => {
              await applyProgressRows(rows, "overwrite");
              return { error: null };
            }
          };
        }

        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                ok(
                  state.serverDailyGoal === null
                    ? null
                    : {
                        daily_goal: state.serverDailyGoal,
                        updated_at: state.serverDailyGoalUpdatedAt
                      }
                )
            })
          }),
          upsert: async (row: { daily_goal: number }) => {
            applySettingsRow({ daily_goal: row.daily_goal, updated_at: new Date().toISOString() }, "overwrite");
            return { error: null };
          }
        };
      }
    };

    (window as Window & { __SUOMISANAT_E2E_SUPABASE__?: unknown }).__SUOMISANAT_E2E_SUPABASE__ = supabase;
    (window as Window & { __SUOMISANAT_E2E_SYNC_STATE__?: unknown }).__SUOMISANAT_E2E_SYNC_STATE__ = state;
  }, scenario);
};
