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
  <div className="app-frame px-4 py-2 md:px-8 md:py-3">
    <div className="mx-auto max-w-6xl">{children}</div>
  </div>
);

const AppFooter = () => (
  <footer className="mt-6 border-t border-slate-200 pt-4 text-xs text-slate-600 md:mt-8">
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <span>SuomiSanat — offline-first Finnish vocab trainer.</span>
    </div>
  </footer>
);

const TabLoadingCard = ({ label }: { label: string }) => (
  <section className="surface-card loading-panel rounded-[28px] px-4 py-5 md:px-6 md:py-8">
    <p className="eyebrow">Loading</p>
    <h2 className="mt-2 text-2xl font-semibold text-ink">{label}</h2>
    <p className="mt-1.5 text-sm text-slate-600 md:hidden">Restoring this tab.</p>
    <p className="mt-2 hidden max-w-2xl text-sm text-slate-600 md:block">Preparing this workspace and restoring the latest local state.</p>
    <div className="mt-5 space-y-3 md:mt-6">
      <div className="skeleton-block h-18 rounded-3xl md:h-20" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="skeleton-block h-24 rounded-3xl md:h-28" />
        <div className="skeleton-block h-24 rounded-3xl md:h-28" />
        <div className="skeleton-block hidden h-24 rounded-3xl md:block md:h-28" />
      </div>
    </div>
  </section>
);

const DatasetStateCard = ({
  title,
  body,
  mobileBody,
  actionLabel,
  onAction
}: {
  title: string;
  body: string;
  mobileBody?: string;
  actionLabel?: string;
  onAction?: () => void;
}) => (
  <AppFrame>
    <section className="surface-card rounded-[30px] px-5 py-6 md:rounded-[32px] md:px-8 md:py-10">
      <div className="max-w-2xl space-y-3">
        <p className="eyebrow">SuomiSanat</p>
        <h1 className="text-[2rem] font-semibold leading-tight tracking-tight text-ink md:text-4xl">{title}</h1>
        <p className="text-sm leading-6 text-slate-700 md:hidden">{mobileBody ?? body}</p>
        <p className="hidden text-base leading-7 text-slate-700 md:block">{body}</p>
        {actionLabel && onAction && (
          <button type="button" className="action-primary mt-3 w-full rounded-full px-5 py-3 text-sm font-semibold sm:w-auto" onClick={onAction}>
            {actionLabel}
          </button>
        )}
      </div>
    </section>
  </AppFrame>
);

const SyncAttentionBanner = ({
  message,
  actionLabel,
  toneClassName,
  onAction
}: {
  message: string;
  actionLabel: string;
  toneClassName: string;
  onAction: () => void;
}) => (
  <section className={`surface-card mb-3 flex flex-col gap-3 rounded-[24px] px-4 py-3 md:mb-4 md:flex-row md:items-center md:justify-between md:px-5 ${toneClassName}`}>
    <div className="space-y-1">
      <p className="eyebrow opacity-70">Sync</p>
      <p className="text-sm font-semibold leading-6">{message}</p>
    </div>
    <button type="button" className="action-secondary w-full rounded-full px-4 py-2 text-sm font-semibold md:w-auto" onClick={onAction}>
      {actionLabel}
    </button>
  </section>
);

const AppShell = () => {
  const { tab, setTab, cloudSync } = useAppState();
  const showSyncBanner = tab !== "progress" && (cloudSync.syncBadgeLabel === "Action needed" || cloudSync.syncBadgeLabel === "Error");
  const syncBannerToneClassName = cloudSync.syncBadgeLabel === "Error"
    ? "border-rose-200 bg-rose-50 text-rose-900"
    : "border-amber-200 bg-amber-50 text-amber-950";
  const syncBannerMessage = cloudSync.syncBadgeLabel === "Error"
    ? "Cloud sync needs attention. Review the issue in Progress."
    : "Cloud sync needs review. Resolve the browser and cloud snapshot in Progress.";
  const syncBannerActionLabel = cloudSync.syncBadgeLabel === "Error" ? "Review Sync" : "Resolve Sync";

  const handleOpenProgressSync = (): void => {
    cloudSync.openCloudSync();
    setTab("progress");
  };

  return (
    <AppFrame>
      <AppHeader tab={tab} syncBadgeLabel={cloudSync.syncBadgeLabel} onTabChange={setTab} />

      {showSyncBanner && (
        <SyncAttentionBanner
          message={syncBannerMessage}
          actionLabel={syncBannerActionLabel}
          toneClassName={syncBannerToneClassName}
          onAction={handleOpenProgressSync}
        />
      )}

      <Suspense fallback={<TabLoadingCard label={tab === "list" ? "Word List" : tab.charAt(0).toUpperCase() + tab.slice(1)} />}>
        {tab === "study" && <StudyTabScreen />}
        {tab === "quiz" && <QuizTabScreen />}
        {tab === "list" && <WordListTabScreen />}
        {tab === "progress" && <ProgressTabScreen />}
      </Suspense>

      <AppFooter />
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
        mobileBody="Preparing the Finnish word pack for study."
      />
    );
  }

  if (dataset.status === "error" || !dataset.words) {
    return (
      <DatasetStateCard
        title="Vocabulary data could not load"
        body={dataset.error ?? "The word dataset failed validation or could not be fetched."}
        mobileBody="Could not open the Finnish word pack in this browser."
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






















































