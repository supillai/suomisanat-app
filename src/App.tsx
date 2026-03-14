import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { words } from "./data/words";
import { hasSupabaseConfig, supabase } from "./lib/supabase";
import type { ProgressMap, ProgressState, VocabularyWord, WordPos, WordTopic } from "./types";

type Tab = "study" | "quiz" | "list" | "progress";
type StudyFilter = "all" | "unknown" | "known" | "practice";
type QuizMode = "mcq" | "typing";
type StudyDecision = "none" | "known" | "practice";
type SyncStatus = "idle" | "loading" | "saving" | "synced" | "error";

type SyncConflict = {
  mode: "import" | "conflict";
  serverProgress: ProgressMap;
  serverDailyGoal: number;
};

type UserProgressRow = {
  word_id: number;
  seen: number | null;
  correct: number | null;
  wrong: number | null;
  known: boolean | null;
  needs_practice: boolean | null;
  last_reviewed: string | null;
  updated_at: string | null;
};

type UserProgressUpsert = {
  user_id: string;
  word_id: number;
  seen: number;
  correct: number;
  wrong: number;
  known: boolean;
  needs_practice: boolean;
  last_reviewed: string | null;
  updated_at: string;
};

type UserSettingsRow = {
  daily_goal: number | null;
};

type UserSettingsUpsert = {
  user_id: string;
  daily_goal: number;
  updated_at: string;
};

const PROGRESS_KEY = "suomisanat-progress-v1";
const DAILY_GOAL_KEY = "suomisanat-daily-goal-v1";
const DEFAULT_DAILY_GOAL = 20;
const SYNC_DEBOUNCE_MS = 900;
const TAB_CONFIG: Array<{ id: Tab; label: string }> = [
  { id: "study", label: "Study" },
  { id: "quiz", label: "Quiz" },
  { id: "list", label: "Word List" },
  { id: "progress", label: "Progress" }
];

const TOPICS: WordTopic[] = ["core", "time", "home", "food", "city", "health", "work", "verbs", "describing"];
const POS_OPTIONS: WordPos[] = ["noun", "verb", "adjective", "adverb", "pronoun", "other"];
const TOPIC_LABELS: Record<WordTopic, string> = {
  core: "Core",
  time: "Time",
  home: "Home",
  food: "Food",
  city: "City",
  health: "Health",
  work: "Work",
  verbs: "Verbs",
  describing: "Describing"
};
const POS_LABELS: Record<WordPos, string> = {
  noun: "Noun",
  verb: "Verb",
  adjective: "Adjective",
  adverb: "Adverb",
  pronoun: "Pronoun",
  other: "Phrase"
};
const STUDY_FILTER_LABELS: Record<StudyFilter, string> = {
  all: "All Cards",
  unknown: "Unknown",
  known: "Known",
  practice: "Needs Practice"
};

const todayIso = (): string => new Date().toISOString().slice(0, 10);

const normalizeFinnish = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    // Ignore punctuation so phrase cards do not require exact commas or ellipses.
    .replace(/[.,!?;:\u2026'"`\u00B4\u2019\u2018\-()/]/g, " ")
    .replace(/\u00E4/g, "a")
    .replace(/\u00F6/g, "o")
    .replace(/\u00E5/g, "a")
    .replace(/\s+/g, " ")
    .trim();

const randomFrom = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

const safeReadProgress = (): ProgressMap => {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Partial<ProgressState>> | null;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const normalized: ProgressMap = {};

    for (const [rawId, value] of Object.entries(parsed)) {
      if (!value || typeof value !== "object") continue;

      const id = Number(rawId);
      if (!Number.isFinite(id)) continue;

      const seen = Number(value.seen);
      const correct = Number(value.correct);
      const wrong = Number(value.wrong);
      const known = Boolean(value.known);
      const needsPractice = known ? false : Boolean(value.needsPractice);

      normalized[id] = {
        seen: Number.isFinite(seen) && seen >= 0 ? Math.round(seen) : 0,
        correct: Number.isFinite(correct) && correct >= 0 ? Math.round(correct) : 0,
        wrong: Number.isFinite(wrong) && wrong >= 0 ? Math.round(wrong) : 0,
        known,
        needsPractice,
        lastReviewed: typeof value.lastReviewed === "string" ? value.lastReviewed : null,
        updatedAt: safeTimestamp(value.updatedAt)
      };
    }

    return normalized;
  } catch {
    return {};
  }
};

const safeReadDailyGoal = (): number => {
  try {
    const parsed = Number(localStorage.getItem(DAILY_GOAL_KEY));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DAILY_GOAL;
  } catch {
    return DEFAULT_DAILY_GOAL;
  }
};

const safeInt = (value: number | null | undefined): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : 0;
};

const safeTimestamp = (value: string | null | undefined): string | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  return Number.isNaN(Date.parse(value)) ? null : value;
};

const laterIsoDate = (first: string | null, second: string | null): string | null => {
  if (!first) return second;
  if (!second) return first;
  return first >= second ? first : second;
};

const progressActivityScore = (state: ProgressState): number => state.seen + state.correct + state.wrong;

const pickPreferredProgressState = (first: ProgressState, second: ProgressState): ProgressState => {
  const firstUpdatedAt = safeTimestamp(first.updatedAt);
  const secondUpdatedAt = safeTimestamp(second.updatedAt);

  if (firstUpdatedAt && secondUpdatedAt && firstUpdatedAt !== secondUpdatedAt) {
    return firstUpdatedAt > secondUpdatedAt ? first : second;
  }

  if (firstUpdatedAt && !secondUpdatedAt) return first;
  if (secondUpdatedAt && !firstUpdatedAt) return second;

  if (first.lastReviewed && second.lastReviewed && first.lastReviewed !== second.lastReviewed) {
    return first.lastReviewed > second.lastReviewed ? first : second;
  }

  if (first.lastReviewed && !second.lastReviewed) return first;
  if (second.lastReviewed && !first.lastReviewed) return second;

  return progressActivityScore(first) >= progressActivityScore(second) ? first : second;
};

const mergeProgressState = (
  localState: ProgressState | undefined,
  serverState: ProgressState | undefined
): ProgressState | undefined => {
  if (!localState) return serverState;
  if (!serverState) return localState;

  const preferred = pickPreferredProgressState(localState, serverState);
  const known = Boolean(preferred.known);

  return {
    seen: Math.max(safeInt(localState.seen), safeInt(serverState.seen)),
    correct: Math.max(safeInt(localState.correct), safeInt(serverState.correct)),
    wrong: Math.max(safeInt(localState.wrong), safeInt(serverState.wrong)),
    known,
    needsPractice: known ? false : Boolean(preferred.needsPractice),
    lastReviewed: laterIsoDate(localState.lastReviewed, serverState.lastReviewed),
    updatedAt: safeTimestamp(preferred.updatedAt)
  };
};

