import type { VocabularyWord } from "../../types";
import type { LearningScope } from "./app.types";

const phraseLikePosSet = new Set(["phrase", "sentence", "opening", "closing", "connector"]);

export const isPhraseLikeWord = (word: VocabularyWord): boolean => {
  if (phraseLikePosSet.has(word.pos)) {
    return true;
  }

  return /\s/u.test(word.fi.trim());
};

export const filterWordsByScope = (words: VocabularyWord[], scope: LearningScope): VocabularyWord[] => {
  if (scope === "all") {
    return words;
  }

  return words.filter((word) => (scope === "phrases" ? isPhraseLikeWord(word) : !isPhraseLikeWord(word)));
};

export const getLearningItemLabel = (word: VocabularyWord): "word" | "phrase" => (isPhraseLikeWord(word) ? "phrase" : "word");