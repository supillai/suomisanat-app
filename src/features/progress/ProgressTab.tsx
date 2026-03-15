import { CloudSyncPanel } from "./CloudSyncPanel";
import { tabButtonId, tabPanelId } from "../app/app.constants";
import type { CloudSyncState } from "../sync/useCloudSync";
import type { MiniDrillRecommendation } from "../quiz/quiz.utils";

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
  return (
    <section
      id={tabPanelId("progress")}
      role="tabpanel"
      aria-labelledby={tabButtonId("progress")}
      className="surface-card rounded-[28px] px-4 py-5 md:px-8 md:py-8"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="eyebrow">Progress</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">Track recall, goals, and optional cloud sync</h2>
        </div>
        {!cloudSync.showCloudSync && (
          <div className="flex flex-col gap-2 sm:items-end">
            <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${cloudSync.syncBadgeClass}`}>
              {cloudSync.syncBadgeLabel}
            </span>
            <button type="button" aria-label="Open Cloud Sync" className="action-secondary w-full rounded-full px-4 py-2 text-sm font-semibold sm:w-auto" onClick={cloudSync.openCloudSync}>
              <span className="md:hidden">Cloud Sync</span>
              <span className="hidden md:inline">Open Cloud Sync</span>
            </button>
          </div>
        )}
      </div>

      {cloudSync.showCloudSync && (
        <div className="mt-5">
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

      <div className={`grid grid-cols-2 gap-3 md:grid-cols-4 ${cloudSync.showCloudSync ? "mt-5" : "mt-6"}`}>
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
