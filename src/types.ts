export const WORD_TOPICS = [
  "core",
  "time",
  "home",
  "food",
  "city",
  "health",
  "work",
  "verbs",
  "describing",
  "weather",
  "emotions",
  "family",
  "admin",
  "communication",
  "daily",
  "housing",
  "job_seeking",
  "media",
  "opinion",
  "shopping",
  "social",
  "social_services",
  "study",
  "studying",
  "transport",
  "travel",
  "writing"
] as const;

export type WordTopic = (typeof WORD_TOPICS)[number];

export const WORD_POS_OPTIONS = ["noun", "verb", "adjective", "adverb", "pronoun", "word", "phrase", "sentence", "connector", "opening", "closing", "other"] as const;

export type WordPos = (typeof WORD_POS_OPTIONS)[number];

export type VocabularyWord = {
  id: number;
  fi: string;
  en: string;
  fiSimple: string;
  enSimple: string;
  topic: WordTopic;
  pos: WordPos;
};

export type ProgressState = {
  seen: number;
  correct: number;
  wrong: number;
  known: boolean;
  needsPractice: boolean;
  lastReviewed: string | null;
  updatedAt?: string | null;
};

export type ProgressMap = Record<number, ProgressState>;
