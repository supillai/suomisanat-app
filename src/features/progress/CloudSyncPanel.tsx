import type { Session } from "@supabase/supabase-js";
import type { ProgressSummary } from "./progress.utils";
import type { SyncConflict, SyncResolutionChoice, SyncStatus } from "../sync/sync.types";

type CloudSyncPanelProps = {
  isExpanded: boolean;
  syncBadgeClass: string;
  syncBadgeLabel: string;
  syncMessage: string;
  lastSyncedLabel: string;
  canManualSync: boolean;
  hasSupabaseConfig: boolean;
  session: Session | null;
  authBusy: boolean;
  authEmail: string;
  authMessage: string;
  syncStatus: SyncStatus;
  syncError: string | null;
  syncConflict: SyncConflict | null;
  localSyncSummary: ProgressSummary;
  cloudSyncSummary: ProgressSummary | null;
  onHide: () => void;
  onSyncNow: () => void;
  onSignOut: () => void;
  onResolveConflict: (choice: SyncResolutionChoice) => void;
  onAuthEmailChange: (value: string) => void;
  onSendMagicLink: () => void;
};

type SnapshotSummaryCardProps = {
  title: string;
  summary: ProgressSummary;
};

const SnapshotSummaryCard = ({ title, summary }: SnapshotSummaryCardProps) => (
  <article className="min-w-[250px] flex-none rounded-[22px] border border-amber-200 bg-white/90 p-4 sm:min-w-0">
    <p className="eyebrow">{title}</p>
    <p className="mt-2 text-sm text-slate-800">
      {summary.known} known, {summary.needsPractice} practice, {summary.reviewedToday} reviewed today
    </p>
    <div className="mt-3 grid grid-cols-2 gap-2">
      <div className="rounded-[18px] bg-slate-50 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Tracked</p>
        <p className="mt-1 text-sm font-semibold text-ink">{summary.trackedWords}</p>
      </div>
      <div className="rounded-[18px] bg-slate-50 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Goal</p>
        <p className="mt-1 text-sm font-semibold text-ink">{summary.dailyGoal}</p>
      </div>
      <div className="rounded-[18px] bg-slate-50 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Correct</p>
        <p className="mt-1 text-sm font-semibold text-ink">{summary.totalCorrect}</p>
      </div>
      <div className="rounded-[18px] bg-slate-50 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Accuracy</p>
        <p className="mt-1 text-sm font-semibold text-ink">{summary.accuracy}%</p>
      </div>
    </div>
    <p className="mt-3 text-xs text-slate-600">{summary.totalWrong} wrong answers recorded.</p>
  </article>
);

