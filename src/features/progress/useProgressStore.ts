import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import type { ProgressMap, VocabularyWord } from "../../types";
import {
  buildProgressStats,
  createEmptyProgressState,
  persistDailyGoal,
  persistProgress,
  safeReadDailyGoal,
  safeReadProgress,
  summarizeProgress,
  todayIso
} from "./progress.utils";
import type { ProgressStats, ProgressSummary } from "./progress.utils";

export type WordStatus = "known" | "practice" | "clear";

export type MarkWordOptions = {
  known?: boolean;
  needsPractice?: boolean;
};

export type MarkWord = (word: VocabularyWord, isCorrect: boolean, options?: MarkWordOptions) => void;

export type ProgressStore = {
  progressMap: ProgressMap;
  progressMapRef: MutableRefObject<ProgressMap>;
  dailyGoal: number;
  dailyGoalRef: MutableRefObject<number>;
  stats: ProgressStats;
  localSyncSummary: ProgressSummary;
  updateDailyGoal: (nextGoal: number) => void;
  replaceSnapshot: (nextProgress: ProgressMap, nextDailyGoal: number) => void;
  setWordStatus: (word: VocabularyWord, status: WordStatus) => void;
  markWord: MarkWord;
};

export const useProgressStore = (wordList: VocabularyWord[]): ProgressStore => {
  const [progressMap, setProgressMap] = useState<ProgressMap>(() => safeReadProgress());
  const [dailyGoal, setDailyGoal] = useState<number>(() => safeReadDailyGoal());

  const progressMapRef = useRef<ProgressMap>(progressMap);
  const dailyGoalRef = useRef<number>(dailyGoal);

  useEffect(() => {
    persistProgress(progressMap);
  }, [progressMap]);

  useEffect(() => {
    persistDailyGoal(dailyGoal);
  }, [dailyGoal]);

  useEffect(() => {
    progressMapRef.current = progressMap;
  }, [progressMap]);

  useEffect(() => {
    dailyGoalRef.current = dailyGoal;
  }, [dailyGoal]);

  const replaceSnapshot = useCallback((nextProgress: ProgressMap, nextDailyGoal: number): void => {
    progressMapRef.current = nextProgress;
    dailyGoalRef.current = nextDailyGoal;
    setProgressMap(nextProgress);
    setDailyGoal(nextDailyGoal);
  }, []);

  const updateDailyGoal = (nextGoal: number): void => {
    if (!Number.isFinite(nextGoal) || nextGoal <= 0) return;

    const normalizedGoal = Math.round(nextGoal);
    dailyGoalRef.current = normalizedGoal;
    setDailyGoal(normalizedGoal);
  };

  const setWordStatus = (word: VocabularyWord, status: WordStatus): void => {
    setProgressMap((current) => {
      const next = {
        ...current,
        [word.id]: {
          ...(current[word.id] ?? createEmptyProgressState()),
          known: status === "known",
          needsPractice: status === "practice",
          updatedAt: new Date().toISOString()
        }
      };

      progressMapRef.current = next;
      return next;
    });
  };

  const markWord: MarkWord = (word, isCorrect, options) => {
    setProgressMap((current) => {
      const updatedAt = new Date().toISOString();
      const previousState = current[word.id] ?? createEmptyProgressState();

      const next = {
        ...current,
        [word.id]: {
          seen: previousState.seen + 1,
          correct: previousState.correct + (isCorrect ? 1 : 0),
          wrong: previousState.wrong + (isCorrect ? 0 : 1),
          known: typeof options?.known === "boolean" ? options.known : previousState.known,
          needsPractice:
            typeof options?.needsPractice === "boolean" ? options.needsPractice : previousState.needsPractice,
          lastReviewed: todayIso(),
          updatedAt
        }
      };

      progressMapRef.current = next;
      return next;
    });
  };

  const stats = useMemo(() => buildProgressStats(wordList, progressMap, dailyGoal), [dailyGoal, progressMap, wordList]);
  const localSyncSummary = useMemo(() => summarizeProgress(progressMap, dailyGoal), [dailyGoal, progressMap]);

  return {
    progressMap,
    progressMapRef,
    dailyGoal,
    dailyGoalRef,
    stats,
    localSyncSummary,
    updateDailyGoal,
    replaceSnapshot,
    setWordStatus,
    markWord
  };
};
