import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProgressMap, VocabularyWord } from "../../types";
import { buildProgressStats, calculateReviewStreak, localDateIso, safeTimestamp, summarizeProgress, todayIso } from "./progress.utils";

const words: VocabularyWord[] = [
  { id: 1, fi: "kissa", en: "cat", fiSimple: "Elain.", enSimple: "An animal.", topic: "home", pos: "noun" },
  { id: 2, fi: "juosta", en: "run", fiSimple: "Liikkua nopeasti.", enSimple: "Move fast.", topic: "verbs", pos: "verb" },
  { id: 3, fi: "aina", en: "always", fiSimple: "Joka kerta.", enSimple: "Every time.", topic: "time", pos: "adverb" }
];

describe("progress.utils", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats dates using the local calendar day", () => {
    expect(localDateIso(new Date(2026, 2, 5, 23, 59, 59))).toBe("2026-03-05");
  });

  it("builds progress stats from the tracked words", () => {
    const progressMap: ProgressMap = {
      1: {
        seen: 2,
        correct: 2,
        wrong: 0,
        known: true,
        needsPractice: false,
        lastReviewed: todayIso(),
        updatedAt: "2026-03-15T10:00:00.000Z"
      },
      2: {
        seen: 3,
        correct: 1,
        wrong: 2,
        known: false,
        needsPractice: true,
        lastReviewed: "2026-03-14",
        updatedAt: "2026-03-14T10:00:00.000Z"
      }
    };

    expect(buildProgressStats(words, progressMap, 5)).toEqual({
      totalWords: 3,
      knownCount: 1,
      needsPracticeCount: 1,
      reviewedToday: 1,
      totalCorrect: 3,
      totalWrong: 2,
      accuracy: 60,
      goalPct: 20
    });
  });

  it("summarizes tracked progress independently from the word list", () => {
    const progressMap: ProgressMap = {
      99: {
        seen: 1,
        correct: 1,
        wrong: 0,
        known: true,
        needsPractice: false,
        lastReviewed: todayIso(),
        updatedAt: null
      },
      100: {
        seen: 1,
        correct: 0,
        wrong: 1,
        known: false,
        needsPractice: true,
        lastReviewed: "2026-03-10",
        updatedAt: null
      }
    };

    expect(summarizeProgress(progressMap, 25)).toEqual({
      trackedWords: 2,
      known: 1,
      needsPractice: 1,
      reviewedToday: 1,
      dailyGoal: 25,
      totalCorrect: 1,
      totalWrong: 1,
      accuracy: 50
    });
  });

  it("counts a review streak through today or yesterday", () => {
    const progressMap: ProgressMap = {
      1: {
        seen: 1,
        correct: 1,
        wrong: 0,
        known: true,
        needsPractice: false,
        lastReviewed: "2026-03-16",
        updatedAt: null
      },
      2: {
        seen: 1,
        correct: 1,
        wrong: 0,
        known: false,
        needsPractice: false,
        lastReviewed: "2026-03-15",
        updatedAt: null
      },
      3: {
        seen: 1,
        correct: 0,
        wrong: 1,
        known: false,
        needsPractice: true,
        lastReviewed: "2026-03-14",
        updatedAt: null
      }
    };

    expect(calculateReviewStreak(progressMap, new Date(2026, 2, 16, 10, 0, 0))).toBe(3);
    expect(calculateReviewStreak(progressMap, new Date(2026, 2, 17, 10, 0, 0))).toBe(3);
    expect(calculateReviewStreak(progressMap, new Date(2026, 2, 18, 10, 0, 0))).toBe(0);
  });

  it("reads today's date from the local clock", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 15, 8, 45, 0));

    expect(todayIso()).toBe("2026-03-15");
  });

  it("accepts only valid timestamps", () => {
    expect(safeTimestamp("2026-03-15T10:00:00.000Z")).toBe("2026-03-15T10:00:00.000Z");
    expect(safeTimestamp("not-a-date")).toBeNull();
    expect(safeTimestamp("")).toBeNull();
  });
});
