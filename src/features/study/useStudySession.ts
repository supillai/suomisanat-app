import { useEffect, useMemo, useState } from "react";
import type { ProgressMap, VocabularyWord } from "../../types";
import { randomFrom } from "../../utils/collections";
import type { StudyDecision, StudyFilter } from "../app/app.types";
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
  const [studyFilter, setStudyFilter] = useState<StudyFilter>("all");
  const [studyWord, setStudyWord] = useState<VocabularyWord>(() => words[0]);
  const [reveal, setReveal] = useState(false);
  const [studyHintLevel, setStudyHintLevel] = useState(0);
  const [studyDecision, setStudyDecision] = useState<StudyDecision>("none");
  const [studyKnownSession, setStudyKnownSession] = useState(0);
  const [studyPracticeSession, setStudyPracticeSession] = useState(0);

  const studyPool = useMemo(() => {
    if (studyFilter === "all") return words;

    return words.filter((word) => {
      const known = progressMap[word.id]?.known ?? false;
      const needsPractice = progressMap[word.id]?.needsPractice ?? false;

      if (studyFilter === "known") return known;
      if (studyFilter === "practice") return needsPractice;
      return !known;
    });
  }, [progressMap, studyFilter, words]);

  const studyHints = useMemo(() => buildStudyHints(studyWord), [studyWord]);

  useEffect(() => {
    if (!studyPool.some((word) => word.id === studyWord.id)) {
      const fallbackWord = studyPool.length > 0 ? studyPool[0] : words[0];
      setStudyWord(fallbackWord);
      setReveal(false);
      setStudyHintLevel(0);
      setStudyDecision("none");
    }
  }, [studyPool, studyWord.id, words]);

  useEffect(() => {
    setStudyHintLevel(0);
  }, [studyWord.id]);

  const nextStudyWord = (): void => {
    const pool = studyPool.length > 0 ? studyPool : words;
    setStudyWord(randomFrom(pool));
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
