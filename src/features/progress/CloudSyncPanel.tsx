import type { Session } from "@supabase/supabase-js";
import type { ProgressSummary } from "./progress.utils";
import type { SyncConflict, SyncStatus } from "../sync/sync.types";

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
  onResolveConflict: (choice: "local" | "cloud") => void;
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
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${syncBadgeClass}`}>
              {syncBadgeLabel}
            </span>
            <span className="text-sm font-semibold text-slate-900">Cloud sync</span>
          </div>
          <p className="text-sm text-slate-700" role="status" aria-live="polite">
            {syncMessage}
          </p>
          <p className="text-xs text-slate-500">Last synced: {lastSyncedLabel}</p>
        </div>

        <button
          type="button"
          className="flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600"
          onClick={onHide}
          aria-expanded={isExpanded}
          aria-controls="cloud-sync-panel"
        >
          Hide Details
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

      <div id="cloud-sync-panel" className="mt-3 border-t border-slate-200 pt-3">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={onSyncNow}
              disabled={!canManualSync}
            >
              Sync Now
            </button>
            {hasSupabaseConfig && session && (
              <button
                type="button"
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                onClick={onSignOut}
                disabled={authBusy}
              >
                Sign Out
              </button>
            )}
          </div>

          {syncError && (
            <p className="text-xs text-rose-700" role="status" aria-live="polite">
              {syncError}
            </p>
          )}

          {syncConflict && cloudSyncSummary && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-amber-950">
                  {syncConflict.mode === "import" ? "Import browser data to cloud?" : "Browser and cloud data differ"}
                </p>
                <p className="text-xs text-amber-900">
                  {syncConflict.mode === "import"
                    ? "This browser has progress that is not in Supabase yet."
                    : "Choose whether to import what is stored in this browser or replace it with the current cloud data."}
                </p>
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <article className="rounded-xl border border-amber-200 bg-white/80 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">This Browser</p>
                  <p className="mt-2 text-sm text-slate-800">
                    {localSyncSummary.known} known, {localSyncSummary.needsPractice} practice, {localSyncSummary.reviewedToday} reviewed today
                  </p>
                  <p className="text-xs text-slate-600">
                    {localSyncSummary.trackedWords} tracked words, daily goal {localSyncSummary.dailyGoal}
                  </p>
                </article>
                <article className="rounded-xl border border-amber-200 bg-white/80 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Cloud</p>
                  <p className="mt-2 text-sm text-slate-800">
                    {cloudSyncSummary.known} known, {cloudSyncSummary.needsPractice} practice, {cloudSyncSummary.reviewedToday} reviewed today
                  </p>
                  <p className="text-xs text-slate-600">
                    {cloudSyncSummary.trackedWords} tracked words, daily goal {cloudSyncSummary.dailyGoal}
                  </p>
                </article>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-amber-700 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => onResolveConflict("local")}
                  disabled={syncStatus === "saving"}
                >
                  Import Browser Data
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-950 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => onResolveConflict("cloud")}
                  disabled={syncStatus === "saving"}
                >
                  {syncConflict.mode === "import" ? "Start from Cloud" : "Use Cloud Data"}
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {hasSupabaseConfig && session && <p className="text-xs text-slate-600">Signed in as {session.user.email ?? "your account"}.</p>}
              {!hasSupabaseConfig && <p className="text-xs text-slate-600">Running in local-only mode.</p>}
            </div>
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
                className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 focus:border-accent focus:outline-none"
                placeholder="you@example.com"
                value={authEmail}
                onChange={(event) => onAuthEmailChange(event.target.value)}
              />
              <button
                type="submit"
                disabled={authBusy}
                className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {authBusy ? "Sending..." : "Email Link"}
              </button>
            </form>
          )}

          {authMessage && (
            <p className="text-xs text-slate-700" role="status" aria-live="polite">
              {authMessage}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
