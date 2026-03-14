import type { ProgressMap, ProgressState } from "../../types";
import { safeInt, safeTimestamp } from "../progress/progress.utils";
import type { UserProgressRow, UserProgressUpsert, UserSettingsUpsert } from "./sync.types";

const laterIsoDate = (first: string | null, second: string | null): string | null => {
  if (!first) return second;
  if (!second) return first;
  return first >= second ? first : second;
};

const progressActivityScore = (state: ProgressState): number => state.seen + state.correct + state.wrong;

const pickPreferredProgressState = (first: ProgressState, second: ProgressState): ProgressState => {
  const firstUpdatedAt = safeTimestamp(first.updatedAt);
  const secondUpdatedAt = safeTimestamp(second.updatedAt);

  if (firstUpdatedAt && secondUpdatedAt && firstUpdatedAt !== secondUpdatedAt) {
    return firstUpdatedAt > secondUpdatedAt ? first : second;
  }

  if (firstUpdatedAt && !secondUpdatedAt) return first;
  if (secondUpdatedAt && !firstUpdatedAt) return second;

  if (first.lastReviewed && second.lastReviewed && first.lastReviewed !== second.lastReviewed) {
    return first.lastReviewed > second.lastReviewed ? first : second;
  }

  if (first.lastReviewed && !second.lastReviewed) return first;
  if (second.lastReviewed && !first.lastReviewed) return second;

  return progressActivityScore(first) >= progressActivityScore(second) ? first : second;
};

const mergeProgressState = (
  localState: ProgressState | undefined,
  serverState: ProgressState | undefined
): ProgressState | undefined => {
  if (!localState) return serverState;
  if (!serverState) return localState;

  const preferred = pickPreferredProgressState(localState, serverState);
  const known = Boolean(preferred.known);

  return {
    seen: Math.max(safeInt(localState.seen), safeInt(serverState.seen)),
    correct: Math.max(safeInt(localState.correct), safeInt(serverState.correct)),
    wrong: Math.max(safeInt(localState.wrong), safeInt(serverState.wrong)),
    known,
    needsPractice: known ? false : Boolean(preferred.needsPractice),
    lastReviewed: laterIsoDate(localState.lastReviewed, serverState.lastReviewed),
    updatedAt: safeTimestamp(preferred.updatedAt)
  };
};

export const mergeProgressMaps = (localMap: ProgressMap, serverMap: ProgressMap): ProgressMap => {
  const merged: ProgressMap = {};
  const wordIds = new Set([...Object.keys(localMap), ...Object.keys(serverMap)].map((value) => Number(value)));

  for (const wordId of wordIds) {
    if (!Number.isFinite(wordId)) continue;

    const state = mergeProgressState(localMap[wordId], serverMap[wordId]);
    if (state) {
      merged[wordId] = state;
    }
  }

  return merged;
};

const progressStatesEqual = (first: ProgressState | undefined, second: ProgressState | undefined): boolean => {
  if (!first && !second) return true;
  if (!first || !second) return false;

  return (
    safeInt(first.seen) === safeInt(second.seen) &&
    safeInt(first.correct) === safeInt(second.correct) &&
    safeInt(first.wrong) === safeInt(second.wrong) &&
    Boolean(first.known) === Boolean(second.known) &&
    (Boolean(first.known) ? false : Boolean(first.needsPractice)) ===
      (Boolean(second.known) ? false : Boolean(second.needsPractice)) &&
    (first.lastReviewed ?? null) === (second.lastReviewed ?? null)
  );
};

export const progressMapsEqual = (first: ProgressMap, second: ProgressMap): boolean => {
  const wordIds = new Set([...Object.keys(first), ...Object.keys(second)].map((value) => Number(value)));

  for (const wordId of wordIds) {
    if (!Number.isFinite(wordId)) continue;
    if (!progressStatesEqual(first[wordId], second[wordId])) {
      return false;
    }
  }

  return true;
};

export const toProgressMapFromRows = (rows: UserProgressRow[] | null | undefined): ProgressMap => {
  const map: ProgressMap = {};

  for (const row of rows ?? []) {
    if (!Number.isFinite(row.word_id)) continue;

    const known = Boolean(row.known);
    const needsPractice = known ? false : Boolean(row.needs_practice);

    map[row.word_id] = {
      seen: safeInt(row.seen),
      correct: safeInt(row.correct),
      wrong: safeInt(row.wrong),
      known,
      needsPractice,
      lastReviewed: typeof row.last_reviewed === "string" ? row.last_reviewed : null,
      updatedAt: safeTimestamp(row.updated_at)
    };
  }

  return map;
};

export const toProgressUpserts = (userId: string, map: ProgressMap): UserProgressUpsert[] => {
  const fallbackUpdatedAt = new Date().toISOString();
  const rows: UserProgressUpsert[] = [];

  for (const [rawWordId, state] of Object.entries(map)) {
    const wordId = Number(rawWordId);
    if (!Number.isFinite(wordId)) continue;

    rows.push({
      user_id: userId,
      word_id: wordId,
      seen: safeInt(state.seen),
      correct: safeInt(state.correct),
      wrong: safeInt(state.wrong),
      known: Boolean(state.known),
      needs_practice: state.known ? false : Boolean(state.needsPractice),
      last_reviewed: typeof state.lastReviewed === "string" ? state.lastReviewed : null,
      updated_at: safeTimestamp(state.updatedAt) ?? fallbackUpdatedAt
    });
  }

  return rows;
};

export const toSettingsUpsert = (userId: string, goal: number): UserSettingsUpsert => ({
  user_id: userId,
  daily_goal: Math.max(1, Math.round(goal)),
  updated_at: new Date().toISOString()
});

export const formatSyncTimestamp = (value: string | null): string => {
  if (!value) return "Not synced yet";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not synced yet";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(parsed);
};
