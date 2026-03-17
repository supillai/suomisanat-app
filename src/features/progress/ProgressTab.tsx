import { tabButtonId, tabPanelId } from "../app/app.constants";
import type { CloudSyncState } from "../sync/useCloudSync";
import type { MiniDrillRecommendation } from "../quiz/quiz.utils";
import { CloudSyncPanel } from "./CloudSyncPanel";

type ProgressTabProps = {
  knownCount: number;
  needsPracticeCount: number;
  accuracy: number;
  reviewedToday: number;
  dailyGoal: number;
  goalPct: number;
  miniDrillRecommendations: MiniDrillRecommendation[];
  cloudSync: CloudSyncState;
  onDailyGoalChange: (value: number) => void;
  onStartMiniDrill: () => void;
};

const getSyncSummaryTitle = (cloudSync: CloudSyncState): string => {
  if (!cloudSync.hasSupabaseConfig) {
    return "Cloud sync is off for this build";
  }

  if (cloudSync.syncConflict) {
    return "Cloud sync needs review";
  }

  if (cloudSync.syncStatus === "error") {
    return "Cloud sync hit an error";
  }

  if (!cloudSync.session) {
    return "Sign in to keep progress across browsers";
  }

  if (cloudSync.syncStatus === "loading") {
    return "Checking your cloud snapshot";
  }

  if (cloudSync.syncStatus === "saving") {
    return "Saving the latest study changes";
  }

  if (cloudSync.syncStatus === "synced") {
    return "Cloud sync is working";
  }

  return "Cloud sync is ready";
};

const getSyncActionLabel = (cloudSync: CloudSyncState): string => {
  if (cloudSync.showCloudSync) {
    return "Hide Sync Details";
  }

  if (cloudSync.syncConflict) {
    return "Resolve Sync";
  }

  if (cloudSync.syncStatus === "error") {
    return "Review Sync";
  }

  return "Open Cloud Sync";
};

const getConnectionLabel = (cloudSync: CloudSyncState): string => {
  if (!cloudSync.hasSupabaseConfig) {
    return "Local only";
  }

  return cloudSync.session ? "Signed in" : "Signed out";
};

