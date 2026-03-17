import type { ProgressMap, ProgressState, VocabularyWord } from "../../types";
import { DEFAULT_DAILY_GOAL } from "../app/app.constants";

const PROGRESS_KEY = "suomisanat-progress-v1";
const DAILY_GOAL_KEY = "suomisanat-daily-goal-v1";

export type ProgressSummary = {
  trackedWords: number;
  known: number;
  needsPractice: number;
  reviewedToday: number;
  dailyGoal: number;
  totalCorrect: number;
  totalWrong: number;
  accuracy: number;
};

export type ProgressStats = {
  totalWords: number;
  knownCount: number;
  needsPracticeCount: number;
  reviewedToday: number;
  totalCorrect: number;
  totalWrong: number;
  accuracy: number;
  goalPct: number;
};

const padDatePart = (value: number): string => String(value).padStart(2, "0");

export const localDateIso = (value: Date): string => {
  return `${value.getFullYear()}-${padDatePart(value.getMonth() + 1)}-${padDatePart(value.getDate())}`;
};

export const todayIso = (): string => localDateIso(new Date());
const shiftIsoDate = (isoDate: string, dayOffset: number): string => {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + dayOffset);
  return localDateIso(date);
};

export const calculateReviewStreak = (map: ProgressMap, anchorDate: Date = new Date()): number => {
  const reviewedDates = Array.from(
    new Set(
      Object.values(map)
        .map((state) => state.lastReviewed)
        .filter((value): value is string => typeof value === "string" && value.length > 0)
    )
  ).sort((first, second) => second.localeCompare(first));

  if (reviewedDates.length === 0) return 0;

  const anchorIsoDate = localDateIso(anchorDate);
  const earliestActiveIsoDate = shiftIsoDate(anchorIsoDate, -1);
  const latestReviewedDate = reviewedDates[0];

  if (latestReviewedDate !== anchorIsoDate && latestReviewedDate !== earliestActiveIsoDate) {
    return 0;
  }

  const reviewedDateSet = new Set(reviewedDates);
  let streakDays = 1;
  let cursorIsoDate = latestReviewedDate;

  while (true) {
    cursorIsoDate = shiftIsoDate(cursorIsoDate, -1);

    if (!reviewedDateSet.has(cursorIsoDate)) {
      return streakDays;
    }

    streakDays += 1;
  }
};

export const safeInt = (value: number | null | undefined): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : 0;
};

export const safeTimestamp = (value: string | null | undefined): string | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  return Number.isNaN(Date.parse(value)) ? null : value;
};

export const createEmptyProgressState = (): ProgressState => ({
  seen: 0,
  correct: 0,
  wrong: 0,
  known: false,
  needsPractice: false,
  lastReviewed: null,
  updatedAt: null
});

export const safeReadProgress = (): ProgressMap => {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as Record<string, Partial<ProgressState>> | null;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const normalized: ProgressMap = {};

    for (const [rawId, value] of Object.entries(parsed)) {
      if (!value || typeof value !== "object") continue;

      const id = Number(rawId);
      if (!Number.isFinite(id)) continue;

      const seen = Number(value.seen);
      const correct = Number(value.correct);
      const wrong = Number(value.wrong);
      const known = Boolean(value.known);
      const needsPractice = known ? false : Boolean(value.needsPractice);

      normalized[id] = {
        seen: Number.isFinite(seen) && seen >= 0 ? Math.round(seen) : 0,
        correct: Number.isFinite(correct) && correct >= 0 ? Math.round(correct) : 0,
        wrong: Number.isFinite(wrong) && wrong >= 0 ? Math.round(wrong) : 0,
        known,
        needsPractice,
        lastReviewed: typeof value.lastReviewed === "string" ? value.lastReviewed : null,
        updatedAt: safeTimestamp(value.updatedAt)
      };
    }

    return normalized;
  } catch {
    return {};
  }
};

export const safeReadDailyGoal = (): number => {
  try {
    const parsed = Number(localStorage.getItem(DAILY_GOAL_KEY));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DAILY_GOAL;
  } catch {
    return DEFAULT_DAILY_GOAL;
  }
};

export const persistProgress = (progressMap: ProgressMap): void => {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progressMap));
};

export const persistDailyGoal = (dailyGoal: number): void => {
  localStorage.setItem(DAILY_GOAL_KEY, String(dailyGoal));
};

export const hasTrackedProgress = (map: ProgressMap): boolean => Object.keys(map).length > 0;

export const summarizeProgress = (map: ProgressMap, dailyGoal: number): ProgressSummary => {
  const states = Object.values(map);
  const totalCorrect = states.reduce((sum, state) => sum + safeInt(state.correct), 0);
  const totalWrong = states.reduce((sum, state) => sum + safeInt(state.wrong), 0);
  const totalAnswers = totalCorrect + totalWrong;

  return {
    trackedWords: states.length,
    known: states.filter((state) => state.known).length,
    needsPractice: states.filter((state) => state.needsPractice).length,
    reviewedToday: states.filter((state) => state.lastReviewed === todayIso()).length,
    dailyGoal,
    totalCorrect,
    totalWrong,
    accuracy: totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : 0
  };
};

export const buildProgressStats = (
  wordList: VocabularyWord[],
  progressMap: ProgressMap,
  dailyGoal: number
): ProgressStats => {
  const today = todayIso();
  const totalWords = wordList.length;
  const knownCount = wordList.filter((word) => progressMap[word.id]?.known).length;
  const needsPracticeCount = wordList.filter((word) => progressMap[word.id]?.needsPractice).length;
  const reviewedToday = wordList.filter((word) => progressMap[word.id]?.lastReviewed === today).length;
  const totalCorrect = wordList.reduce((sum, word) => sum + (progressMap[word.id]?.correct ?? 0), 0);
  const totalWrong = wordList.reduce((sum, word) => sum + (progressMap[word.id]?.wrong ?? 0), 0);
  const accuracy = totalCorrect + totalWrong > 0 ? Math.round((totalCorrect / (totalCorrect + totalWrong)) * 100) : 0;
  const goalPct = Math.min(100, Math.round((reviewedToday / dailyGoal) * 100));

  return {
    totalWords,
    knownCount,
    needsPracticeCount,
    reviewedToday,
    totalCorrect,
    totalWrong,
    accuracy,
    goalPct
  };
};
