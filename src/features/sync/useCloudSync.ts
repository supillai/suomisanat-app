import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient, getSupabaseConfig, hasSupabaseConfig } from "../../lib/supabase";
import type { ProgressMap } from "../../types";
import { DEFAULT_DAILY_GOAL, SYNC_DEBOUNCE_MS } from "../app/app.constants";
import { hasTrackedProgress, summarizeProgress } from "../progress/progress.utils";
import type { ProgressSummary } from "../progress/progress.utils";
import {
  createBackgroundSyncRequests,
  formatSyncTimestamp,
  progressMapsEqual,
  toProgressMapFromRows,
  toProgressUpserts,
  toSettingsUpsert
} from "./sync.utils";
import type { SyncConflict, SyncResolutionChoice, SyncStatus, UserProgressRow, UserSettingsRow } from "./sync.types";

type UseCloudSyncOptions = {
  progressMap: ProgressMap;
  progressMapRef: MutableRefObject<ProgressMap>;
  dailyGoal: number;
  dailyGoalRef: MutableRefObject<number>;
  replaceSnapshot: (nextProgress: ProgressMap, nextDailyGoal: number) => void;
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

export const useCloudSync = ({
  progressMap,
  progressMapRef,
  dailyGoal,
  dailyGoalRef,
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
  const hydrationBaselineProgressRef = useRef<ProgressMap>({});
  const hydrationBaselineDailyGoalRef = useRef(DEFAULT_DAILY_GOAL);
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
    options?: { keepPendingCloudWrite?: boolean }
  ): void => {
    const keepPendingCloudWrite = Boolean(options?.keepPendingCloudWrite);

    skipNextProgressSyncRef.current = true;
    skipNextSettingsSyncRef.current = true;
    replaceSnapshot(nextProgress, nextDailyGoal);
    hasPendingCloudWriteRef.current = keepPendingCloudWrite;
    pendingFlushAfterHydrationRef.current = keepPendingCloudWrite;
    setHasHydratedServer(true);
    setLastSyncedAt((current) => (keepPendingCloudWrite ? current : new Date().toISOString()));
    setSyncStatus(keepPendingCloudWrite ? "idle" : "synced");
  }, [replaceSnapshot]);

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

    const progressRows = toProgressUpserts(userId, progressMapRef.current);
    const settingsRow = toSettingsUpsert(userId, dailyGoalRef.current);

    setSyncStatus("saving");

    let saveSucceeded = false;

    try {
      const [progressResponse, settingsResponse] = await Promise.all([
        progressRows.length > 0
          ? client.from("user_progress").upsert(progressRows, { onConflict: "user_id,word_id" })
          : Promise.resolve({ error: null }),
        client.from("user_settings").upsert(settingsRow, { onConflict: "user_id" })
      ]);

      if (progressResponse.error) {
        setSyncStatus("error");
        setSyncError(progressResponse.error.message);
        return;
      }

      if (settingsResponse.error) {
        setSyncStatus("error");
        setSyncError(settingsResponse.error.message);
        return;
      }

      setSyncError(null);
      hasPendingCloudWriteRef.current = pendingFlushAfterSaveRef.current;
      setLastSyncedAt(new Date().toISOString());
      saveSucceeded = true;
      setSyncStatus(pendingFlushAfterSaveRef.current ? "saving" : "synced");
    } finally {
      flushSyncInFlightRef.current = false;

      if (saveSucceeded && pendingFlushAfterSaveRef.current && !syncConflictRef.current) {
        void flushSyncNow();
      }
    }
  }, [dailyGoalRef, progressMapRef]);

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

    const requests = createBackgroundSyncRequests({
      supabaseUrl: supabaseConfig.url,
      publishableKey: supabaseConfig.publishableKey,
      accessToken,
      userId,
      map: progressMapRef.current,
      goal: dailyGoalRef.current
    });

    for (const request of requests) {
      void fetch(request.url, request.init).catch(() => undefined);
    }
  }, [dailyGoalRef, progressMapRef]);

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

      if (wordIdsToDelete.length > 0) {
        const deleteResponse = await client.from("user_progress").delete().eq("user_id", userId).in("word_id", wordIdsToDelete);
        if (deleteResponse.error) {
          setSyncStatus("error");
          setSyncError(deleteResponse.error.message);
          return;
        }
      }

      const [progressResponse, settingsResponse] = await Promise.all([
        progressRows.length > 0
          ? client.from("user_progress").upsert(progressRows, { onConflict: "user_id,word_id" })
          : Promise.resolve({ error: null }),
        client.from("user_settings").upsert(toSettingsUpsert(userId, nextDailyGoal), { onConflict: "user_id" })
      ]);

      if (progressResponse.error) {
        setSyncStatus("error");
        setSyncError(progressResponse.error.message);
        return;
      }

      if (settingsResponse.error) {
        setSyncStatus("error");
        setSyncError(settingsResponse.error.message);
        return;
      }
    }

    setSyncConflict(null);
    applyHydratedState(nextProgress, nextDailyGoal);
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
      hydrationBaselineProgressRef.current = progressMapRef.current;
      hydrationBaselineDailyGoalRef.current = dailyGoalRef.current;
      setSyncError(null);
      setSyncConflict(null);
      setSyncStatus(nextSession ? "loading" : "idle");
      setHasHydratedServer(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [dailyGoalRef, progressMapRef, supabaseConfigured]);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;

    const userId = session?.user.id;
    if (!userId) {
      hasPendingCloudWriteRef.current = false;
      pendingFlushAfterHydrationRef.current = false;
      hydrationBaselineProgressRef.current = {};
      hydrationBaselineDailyGoalRef.current = DEFAULT_DAILY_GOAL;
      setHasHydratedServer(false);
      setSyncConflict(null);
      setSyncStatus("idle");
      return;
    }

    let cancelled = false;

    const loadServerData = async (): Promise<void> => {
      setSyncStatus("loading");
      setSyncError(null);

      const baselineProgress = progressMapRef.current;
      const baselineDailyGoal = dailyGoalRef.current;
      hydrationBaselineProgressRef.current = baselineProgress;
      hydrationBaselineDailyGoalRef.current = baselineDailyGoal;
      pendingFlushAfterHydrationRef.current = false;

      const [progressResponse, settingsResponse] = await Promise.all([
        client
          .from("user_progress")
          .select("word_id, seen, correct, wrong, known, needs_practice, last_reviewed, updated_at")
          .eq("user_id", userId),
        client.from("user_settings").select("daily_goal").eq("user_id", userId).maybeSingle<UserSettingsRow>()
      ]);

      if (cancelled) return;

      if (progressResponse.error) {
        setSyncStatus("error");
        setSyncError(progressResponse.error.message);
        setHasHydratedServer(false);
        return;
      }

      if (settingsResponse.error) {
        setSyncStatus("error");
        setSyncError(settingsResponse.error.message);
        setHasHydratedServer(false);
        return;
      }

      const serverRows = (progressResponse.data ?? []) as UserProgressRow[];
      const serverProgress = toProgressMapFromRows(serverRows);
      const currentLocalProgress = progressMapRef.current;
      const currentLocalDailyGoal = dailyGoalRef.current;
      const hasServerGoal = Number.isFinite(settingsResponse.data?.daily_goal) && Number(settingsResponse.data?.daily_goal) > 0;
      const serverDailyGoal = hasServerGoal ? Math.round(Number(settingsResponse.data?.daily_goal)) : DEFAULT_DAILY_GOAL;
      const hasServerData = hasTrackedProgress(serverProgress) || hasServerGoal;
      const hasBaselineLocalData = hasTrackedProgress(baselineProgress) || baselineDailyGoal !== DEFAULT_DAILY_GOAL;
      const baselineProgressDiffers = !progressMapsEqual(baselineProgress, serverProgress);
      const baselineGoalDiffers = baselineDailyGoal !== serverDailyGoal;
      const localChangedDuringHydration =
        !progressMapsEqual(currentLocalProgress, baselineProgress) || currentLocalDailyGoal !== baselineDailyGoal;

      if (hasBaselineLocalData && hasServerData && (baselineProgressDiffers || baselineGoalDiffers)) {
        hasPendingCloudWriteRef.current = false;
        pendingFlushAfterHydrationRef.current = false;
        setSyncConflict({
          mode: "different-data",
          serverProgress,
          serverDailyGoal
        });
        setHasHydratedServer(false);
        setSyncStatus("idle");
        return;
      }

      if (hasBaselineLocalData && !hasServerData) {
        hasPendingCloudWriteRef.current = false;
        pendingFlushAfterHydrationRef.current = false;
        setSyncConflict({
          mode: "cloud-empty",
          serverProgress,
          serverDailyGoal
        });
        setHasHydratedServer(false);
        setSyncStatus("idle");
        return;
      }

      setSyncConflict(null);
      const nextProgress = localChangedDuringHydration
        ? currentLocalProgress
        : hasTrackedProgress(serverProgress)
          ? serverProgress
          : currentLocalProgress;
      const nextDailyGoal = localChangedDuringHydration
        ? currentLocalDailyGoal
        : hasServerGoal
          ? serverDailyGoal
          : currentLocalDailyGoal;
      applyHydratedState(nextProgress, nextDailyGoal, { keepPendingCloudWrite: localChangedDuringHydration });
    };

    void loadServerData();

    return () => {
      cancelled = true;
    };
  }, [applyHydratedState, dailyGoalRef, progressMapRef, session?.user.id]);

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


