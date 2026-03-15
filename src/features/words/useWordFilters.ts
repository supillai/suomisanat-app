import { useMemo, useState } from "react";
import type { ProgressMap, VocabularyWord, WordPos, WordTopic } from "../../types";

export type WordListSort = "fi" | "en" | "topic" | "recent";
export type WordListView = "all" | "due-next";

export type WordFilters = {
  searchValue: string;
  setSearchValue: (value: string) => void;
  topicFilter: WordTopic | "all";
  setTopicFilter: (value: WordTopic | "all") => void;
  posFilter: WordPos | "all";
  setPosFilter: (value: WordPos | "all") => void;
  sortBy: WordListSort;
  setSortBy: (value: WordListSort) => void;
  viewMode: WordListView;
  setViewMode: (value: WordListView) => void;
  dueNextCount: number;
  filteredWords: VocabularyWord[];
};

type WordRow = {
  word: VocabularyWord;
  dueScore: number;
  lastReviewedSortValue: number;
};

const compareFinnish = (first: string, second: string): number => first.localeCompare(second, "fi");
const compareEnglish = (first: string, second: string): number => first.localeCompare(second, "en");
const DUE_THRESHOLD = 24;

const getInitialWordListView = (): WordListView => {
  if (typeof window !== "undefined" && "matchMedia" in window && window.matchMedia("(max-width: 767px)").matches) {
    return "due-next";
  }

  return "all";
};

const toDueScore = (progressMap: ProgressMap, word: VocabularyWord): number => {
  const state = progressMap[word.id];
  if (!state) return 90;

  const totalAnswers = state.correct + state.wrong;
  const accuracyPenalty = totalAnswers > 0 ? Math.round((1 - state.correct / totalAnswers) * 28) : 18;
  const reviewGap = state.lastReviewed ? Math.max(0, Math.floor((Date.now() - new Date(`${state.lastReviewed}T00:00:00`).getTime()) / 86_400_000)) : 14;

  return (
    (state.needsPractice ? 70 : 0) +
    (state.known ? 0 : 18) +
    Math.min(state.wrong * 7, 28) +
    Math.min(reviewGap * 3, 36) +
    accuracyPenalty
  );
};

const toLastReviewedSortValue = (progressMap: ProgressMap, word: VocabularyWord): number => {
  const lastReviewed = progressMap[word.id]?.lastReviewed;
  if (!lastReviewed) return Number.MIN_SAFE_INTEGER;

  const parsed = Date.parse(`${lastReviewed}T00:00:00`);
  return Number.isNaN(parsed) ? Number.MIN_SAFE_INTEGER : parsed;
};

export const useWordFilters = (words: VocabularyWord[], progressMap: ProgressMap): WordFilters => {
  const [searchValue, setSearchValue] = useState("");
  const [topicFilter, setTopicFilter] = useState<WordTopic | "all">("all");
  const [posFilter, setPosFilter] = useState<WordPos | "all">("all");
  const [sortBy, setSortBy] = useState<WordListSort>("fi");
  const [viewMode, setViewMode] = useState<WordListView>(() => getInitialWordListView());

  const rows = useMemo<WordRow[]>(() => {
    return words.map((word) => ({
      word,
      dueScore: toDueScore(progressMap, word),
      lastReviewedSortValue: toLastReviewedSortValue(progressMap, word)
    }));
  }, [progressMap, words]);

  const normalizedSearch = useMemo(() => searchValue.trim().toLocaleLowerCase(), [searchValue]);
  const dueNextCount = useMemo(() => rows.filter((row) => row.dueScore >= DUE_THRESHOLD).length, [rows]);

  const filteredWords = useMemo(() => {
    const visibleRows = rows.filter(({ dueScore, word }) => {
      if (viewMode === "due-next" && dueScore < DUE_THRESHOLD) return false;
      if (topicFilter !== "all" && word.topic !== topicFilter) return false;
      if (posFilter !== "all" && word.pos !== posFilter) return false;
      if (!normalizedSearch) return true;

      return (
        word.fi.toLocaleLowerCase().includes(normalizedSearch) ||
        word.en.toLocaleLowerCase().includes(normalizedSearch) ||
        word.fiSimple.toLocaleLowerCase().includes(normalizedSearch) ||
        word.enSimple.toLocaleLowerCase().includes(normalizedSearch)
      );
    });

    visibleRows.sort((first, second) => {
      if (viewMode === "due-next" && second.dueScore !== first.dueScore) {
        return second.dueScore - first.dueScore;
      }

      switch (sortBy) {
        case "en":
          return compareEnglish(first.word.en, second.word.en) || compareFinnish(first.word.fi, second.word.fi);
        case "topic":
          return compareEnglish(first.word.topic, second.word.topic) || compareFinnish(first.word.fi, second.word.fi);
        case "recent":
          return second.lastReviewedSortValue - first.lastReviewedSortValue || compareFinnish(first.word.fi, second.word.fi);
        case "fi":
        default:
          return compareFinnish(first.word.fi, second.word.fi);
      }
    });

    return visibleRows.map((row) => row.word);
  }, [normalizedSearch, posFilter, rows, sortBy, topicFilter, viewMode]);

  return {
    searchValue,
    setSearchValue,
    topicFilter,
    setTopicFilter,
    posFilter,
    setPosFilter,
    sortBy,
    setSortBy,
    viewMode,
    setViewMode,
    dueNextCount,
    filteredWords
  };
};
