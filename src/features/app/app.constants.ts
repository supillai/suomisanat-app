import type { WordPos, WordTopic } from "../../types";
import type { StudyFilter, Tab } from "./app.types";

export const DEFAULT_DAILY_GOAL = 20;
export const SYNC_DEBOUNCE_MS = 900;

export const TAB_CONFIG: Array<{ id: Tab; label: string }> = [
  { id: "study", label: "Study" },
  { id: "quiz", label: "Quiz" },
  { id: "list", label: "Word List" },
  { id: "progress", label: "Progress" }
];

export const TOPICS: WordTopic[] = ["core", "time", "home", "food", "city", "health", "work", "verbs", "describing"];

export const POS_OPTIONS: WordPos[] = ["noun", "verb", "adjective", "adverb", "pronoun", "other"];

export const TOPIC_LABELS: Record<WordTopic, string> = {
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

export const POS_LABELS: Record<WordPos, string> = {
  noun: "Noun",
  verb: "Verb",
  adjective: "Adjective",
  adverb: "Adverb",
  pronoun: "Pronoun",
  other: "Phrase"
};

export const STUDY_FILTER_LABELS: Record<StudyFilter, string> = {
  all: "All Cards",
  unknown: "Unknown",
  known: "Known",
  practice: "Needs Practice"
};

export const tabButtonId = (tab: Tab): string => `tab-${tab}`;

export const tabPanelId = (tab: Tab): string => `panel-${tab}`;
