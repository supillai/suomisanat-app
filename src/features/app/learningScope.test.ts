import { describe, expect, it } from "vitest";
import type { VocabularyWord } from "../../types";
import { filterWordsByScope, getLearningItemLabel, isPhraseLikeWord } from "./learningScope";

const words: VocabularyWord[] = [
  { id: 1, fi: "kissa", en: "cat", fiSimple: "Elain.", enSimple: "An animal.", topic: "home", pos: "noun" },
  { id: 2, fi: "paljon onnea", en: "congratulations", fiSimple: "Paljon onnea!", enSimple: "Congratulations!", topic: "social", pos: "other" },
  { id: 3, fi: "terveisin", en: "kind regards", fiSimple: "Terveisin", enSimple: "Kind regards", topic: "communication", pos: "closing" }
];

describe("learningScope", () => {
  it("treats multi-word or phrase-specific items as phrase-like", () => {
    expect(isPhraseLikeWord(words[0])).toBe(false);
    expect(isPhraseLikeWord(words[1])).toBe(true);
    expect(isPhraseLikeWord(words[2])).toBe(true);
  });

  it("filters words by learning scope", () => {
    expect(filterWordsByScope(words, "all")).toHaveLength(3);
    expect(filterWordsByScope(words, "words").map((word) => word.id)).toEqual([1]);
    expect(filterWordsByScope(words, "phrases").map((word) => word.id)).toEqual([2, 3]);
  });

  it("returns a practical item label for prompts", () => {
    expect(getLearningItemLabel(words[0])).toBe("word");
    expect(getLearningItemLabel(words[1])).toBe("phrase");
  });
});