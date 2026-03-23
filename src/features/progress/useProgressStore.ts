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

export type ReplaceSnapshotOptions = {
  preserveDirty?: boolean;
  dailyGoalUpdatedAt?: string | null;
};

export type MarkWord = (word: VocabularyWord, isCorrect: boolean, options?: MarkWordOptions) => void;

export type ProgressStore = {
  progressMap: ProgressMap;
  progressMapRef: MutableRefObject<ProgressMap>;
  dirtyWordIdsRef: MutableRefObject<Set<number>>;
  dailyGoal: number;
  dailyGoalRef: MutableRefObject<number>;
  dailyGoalUpdatedAtRef: MutableRefObject<string | null>;
  settingsDirtyRef: MutableRefObject<boolean>;
  stats: ProgressStats;
  localSyncSummary: ProgressSummary;
  updateDailyGoal: (nextGoal: number) => void;
  replaceSnapshot: (nextProgress: ProgressMap, nextDailyGoal: number, options?: ReplaceSnapshotOptions) => void;
  setWordStatus: (word: VocabularyWord, status: WordStatus) => void;
  markWord: MarkWord;
};

export const useProgressStore = (wordList: VocabularyWord[]): ProgressStore => {
  const [progressMap, setProgressMap] = useState<ProgressMap>(() => safeReadProgress());
  const [dailyGoal, setDailyGoal] = useState<number>(() => safeReadDailyGoal());

  const progressMapRef = useRef<ProgressMap>(progressMap);
  const dirtyWordIdsRef = useRef<Set<number>>(new Set());
  const dailyGoalRef = useRef<number>(dailyGoal);
  const dailyGoalUpdatedAtRef = useRef<string | null>(null);
  const settingsDirtyRef = useRef(false);

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

  const replaceSnapshot = useCallback((
    nextProgress: ProgressMap,
    nextDailyGoal: number,
    options?: ReplaceSnapshotOptions
  ): void => {
    progressMapRef.current = nextProgress;
    dailyGoalRef.current = nextDailyGoal;

    if (!options?.preserveDirty) {
      dirtyWordIdsRef.current = new Set();
      settingsDirtyRef.current = false;
    }

    if (typeof options?.dailyGoalUpdatedAt !== "undefined") {
      dailyGoalUpdatedAtRef.current = options.dailyGoalUpdatedAt;
    }

    setProgressMap(nextProgress);
    setDailyGoal(nextDailyGoal);
  }, []);

  const updateDailyGoal = (nextGoal: number): void => {
    if (!Number.isFinite(nextGoal) || nextGoal <= 0) return;

    const normalizedGoal = Math.round(nextGoal);
    if (normalizedGoal === dailyGoalRef.current) return;

    dailyGoalRef.current = normalizedGoal;
    dailyGoalUpdatedAtRef.current = new Date().toISOString();
    settingsDirtyRef.current = true;
    setDailyGoal(normalizedGoal);
  };

  const setWordStatus = (word: VocabularyWord, status: WordStatus): void => {
    setProgressMap((current) => {
      const updatedAt = new Date().toISOString();
      const next = {
        ...current,
        [word.id]: {
          ...(current[word.id] ?? createEmptyProgressState()),
          known: status === "known",
          needsPractice: status === "practice",
          updatedAt
        }
      };

      progressMapRef.current = next;
      dirtyWordIdsRef.current = new Set(dirtyWordIdsRef.current).add(word.id);
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
      dirtyWordIdsRef.current = new Set(dirtyWordIdsRef.current).add(word.id);
      return next;
    });
  };

  const stats = useMemo(() => buildProgressStats(wordList, progressMap, dailyGoal), [dailyGoal, progressMap, wordList]);
  const localSyncSummary = useMemo(() => summarizeProgress(progressMap, dailyGoal), [dailyGoal, progressMap]);

  return {
    progressMap,
    progressMapRef,
    dirtyWordIdsRef,
    dailyGoal,
    dailyGoalRef,
    dailyGoalUpdatedAtRef,
    settingsDirtyRef,
    stats,
    localSyncSummary,
    updateDailyGoal,
    replaceSnapshot,
    setWordStatus,
    markWord
  };
};
