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
  mobileTitle: string;
  summary: ProgressSummary;
};

const SnapshotSummaryCard = ({ title, mobileTitle, summary }: SnapshotSummaryCardProps) => (
  <article className="min-w-[244px] flex-none rounded-[22px] border border-amber-200 bg-white/90 p-4 sm:min-w-0">
    <div className="flex items-center justify-between gap-2">
      <p className="eyebrow md:hidden">{mobileTitle}</p>
      <p className="hidden md:block eyebrow">{title}</p>
      <span className="inline-flex rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200 md:hidden">
        Today {summary.reviewedToday}
      </span>
    </div>
    <p className="mt-2 text-sm text-slate-800 md:hidden">{summary.known} known · {summary.needsPractice} practice</p>
    <p className="mt-2 hidden text-sm text-slate-800 md:block">
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
    <p className="mt-3 hidden text-xs text-slate-600 md:block">{summary.totalWrong} wrong answers recorded.</p>
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
  const sessionEmail = session?.user.email?.trim() ?? "";
  const compactEmail = sessionEmail.length > 28 ? `${sessionEmail.slice(0, 28)}...` : sessionEmail;
  const connectionLabel = !hasSupabaseConfig ? "Local only" : session ? "Signed in" : "Signed out";
  const connectionMetaLabel = !hasSupabaseConfig
    ? "Configure Supabase to enable cloud sync."
    : session
      ? sessionEmail || "Cloud sync is available in this browser."
      : "Progress stays in this browser until you sign in.";
  const mobileConnectionMeta = !hasSupabaseConfig
    ? "Add Supabase config to enable sync."
    : session
      ? compactEmail || "Ready on this browser."
      : "Send a one-time link to sync here.";
  const conflictDescription = syncConflict?.mode === "cloud-empty"
    ? "Choose whether to upload this browser snapshot to the cloud or discard it and keep the empty cloud state."
    : showHistoryMismatchCopy
      ? "The totals line up, but the progress is attached to different words or review dates. Pick one full snapshot to keep."
      : "Choose one full snapshot: overwrite the cloud with this browser, or replace this browser with the current cloud snapshot.";
  const mobileConflictDescription = syncConflict?.mode === "cloud-empty"
    ? "Cloud is empty. Keep browser progress or keep the empty cloud."
    : showHistoryMismatchCopy
      ? "Totals match, but history differs. Pick one snapshot."
      : "Browser and cloud differ. Pick which snapshot to keep.";
  const primaryConflictLabel = syncConflict?.mode === "cloud-empty" ? "Upload Browser Snapshot" : "Overwrite Cloud with Browser";
  const secondaryConflictLabel = syncConflict?.mode === "cloud-empty" ? "Discard Browser Snapshot" : "Replace Browser with Cloud";
  const primaryConflictShortLabel = syncConflict?.mode === "cloud-empty" ? "Upload" : "Use browser";
  const secondaryConflictShortLabel = syncConflict?.mode === "cloud-empty" ? "Keep cloud" : "Use cloud";
  const authMessageIsError = /failed|could not|error/i.test(authMessage);

  return (
    <div className="surface-subtle rounded-[28px] p-4 md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-2.5 md:space-y-3">
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
          <p className="max-w-full truncate text-xs text-slate-500 md:hidden" title={sessionEmail || undefined}>
            {mobileConnectionMeta}
          </p>
          <p className="hidden text-xs text-slate-500 md:block">{connectionMetaLabel}</p>
        </div>

        <button
          type="button"
          aria-label="Hide details"
          className="action-ghost inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold md:w-auto"
          onClick={onHide}
          aria-expanded={isExpanded}
          aria-controls="cloud-sync-panel"
        >
          <span className="md:hidden">Close</span>
          <span className="hidden md:inline">Hide details</span>
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
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
              <button
                type="button"
                aria-label="Sync Now"
                className="action-primary w-full rounded-full px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                onClick={onSyncNow}
                disabled={!canManualSync}
              >
                <span className="md:hidden">Sync</span>
                <span className="hidden md:inline">Sync Now</span>
              </button>
              <button
                type="button"
                aria-label="Sign Out"
                className="action-secondary w-full rounded-full px-4 py-2 text-sm font-semibold sm:w-auto"
                onClick={onSignOut}
                disabled={authBusy}
              >
                <span className="md:hidden">Sign out</span>
                <span className="hidden md:inline">Sign Out</span>
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
              <div className="space-y-1.5">
                <p className="text-sm font-semibold text-amber-950">
                  {syncConflict.mode === "cloud-empty"
                    ? "Cloud snapshot is empty"
                    : showHistoryMismatchCopy
                      ? "Totals match, but per-word history differs"
                      : "Browser and cloud snapshots differ"}
                </p>
                <p className="text-sm leading-5 text-amber-900 md:hidden">{mobileConflictDescription}</p>
                <p className="hidden text-sm leading-5 text-amber-900 md:block">{conflictDescription}</p>
              </div>

              <div className="touch-scroll-row mt-4 flex gap-3 overflow-x-auto pb-1 md:grid md:grid-cols-2 md:overflow-visible md:pb-0">
                <SnapshotSummaryCard title="This browser snapshot" mobileTitle="Browser" summary={localSyncSummary} />
                <SnapshotSummaryCard title="Cloud snapshot" mobileTitle="Cloud" summary={cloudSyncSummary} />
              </div>

              {showHistoryMismatchCopy && (
                <p className="mt-4 text-sm text-amber-900">
                  Matching totals do not mean matching history. Review dates or word-level status can still differ and affect drills.
                </p>
              )}

              <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <button
                  type="button"
                  aria-label={primaryConflictLabel}
                  className="w-full rounded-full bg-amber-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  onClick={() => onResolveConflict("overwrite-cloud")}
                  disabled={syncStatus === "saving"}
                >
                  <span className="md:hidden">{primaryConflictShortLabel}</span>
                  <span className="hidden md:inline">{primaryConflictLabel}</span>
                </button>
                <button
                  type="button"
                  aria-label={secondaryConflictLabel}
                  className="w-full rounded-full border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-950 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  onClick={() => onResolveConflict("use-cloud")}
                  disabled={syncStatus === "saving"}
                >
                  <span className="md:hidden">{secondaryConflictShortLabel}</span>
                  <span className="hidden md:inline">{secondaryConflictLabel}</span>
                </button>
              </div>
            </div>
          )}

          {hasSupabaseConfig && !session && (
            <div className="rounded-[24px] border border-slate-200 bg-white p-4">
              <div className="space-y-1">
                <p className="section-title md:hidden">Sign in</p>
                <p className="hidden md:block section-title">Sign in to sync</p>
                <p className="text-sm text-slate-600 md:hidden">Send a one-time link to this browser.</p>
                <p className="hidden text-sm text-slate-600 md:block">Email yourself a one-time sign-in link for this browser.</p>
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
                <button type="submit" aria-label="Email Link" disabled={authBusy} className="action-primary w-full rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60 sm:w-auto">
                  <span className="md:hidden">{authBusy ? "Sending" : "Send link"}</span>
                  <span className="hidden md:inline">{authBusy ? "Sending..." : "Email Link"}</span>
                </button>
              </form>
            </div>
          )}

          {authMessage && (
            <div className={`rounded-[20px] border px-3.5 py-2.5 ${authMessageIsError ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-white/80"}`}>
              <p className={`text-sm ${authMessageIsError ? "text-rose-700" : "text-slate-700"}`} role="status" aria-live="polite">
                {authMessage}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

