import { WORD_POS_OPTIONS, WORD_TOPICS } from "../../types";
import type { LearningScope, StudyFilter, Tab } from "./app.types";

export const DEFAULT_DAILY_GOAL = 20;
export const SYNC_DEBOUNCE_MS = 900;

export const TAB_CONFIG: Array<{ id: Tab; label: string }> = [
  { id: "study", label: "Study" },
  { id: "quiz", label: "Quiz" },
  { id: "list", label: "Word List" },
  { id: "progress", label: "Progress" }
];

export const TOPICS = [...WORD_TOPICS];
export const POS_OPTIONS = [...WORD_POS_OPTIONS];
export const LEARNING_SCOPE_OPTIONS: LearningScope[] = ["all", "words", "phrases"];

export const TOPIC_LABELS = {
  core: "Core",
  time: "Time",
  home: "Home",
  food: "Food",
  city: "City",
  health: "Health",
  work: "Work",
  verbs: "Verbs",
  describing: "Describing",
  weather: "Weather",
  emotions: "Emotions",
  family: "Family",
  admin: "Admin",
  communication: "Communication",
  daily: "Daily Life",
  housing: "Housing",
  job_seeking: "Job Seeking",
  media: "Media",
  opinion: "Opinion",
  shopping: "Shopping",
  social: "Social",
  social_services: "Social Services",
  study: "Study",
  studying: "Studying",
  transport: "Transport",
  travel: "Travel",
  writing: "Writing"
} as const;

export const POS_LABELS = {
  noun: "Noun",
  verb: "Verb",
  adjective: "Adjective",
  adverb: "Adverb",
  pronoun: "Pronoun",
  word: "Word",
  phrase: "Phrase",
  sentence: "Sentence",
  connector: "Connector",
  opening: "Opening",
  closing: "Closing",
  other: "Other"
} as const;

export const LEARNING_SCOPE_LABELS: Record<LearningScope, string> = {
  all: "All",
  words: "Words",
  phrases: "Phrases"
};

export const STUDY_FILTER_LABELS: Record<StudyFilter, string> = {
  all: "All Cards",
  unknown: "Unknown",
  known: "Known",
  practice: "Needs Practice"
};

export const tabButtonId = (tab: Tab): string => `tab-${tab}`;
export const tabPanelId = (tab: Tab): string => `panel-${tab}`;