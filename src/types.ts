export type WordTopic =
  | "core"
  | "time"
  | "home"
  | "food"
  | "city"
  | "health"
  | "work"
  | "verbs"
  | "describing";

export type WordPos = "noun" | "verb" | "adjective" | "adverb" | "pronoun" | "other";

export type VocabularyWord = {
  id: number;
  fi: string;
  en: string;
  fiSimple: string;
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
