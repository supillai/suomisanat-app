import { Suspense, lazy } from "react";
import type { ReactNode } from "react";
import { AppHeader } from "./features/app/AppHeader";
import { AppStateProvider, useAppState } from "./features/app/AppStateContext";
import { useWordDataset } from "./features/app/useWordDataset";

const StudyTabScreen = lazy(() => import("./features/study/StudyTabScreen"));
const QuizTabScreen = lazy(() => import("./features/quiz/QuizTabScreen"));
const WordListTabScreen = lazy(() => import("./features/words/WordListTabScreen"));
const ProgressTabScreen = lazy(() => import("./features/progress/ProgressTabScreen"));

const AppFrame = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen px-4 py-5 md:px-8 md:py-8">
    <div className="mx-auto max-w-6xl">{children}</div>
  </div>
);

const TabLoadingCard = ({ label }: { label: string }) => (
  <section className="surface-card loading-panel rounded-[28px] px-6 py-8">
    <p className="eyebrow">Loading</p>
    <h2 className="mt-3 text-2xl font-semibold text-ink">{label}</h2>
    <p className="mt-2 max-w-2xl text-sm text-slate-600">Preparing this workspace and restoring the latest local state.</p>
    <div className="mt-6 grid gap-3 md:grid-cols-3">
      <div className="skeleton-block h-28 rounded-3xl" />
      <div className="skeleton-block h-28 rounded-3xl" />
      <div className="skeleton-block h-28 rounded-3xl" />
    </div>
  </section>
);

const DatasetStateCard = ({
  title,
  body,
  actionLabel,
  onAction
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) => (
  <AppFrame>
    <section className="surface-card rounded-[32px] px-6 py-8 md:px-8 md:py-10">
      <div className="max-w-2xl space-y-3">
        <p className="eyebrow">SuomiSanat</p>
        <h1 className="text-3xl font-semibold tracking-tight text-ink md:text-4xl">{title}</h1>
        <p className="text-base leading-7 text-slate-700">{body}</p>
        {actionLabel && onAction && (
          <button type="button" className="action-primary mt-3 rounded-full px-5 py-3 text-sm font-semibold" onClick={onAction}>
            {actionLabel}
          </button>
        )}
      </div>
    </section>
  </AppFrame>
);

const AppShell = () => {
  const { tab, setTab, progressStore, cloudSync, openCloudSyncSettings } = useAppState();

  return (
    <AppFrame>
      <AppHeader
        tab={tab}
        totalWords={progressStore.stats.totalWords}
        knownCount={progressStore.stats.knownCount}
        syncBadgeLabel={cloudSync.syncBadgeLabel}
        syncBadgeClass={cloudSync.syncBadgeClass}
        onTabChange={setTab}
        onOpenCloudSync={openCloudSyncSettings}
      />

      <Suspense fallback={<TabLoadingCard label={tab === "list" ? "Word List" : tab.charAt(0).toUpperCase() + tab.slice(1)} />}>
        {tab === "study" && <StudyTabScreen />}
        {tab === "quiz" && <QuizTabScreen />}
        {tab === "list" && <WordListTabScreen />}
        {tab === "progress" && <ProgressTabScreen />}
      </Suspense>
    </AppFrame>
  );
};

export default function App() {
  const dataset = useWordDataset();

  if (dataset.status === "loading") {
    return (
      <DatasetStateCard
        title="Loading vocabulary set"
        body="Fetching the current SuomiSanat word pack and validating its structure before the study tools mount."
      />
    );
  }

  if (dataset.status === "error" || !dataset.words) {
    return (
      <DatasetStateCard
        title="Vocabulary data could not load"
        body={dataset.error ?? "The word dataset failed validation or could not be fetched."}
        actionLabel="Retry"
        onAction={dataset.reload}
      />
    );
  }

  return (
    <AppStateProvider words={dataset.words}>
      <AppShell />
    </AppStateProvider>
  );
}





















