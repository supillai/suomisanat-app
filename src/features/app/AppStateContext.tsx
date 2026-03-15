import { createContext, startTransition, useContext, useState } from "react";
import type { PropsWithChildren } from "react";
import type { VocabularyWord } from "../../types";
import { useProgressStore } from "../progress/useProgressStore";
import type { ProgressStore } from "../progress/useProgressStore";
import { useCloudSync } from "../sync/useCloudSync";
import type { CloudSyncState } from "../sync/useCloudSync";
import { useStudySession } from "../study/useStudySession";
import type { StudySession } from "../study/useStudySession";
import { useQuizSession } from "../quiz/useQuizSession";
import type { QuizSession } from "../quiz/useQuizSession";
import { useWordFilters } from "../words/useWordFilters";
import type { WordFilters } from "../words/useWordFilters";
import type { Tab } from "./app.types";

type AppState = {
  words: VocabularyWord[];
  tab: Tab;
  setTab: (tab: Tab) => void;
  progressStore: ProgressStore;
  studySession: StudySession;
  quizSession: QuizSession;
  wordFilters: WordFilters;
  cloudSync: CloudSyncState;
  openCloudSyncSettings: () => void;
  startMiniDrill: () => void;
};

const AppStateContext = createContext<AppState | null>(null);

type AppStateProviderProps = PropsWithChildren<{
  words: VocabularyWord[];
}>;

export const AppStateProvider = ({ words, children }: AppStateProviderProps) => {
  const [tab, setTabState] = useState<Tab>("study");

  const progressStore = useProgressStore(words);
  const studySession = useStudySession({
    words,
    progressMap: progressStore.progressMap,
    markWord: progressStore.markWord
  });
  const quizSession = useQuizSession({
    words,
    progressMap: progressStore.progressMap,
    markWord: progressStore.markWord
  });
  const wordFilters = useWordFilters(words, progressStore.progressMap);
  const cloudSync = useCloudSync({
    progressMap: progressStore.progressMap,
    progressMapRef: progressStore.progressMapRef,
    dailyGoal: progressStore.dailyGoal,
    dailyGoalRef: progressStore.dailyGoalRef,
    replaceSnapshot: progressStore.replaceSnapshot,
    localSyncSummary: progressStore.localSyncSummary
  });

  const setTab = (nextTab: Tab): void => {
    startTransition(() => {
      setTabState(nextTab);
    });
  };

  const openCloudSyncSettings = (): void => {
    cloudSync.openCloudSync();
    setTab("progress");
  };

  const startMiniDrill = (): void => {
    quizSession.startMiniDrill();
    setTab("quiz");
  };

  const value: AppState = {
    words,
    tab,
    setTab,
    progressStore,
    studySession,
    quizSession,
    wordFilters,
    cloudSync,
    openCloudSyncSettings,
    startMiniDrill
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
};

export const useAppState = (): AppState => {
  const value = useContext(AppStateContext);

  if (!value) {
    throw new Error("useAppState must be used within AppStateProvider.");
  }

  return value;
};
