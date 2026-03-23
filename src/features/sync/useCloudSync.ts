import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient, getSupabaseConfig, hasSupabaseConfig } from "../../lib/supabase";
import type { ProgressMap } from "../../types";
import { DEFAULT_DAILY_GOAL, SYNC_DEBOUNCE_MS } from "../app/app.constants";
import { hasTrackedProgress, safeTimestamp, summarizeProgress } from "../progress/progress.utils";
import type { ProgressSummary } from "../progress/progress.utils";
import {
  buildPushSyncBatchArgs,
  createBackgroundSyncRequests,
  formatSyncTimestamp,
  normalizePullUserSyncStateResponse,
  normalizePushUserSyncBatchResponse,
  progressMapsEqual,
  toProgressMapFromRows,
  toProgressUpserts,
  toProgressUpsertsForWordIds,
  toSettingsUpsert
} from "./sync.utils";
import type {
  PushUserSyncBatchResponse,
  SyncConflict,
  SyncResolutionChoice,
  SyncStatus,
  UserProgressUpsert
} from "./sync.types";

type ReplaceSnapshot = (
  nextProgress: ProgressMap,
  nextDailyGoal: number,
  options?: { preserveDirty?: boolean; dailyGoalUpdatedAt?: string | null }
) => void;

type UseCloudSyncOptions = {
  progressMap: ProgressMap;
  progressMapRef: MutableRefObject<ProgressMap>;
  dirtyWordIdsRef: MutableRefObject<Set<number>>;
  dailyGoal: number;
  dailyGoalRef: MutableRefObject<number>;
  dailyGoalUpdatedAtRef: MutableRefObject<string | null>;
  settingsDirtyRef: MutableRefObject<boolean>;
  replaceSnapshot: ReplaceSnapshot;
  localSyncSummary: ProgressSummary;
};

export type CloudSyncState = {
  hasSupabaseConfig: boolean;
  session: Session | null;
  authEmail: string;
  setAuthEmail: (value: string) => void;
  authBusy: boolean;
  authMessage: string;
  showCloudSync: boolean;
  openCloudSync: () => void;
  hideCloudSync: () => void;
  syncStatus: SyncStatus;
  syncError: string | null;
  syncConflict: SyncConflict | null;
  lastSyncedAt: string | null;
  flushSyncNow: () => Promise<void>;
  resolveSyncConflict: (choice: SyncResolutionChoice) => Promise<void>;
  sendMagicLink: () => Promise<void>;
  signOut: () => Promise<void>;
  syncBadgeLabel: string;
  syncBadgeClass: string;
  syncMessage: string;
  lastSyncedLabel: string;
  canManualSync: boolean;
  localSyncSummary: ProgressSummary;
  cloudSyncSummary: ProgressSummary | null;
};

type ServerSnapshot = {
  progress: ProgressMap;
  dailyGoal: number;
  dailyGoalUpdatedAt: string | null;
  hasServerGoal: boolean;
  hasServerData: boolean;
};

const hasPendingDirtyState = (
  dirtyWordIdsRef: MutableRefObject<Set<number>>,
  settingsDirtyRef: MutableRefObject<boolean>
): boolean => dirtyWordIdsRef.current.size > 0 || settingsDirtyRef.current;

