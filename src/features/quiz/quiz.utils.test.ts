import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProgressState, VocabularyWord } from "../../types";
import { buildMiniDrillRecommendations, buildTypingMistakeFeedback, normalizeFinnish, pickQuizOptions } from "./quiz.utils";

const words: VocabularyWord[] = [
  { id: 1, fi: "kiitos", en: "thank you", fiSimple: "Tama ilmaisee kiitollisuutta.", enSimple: "Shows gratitude.", topic: "social", pos: "word" },
  { id: 2, fi: "koydet", en: "ropes", fiSimple: "Nama ovat pitkia naruja.", enSimple: "Plural rope.", topic: "home", pos: "noun" },
  { id: 3, fi: "juosta", en: "run", fiSimple: "Liikkua nopeasti.", enSimple: "Move fast.", topic: "verbs", pos: "verb" },
  { id: 4, fi: "aina", en: "always", fiSimple: "Joka kerta.", enSimple: "Every time.", topic: "time", pos: "adverb" }
];

describe("quiz.utils", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes Finnish input for tolerant comparisons", () => {
    expect(normalizeFinnish("  Koydet!? ")).toBe("koydet");
  });

  it("builds typing feedback with practical hints", () => {
    expect(buildTypingMistakeFeedback("ropes", words[1])).toContain("You entered English. This mode expects Finnish.");
    expect(buildTypingMistakeFeedback("koydet", { ...words[1], fi: "k\u00f6ydet" })).toContain("This word uses Finnish special letters.");
  });

  it("returns the correct answer among quiz options", () => {
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0);

    const options = pickQuizOptions(words[0], words);
    expect(options).toHaveLength(4);
    expect(new Set(options).size).toBe(4);
    expect(options).toContain("thank you");
  });

  it("prioritizes weak or unseen words for mini drills", () => {
    const progressMap: Record<number, ProgressState | undefined> = {
      1: {
        seen: 0,
        correct: 0,
        wrong: 0,
        known: false,
        needsPractice: false,
        lastReviewed: null,
        updatedAt: null
      },
      2: {
        seen: 3,
        correct: 0,
        wrong: 3,
        known: false,
        needsPractice: true,
        lastReviewed: "2026-03-01",
        updatedAt: null
      },
      3: {
        seen: 5,
        correct: 5,
        wrong: 0,
        known: true,
        needsPractice: false,
        lastReviewed: "2026-03-15",
        updatedAt: null
      }
    };

    const recommendations = buildMiniDrillRecommendations(words, progressMap);
    expect(recommendations[0]?.word.id).toBe(2);
    expect(recommendations[0]?.reason).toBe("Marked as needs practice");
    expect(recommendations.some((item) => item.word.id === 1)).toBe(true);
  });
});
