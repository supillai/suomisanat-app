import { useEffect, useMemo, useState } from "react";
import type { ProgressMap, VocabularyWord } from "../../types";
import { randomFrom } from "../../utils/collections";
import type { LearningScope, StudyDecision, StudyFilter } from "../app/app.types";
import { filterWordsByScope } from "../app/learningScope";
import type { MarkWord } from "../progress/useProgressStore";
import { buildStudyHints } from "./study.utils";

type UseStudySessionOptions = {
  words: VocabularyWord[];
  progressMap: ProgressMap;
  markWord: MarkWord;
};

export type StudySession = {
  studyFilter: StudyFilter;
  setStudyFilter: (filter: StudyFilter) => void;
  studyScope: LearningScope;
  setStudyScope: (scope: LearningScope) => void;
  scopedWords: VocabularyWord[];
  studyWord: VocabularyWord;
  studyPool: VocabularyWord[];
  reveal: boolean;
  studyHintLevel: number;
  studyHints: string[];
  studyDecision: StudyDecision;
  studyKnownSession: number;
  studyPracticeSession: number;
  hasStudyActivity: boolean;
  nextStudyWord: () => void;
  revealStudyWord: () => void;
  revealStudyHint: () => void;
  markStudyKnown: () => void;
  markStudyPractice: () => void;
};

export const useStudySession = ({ words, progressMap, markWord }: UseStudySessionOptions): StudySession => {
  const firstWord = words[0]!;
  const [studyFilter, setStudyFilter] = useState<StudyFilter>("all");
  const [studyScope, setStudyScope] = useState<LearningScope>("all");
  const [studyWordId, setStudyWordId] = useState<number>(() => firstWord.id);
  const [reveal, setReveal] = useState(false);
  const [studyHintLevel, setStudyHintLevel] = useState(0);
  const [studyDecision, setStudyDecision] = useState<StudyDecision>("none");
  const [studyKnownSession, setStudyKnownSession] = useState(0);
  const [studyPracticeSession, setStudyPracticeSession] = useState(0);
  const wordsById = useMemo(() => new Map(words.map((word) => [word.id, word] as const)), [words]);
  const scopedWords = useMemo(() => {
    const filteredWords = filterWordsByScope(words, studyScope);
    return filteredWords.length > 0 ? filteredWords : words;
  }, [studyScope, words]);

  const studyPool = useMemo(() => {
    if (studyFilter === "all") return scopedWords;

    return scopedWords.filter((word) => {
      const known = progressMap[word.id]?.known ?? false;
      const needsPractice = progressMap[word.id]?.needsPractice ?? false;

      if (studyFilter === "known") return known;
      if (studyFilter === "practice") return needsPractice;
      return !known;
    });
  }, [progressMap, scopedWords, studyFilter]);

  const scopedFallbackWord = scopedWords[0] ?? firstWord;
  const studyWord = wordsById.get(studyWordId) ?? scopedFallbackWord;
  const studyHints = useMemo(() => buildStudyHints(studyWord), [studyWord]);

  useEffect(() => {
    if (!studyPool.some((word) => word.id === studyWordId)) {
      const fallbackWord = studyPool[0] ?? scopedFallbackWord;
      setStudyWordId(fallbackWord.id);
      setReveal(false);
      setStudyHintLevel(0);
      setStudyDecision("none");
    }
  }, [scopedFallbackWord, studyPool, studyWordId]);

  useEffect(() => {
    setStudyHintLevel(0);
  }, [studyWordId]);

  const nextStudyWord = (): void => {
    const pool = studyPool.length > 0 ? studyPool : scopedWords;
    setStudyWordId(randomFrom(pool).id);
    setReveal(false);
    setStudyHintLevel(0);
    setStudyDecision("none");
  };

  const revealStudyWord = (): void => {
    setReveal(true);
    setStudyDecision("none");
  };

  const revealStudyHint = (): void => {
    if (reveal) return;
    setStudyHintLevel((current) => Math.min(current + 1, studyHints.length));
  };

  const markStudyKnown = (): void => {
    if (!reveal || studyDecision !== "none") return;
    markWord(studyWord, true, { known: true, needsPractice: false });
    setStudyDecision("known");
    setStudyKnownSession((current) => current + 1);
  };

  const markStudyPractice = (): void => {
    if (!reveal || studyDecision !== "none") return;
    markWord(studyWord, false, { known: false, needsPractice: true });
    setStudyDecision("practice");
    setStudyPracticeSession((current) => current + 1);
  };

  return {
    studyFilter,
    setStudyFilter,
    studyScope,
    setStudyScope,
    scopedWords,
    studyWord,
    studyPool,
    reveal,
    studyHintLevel,
    studyHints,
    studyDecision,
    studyKnownSession,
    studyPracticeSession,
    hasStudyActivity: studyKnownSession > 0 || studyPracticeSession > 0,
    nextStudyWord,
    revealStudyWord,
    revealStudyHint,
    markStudyKnown,
    markStudyPractice
  };
};