export const CloudSyncPanel = ({
  isExpanded,
  syncBadgeClass,
  syncBadgeLabel,
  syncMessage,
  lastSyncedLabel,
  canManualSync,
  hasSupabaseConfig,
  session,
  authBusy,
  authEmail,
  authMessage,
  syncStatus,
  syncError,
  syncConflict,
  localSyncSummary,
  cloudSyncSummary,
  onHide,
  onSyncNow,
  onSignOut,
  onResolveConflict,
  onAuthEmailChange,
  onSendMagicLink
}: CloudSyncPanelProps) => {
  const summariesMatch = Boolean(
    syncConflict &&
      cloudSyncSummary &&
      localSyncSummary.trackedWords === cloudSyncSummary.trackedWords &&
      localSyncSummary.known === cloudSyncSummary.known &&
      localSyncSummary.needsPractice === cloudSyncSummary.needsPractice &&
      localSyncSummary.reviewedToday === cloudSyncSummary.reviewedToday &&
      localSyncSummary.dailyGoal === cloudSyncSummary.dailyGoal &&
      localSyncSummary.totalCorrect === cloudSyncSummary.totalCorrect &&
      localSyncSummary.totalWrong === cloudSyncSummary.totalWrong
  );
  const showHistoryMismatchCopy = syncConflict?.mode === "different-data" && summariesMatch;
  const connectionLabel = !hasSupabaseConfig
    ? "Local-only mode"
    : session
      ? `Signed in as ${session.user.email ?? "your account"}`
      : "Signed out";
  const connectionMetaLabel = !hasSupabaseConfig
    ? "Configure Supabase to enable cloud sync."
    : session
      ? "Cloud sync is available in this browser."
      : "Progress stays in this browser until you sign in.";

  return (
    <div className="surface-subtle rounded-[28px] p-4 md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${syncBadgeClass}`}>
              {syncBadgeLabel}
            </span>
            <span className="section-title">Cloud sync</span>
          </div>
          <p className="text-sm leading-5 text-slate-700" role="status" aria-live="polite">
            {syncMessage}
          </p>
          <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-700">
            <span className="inline-flex rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200">Last synced: {lastSyncedLabel}</span>
            <span className="inline-flex rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200">{connectionLabel}</span>
          </div>
          <p className="text-xs text-slate-500">{connectionMetaLabel}</p>
        </div>

        <button
          type="button"
          className="action-ghost inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold md:w-auto"
          onClick={onHide}
          aria-expanded={isExpanded}
          aria-controls="cloud-sync-panel"
        >
          Hide details
          <svg viewBox="0 0 20 20" aria-hidden="true" className="cloud-sync-chevron h-4 w-4 text-slate-500" data-open={isExpanded}>
            <path
              d="M5.75 7.75 10 12l4.25-4.25"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
            />
          </svg>
        </button>
      </div>

      <div id="cloud-sync-panel" className="mt-4 border-t border-slate-200 pt-4">
        <div className="flex flex-col gap-4">
          {hasSupabaseConfig && session && (
            <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
              <button
                type="button"
                className="action-primary w-full rounded-full px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                onClick={onSyncNow}
                disabled={!canManualSync}
              >
                Sync Now
              </button>
              <button
                type="button"
                className="action-secondary w-full rounded-full px-4 py-2 text-sm font-semibold sm:w-auto"
                onClick={onSignOut}
                disabled={authBusy}
              >
                Sign Out
              </button>
            </div>
          )}

          {syncError && (
            <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3">
              <p className="text-sm text-rose-700" role="status" aria-live="polite">
                {syncError}
              </p>
            </div>
          )}

          {syncConflict && cloudSyncSummary && (
            <div className="rounded-[28px] border border-amber-300 bg-amber-50 p-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-amber-950">
                  {syncConflict.mode === "cloud-empty"
                    ? "Cloud snapshot is empty"
                    : showHistoryMismatchCopy
                      ? "Totals match, but per-word history differs"
                      : "Browser and cloud snapshots differ"}
                </p>
                <p className="text-sm leading-5 text-amber-900">
                  {syncConflict.mode === "cloud-empty"
                    ? "Choose whether to upload this browser snapshot to the cloud or discard it and keep the empty cloud state."
                    : showHistoryMismatchCopy
                      ? "The totals line up, but the progress is attached to different words or review dates. Pick one full snapshot to keep."
                      : "Choose one full snapshot: overwrite the cloud with this browser, or replace this browser with the current cloud snapshot."}
                </p>
              </div>

              <div className="touch-scroll-row mt-4 flex gap-3 overflow-x-auto pb-1 md:grid md:grid-cols-2 md:overflow-visible md:pb-0">
                <SnapshotSummaryCard title="This browser snapshot" summary={localSyncSummary} />
                <SnapshotSummaryCard title="Cloud snapshot" summary={cloudSyncSummary} />
              </div>

              {showHistoryMismatchCopy && (
                <p className="mt-4 text-sm text-amber-900">
                  Matching totals do not mean matching history. Review dates or word-level status can still differ and affect drills.
                </p>
              )}

              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  className="w-full rounded-full bg-amber-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  onClick={() => onResolveConflict("overwrite-cloud")}
                  disabled={syncStatus === "saving"}
                >
                  {syncConflict.mode === "cloud-empty" ? "Upload Browser Snapshot" : "Overwrite Cloud with Browser"}
                </button>
                <button
                  type="button"
                  className="w-full rounded-full border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-950 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  onClick={() => onResolveConflict("use-cloud")}
                  disabled={syncStatus === "saving"}
                >
                  {syncConflict.mode === "cloud-empty" ? "Discard Browser Snapshot" : "Replace Browser with Cloud"}
                </button>
              </div>
            </div>
          )}

          {hasSupabaseConfig && !session && (
            <div className="rounded-[24px] border border-slate-200 bg-white p-4">
              <div className="space-y-1">
                <p className="section-title">Sign in to sync</p>
                <p className="text-sm text-slate-600">Email yourself a one-time sign-in link for this browser.</p>
              </div>
              <form
                className="mt-3 flex w-full flex-col gap-2 sm:flex-row"
                onSubmit={(event) => {
                  event.preventDefault();
                  onSendMagicLink();
                }}
              >
                <label htmlFor="sync-email" className="sr-only">
                  Email address for sign-in link
                </label>
                <input
                  id="sync-email"
                  type="email"
                  required
                  autoComplete="email"
                  className="text-input text-input-idle"
                  placeholder="you@example.com"
                  value={authEmail}
                  onChange={(event) => onAuthEmailChange(event.target.value)}
                />
                <button type="submit" disabled={authBusy} className="action-primary w-full rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60 sm:w-auto">
                  {authBusy ? "Sending..." : "Email Link"}
                </button>
              </form>
            </div>
          )}

          {authMessage && (
            <p className="text-sm text-slate-700" role="status" aria-live="polite">
              {authMessage}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