export const ProgressTab = ({
  knownCount,
  needsPracticeCount,
  accuracy,
  reviewedToday,
  dailyGoal,
  goalPct,
  miniDrillRecommendations,
  cloudSync,
  onDailyGoalChange,
  onStartMiniDrill
}: ProgressTabProps) => {
  const syncSummaryTitle = getSyncSummaryTitle(cloudSync);
  const syncActionLabel = getSyncActionLabel(cloudSync);
  const syncConnectionLabel = getConnectionLabel(cloudSync);
  const handleSyncAction = cloudSync.showCloudSync ? cloudSync.hideCloudSync : cloudSync.openCloudSync;

  return (
    <section
      id={tabPanelId("progress")}
      role="tabpanel"
      aria-labelledby={tabButtonId("progress")}
      className="surface-card rounded-[28px] px-4 py-5 md:px-8 md:py-8"
    >
      <div>
        <p className="eyebrow">Progress</p>
        <h2 className="mt-2 text-2xl font-semibold text-ink">Track recall, goals, and sync state</h2>
      </div>

      <div className="surface-subtle mt-5 rounded-[26px] p-4 md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${cloudSync.syncBadgeClass}`}>
                {cloudSync.syncBadgeLabel}
              </span>
              <span className="section-title">Cloud sync</span>
            </div>
            <div className="space-y-1.5">
              <p className="text-lg font-semibold text-ink">{syncSummaryTitle}</p>
              <p className="text-sm leading-6 text-slate-700">{cloudSync.syncMessage}</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-700">
              <span className="inline-flex rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200">Last synced: {cloudSync.lastSyncedLabel}</span>
              <span className="inline-flex rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200">{syncConnectionLabel}</span>
            </div>
          </div>

          <button
            type="button"
            aria-label={syncActionLabel}
            aria-controls="cloud-sync-panel"
            aria-expanded={cloudSync.showCloudSync}
            className="action-secondary w-full rounded-full px-4 py-2 text-sm font-semibold lg:w-auto"
            onClick={handleSyncAction}
          >
            {syncActionLabel}
          </button>
        </div>

        {cloudSync.showCloudSync && (
          <div className="mt-4">
            <CloudSyncPanel
              isExpanded={cloudSync.showCloudSync}
              syncBadgeClass={cloudSync.syncBadgeClass}
              syncBadgeLabel={cloudSync.syncBadgeLabel}
              syncMessage={cloudSync.syncMessage}
              lastSyncedLabel={cloudSync.lastSyncedLabel}
              canManualSync={cloudSync.canManualSync}
              hasSupabaseConfig={cloudSync.hasSupabaseConfig}
              session={cloudSync.session}
              authBusy={cloudSync.authBusy}
              authEmail={cloudSync.authEmail}
              authMessage={cloudSync.authMessage}
              syncStatus={cloudSync.syncStatus}
              syncError={cloudSync.syncError}
              syncConflict={cloudSync.syncConflict}
              localSyncSummary={cloudSync.localSyncSummary}
              cloudSyncSummary={cloudSync.cloudSyncSummary}
              onHide={cloudSync.hideCloudSync}
              onSyncNow={() => {
                void cloudSync.flushSyncNow();
              }}
              onSignOut={() => {
                void cloudSync.signOut();
              }}
              onResolveConflict={(choice) => {
                void cloudSync.resolveSyncConflict(choice);
              }}
              onAuthEmailChange={cloudSync.setAuthEmail}
              onSendMagicLink={() => {
                void cloudSync.sendMagicLink();
              }}
            />
          </div>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <article className="metric-card">
          <p className="metric-label">Known Words</p>
          <p className="metric-value">{knownCount}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Needs Practice</p>
          <p className="metric-value">{needsPracticeCount}</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Accuracy</p>
          <p className="metric-value">{accuracy}%</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Reviewed Today</p>
          <p className="metric-value">{reviewedToday}</p>
        </article>
      </div>

      <div className="surface-subtle mt-5 rounded-[26px] p-4 md:p-5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="section-title">Daily goal progress</p>
          <span className="text-sm text-slate-700">
            {reviewedToday}/{dailyGoal}
          </span>
        </div>
        <div className="progress-track">
          <div className="progress-bar" style={{ width: `${goalPct}%` }} />
        </div>
        <div className="mt-4 flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:gap-3">
          <label htmlFor="daily-goal" className="text-sm text-slate-700">
            Daily goal
          </label>
          <input
            id="daily-goal"
            type="number"
            min={5}
            max={200}
            className="text-input text-input-idle w-full min-[420px]:w-24"
            value={dailyGoal}
            onChange={(event) => onDailyGoalChange(Number(event.target.value))}
          />
        </div>
      </div>

      <div className="surface-subtle mt-5 rounded-[26px] p-4 md:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="section-title">Daily mini drill</p>
            <p className="text-sm text-slate-600 md:hidden">Top 5 weak or stale words.</p>
            <p className="hidden text-sm text-slate-600 md:block">Top 5 words selected from weak or stale items.</p>
          </div>
          <button aria-label="Start Mini Drill" className="action-primary w-full rounded-full px-5 py-2.5 text-sm font-semibold sm:w-auto" onClick={onStartMiniDrill}>
            <span className="md:hidden">Mini Drill</span>
            <span className="hidden md:inline">Start Mini Drill</span>
          </button>
        </div>

        <div className="touch-scroll-row mt-4 flex gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-5">
          {miniDrillRecommendations.map((item) => (
            <article key={`mini-drill-${item.word.id}`} className="min-w-[220px] flex-none rounded-[22px] border border-slate-200 bg-white p-4 sm:min-w-0">
              <p className="text-lg font-semibold text-ink" lang="fi">
                {item.word.fi}
              </p>
              <p className="text-sm text-slate-700">{item.word.en}</p>
              <p className="mt-2 text-sm text-slate-600">{item.reason}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