export const useCloudSync = ({
  progressMap,
  progressMapRef,
  dirtyWordIdsRef,
  dailyGoal,
  dailyGoalRef,
  dailyGoalUpdatedAtRef,
  settingsDirtyRef,
  replaceSnapshot,
  localSyncSummary
}: UseCloudSyncOptions): CloudSyncState => {
  const supabaseConfigured = hasSupabaseConfig();
  const [session, setSession] = useState<Session | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [showCloudSync, setShowCloudSync] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(supabaseConfigured ? "loading" : "idle");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [hasHydratedServer, setHasHydratedServer] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncConflict, setSyncConflict] = useState<SyncConflict | null>(null);

  const progressSaveTimerRef = useRef<number | null>(null);
  const settingsSaveTimerRef = useRef<number | null>(null);
  const skipNextProgressSyncRef = useRef(false);
  const skipNextSettingsSyncRef = useRef(false);
  const sessionRef = useRef<Session | null>(session);
  const hasHydratedServerRef = useRef(hasHydratedServer);
  const flushSyncInFlightRef = useRef(false);
  const syncConflictRef = useRef<SyncConflict | null>(syncConflict);
  const pendingFlushAfterSaveRef = useRef(false);
  const hasPendingCloudWriteRef = useRef(false);
  const pendingFlushAfterHydrationRef = useRef(false);

  useEffect(() => {
    return () => {
      if (progressSaveTimerRef.current !== null) {
        window.clearTimeout(progressSaveTimerRef.current);
      }

      if (settingsSaveTimerRef.current !== null) {
        window.clearTimeout(settingsSaveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    hasHydratedServerRef.current = hasHydratedServer;
  }, [hasHydratedServer]);

  useEffect(() => {
    syncConflictRef.current = syncConflict;
  }, [syncConflict]);

  useEffect(() => {
    if (syncConflict) {
      setShowCloudSync(true);
    }
  }, [syncConflict]);

  const applyHydratedState = useCallback((
    nextProgress: ProgressMap,
    nextDailyGoal: number,
    options?: { keepPendingCloudWrite?: boolean; serverDailyGoalUpdatedAt?: string | null }
  ): void => {
    const keepPendingCloudWrite = Boolean(options?.keepPendingCloudWrite);

    skipNextProgressSyncRef.current = true;
    skipNextSettingsSyncRef.current = true;
    replaceSnapshot(nextProgress, nextDailyGoal, {
      preserveDirty: keepPendingCloudWrite,
      dailyGoalUpdatedAt: keepPendingCloudWrite ? dailyGoalUpdatedAtRef.current : options?.serverDailyGoalUpdatedAt ?? null
    });
    hasPendingCloudWriteRef.current = keepPendingCloudWrite && hasPendingDirtyState(dirtyWordIdsRef, settingsDirtyRef);
    pendingFlushAfterHydrationRef.current = hasPendingCloudWriteRef.current;
    setHasHydratedServer(true);
    setLastSyncedAt((current) => (keepPendingCloudWrite ? current : new Date().toISOString()));
    setSyncStatus(keepPendingCloudWrite ? "idle" : "synced");
  }, [dailyGoalUpdatedAtRef, dirtyWordIdsRef, replaceSnapshot, settingsDirtyRef]);

  const buildPendingSyncBatch = useCallback((userId: string): {
    progressRows: UserProgressUpsert[];
    settingsRow: ReturnType<typeof toSettingsUpsert> | null;
  } => {
    const progressRows = toProgressUpsertsForWordIds(userId, progressMapRef.current, dirtyWordIdsRef.current);
    const settingsRow = settingsDirtyRef.current
      ? toSettingsUpsert(userId, dailyGoalRef.current, dailyGoalUpdatedAtRef.current)
      : null;

    return {
      progressRows,
      settingsRow
    };
  }, [dailyGoalRef, dailyGoalUpdatedAtRef, dirtyWordIdsRef, progressMapRef, settingsDirtyRef]);

  const clearFlushedProgressRows = useCallback((progressRows: UserProgressUpsert[]): void => {
    if (progressRows.length === 0) return;

    const nextDirtyWordIds = new Set(dirtyWordIdsRef.current);

    for (const row of progressRows) {
      const currentUpdatedAt = safeTimestamp(progressMapRef.current[row.word_id]?.updatedAt);
      if (currentUpdatedAt === row.updated_at) {
        nextDirtyWordIds.delete(row.word_id);
      }
    }

    dirtyWordIdsRef.current = nextDirtyWordIds;
  }, [dirtyWordIdsRef, progressMapRef]);

  const clearFlushedSettingsRow = useCallback((settingsRow: ReturnType<typeof toSettingsUpsert> | null): void => {
    if (!settingsRow || !settingsDirtyRef.current) return;

    if (
      dailyGoalRef.current === settingsRow.daily_goal &&
      safeTimestamp(dailyGoalUpdatedAtRef.current) === settingsRow.updated_at
    ) {
      settingsDirtyRef.current = false;
      dailyGoalUpdatedAtRef.current = settingsRow.updated_at;
    }
  }, [dailyGoalRef, dailyGoalUpdatedAtRef, settingsDirtyRef]);

  const loadServerData = useCallback(async (userId: string): Promise<void> => {
    const client = getSupabaseClient();
    if (!client) return;

    setSyncStatus("loading");
    setSyncError(null);

    const baselineProgress = progressMapRef.current;
    const baselineDailyGoal = dailyGoalRef.current;
    pendingFlushAfterHydrationRef.current = false;

    const { data, error } = await client.rpc("pull_user_sync_state");
    if (sessionRef.current?.user.id !== userId) return;

    if (error) {
      setSyncStatus("error");
      setSyncError(error.message);
      setHasHydratedServer(false);
      return;
    }

    const response = normalizePullUserSyncStateResponse(data);
    const serverSnapshot: ServerSnapshot = {
      progress: toProgressMapFromRows(response.progress),
      dailyGoal:
        Number.isFinite(response.settings?.daily_goal) && Number(response.settings?.daily_goal) > 0
          ? Math.round(Number(response.settings?.daily_goal))
          : DEFAULT_DAILY_GOAL,
      dailyGoalUpdatedAt: safeTimestamp(response.settings?.updated_at),
      hasServerGoal: Number.isFinite(response.settings?.daily_goal) && Number(response.settings?.daily_goal) > 0,
      hasServerData: false
    };
    serverSnapshot.hasServerData = hasTrackedProgress(serverSnapshot.progress) || serverSnapshot.hasServerGoal;

    const currentLocalProgress = progressMapRef.current;
    const currentLocalDailyGoal = dailyGoalRef.current;
    const hasBaselineLocalData = hasTrackedProgress(baselineProgress) || baselineDailyGoal !== DEFAULT_DAILY_GOAL;
    const baselineProgressDiffers = !progressMapsEqual(baselineProgress, serverSnapshot.progress);
    const baselineGoalDiffers = baselineDailyGoal !== serverSnapshot.dailyGoal;
    const localChangedDuringHydration =
      !progressMapsEqual(currentLocalProgress, baselineProgress) || currentLocalDailyGoal !== baselineDailyGoal;

    if (hasBaselineLocalData && serverSnapshot.hasServerData && (baselineProgressDiffers || baselineGoalDiffers)) {
      hasPendingCloudWriteRef.current = false;
      pendingFlushAfterHydrationRef.current = false;
      setSyncConflict({
        mode: "different-data",
        serverProgress: serverSnapshot.progress,
        serverDailyGoal: serverSnapshot.dailyGoal
      });
      setHasHydratedServer(false);
      setSyncStatus("idle");
      return;
    }

    if (hasBaselineLocalData && !serverSnapshot.hasServerData) {
      hasPendingCloudWriteRef.current = false;
      pendingFlushAfterHydrationRef.current = false;
      setSyncConflict({
        mode: "cloud-empty",
        serverProgress: serverSnapshot.progress,
        serverDailyGoal: serverSnapshot.dailyGoal
      });
      setHasHydratedServer(false);
      setSyncStatus("idle");
      return;
    }

    setSyncConflict(null);
    const nextProgress = localChangedDuringHydration
      ? currentLocalProgress
      : hasTrackedProgress(serverSnapshot.progress)
        ? serverSnapshot.progress
        : currentLocalProgress;
    const nextDailyGoal = localChangedDuringHydration
      ? currentLocalDailyGoal
      : serverSnapshot.hasServerGoal
        ? serverSnapshot.dailyGoal
        : currentLocalDailyGoal;

    applyHydratedState(nextProgress, nextDailyGoal, {
      keepPendingCloudWrite: localChangedDuringHydration,
      serverDailyGoalUpdatedAt: serverSnapshot.dailyGoalUpdatedAt
    });
  }, [applyHydratedState, dailyGoalRef, progressMapRef]);

  useEffect(() => {
    if (!syncConflict) return;

    const localMatchesServer =
      progressMapsEqual(progressMap, syncConflict.serverProgress) && dailyGoal === syncConflict.serverDailyGoal;

    if (!localMatchesServer) return;

    setSyncConflict(null);
    applyHydratedState(syncConflict.serverProgress, syncConflict.serverDailyGoal);
  }, [applyHydratedState, dailyGoal, progressMap, syncConflict]);

  const flushSyncNow = useCallback(async (): Promise<void> => {
    const client = getSupabaseClient();
    const userId = sessionRef.current?.user.id;
    if (!client || !userId || !hasHydratedServerRef.current || flushSyncInFlightRef.current || syncConflictRef.current) return;

    flushSyncInFlightRef.current = true;
    pendingFlushAfterSaveRef.current = false;

    if (progressSaveTimerRef.current !== null) {
      window.clearTimeout(progressSaveTimerRef.current);
      progressSaveTimerRef.current = null;
    }

    if (settingsSaveTimerRef.current !== null) {
      window.clearTimeout(settingsSaveTimerRef.current);
      settingsSaveTimerRef.current = null;
    }

    const { progressRows, settingsRow } = buildPendingSyncBatch(userId);

    if (progressRows.length === 0 && !settingsRow) {
      hasPendingCloudWriteRef.current = false;
      setSyncError(null);
      setSyncStatus("synced");
      flushSyncInFlightRef.current = false;
      return;
    }

    setSyncStatus("saving");

    let saveSucceeded = false;

    try {
      const { data, error } = await client.rpc("push_user_sync_batch", buildPushSyncBatchArgs(progressRows, settingsRow));

      if (error) {
        setSyncStatus("error");
        setSyncError(error.message);
        return;
      }

      const response: PushUserSyncBatchResponse = normalizePushUserSyncBatchResponse(data);
      const hasStaleWrites = (response.progress_stale_count ?? 0) > 0 || Boolean(response.settings_stale);

      if (hasStaleWrites) {
        setSyncError("Cloud data changed on another device. Review the latest snapshot.");
        await loadServerData(userId);
        return;
      }

      clearFlushedProgressRows(progressRows);
      clearFlushedSettingsRow(settingsRow);
      hasPendingCloudWriteRef.current = hasPendingDirtyState(dirtyWordIdsRef, settingsDirtyRef);
      setSyncError(null);
      setLastSyncedAt(response.synced_at ?? new Date().toISOString());
      saveSucceeded = true;
      setSyncStatus(hasPendingCloudWriteRef.current || pendingFlushAfterSaveRef.current ? "saving" : "synced");
    } finally {
      flushSyncInFlightRef.current = false;

      if (saveSucceeded && (pendingFlushAfterSaveRef.current || hasPendingDirtyState(dirtyWordIdsRef, settingsDirtyRef)) && !syncConflictRef.current) {
        void flushSyncNow();
      }
    }
  }, [buildPendingSyncBatch, clearFlushedProgressRows, clearFlushedSettingsRow, dirtyWordIdsRef, loadServerData, settingsDirtyRef]);

  const flushSyncInBackground = useCallback((): void => {
    const supabaseConfig = getSupabaseConfig();
    const nextSession = sessionRef.current;
    const userId = nextSession?.user.id;
    const accessToken = nextSession?.access_token;
    const shouldAttemptBackgroundSync =
      hasPendingCloudWriteRef.current ||
      flushSyncInFlightRef.current ||
      progressSaveTimerRef.current !== null ||
      settingsSaveTimerRef.current !== null;

    if (
      !supabaseConfig ||
      !userId ||
      !accessToken ||
      !hasHydratedServerRef.current ||
      syncConflictRef.current ||
      !shouldAttemptBackgroundSync ||
      typeof fetch !== "function"
    ) {
      return;
    }

    const { progressRows, settingsRow } = buildPendingSyncBatch(userId);
    const requests = createBackgroundSyncRequests({
      supabaseUrl: supabaseConfig.url,
      publishableKey: supabaseConfig.publishableKey,
      accessToken,
      progressRows,
      settingsRow
    });

    for (const request of requests) {
      void fetch(request.url, request.init).catch(() => undefined);
    }
  }, [buildPendingSyncBatch]);

  const scheduleSyncFlush = useCallback((kind: "progress" | "settings"): void => {
    if (flushSyncInFlightRef.current) {
      pendingFlushAfterSaveRef.current = true;
      return;
    }

    if (progressSaveTimerRef.current !== null || settingsSaveTimerRef.current !== null) return;

    const timerRef = kind === "progress" ? progressSaveTimerRef : settingsSaveTimerRef;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void flushSyncNow();
    }, SYNC_DEBOUNCE_MS);
  }, [flushSyncNow]);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId || !hasHydratedServer || !pendingFlushAfterHydrationRef.current || syncConflict) return;

    pendingFlushAfterHydrationRef.current = false;
    scheduleSyncFlush("progress");
  }, [hasHydratedServer, scheduleSyncFlush, session?.user.id, syncConflict]);

  const resolveSyncConflict = async (choice: SyncResolutionChoice): Promise<void> => {
    const client = getSupabaseClient();
    const userId = session?.user.id;
    if (!client || !userId || !syncConflict) return;

    const overwriteCloud = choice === "overwrite-cloud";
    const nextProgress = overwriteCloud ? progressMapRef.current : syncConflict.serverProgress;
    const nextDailyGoal = overwriteCloud ? dailyGoalRef.current : syncConflict.serverDailyGoal;
    setSyncStatus("saving");
    setSyncError(null);

    if (overwriteCloud) {
      const localWordIds = new Set(Object.keys(nextProgress).map((value) => Number(value)).filter((value) => Number.isFinite(value)));
      const serverWordIds = Object.keys(syncConflict.serverProgress)
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value));
      const wordIdsToDelete = serverWordIds.filter((wordId) => !localWordIds.has(wordId));
      const progressRows = toProgressUpserts(userId, nextProgress);
      const settingsRow = toSettingsUpsert(userId, nextDailyGoal, dailyGoalUpdatedAtRef.current);

      const { data, error } = await client.rpc(
        "overwrite_user_sync_snapshot",
        buildPushSyncBatchArgs(progressRows, settingsRow, wordIdsToDelete)
      );

      if (error) {
        setSyncStatus("error");
        setSyncError(error.message);
        return;
      }

      const response = normalizePushUserSyncBatchResponse(data);
      setLastSyncedAt(response.synced_at ?? new Date().toISOString());
      dailyGoalUpdatedAtRef.current = settingsRow.updated_at;
      hasPendingCloudWriteRef.current = false;
    }

    setSyncConflict(null);
    applyHydratedState(nextProgress, nextDailyGoal, {
      serverDailyGoalUpdatedAt: overwriteCloud ? dailyGoalUpdatedAtRef.current : null
    });
  };

  useEffect(() => {
    if (!supabaseConfigured) return;

    const client = getSupabaseClient();
    if (!client) return;

    let cancelled = false;

    const loadInitialSession = async (): Promise<void> => {
      const { data, error } = await client.auth.getSession();
      if (cancelled) return;

      if (error) {
        setSyncStatus("error");
        setSyncError(error.message);
        return;
      }

      setSession(data.session ?? null);
      setSyncStatus(data.session ? "loading" : "idle");
    };

    void loadInitialSession();

    const {
      data: { subscription }
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      const previousUserId = sessionRef.current?.user.id ?? null;
      const nextUserId = nextSession?.user.id ?? null;
      const userChanged = previousUserId !== nextUserId;

      setSession(nextSession);

      if (!userChanged) {
        return;
      }

      hasPendingCloudWriteRef.current = false;
      pendingFlushAfterHydrationRef.current = false;
      setSyncError(null);
      setSyncConflict(null);
      setSyncStatus(nextSession ? "loading" : "idle");
      setHasHydratedServer(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabaseConfigured]);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) {
      hasPendingCloudWriteRef.current = false;
      pendingFlushAfterHydrationRef.current = false;
      setHasHydratedServer(false);
      setSyncConflict(null);
      setSyncStatus("idle");
      return;
    }

    void loadServerData(userId);
  }, [loadServerData, session?.user.id]);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;

    const userId = session?.user.id;
    if (!userId || !hasHydratedServer) return;

    if (skipNextProgressSyncRef.current) {
      skipNextProgressSyncRef.current = false;
      return;
    }

    hasPendingCloudWriteRef.current = true;
    scheduleSyncFlush("progress");
  }, [hasHydratedServer, progressMap, scheduleSyncFlush, session?.user.id]);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;

    const userId = session?.user.id;
    if (!userId || !hasHydratedServer) return;

    if (skipNextSettingsSyncRef.current) {
      skipNextSettingsSyncRef.current = false;
      return;
    }

    hasPendingCloudWriteRef.current = true;
    scheduleSyncFlush("settings");
  }, [dailyGoal, hasHydratedServer, scheduleSyncFlush, session?.user.id]);

  useEffect(() => {
    if (!getSupabaseClient()) return;

    const handleVisibilityChange = (): void => {
      if (document.visibilityState === "hidden") {
        flushSyncInBackground();
        void flushSyncNow();
      }
    };

    const handlePageHide = (): void => {
      flushSyncInBackground();
      void flushSyncNow();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [flushSyncInBackground, flushSyncNow]);

  const sendMagicLink = async (): Promise<void> => {
    const client = getSupabaseClient();
    if (!client || authBusy) return;

    const email = authEmail.trim().toLowerCase();
    if (!email) {
      setAuthMessage("Enter your email to receive a sign-in link.");
      return;
    }

    setAuthBusy(true);
    setAuthMessage("");

    const { error } = await client.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin
      }
    });

    if (error) {
      setAuthMessage(`Could not send sign-in link: ${error.message}`);
    } else {
      setAuthMessage(`Sign-in link sent to ${email}.`);
    }

    setAuthBusy(false);
  };

  const signOut = async (): Promise<void> => {
    const client = getSupabaseClient();
    if (!client || authBusy) return;

    setAuthBusy(true);
    setAuthMessage("");

    const { error } = await client.auth.signOut();
    if (error) {
      setAuthMessage(`Sign out failed: ${error.message}`);
    } else {
      setSyncConflict(null);
      setAuthMessage("Signed out.");
    }

    setAuthBusy(false);
  };

  const cloudSyncSummary = useMemo(
    () => (syncConflict ? summarizeProgress(syncConflict.serverProgress, syncConflict.serverDailyGoal) : null),
    [syncConflict]
  );

  const syncBadgeLabel = !supabaseConfigured
    ? "Local only"
    : syncConflict
      ? "Action needed"
      : !session
        ? "Signed out"
        : syncStatus === "loading"
          ? "Loading"
          : syncStatus === "saving"
            ? "Saving"
            : syncStatus === "synced"
              ? "Up to date"
              : syncStatus === "error"
                ? "Error"
                : "Idle";

  const syncBadgeClass = !supabaseConfigured
    ? "border-slate-300 bg-slate-100 text-slate-700"
    : syncConflict
      ? "border-amber-300 bg-amber-50 text-amber-900"
      : syncStatus === "error"
        ? "border-rose-300 bg-rose-50 text-rose-800"
        : syncStatus === "saving"
          ? "border-sky-300 bg-sky-50 text-sky-800"
          : "border-emerald-300 bg-emerald-50 text-emerald-800";

  const syncMessage = !supabaseConfigured
    ? "Cloud sync is disabled. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY."
    : syncConflict?.mode === "cloud-empty"
      ? "This browser has local progress, but the cloud snapshot is empty. Choose whether to upload the browser snapshot or discard it."
      : syncConflict
        ? "Browser and cloud progress differ. Choose whether the browser snapshot should overwrite the cloud or whether the cloud snapshot should replace this browser."
        : !session
          ? "Signed out. Progress is saved locally in this browser."
          : syncStatus === "loading"
            ? "Loading progress from cloud."
            : syncStatus === "saving"
              ? "Saving latest progress to cloud."
              : syncStatus === "synced"
                ? "Cloud sync is up to date."
                : syncStatus === "error"
                  ? "Cloud sync needs attention."
                  : "Signed in and ready to sync.";

  const lastSyncedLabel = session ? formatSyncTimestamp(lastSyncedAt) : "Local browser only";
  const canManualSync = Boolean(
    session && hasHydratedServer && !syncConflict && syncStatus !== "loading" && syncStatus !== "saving" && !authBusy
  );

  return {
    hasSupabaseConfig: supabaseConfigured,
    session,
    authEmail,
    setAuthEmail,
    authBusy,
    authMessage,
    showCloudSync,
    openCloudSync: () => setShowCloudSync(true),
    hideCloudSync: () => setShowCloudSync(false),
    syncStatus,
    syncError,
    syncConflict,
    lastSyncedAt,
    flushSyncNow,
    resolveSyncConflict,
    sendMagicLink,
    signOut,
    syncBadgeLabel,
    syncBadgeClass,
    syncMessage,
    lastSyncedLabel,
    canManualSync,
    localSyncSummary,
    cloudSyncSummary
  };
};
