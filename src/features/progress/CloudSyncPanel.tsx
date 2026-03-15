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

  return (
    <div className="surface-subtle rounded-[28px] p-4 md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${syncBadgeClass}`}>
              {syncBadgeLabel}
            </span>
            <span className="section-title">Cloud sync</span>
          </div>
          <p className="text-sm text-slate-700" role="status" aria-live="polite">
            {syncMessage}
          </p>
          <p className="text-xs text-slate-500">Last synced: {lastSyncedLabel}</p>
        </div>

        <button
          type="button"
          className="action-ghost flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
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
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="action-primary rounded-full px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              onClick={onSyncNow}
              disabled={!canManualSync}
            >
              Sync Now
            </button>
            {hasSupabaseConfig && session && (
              <button
                type="button"
                className="action-secondary rounded-full px-4 py-2 text-sm font-semibold"
                onClick={onSignOut}
                disabled={authBusy}
              >
                Sign Out
              </button>
            )}
          </div>

          {syncError && (
            <p className="text-sm text-rose-700" role="status" aria-live="polite">
              {syncError}
            </p>
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
                <p className="text-sm text-amber-900">
                  {syncConflict.mode === "cloud-empty"
                    ? "Choose whether to upload this browser snapshot to the cloud or discard it and keep the empty cloud state."
                    : showHistoryMismatchCopy
                      ? "The totals line up, but the progress is attached to different words or review dates. Pick one full snapshot to keep."
                      : "Choose one full snapshot: overwrite the cloud with this browser, or replace this browser with the current cloud snapshot."}
                </p>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <article className="rounded-[22px] border border-amber-200 bg-white/90 p-4">
                  <p className="eyebrow">This browser snapshot</p>
                  <p className="mt-2 text-sm text-slate-800">
                    {localSyncSummary.known} known, {localSyncSummary.needsPractice} practice, {localSyncSummary.reviewedToday} reviewed today
                  </p>
                  <p className="text-sm text-slate-600">
                    {localSyncSummary.trackedWords} tracked words, daily goal {localSyncSummary.dailyGoal}
                  </p>
                  <p className="text-sm text-slate-600">
                    {localSyncSummary.totalCorrect} correct, {localSyncSummary.totalWrong} wrong, {localSyncSummary.accuracy}% accuracy
                  </p>
                </article>
                <article className="rounded-[22px] border border-amber-200 bg-white/90 p-4">
                  <p className="eyebrow">Cloud snapshot</p>
                  <p className="mt-2 text-sm text-slate-800">
                    {cloudSyncSummary.known} known, {cloudSyncSummary.needsPractice} practice, {cloudSyncSummary.reviewedToday} reviewed today
                  </p>
                  <p className="text-sm text-slate-600">
                    {cloudSyncSummary.trackedWords} tracked words, daily goal {cloudSyncSummary.dailyGoal}
                  </p>
                  <p className="text-sm text-slate-600">
                    {cloudSyncSummary.totalCorrect} correct, {cloudSyncSummary.totalWrong} wrong, {cloudSyncSummary.accuracy}% accuracy
                  </p>
                </article>
              </div>

              {showHistoryMismatchCopy && (
                <p className="mt-4 text-sm text-amber-900">
                  Matching totals do not mean matching history. Review dates or word-level status can still differ and affect drills.
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-full bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => onResolveConflict("overwrite-cloud")}
                  disabled={syncStatus === "saving"}
                >
                  {syncConflict.mode === "cloud-empty" ? "Upload Browser Snapshot" : "Overwrite Cloud with Browser"}
                </button>
                <button
                  type="button"
                  className="rounded-full border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => onResolveConflict("use-cloud")}
                  disabled={syncStatus === "saving"}
                >
                  {syncConflict.mode === "cloud-empty" ? "Discard Browser Snapshot" : "Replace Browser with Cloud"}
                </button>
              </div>
            </div>
          )}

          <div>
            {hasSupabaseConfig && session && <p className="text-sm text-slate-600">Signed in as {session.user.email ?? "your account"}.</p>}
            {!hasSupabaseConfig && <p className="text-sm text-slate-600">Running in local-only mode.</p>}
          </div>

          {hasSupabaseConfig && !session && (
            <form
              className="flex w-full flex-col gap-2 sm:flex-row"
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
              <button type="submit" disabled={authBusy} className="action-primary rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60">
                {authBusy ? "Sending..." : "Email Link"}
              </button>
            </form>
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
