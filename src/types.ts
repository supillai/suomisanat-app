export const WORD_TOPICS = ["core", "time", "home", "food", "city", "health", "work", "verbs", "describing"] as const;

export type WordTopic = (typeof WORD_TOPICS)[number];

export const WORD_POS_OPTIONS = ["noun", "verb", "adjective", "adverb", "pronoun", "other"] as const;

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