const mergeProgressMaps = (localMap: ProgressMap, serverMap: ProgressMap): ProgressMap => {
  const merged: ProgressMap = {};
  const wordIds = new Set([...Object.keys(localMap), ...Object.keys(serverMap)].map((value) => Number(value)));

  for (const wordId of wordIds) {
    if (!Number.isFinite(wordId)) continue;
    const state = mergeProgressState(localMap[wordId], serverMap[wordId]);
    if (state) {
      merged[wordId] = state;
    }
  }

  return merged;
};

const progressStatesEqual = (first: ProgressState | undefined, second: ProgressState | undefined): boolean => {
  if (!first && !second) return true;
  if (!first || !second) return false;

  return (
    safeInt(first.seen) === safeInt(second.seen) &&
    safeInt(first.correct) === safeInt(second.correct) &&
    safeInt(first.wrong) === safeInt(second.wrong) &&
    Boolean(first.known) === Boolean(second.known) &&
    (Boolean(first.known) ? false : Boolean(first.needsPractice)) ===
      (Boolean(second.known) ? false : Boolean(second.needsPractice)) &&
    (first.lastReviewed ?? null) === (second.lastReviewed ?? null)
  );
};

const progressMapsEqual = (first: ProgressMap, second: ProgressMap): boolean => {
  const wordIds = new Set([...Object.keys(first), ...Object.keys(second)].map((value) => Number(value)));

  for (const wordId of wordIds) {
    if (!Number.isFinite(wordId)) continue;
    if (!progressStatesEqual(first[wordId], second[wordId])) {
      return false;
    }
  }

  return true;
};

const toProgressMapFromRows = (rows: UserProgressRow[] | null | undefined): ProgressMap => {
  const map: ProgressMap = {};

  for (const row of rows ?? []) {
    if (!Number.isFinite(row.word_id)) continue;

    const known = Boolean(row.known);
    const needsPractice = known ? false : Boolean(row.needs_practice);

    map[row.word_id] = {
      seen: safeInt(row.seen),
      correct: safeInt(row.correct),
      wrong: safeInt(row.wrong),
      known,
      needsPractice,
      lastReviewed: typeof row.last_reviewed === "string" ? row.last_reviewed : null,
      updatedAt: safeTimestamp(row.updated_at)
    };
  }

  return map;
};

const toProgressUpserts = (userId: string, map: ProgressMap): UserProgressUpsert[] => {
  const fallbackUpdatedAt = new Date().toISOString();
  const rows: UserProgressUpsert[] = [];

  for (const [rawWordId, state] of Object.entries(map)) {
    const wordId = Number(rawWordId);
    if (!Number.isFinite(wordId)) continue;

    rows.push({
      user_id: userId,
      word_id: wordId,
      seen: safeInt(state.seen),
      correct: safeInt(state.correct),
      wrong: safeInt(state.wrong),
      known: Boolean(state.known),
      needs_practice: state.known ? false : Boolean(state.needsPractice),
      last_reviewed: typeof state.lastReviewed === "string" ? state.lastReviewed : null,
      updated_at: safeTimestamp(state.updatedAt) ?? fallbackUpdatedAt
    });
  }

  return rows;
};

const toSettingsUpsert = (userId: string, goal: number): UserSettingsUpsert => ({
  user_id: userId,
  daily_goal: Math.max(1, Math.round(goal)),
  updated_at: new Date().toISOString()
});

const hasTrackedProgress = (map: ProgressMap): boolean => Object.keys(map).length > 0;

const summarizeProgress = (map: ProgressMap, dailyGoal: number) => {
  const states = Object.values(map);
  return {
    trackedWords: states.length,
    known: states.filter((state) => state.known).length,
    needsPractice: states.filter((state) => state.needsPractice).length,
    reviewedToday: states.filter((state) => state.lastReviewed === todayIso()).length,
    dailyGoal
  };
};

const formatSyncTimestamp = (value: string | null): string => {
  if (!value) return "Not synced yet";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not synced yet";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(parsed);
};

const tabButtonId = (tab: Tab): string => `tab-${tab}`;
const tabPanelId = (tab: Tab): string => `panel-${tab}`;

const pickQuizOptions = (correctWord: VocabularyWord): string[] => {
  const distractors = Array.from(
    new Set(words.filter((word) => word.id !== correctWord.id).map((word) => word.en))
  )
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  return [...distractors, correctWord.en].sort(() => Math.random() - 0.5);
};

const verbExampleOverrides: Record<string, string> = {
  heräsin: "Esimerkki: Minä heräsin aikaisin.",
  menin: "Esimerkki: Minä menin kauppaan.",
  tulin: "Esimerkki: Minä tulin kotiin.",
  tapasin: "Esimerkki: Minä tapasin ystävän.",
  söin: "Esimerkki: Minä söin aamupalaa.",
  kävin: "Esimerkki: Minä kävin kirjastossa.",
  palasin: "Esimerkki: Minä palasin kotiin."
};

