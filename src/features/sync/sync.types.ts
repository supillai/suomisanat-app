import type { ProgressMap } from "../../types";

export type SyncStatus = "idle" | "loading" | "saving" | "synced" | "error";
export type SyncConflictMode = "cloud-empty" | "different-data";
export type SyncResolutionChoice = "overwrite-cloud" | "use-cloud";

export type SyncConflict = {
  mode: SyncConflictMode;
  serverProgress: ProgressMap;
  serverDailyGoal: number;
};

export type UserProgressRow = {
  word_id: number;
  seen: number | null;
  correct: number | null;
  wrong: number | null;
  known: boolean | null;
  needs_practice: boolean | null;
  last_reviewed: string | null;
  updated_at: string | null;
};

export type UserProgressUpsert = {
  user_id: string;
  word_id: number;
  seen: number;
  correct: number;
  wrong: number;
  known: boolean;
  needs_practice: boolean;
  last_reviewed: string | null;
  updated_at: string;
};

export type UserSettingsRow = {
  daily_goal: number | null;
  updated_at: string | null;
};

export type UserSettingsUpsert = {
  user_id: string;
  daily_goal: number;
  updated_at: string;
};

export type PullUserSyncStateResponse = {
  settings: UserSettingsRow | null;
  progress: UserProgressRow[];
};

export type PushUserSyncBatchResponse = {
  progress_accepted_count: number | null;
  progress_stale_count: number | null;
  settings_applied: boolean | null;
  settings_stale: boolean | null;
  deleted_count: number | null;
  synced_at: string | null;
};
