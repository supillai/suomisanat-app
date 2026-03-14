import { useMemo, useState } from "react";
import type { VocabularyWord, WordPos, WordTopic } from "../../types";

export type WordFilters = {
  searchValue: string;
  setSearchValue: (value: string) => void;
  topicFilter: WordTopic | "all";
  setTopicFilter: (value: WordTopic | "all") => void;
  posFilter: WordPos | "all";
  setPosFilter: (value: WordPos | "all") => void;
  filteredWords: VocabularyWord[];
};

export const useWordFilters = (words: VocabularyWord[]): WordFilters => {
  const [searchValue, setSearchValue] = useState("");
  const [topicFilter, setTopicFilter] = useState<WordTopic | "all">("all");
  const [posFilter, setPosFilter] = useState<WordPos | "all">("all");

  const filteredWords = useMemo(() => {
    return words.filter((word) => {
      if (topicFilter !== "all" && word.topic !== topicFilter) return false;
      if (posFilter !== "all" && word.pos !== posFilter) return false;
      if (!searchValue.trim()) return true;

      const needle = searchValue.toLowerCase();
      return (
        word.fi.toLowerCase().includes(needle) ||
        word.en.toLowerCase().includes(needle) ||
        word.fiSimple.toLowerCase().includes(needle)
      );
    });
  }, [posFilter, searchValue, topicFilter, words]);

  return {
    searchValue,
    setSearchValue,
    topicFilter,
    setTopicFilter,
    posFilter,
    setPosFilter,
    filteredWords
  };
};