const studyExample = (word: VocabularyWord): string => {
  if (word.pos === "verb") {
    if (word.fi === "olla") {
      return "Esimerkki: MinÃƒÂ¤ haluan olla ajoissa.";
    }
    const override = verbExampleOverrides[word.fi];
    if (override) {
      return override;
    }
    return `Esimerkki: Minä yritän ${word.fi} tänään.`;
  }
  if (word.pos === "noun") {
    return `Esimerkki: TÃƒÂ¤mÃƒÂ¤ on ${word.fi}.`;
  }
  if (word.pos === "adjective") {
    return `Esimerkki: TÃƒÂ¤mÃƒÂ¤ tehtÃƒÂ¤vÃƒÂ¤ on ${word.fi}.`;
  }
  if (word.pos === "adverb") {
    return `Esimerkki: HÃƒÂ¤n puhuu ${word.fi}.`;
  }
  if (word.pos === "pronoun") {
    return `Esimerkki: Sana "${word.fi}" auttaa keskustelussa.`;
  }
  return `Esimerkki: KÃƒÂ¤ytÃƒÂ¤n sanaa "${word.fi}" arjessa.`;
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const maskedSimpleExplanation = (word: VocabularyWord): string => {
  if (!word.fiSimple.trim()) return "";

  const escapedWord = escapeRegExp(word.fi);
  if (!escapedWord) return word.fiSimple;

  const masked = word.fiSimple.replace(new RegExp(escapedWord, "giu"), "____");
  return masked;
};

const buildStudyHints = (word: VocabularyWord): string[] => {
  const hints: string[] = [];
  const maskedExplanation = maskedSimpleExplanation(word);

  hints.push(`Topic: ${TOPIC_LABELS[word.topic]}. Word type: ${POS_LABELS[word.pos]}.`);

  if (maskedExplanation.trim()) {
    hints.push(`Easy Finnish clue: ${maskedExplanation}`);
  }

  if (word.enSimple.trim()) {
    hints.push(`English clue: ${word.enSimple}`);
  }

  return hints;
};

const levenshteinDistance = (source: string, target: string): number => {
  if (source === target) return 0;
  if (!source) return target.length;
  if (!target) return source.length;

  const previousRow = Array.from({ length: target.length + 1 }, (_, index) => index);
  const currentRow = new Array<number>(target.length + 1).fill(0);

  for (let sourceIndex = 1; sourceIndex <= source.length; sourceIndex += 1) {
    currentRow[0] = sourceIndex;

    for (let targetIndex = 1; targetIndex <= target.length; targetIndex += 1) {
      const sourceChar = source[sourceIndex - 1];
      const targetChar = target[targetIndex - 1];
      const substitutionCost = sourceChar === targetChar ? 0 : 1;

      currentRow[targetIndex] = Math.min(
        currentRow[targetIndex - 1] + 1,
        previousRow[targetIndex] + 1,
        previousRow[targetIndex - 1] + substitutionCost
      );
    }

    for (let index = 0; index < currentRow.length; index += 1) {
      previousRow[index] = currentRow[index];
    }
  }

  return previousRow[target.length];
};

const longestCommonPrefixLength = (first: string, second: string): number => {
  const maxLength = Math.min(first.length, second.length);
  let length = 0;

  while (length < maxLength && first[length] === second[length]) {
    length += 1;
  }

  return length;
};

const buildTypingMistakeFeedback = (typedValue: string, word: VocabularyWord): string => {
  const typed = typedValue.trim().toLowerCase();
  const expected = word.fi.trim().toLowerCase();
  const normalizedTyped = normalizeFinnish(typed);
  const normalizedExpected = normalizeFinnish(expected);
  const notes: string[] = [];

  if (!typed) {
    return `Incorrect. Correct answer: ${word.fi}.`;
  }

  if (normalizeFinnish(word.en) === normalizedTyped) {
    notes.push("You entered English. This mode expects Finnish.");
  }

  const distance = levenshteinDistance(normalizedTyped, normalizedExpected);
  if (distance <= 1) {
    notes.push("Very close: one character off.");
  } else if (distance === 2) {
    notes.push("Close: two edits away.");
  } else if (distance <= 4) {
    notes.push("Partly correct. Check middle letters and ending.");
  } else {
    notes.push("Try recalling by topic and first letter.");
  }

  const commonPrefixLength = longestCommonPrefixLength(normalizedTyped, normalizedExpected);
  if (commonPrefixLength >= 3 && commonPrefixLength < normalizedExpected.length) {
    notes.push("Beginning looks good, check the ending.");
  }

  const expectedDoubleLetter = expected.match(/([a-z\u00E5\u00E4\u00F6])\1/iu)?.[0];
  if (expectedDoubleLetter && !typed.includes(expectedDoubleLetter)) {
    notes.push(`Watch double letters like "${expectedDoubleLetter}".`);
  }

  const expectedSpecialLetters = /[\u00E5\u00E4\u00F6]/iu.test(expected);
  const typedSpecialLetters = /[\u00E5\u00E4\u00F6]/iu.test(typed);
  if (expectedSpecialLetters && !typedSpecialLetters) {
    notes.push("This word uses Finnish special letters.");
  }

  const detail = Array.from(new Set(notes)).slice(0, 2).join(" ");
  return detail ? `Incorrect. Correct answer: ${word.fi}. ${detail}` : `Incorrect. Correct answer: ${word.fi}.`;
};

const daysSinceIsoDate = (isoDate: string | null): number | null => {
  if (!isoDate) return null;
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const parsedStart = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const diffMs = todayStart.getTime() - parsedStart.getTime();

  return Math.max(0, Math.floor(diffMs / 86_400_000));
};

const miniDrillScore = (state: ProgressState | undefined): number => {
  if (!state) return 7;

  const totalAnswers = state.correct + state.wrong;
  const accuracy = totalAnswers > 0 ? state.correct / totalAnswers : 0;
  const reviewGap = daysSinceIsoDate(state.lastReviewed);

  let score = 0;
  score += state.needsPractice ? 8 : 0;
  score += state.wrong * 2;
  score += state.known ? 0 : 2;
  score += totalAnswers === 0 ? 4 : accuracy < 0.6 ? 3 : accuracy < 0.8 ? 1 : 0;
  score += reviewGap === null ? 2 : reviewGap >= 7 ? 3 : reviewGap >= 3 ? 1 : 0;
  score -= state.known && !state.needsPractice && accuracy >= 0.9 && reviewGap !== null && reviewGap < 3 ? 4 : 0;

  return score;
};

const miniDrillReason = (state: ProgressState | undefined): string => {
  if (!state || state.seen === 0) return "New or never reviewed";
  if (state.needsPractice) return "Marked as needs practice";

  const totalAnswers = state.correct + state.wrong;
  const accuracy = totalAnswers > 0 ? Math.round((state.correct / totalAnswers) * 100) : 0;
  if (accuracy < 60) return `Low accuracy (${accuracy}%)`;

  const reviewGap = daysSinceIsoDate(state.lastReviewed);
  if (reviewGap !== null && reviewGap >= 7) return `${reviewGap} days since review`;
  if (state.wrong > 0) return `${state.wrong} wrong answers recorded`;

  return "Good refresh candidate";
};

export default function App() {
  const [tab, setTab] = useState<Tab>("study");
  const [progressMap, setProgressMap] = useState<ProgressMap>(() => safeReadProgress());
  const [dailyGoal, setDailyGoal] = useState<number>(() => safeReadDailyGoal());
  const [studyFilter, setStudyFilter] = useState<StudyFilter>("all");
  const [studyWord, setStudyWord] = useState<VocabularyWord>(() => words[0]);
  const [reveal, setReveal] = useState(false);
  const [studyHintLevel, setStudyHintLevel] = useState(0);
  const [studyDecision, setStudyDecision] = useState<StudyDecision>("none");
  const [studyKnownSession, setStudyKnownSession] = useState(0);
  const [studyPracticeSession, setStudyPracticeSession] = useState(0);
  const [quizMode, setQuizMode] = useState<QuizMode>("mcq");
  const [quizWord, setQuizWord] = useState<VocabularyWord>(() => words[1]);
  const [quizOptions, setQuizOptions] = useState<string[]>(() => pickQuizOptions(words[1]));
  const [typingValue, setTypingValue] = useState("");
  const [quizFeedback, setQuizFeedback] = useState("");
  const [quizCorrect, setQuizCorrect] = useState(0);
  const [quizWrong, setQuizWrong] = useState(0);
  const [miniDrillQueue, setMiniDrillQueue] = useState<number[]>([]);
  const [miniDrillIndex, setMiniDrillIndex] = useState(0);
  const [searchValue, setSearchValue] = useState("");
  const [topicFilter, setTopicFilter] = useState<WordTopic | "all">("all");
  const [posFilter, setPosFilter] = useState<WordPos | "all">("all");
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
  const progressMapRef = useRef<ProgressMap>(progressMap);
  const dailyGoalRef = useRef<number>(dailyGoal);
  const sessionRef = useRef<Session | null>(session);
  const hasHydratedServerRef = useRef<boolean>(hasHydratedServer);
  const flushSyncInFlightRef = useRef(false);
  const syncConflictRef = useRef<SyncConflict | null>(syncConflict);
  const tabButtonRefs = useRef<Record<Tab, HTMLButtonElement | null>>({
    study: null,
    quiz: null,
    list: null,
    progress: null
  });
  const studyRevealButtonRef = useRef<HTMLButtonElement | null>(null);
  const studyKnownButtonRef = useRef<HTMLButtonElement | null>(null);
  const studyNextButtonRef = useRef<HTMLButtonElement | null>(null);
  const quizFirstOptionRef = useRef<HTMLButtonElement | null>(null);
  const quizTypingInputRef = useRef<HTMLInputElement | null>(null);
  const quizNextButtonRef = useRef<HTMLButtonElement | null>(null);

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
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progressMap));
  }, [progressMap]);

  useEffect(() => {
    localStorage.setItem(DAILY_GOAL_KEY, String(dailyGoal));
  }, [dailyGoal]);

  useEffect(() => {
    progressMapRef.current = progressMap;
  }, [progressMap]);

  useEffect(() => {
    dailyGoalRef.current = dailyGoal;
  }, [dailyGoal]);

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
    progressMapRef.current = nextProgress;
    dailyGoalRef.current = nextDailyGoal;
    setProgressMap(nextProgress);
    setDailyGoal(nextDailyGoal);
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
      const hasServerGoal =
        Number.isFinite(settingsResponse.data?.daily_goal) && Number(settingsResponse.data?.daily_goal) > 0;
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
  }, [session?.user.id]);

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

  const selectTab = (nextTab: Tab): void => {
    setTab(nextTab);
  };

  const openCloudSyncSettings = (): void => {
    setShowCloudSync(true);
    selectTab("progress");
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number): void => {
    let nextIndex = currentIndex;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % TAB_CONFIG.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + TAB_CONFIG.length) % TAB_CONFIG.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = TAB_CONFIG.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const nextTab = TAB_CONFIG[nextIndex].id;
    selectTab(nextTab);
    tabButtonRefs.current[nextTab]?.focus();
  };

  const setWordStatus = (word: VocabularyWord, status: "known" | "practice" | "clear"): void => {
    setProgressMap((current) => {
      const prev = current[word.id] ?? {
        seen: 0,
        correct: 0,
        wrong: 0,
        known: false,
        needsPractice: false,
        lastReviewed: null,
        updatedAt: null
      };

      const next = {
        ...current,
        [word.id]: {
          ...prev,
          known: status === "known",
          needsPractice: status === "practice",
          updatedAt: new Date().toISOString()
        }
      };

      progressMapRef.current = next;
      return next;
    });
  };

  const markWord = (
    word: VocabularyWord,
    isCorrect: boolean,
    options?: { known?: boolean; needsPractice?: boolean }
  ): void => {
    setProgressMap((current) => {
      const updatedAt = new Date().toISOString();
      const prev = current[word.id] ?? {
        seen: 0,
        correct: 0,
        wrong: 0,
        known: false,
        needsPractice: false,
        lastReviewed: null,
        updatedAt: null
      };

      const next = {
        ...current,
        [word.id]: {
          seen: prev.seen + 1,
          correct: prev.correct + (isCorrect ? 1 : 0),
          wrong: prev.wrong + (isCorrect ? 0 : 1),
          known: typeof options?.known === "boolean" ? options.known : prev.known,
          needsPractice: typeof options?.needsPractice === "boolean" ? options.needsPractice : prev.needsPractice,
          lastReviewed: todayIso(),
          updatedAt
        }
      };

      progressMapRef.current = next;
      return next;
    });
  };

  const studyPool = useMemo(() => {
    if (studyFilter === "all") return words;
    return words.filter((word) => {
      const known = progressMap[word.id]?.known ?? false;
      const needsPractice = progressMap[word.id]?.needsPractice ?? false;
      if (studyFilter === "known") return known;
      if (studyFilter === "practice") return needsPractice;
      return !known;
    });
  }, [progressMap, studyFilter]);

  const studyHints = useMemo(() => buildStudyHints(studyWord), [studyWord]);

  const miniDrillRecommendations = useMemo(() => {
    const scored = words
      .map((word) => {
        const state = progressMap[word.id];
        return {
          word,
          score: miniDrillScore(state),
          reason: miniDrillReason(state),
          daysSinceReview: daysSinceIsoDate(state?.lastReviewed)
        };
      })
      .sort((first, second) => {
        if (second.score !== first.score) return second.score - first.score;

        const firstDays = first.daysSinceReview ?? Number.MAX_SAFE_INTEGER;
        const secondDays = second.daysSinceReview ?? Number.MAX_SAFE_INTEGER;
        if (secondDays !== firstDays) return secondDays - firstDays;

        return first.word.id - second.word.id;
      });

    const topPriority = scored.filter((item) => item.score > 0).slice(0, 5);
    return topPriority.length > 0 ? topPriority : scored.slice(0, 5);
  }, [progressMap]);

  const miniDrillActive = miniDrillQueue.length > 0;
  const miniDrillProgress = miniDrillActive ? `${Math.min(miniDrillIndex + 1, miniDrillQueue.length)}/${miniDrillQueue.length}` : "";
  const miniDrillLastQuestion = miniDrillActive && miniDrillIndex >= miniDrillQueue.length - 1;

  useEffect(() => {
    if (!studyPool.some((word) => word.id === studyWord.id)) {
      const fallback = studyPool.length > 0 ? studyPool[0] : words[0];
      setStudyWord(fallback);
      setReveal(false);
      setStudyHintLevel(0);
      setStudyDecision("none");
    }
  }, [studyPool, studyWord.id]);

  useEffect(() => {
    setStudyHintLevel(0);
  }, [studyWord.id]);

  const filteredWords = useMemo(() => {
    return words.filter((word) => {
      if (topicFilter !== "all" && word.topic !== topicFilter) return false;
      if (posFilter !== "all" && word.pos !== posFilter) return false;
      if (!searchValue.trim()) return true;
      const needle = searchValue.toLowerCase();
      return (
        word.fi.toLowerCase().includes(needle) ||
        word.en.toLowerCase().includes(needle) ||
        word.fiSimple.toLowerCase().includes(needle)
      );
    });
  }, [posFilter, searchValue, topicFilter]);

  const totalWords = words.length;
  const knownCount = words.filter((word) => progressMap[word.id]?.known).length;
  const needsPracticeCount = words.filter((word) => progressMap[word.id]?.needsPractice).length;
  const reviewedToday = words.filter((word) => progressMap[word.id]?.lastReviewed === todayIso()).length;
  const totalCorrect = words.reduce((sum, word) => sum + (progressMap[word.id]?.correct ?? 0), 0);
  const totalWrong = words.reduce((sum, word) => sum + (progressMap[word.id]?.wrong ?? 0), 0);
  const accuracy = totalCorrect + totalWrong > 0 ? Math.round((totalCorrect / (totalCorrect + totalWrong)) * 100) : 0;
  const goalPct = Math.min(100, Math.round((reviewedToday / dailyGoal) * 100));
  const hasStudyActivity = reviewedToday > 0 || studyKnownSession > 0 || studyPracticeSession > 0;
  const localSyncSummary = useMemo(() => summarizeProgress(progressMap, dailyGoal), [progressMap, dailyGoal]);
  const cloudSyncSummary = useMemo(
    () => (syncConflict ? summarizeProgress(syncConflict.serverProgress, syncConflict.serverDailyGoal) : null),
    [syncConflict]
  );

  const nextStudyWord = (): void => {
    const pool = studyPool.length > 0 ? studyPool : words;
    setStudyWord(randomFrom(pool));
    setReveal(false);
    setStudyHintLevel(0);
    setStudyDecision("none");
  };

  const revealStudyWord = (): void => {
    setReveal(true);
    setStudyDecision("none");
  };

  const revealStudyHint = (): void => {
    if (reveal) return;
    setStudyHintLevel((current) => Math.min(current + 1, studyHints.length));
  };

  const setQuizWordAndReset = (word: VocabularyWord): void => {
    setQuizWord(word);
    setQuizOptions(pickQuizOptions(word));
    setTypingValue("");
    setQuizFeedback("");
  };

  const startMiniDrill = (): void => {
    const queue = miniDrillRecommendations.map((item) => item.word.id);
    if (queue.length === 0) return;

    setMiniDrillQueue(queue);
    setMiniDrillIndex(0);
    const firstWord = words.find((word) => word.id === queue[0]) ?? words[0];
    setQuizWordAndReset(firstWord);
    setTab("quiz");
  };

  const stopMiniDrill = (): void => {
    setMiniDrillQueue([]);
    setMiniDrillIndex(0);
  };

  const markStudyKnown = (): void => {
    if (!reveal || studyDecision !== "none") return;
    markWord(studyWord, true, { known: true, needsPractice: false });
    setStudyDecision("known");
    setStudyKnownSession((prev) => prev + 1);
  };

  const markStudyPractice = (): void => {
    if (!reveal || studyDecision !== "none") return;
    markWord(studyWord, false, { known: false, needsPractice: true });
    setStudyDecision("practice");
    setStudyPracticeSession((prev) => prev + 1);
  };

  const nextQuiz = (): void => {
    if (miniDrillQueue.length > 0) {
      const nextIndex = miniDrillIndex + 1;
      if (nextIndex < miniDrillQueue.length) {
        const nextWordId = miniDrillQueue[nextIndex];
        const nextWord = words.find((word) => word.id === nextWordId);

        if (nextWord) {
          setMiniDrillIndex(nextIndex);
          setQuizWordAndReset(nextWord);
          return;
        }
      }

      setMiniDrillQueue([]);
      setMiniDrillIndex(0);
    }

    const next = randomFrom(words);
    setQuizWordAndReset(next);
  };

  const answerMcq = (option: string): void => {
    const ok = option === quizWord.en;
    markWord(quizWord, ok);
    if (ok) {
      setQuizCorrect((prev) => prev + 1);
      setQuizFeedback("Correct.");
    } else {
      setQuizWrong((prev) => prev + 1);
      setQuizFeedback(`Incorrect. Correct answer: ${quizWord.en}`);
    }
  };

  const answerTyping = (): void => {
    if (!typingValue.trim()) return;
    const ok = normalizeFinnish(typingValue) === normalizeFinnish(quizWord.fi);
    markWord(quizWord, ok);
    if (ok) {
      setQuizCorrect((prev) => prev + 1);
      setQuizFeedback("Correct.");
    } else {
      setQuizWrong((prev) => prev + 1);
      setQuizFeedback(buildTypingMistakeFeedback(typingValue, quizWord));
    }
  };

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
  const isCloudSyncExpanded = showCloudSync;

  useEffect(() => {
    if (tab !== "study") return;

    const target = !reveal
      ? studyRevealButtonRef.current
      : studyDecision === "none"
        ? studyKnownButtonRef.current
        : studyNextButtonRef.current;
    if (!target) return;

    const rafId = window.requestAnimationFrame(() => {
      target.focus();
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [reveal, studyDecision, studyWord.id, tab]);

  useEffect(() => {
    if (tab !== "quiz") return;

    const target = quizFeedback
      ? quizNextButtonRef.current
      : quizMode === "typing"
        ? quizTypingInputRef.current
        : quizFirstOptionRef.current;
    if (!target) return;

    const rafId = window.requestAnimationFrame(() => {
      target.focus();
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [quizFeedback, quizMode, quizWord.id, tab]);

  const renderWordStatusActions = (word: VocabularyWord, compact = false) => {
    const known = progressMap[word.id]?.known ?? false;
    const needsPractice = progressMap[word.id]?.needsPractice ?? false;
    const baseClass = compact
      ? "rounded-lg px-3 py-2 text-xs font-semibold"
      : "rounded-md px-2.5 py-1.5 text-xs font-semibold";

    return (
      <div className={`flex flex-wrap gap-2 ${compact ? "mt-3" : ""}`}>
        <button
          type="button"
          className={`${baseClass} ${
            known ? "bg-emerald-600 text-white" : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
          }`}
          onClick={() => setWordStatus(word, "known")}
          aria-pressed={known}
        >
          Known
        </button>
        <button
          type="button"
          className={`${baseClass} ${
            needsPractice ? "bg-amber-500 text-white" : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
          }`}
          onClick={() => setWordStatus(word, "practice")}
          aria-pressed={needsPractice}
        >
          Needs Practice
        </button>
        {(known || needsPractice) && (
          <button
            type="button"
            className={`${baseClass} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}
            onClick={() => setWordStatus(word, "clear")}
          >
            Clear
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="glass card-shadow mb-4 rounded-3xl p-4 md:p-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1.5">
                <h1 className="text-2xl font-extrabold tracking-tight text-ink md:text-3xl">SuomiSanat</h1>
                <p className="max-w-2xl text-xs text-slate-700 md:text-sm">
                  {totalWords} Finnish must-have words for YKI intermediate (grade 3), with English meaning and an easy Finnish clue.
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  className={`inline-flex items-center rounded-2xl border px-3 py-2 text-xs font-semibold ${syncBadgeClass}`}
                  onClick={openCloudSyncSettings}
                >
                  Sync: {syncBadgeLabel}
                </button>
                <div className="sun-gradient inline-flex rounded-2xl px-3 py-2 text-xs font-semibold text-ink">
                  Known: {knownCount}/{totalWords}
                </div>
              </div>
            </div>
          </div>

          <nav className="mt-4 grid gap-2 sm:grid-cols-2 md:grid-cols-4" role="tablist" aria-label="Main sections">
            {TAB_CONFIG.map((item, index) => (
              <button
                key={item.id}
                id={tabButtonId(item.id)}
                ref={(node) => {
                  tabButtonRefs.current[item.id] = node;
                }}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                aria-controls={tabPanelId(item.id)}
                tabIndex={tab === item.id ? 0 : -1}
                className={`rounded-xl border px-3 py-1.5 text-sm font-semibold ${
                  tab === item.id
                    ? "accent-gradient border-transparent text-white"
                    : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                }`}
                onClick={() => selectTab(item.id)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
              >
                {item.label}
              </button>
            ))}
          </nav>

        </header>

        {tab === "study" && (
          <section
            id={tabPanelId("study")}
            role="tabpanel"
            aria-labelledby={tabButtonId("study")}
            className="glass card-shadow rounded-3xl p-4 md:p-6"
          >
            <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Study mode">
              <span className="text-xs font-semibold text-slate-700">Study mode:</span>
              {(["all", "unknown", "known", "practice"] as StudyFilter[]).map((mode) => (
                <button
                  key={mode}
                  className={`rounded-lg border px-2 py-1 text-xs ${
                    studyFilter === mode
                      ? "accent-gradient border-transparent text-white"
                      : "border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200"
                  }`}
                  onClick={() => setStudyFilter(mode)}
                >
                  {STUDY_FILTER_LABELS[mode]}
                </button>
              ))}
              <span className="ml-auto text-xs text-slate-700">Cards in mode: {studyPool.length}</span>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white px-5 py-4 text-center md:px-6 md:py-5">
              <div className="mb-1.5 flex flex-wrap justify-center gap-2">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                  {TOPIC_LABELS[studyWord.topic]}
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                  {POS_LABELS[studyWord.pos]}
                </span>
              </div>
              <h2 className="mt-1 text-4xl font-extrabold text-ink md:text-[3.25rem]">{studyWord.fi}</h2>
              {!reveal && <p className="mt-2.5 text-sm text-slate-700">Try to recall the meaning, then reveal.</p>}
              {!reveal && studyHintLevel > 0 && (
                <div className="mx-auto mt-2.5 max-w-2xl space-y-2 text-left">
                  {studyHints.slice(0, studyHintLevel).map((hint, index) => (
                    <p key={`${studyWord.id}-hint-${index}`} className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-800">
                      Hint {index + 1}: {hint}
                    </p>
                  ))}
                </div>
              )}
              {reveal && (
                <div className="mt-2.5 space-y-2">
                  <p className="text-xl font-semibold text-accent">{studyWord.en}</p>
                  <p className="text-sm text-slate-800">{studyWord.fiSimple}</p>
                  <p className="text-sm text-slate-700">{studyExample(studyWord)}</p>
                </div>
              )}
            </div>

            {!reveal && (
              <div className="mt-4 flex flex-col items-center gap-2.5">
                <div className="grid w-full gap-2 sm:max-w-xl sm:grid-cols-2">
                  <button
                    ref={studyRevealButtonRef}
                    className="w-full rounded-xl bg-slate-800 px-4 py-3 text-sm font-semibold text-white"
                    onClick={revealStudyWord}
                  >
                    Reveal Meaning
                  </button>
                  <button
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={revealStudyHint}
                    disabled={studyHintLevel >= studyHints.length}
                  >
                    {studyHintLevel === 0 ? "Show Hint" : studyHintLevel >= studyHints.length ? "All Hints Shown" : "Show Another Hint"}
                  </button>
                </div>
                <button
                  className="px-3 py-1 text-sm font-semibold text-slate-600 hover:text-slate-900"
                  onClick={nextStudyWord}
                >
                  Skip for Now
                </button>
              </div>
            )}

            {reveal && studyDecision === "none" && (
              <div className="mt-4 flex flex-col items-center gap-2.5">
                <div className="grid w-full gap-2 sm:max-w-xl sm:grid-cols-2">
                  <button
                    ref={studyKnownButtonRef}
                    className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white"
                    onClick={markStudyKnown}
                  >
                    Mark Known
                  </button>
                  <button className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white" onClick={markStudyPractice}>
                    Needs Practice
                  </button>
                </div>
                <button
                  className="px-3 py-1 text-sm font-semibold text-slate-600 hover:text-slate-900"
                  onClick={nextStudyWord}
                >
                  Skip Without Saving
                </button>
              </div>
            )}

            {reveal && studyDecision !== "none" && (
              <div className="mt-5">
                <p className="mb-3 text-sm font-semibold text-slate-800" role="status" aria-live="polite">
                  {studyDecision === "known" ? "Saved as known." : "Saved as needs practice."}
                </p>
                <button
                  ref={studyNextButtonRef}
                  className="w-full rounded-xl bg-slate-800 px-4 py-3 text-sm font-semibold text-white sm:w-auto"
                  onClick={nextStudyWord}
                >
                  Next Card
                </button>
              </div>
            )}

            {hasStudyActivity ? (
              <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(260px,0.9fr)]">
                <div className="rounded-xl bg-slate-50/80 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-ink">Session overview</p>
                    <p className="text-xs text-slate-600">
                      This session: {studyKnownSession} known, {studyPracticeSession} needs practice
                    </p>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                    <article className="rounded-lg bg-white px-3 py-2.5">
                      <p className="text-[11px] uppercase tracking-wide text-slate-600">Reviewed Today</p>
                      <p className="mt-1 text-lg font-bold leading-none text-ink">{reviewedToday}</p>
                    </article>
                    <article className="rounded-lg bg-white px-3 py-2.5">
                      <p className="text-[11px] uppercase tracking-wide text-slate-600">Accuracy</p>
                      <p className="mt-1 text-lg font-bold leading-none text-ink">{accuracy}%</p>
                    </article>
                    <article className="rounded-lg bg-white px-3 py-2.5">
                      <p className="text-[11px] uppercase tracking-wide text-slate-600">Practice Queue</p>
                      <p className="mt-1 text-lg font-bold leading-none text-ink">{needsPracticeCount}</p>
                    </article>
                    <article className="rounded-lg bg-white px-3 py-2.5">
                      <p className="text-[11px] uppercase tracking-wide text-slate-600">Cards in Mode</p>
                      <p className="mt-1 text-lg font-bold leading-none text-ink">{studyPool.length}</p>
                    </article>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50/80 p-3">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-ink">Daily goal</p>
                    <span className="text-xs text-slate-700">
                      {reviewedToday}/{dailyGoal}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-200">
                    <div className="h-2.5 rounded-full bg-accent" style={{ width: `${goalPct}%` }} />
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <label htmlFor="daily-goal-study" className="text-xs text-slate-700">
                      Daily target
                    </label>
                    <input
                      id="daily-goal-study"
                      type="number"
                      min={5}
                      max={200}
                      className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-900"
                      value={dailyGoal}
                      onChange={(event) => {
                        const parsed = Number(event.target.value);
                        if (Number.isFinite(parsed) && parsed > 0) {
                          const nextGoal = Math.round(parsed);
                          dailyGoalRef.current = nextGoal;
                          setDailyGoal(nextGoal);
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-xl bg-slate-50/80 px-4 py-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-ink">Session overview</p>
                    <p className="text-sm text-slate-600">Start reviewing cards to unlock your session stats.</p>
                  </div>
                  <div className="min-w-0 lg:w-[320px]">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-ink">Daily goal</p>
                      <span className="text-xs text-slate-700">
                        {reviewedToday}/{dailyGoal}
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-200">
                      <div className="h-2.5 rounded-full bg-accent" style={{ width: `${goalPct}%` }} />
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <label htmlFor="daily-goal-study" className="text-xs text-slate-700">
                        Daily target
                      </label>
                      <input
                        id="daily-goal-study"
                        type="number"
                        min={5}
                        max={200}
                        className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-900"
                        value={dailyGoal}
                        onChange={(event) => {
                          const parsed = Number(event.target.value);
                          if (Number.isFinite(parsed) && parsed > 0) {
                            const nextGoal = Math.round(parsed);
                            dailyGoalRef.current = nextGoal;
                            setDailyGoal(nextGoal);
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {tab === "quiz" && (
          <section
            id={tabPanelId("quiz")}
            role="tabpanel"
            aria-labelledby={tabButtonId("quiz")}
            className="glass card-shadow rounded-3xl p-5 md:p-8"
          >
            <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Quiz mode">
              <span className="text-sm font-semibold text-slate-700">Quiz mode:</span>
              <button
                className={`rounded-lg border px-3 py-1 text-sm ${
                  quizMode === "mcq"
                    ? "accent-gradient border-transparent text-white"
                    : "border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200"
                }`}
                onClick={() => setQuizMode("mcq")}
              >
                Multiple Choice
              </button>
              <button
                className={`rounded-lg border px-3 py-1 text-sm ${
                  quizMode === "typing"
                    ? "accent-gradient border-transparent text-white"
                    : "border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200"
                }`}
                onClick={() => setQuizMode("typing")}
              >
                Type Finnish
              </button>
              <span className="ml-auto text-xs text-slate-700">
                Score: {quizCorrect} correct / {quizWrong} wrong
              </span>
              {miniDrillActive && (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                  Mini drill: {miniDrillProgress}
                </span>
              )}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              {quizMode === "mcq" && (
                <>
                  <p className="text-sm text-slate-600">Pick the English meaning:</p>
                  <h2 className="mt-2 text-3xl font-bold text-ink">{quizWord.fi}</h2>
                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    {quizOptions.map((option) => (
                      <button
                        key={`${quizWord.id}-${option}`}
                        ref={option === quizOptions[0] ? quizFirstOptionRef : null}
                        className="rounded-xl border border-slate-300 px-3 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"
                        onClick={() => answerMcq(option)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {quizMode === "typing" && (
                <>
                  <p className="text-sm text-slate-600">Type the Finnish word:</p>
                  <h2 className="mt-2 text-2xl font-bold text-ink">{quizWord.en}</h2>
                  <label htmlFor="quiz-typing-input" className="sr-only">
                    Type the Finnish word for {quizWord.en}
                  </label>
                  <input
                    id="quiz-typing-input"
                    ref={quizTypingInputRef}
                    className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-accent focus:outline-none"
                    placeholder="Write Finnish word"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={typingValue}
                    onChange={(event) => setTypingValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        answerTyping();
                      }
                    }}
                  />
                  <button className="mt-3 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white" onClick={answerTyping}>
                    Check
                  </button>
                </>
              )}

              {quizFeedback && (
                <p className="mt-4 text-sm font-semibold text-slate-800" role="status" aria-live="polite">
                  {quizFeedback}
                </p>
              )}
            </div>

            <button
              ref={quizNextButtonRef}
              className="mt-4 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              onClick={nextQuiz}
            >
              {miniDrillLastQuestion ? "Finish Mini Drill" : "Next Question"}
            </button>
            {miniDrillActive && (
              <button
                className="ml-2 mt-4 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                onClick={stopMiniDrill}
              >
                Exit Mini Drill
              </button>
            )}
          </section>
        )}

        {tab === "list" && (
          <section
            id={tabPanelId("list")}
            role="tabpanel"
            aria-labelledby={tabButtonId("list")}
            className="glass card-shadow rounded-3xl p-5 md:p-8"
          >
            <div className="grid gap-3 md:grid-cols-4">
              <label htmlFor="word-search" className="sr-only">
                Search words
              </label>
                <input
                  id="word-search"
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-accent focus:outline-none md:col-span-2"
                  placeholder="Search Finnish, English, or clue"
                  autoComplete="off"
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                />
              <label htmlFor="topic-filter" className="sr-only">
                Filter by topic
              </label>
              <select
                id="topic-filter"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-accent focus:outline-none"
                value={topicFilter}
                onChange={(event) => setTopicFilter(event.target.value as WordTopic | "all")}
              >
                <option value="all">All Topics</option>
                {TOPICS.map((topic) => (
                  <option key={topic} value={topic}>
                    {TOPIC_LABELS[topic]}
                  </option>
                ))}
              </select>
              <label htmlFor="pos-filter" className="sr-only">
                Filter by part of speech
              </label>
              <select
                id="pos-filter"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-accent focus:outline-none"
                value={posFilter}
                onChange={(event) => setPosFilter(event.target.value as WordPos | "all")}
              >
                <option value="all">All Word Types</option>
                {POS_OPTIONS.map((pos) => (
                  <option key={pos} value={pos}>
                    {POS_LABELS[pos]}
                  </option>
                ))}
              </select>
            </div>

            <p className="mt-3 text-xs text-slate-700">Showing {filteredWords.length} of {totalWords} words</p>

            <div className="mt-4 space-y-3 md:hidden">
              {filteredWords.map((word) => (
                <article key={`mobile-word-${word.id}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-ink">{word.fi}</h3>
                      <p className="text-sm font-semibold text-accent">{word.en}</p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                      {TOPIC_LABELS[word.topic]}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-slate-700">{word.fiSimple}</p>
                  <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">{POS_LABELS[word.pos]}</p>
                  {renderWordStatusActions(word, true)}
                </article>
              ))}
            </div>

            <div className="mt-4 hidden max-h-[60vh] overflow-auto rounded-2xl border border-slate-300 bg-white md:block">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="sticky top-0 bg-slate-100 text-xs uppercase tracking-wide text-slate-700">
                  <tr>
                    <th className="px-3 py-2">Finnish</th>
                    <th className="px-3 py-2">English</th>
                    <th className="px-3 py-2">Easy Finnish clue</th>
                    <th className="px-3 py-2">Topic</th>
                    <th className="px-3 py-2">Known</th>
                    <th className="px-3 py-2">Needs Practice</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWords.map((word) => (
                    <tr key={word.id} className="border-t border-slate-200 align-top">
                      <td className="px-3 py-2 font-semibold text-ink">{word.fi}</td>
                      <td className="px-3 py-2 text-slate-800">{word.en}</td>
                      <td className="px-3 py-2 text-slate-700">{word.fiSimple}</td>
                      <td className="px-3 py-2 text-xs uppercase tracking-wide text-slate-600">{TOPIC_LABELS[word.topic]}</td>
                      <td className="px-3 py-2 text-slate-800">{progressMap[word.id]?.known ? "yes" : "no"}</td>
                      <td className="px-3 py-2 text-slate-800">{progressMap[word.id]?.needsPractice ? "yes" : "no"}</td>
                      <td className="px-3 py-2">{renderWordStatusActions(word)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "progress" && (
          <section
            id={tabPanelId("progress")}
            role="tabpanel"
            aria-labelledby={tabButtonId("progress")}
            className="glass card-shadow rounded-3xl p-5 md:p-8"
          >
            {isCloudSyncExpanded && (
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
                    onClick={() => setShowCloudSync(false)}
                    aria-expanded={isCloudSyncExpanded}
                    aria-controls="cloud-sync-panel"
                  >
                    Hide Details
                    <svg
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                      className="cloud-sync-chevron h-4 w-4 text-slate-500"
                      data-open={isCloudSyncExpanded}
                    >
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
                        onClick={() => {
                          void flushSyncNow();
                        }}
                        disabled={!canManualSync}
                      >
                        Sync Now
                      </button>
                      {hasSupabaseConfig && session && (
                        <button
                          type="button"
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                          onClick={() => {
                            void signOut();
                          }}
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
                            onClick={() => {
                              void resolveSyncConflict("local");
                            }}
                            disabled={syncStatus === "saving"}
                          >
                            Import Browser Data
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-950 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() => {
                              void resolveSyncConflict("cloud");
                            }}
                            disabled={syncStatus === "saving"}
                          >
                            {syncConflict.mode === "import" ? "Start from Cloud" : "Use Cloud Data"}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        {hasSupabaseConfig && session && (
                          <p className="text-xs text-slate-600">Signed in as {session.user.email ?? "your account"}.</p>
                        )}
                        {!hasSupabaseConfig && <p className="text-xs text-slate-600">Running in local-only mode.</p>}
                      </div>
                    </div>

                    {hasSupabaseConfig && !session && (
                      <form
                        className="flex w-full flex-col gap-2 sm:flex-row"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void sendMagicLink();
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
                          onChange={(event) => setAuthEmail(event.target.value)}
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
            )}

            <div className={`${isCloudSyncExpanded ? "mt-5 " : ""}grid gap-4 md:grid-cols-4`}>
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
                  onChange={(event) => {
                    const parsed = Number(event.target.value);
                    if (Number.isFinite(parsed) && parsed > 0) {
                      const nextGoal = Math.round(parsed);
                      dailyGoalRef.current = nextGoal;
                      setDailyGoal(nextGoal);
                    }
                  }}
                />
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink">Daily Mini Drill</p>
                  <p className="text-xs text-slate-700">Top 5 words selected from weak or stale items.</p>
                </div>
                <button
                  className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900"
                  onClick={startMiniDrill}
                >
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
        )}
      </div>
    </div>
  );
}









