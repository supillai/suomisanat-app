import type { ProgressState, VocabularyWord } from "../../types";
import { shuffle } from "../../utils/collections";

export type MiniDrillRecommendation = {
  word: VocabularyWord;
  score: number;
  reason: string;
  daysSinceReview: number | null;
};

export const normalizeFinnish = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:\u2026'"`\u00b4\u2019\u2018\-()/]/g, " ")
    .replace(/\u00e4/g, "a")
    .replace(/\u00f6/g, "o")
    .replace(/\u00e5/g, "a")
    .replace(/\s+/g, " ")
    .trim();

export const pickQuizOptions = (correctWord: VocabularyWord, words: VocabularyWord[]): string[] => {
  const distractors = Array.from(new Set(words.filter((word) => word.id !== correctWord.id).map((word) => word.en))).slice(0);
  return shuffle([...shuffle(distractors).slice(0, 3), correctWord.en]);
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

export const buildTypingMistakeFeedback = (typedValue: string, word: VocabularyWord): string => {
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

  const expectedDoubleLetter = expected.match(/([a-z\u00e5\u00e4\u00f6])\1/iu)?.[0];
  if (expectedDoubleLetter && !typed.includes(expectedDoubleLetter)) {
    notes.push(`Watch double letters like "${expectedDoubleLetter}".`);
  }

  const expectedSpecialLetters = /[\u00e5\u00e4\u00f6]/iu.test(expected);
  const typedSpecialLetters = /[\u00e5\u00e4\u00f6]/iu.test(typed);
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

export const buildMiniDrillRecommendations = (
  words: VocabularyWord[],
  progressMap: Record<number, ProgressState | undefined>
): MiniDrillRecommendation[] => {
  const scored = words
    .map((word) => {
      const state = progressMap[word.id];
      return {
        word,
        score: miniDrillScore(state),
        reason: miniDrillReason(state),
        daysSinceReview: daysSinceIsoDate(state?.lastReviewed ?? null)
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
};
