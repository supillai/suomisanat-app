import { useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import type { Session } from "@supabase/supabase-js";
import { hasSupabaseConfig, supabase } from "../../lib/supabase";
import type { ProgressMap } from "../../types";
import { DEFAULT_DAILY_GOAL, SYNC_DEBOUNCE_MS } from "../app/app.constants";
import { hasTrackedProgress, summarizeProgress } from "../progress/progress.utils";
import type { ProgressSummary } from "../progress/progress.utils";
import {
  formatSyncTimestamp,
  mergeProgressMaps,
  progressMapsEqual,
  toProgressMapFromRows,
  toProgressUpserts,
  toSettingsUpsert
} from "./sync.utils";
import type { SyncConflict, SyncStatus, UserProgressRow, UserSettingsRow } from "./sync.types";

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
  resolveSyncConflict: (choice: "local" | "cloud") => Promise<void>;
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
  const [session, setSession] = useState<Session | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [showCloudSync, setShowCloudSync] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(hasSupabaseConfig ? "loading" : "idle");
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

  const applyHydratedState = (nextProgress: ProgressMap, nextDailyGoal: number): void => {
    skipNextProgressSyncRef.current = true;
    skipNextSettingsSyncRef.current = true;
    replaceSnapshot(nextProgress, nextDailyGoal);
    setHasHydratedServer(true);
    setLastSyncedAt(new Date().toISOString());
    setSyncStatus("synced");
  };

  const flushSyncNow = async (): Promise<void> => {
    const client = supabase;
    const userId = sessionRef.current?.user.id;
    if (!client || !userId || !hasHydratedServerRef.current || flushSyncInFlightRef.current || syncConflictRef.current) return;

    flushSyncInFlightRef.current = true;

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
      setSyncStatus("synced");
      setLastSyncedAt(new Date().toISOString());
    } finally {
      flushSyncInFlightRef.current = false;
    }
  };

  const scheduleSyncFlush = (kind: "progress" | "settings"): void => {
    if (progressSaveTimerRef.current !== null || settingsSaveTimerRef.current !== null) return;

    const timerRef = kind === "progress" ? progressSaveTimerRef : settingsSaveTimerRef;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void flushSyncNow();
    }, SYNC_DEBOUNCE_MS);
  };

  const resolveSyncConflict = async (choice: "local" | "cloud"): Promise<void> => {
    const client = supabase;
    const userId = session?.user.id;
    if (!client || !userId || !syncConflict) return;

    const nextProgress =
      choice === "local" ? mergeProgressMaps(progressMapRef.current, syncConflict.serverProgress) : syncConflict.serverProgress;
    const nextDailyGoal = choice === "local" ? dailyGoalRef.current : syncConflict.serverDailyGoal;

    setSyncStatus("saving");
    setSyncError(null);

    if (choice === "local") {
      const progressRows = toProgressUpserts(userId, nextProgress);
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
    const client = supabase;
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
      setSession(nextSession);
      setSyncError(null);
      setSyncConflict(null);
      setSyncStatus(nextSession ? "loading" : "idle");
      setHasHydratedServer(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    const userId = session?.user.id;
    if (!userId) {
      setHasHydratedServer(false);
      setSyncConflict(null);
      setSyncStatus("idle");
      return;
    }

    let cancelled = false;

    const loadServerData = async (): Promise<void> => {
      setSyncStatus("loading");
      setSyncError(null);

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
      const localProgress = progressMapRef.current;
      const localDailyGoal = dailyGoalRef.current;
      const hasServerGoal = Number.isFinite(settingsResponse.data?.daily_goal) && Number(settingsResponse.data?.daily_goal) > 0;
      const serverDailyGoal = hasServerGoal ? Math.round(Number(settingsResponse.data?.daily_goal)) : DEFAULT_DAILY_GOAL;
      const hasServerData = hasTrackedProgress(serverProgress) || hasServerGoal;
      const hasLocalData = hasTrackedProgress(localProgress) || localDailyGoal !== DEFAULT_DAILY_GOAL;
      const progressDiffers = !progressMapsEqual(localProgress, serverProgress);
      const goalDiffers = localDailyGoal !== serverDailyGoal;

      if (hasLocalData && hasServerData && (progressDiffers || goalDiffers)) {
        setSyncConflict({
          mode: "conflict",
          serverProgress,
          serverDailyGoal
        });
        setHasHydratedServer(false);
        setSyncStatus("idle");
        return;
      }

      if (hasLocalData && !hasServerData) {
        setSyncConflict({
          mode: "import",
          serverProgress,
          serverDailyGoal
        });
        setHasHydratedServer(false);
        setSyncStatus("idle");
        return;
      }

      setSyncConflict(null);
      const nextProgress = hasTrackedProgress(serverProgress) ? serverProgress : localProgress;
      const nextDailyGoal = hasServerGoal ? serverDailyGoal : localDailyGoal;
      applyHydratedState(nextProgress, nextDailyGoal);
    };

    void loadServerData();

    return () => {
      cancelled = true;
    };
  }, [dailyGoalRef, progressMapRef, replaceSnapshot, session?.user.id]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    const userId = session?.user.id;
    if (!userId || !hasHydratedServer) return;

    if (skipNextProgressSyncRef.current) {
      skipNextProgressSyncRef.current = false;
      return;
    }

    scheduleSyncFlush("progress");
  }, [hasHydratedServer, progressMap, session?.user.id]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    const userId = session?.user.id;
    if (!userId || !hasHydratedServer) return;

    if (skipNextSettingsSyncRef.current) {
      skipNextSettingsSyncRef.current = false;
      return;
    }

    scheduleSyncFlush("settings");
  }, [dailyGoal, hasHydratedServer, session?.user.id]);

  useEffect(() => {
    if (!supabase) return;

    const handleVisibilityChange = (): void => {
      if (document.visibilityState === "hidden") {
        void flushSyncNow();
      }
    };

    const handlePageHide = (): void => {
      void flushSyncNow();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, []);

  const sendMagicLink = async (): Promise<void> => {
    if (!supabase || authBusy) return;

    const email = authEmail.trim().toLowerCase();
    if (!email) {
      setAuthMessage("Enter your email to receive a sign-in link.");
      return;
    }

    setAuthBusy(true);
    setAuthMessage("");

    const { error } = await supabase.auth.signInWithOtp({
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
    if (!supabase || authBusy) return;

    setAuthBusy(true);
    setAuthMessage("");

    const { error } = await supabase.auth.signOut();
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

  const syncBadgeLabel = !hasSupabaseConfig
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

  const syncBadgeClass = !hasSupabaseConfig
    ? "border-slate-300 bg-slate-100 text-slate-700"
    : syncConflict
      ? "border-amber-300 bg-amber-50 text-amber-900"
      : syncStatus === "error"
        ? "border-rose-300 bg-rose-50 text-rose-800"
        : syncStatus === "saving"
          ? "border-sky-300 bg-sky-50 text-sky-800"
          : "border-emerald-300 bg-emerald-50 text-emerald-800";

  const syncMessage = !hasSupabaseConfig
    ? "Cloud sync is disabled. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY."
    : syncConflict?.mode === "import"
      ? "Browser progress exists on this device and cloud storage is empty. Choose whether to import it."
      : syncConflict
        ? "Browser progress differs from cloud data. Choose which source to keep for this account."
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
    hasSupabaseConfig,
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
