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
              state.pendingProgressUpserts += 1;

              if (typeof initialScenario.progressUpsertDelayMs === "number" && initialScenario.progressUpsertDelayMs > 0) {
                await new Promise((resolve) => window.setTimeout(resolve, initialScenario.progressUpsertDelayMs));
              }

              const nextRows = new Map(state.serverProgressRows.map((row) => [row.word_id, row]));

              for (const row of rows) {
                nextRows.set(row.word_id, normalizeProgressRow(row));
              }

              state.serverProgressRows = [...nextRows.values()];
              state.upsertLog.push({ table, payload: clone(rows) });
              state.pendingProgressUpserts -= 1;
              return { error: null };
            }
          };
        }

        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => ok(state.serverDailyGoal === null ? null : { daily_goal: state.serverDailyGoal })
            })
          }),
          upsert: async (row: { daily_goal: number }) => {
            state.serverDailyGoal = row.daily_goal;
            state.upsertLog.push({ table, payload: clone(row) });
            return { error: null };
          }
        };
      }
    };

    (window as Window & { __SUOMISANAT_E2E_SUPABASE__?: unknown }).__SUOMISANAT_E2E_SUPABASE__ = supabase;
    (window as Window & { __SUOMISANAT_E2E_SYNC_STATE__?: unknown }).__SUOMISANAT_E2E_SYNC_STATE__ = state;
  }, scenario);
};

