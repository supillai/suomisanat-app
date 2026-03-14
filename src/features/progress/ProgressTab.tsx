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
      className="glass card-shadow rounded-3xl p-5 md:p-8"
    >
      {cloudSync.showCloudSync && (
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
      )}

      <div className={`${cloudSync.showCloudSync ? "mt-5 " : ""}grid gap-4 md:grid-cols-4`}>
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-600">Known Words</p>
          <p className="mt-2 text-3xl font-bold text-ink">{knownCount}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-600">Needs Practice</p>
          <p className="mt-2 text-3xl font-bold text-ink">{needsPracticeCount}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-600">Accuracy</p>
          <p className="mt-2 text-3xl font-bold text-ink">{accuracy}%</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-600">Reviewed Today</p>
          <p className="mt-2 text-3xl font-bold text-ink">{reviewedToday}</p>
        </article>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">Daily goal progress</p>
          <span className="text-xs text-slate-700">
            {reviewedToday}/{dailyGoal}
          </span>
        </div>
        <div className="h-3 rounded-full bg-slate-200">
          <div className="h-3 rounded-full bg-accent" style={{ width: `${goalPct}%` }} />
        </div>
        <div className="mt-4 flex items-center gap-2">
          <label htmlFor="daily-goal" className="text-sm text-slate-700">
            Daily goal
          </label>
          <input
            id="daily-goal"
            type="number"
            min={5}
            max={200}
            className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-900"
            value={dailyGoal}
            onChange={(event) => onDailyGoalChange(Number(event.target.value))}
          />
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-ink">Daily Mini Drill</p>
            <p className="text-xs text-slate-700">Top 5 words selected from weak or stale items.</p>
          </div>
          <button className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900" onClick={onStartMiniDrill}>
            Start Mini Drill
          </button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {miniDrillRecommendations.map((item) => (
            <article key={`mini-drill-${item.word.id}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-base font-bold text-ink">{item.word.fi}</p>
              <p className="text-xs text-slate-700">{item.word.en}</p>
              <p className="mt-2 text-xs text-slate-600">{item.reason}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
