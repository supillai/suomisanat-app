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
      className="surface-card rounded-[28px] px-5 py-6 md:px-8 md:py-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Progress</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">Track recall, goals, and optional cloud sync</h2>
        </div>
        {!cloudSync.showCloudSync && (
          <button type="button" className="action-secondary rounded-full px-4 py-2 text-sm font-semibold" onClick={cloudSync.openCloudSync}>
            Open Cloud Sync
          </button>
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

      <div className={`grid gap-4 md:grid-cols-4 ${cloudSync.showCloudSync ? "mt-5" : "mt-6"}`}>
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

      <div className="surface-subtle mt-5 rounded-[26px] p-5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="section-title">Daily goal progress</p>
          <span className="text-sm text-slate-700">
            {reviewedToday}/{dailyGoal}
          </span>
        </div>
        <div className="progress-track">
          <div className="progress-bar" style={{ width: `${goalPct}%` }} />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <label htmlFor="daily-goal" className="text-sm text-slate-700">
            Daily goal
          </label>
          <input
            id="daily-goal"
            type="number"
            min={5}
            max={200}
            className="text-input text-input-idle w-24"
            value={dailyGoal}
            onChange={(event) => onDailyGoalChange(Number(event.target.value))}
          />
        </div>
      </div>

      <div className="surface-subtle mt-5 rounded-[26px] p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="section-title">Daily mini drill</p>
            <p className="text-sm text-slate-600">Top 5 words selected from weak or stale items.</p>
          </div>
          <button className="action-primary rounded-full px-5 py-2.5 text-sm font-semibold" onClick={onStartMiniDrill}>
            Start Mini Drill
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {miniDrillRecommendations.map((item) => (
            <article key={`mini-drill-${item.word.id}`} className="rounded-[22px] border border-slate-200 bg-white p-4">
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
