import { useMemo, useState } from "react";
import type { ProgressMap, VocabularyWord } from "../../types";
import { randomFrom } from "../../utils/collections";
import type { QuizMode } from "../app/app.types";
import type { MarkWord } from "../progress/useProgressStore";
import {
  buildMiniDrillRecommendations,
  buildTypingMistakeFeedback,
  normalizeFinnish,
  pickQuizOptions
} from "./quiz.utils";
import type { MiniDrillRecommendation } from "./quiz.utils";

type UseQuizSessionOptions = {
  words: VocabularyWord[];
  progressMap: ProgressMap;
  markWord: MarkWord;
};

export type QuizSession = {
  quizMode: QuizMode;
  setQuizMode: (mode: QuizMode) => void;
  quizWord: VocabularyWord;
  quizOptions: string[];
  typingValue: string;
  setTypingValue: (value: string) => void;
  quizFeedback: string;
  quizCorrect: number;
  quizWrong: number;
  miniDrillRecommendations: MiniDrillRecommendation[];
  miniDrillActive: boolean;
  miniDrillProgress: string;
  miniDrillLastQuestion: boolean;
  startMiniDrill: () => void;
  stopMiniDrill: () => void;
  nextQuiz: () => void;
  answerMcq: (option: string) => void;
  answerTyping: () => void;
};

export const useQuizSession = ({ words, progressMap, markWord }: UseQuizSessionOptions): QuizSession => {
  const initialWord = words[1] ?? words[0];
  const [quizMode, setQuizMode] = useState<QuizMode>("mcq");
  const [quizWord, setQuizWord] = useState<VocabularyWord>(() => initialWord);
  const [quizOptions, setQuizOptions] = useState<string[]>(() => pickQuizOptions(initialWord, words));
  const [typingValue, setTypingValue] = useState("");
  const [quizFeedback, setQuizFeedback] = useState("");
  const [quizCorrect, setQuizCorrect] = useState(0);
  const [quizWrong, setQuizWrong] = useState(0);
  const [miniDrillQueue, setMiniDrillQueue] = useState<number[]>([]);
  const [miniDrillIndex, setMiniDrillIndex] = useState(0);

  const miniDrillRecommendations = useMemo(() => buildMiniDrillRecommendations(words, progressMap), [progressMap, words]);
  const miniDrillActive = miniDrillQueue.length > 0;
  const miniDrillProgress = miniDrillActive ? `${Math.min(miniDrillIndex + 1, miniDrillQueue.length)}/${miniDrillQueue.length}` : "";
  const miniDrillLastQuestion = miniDrillActive && miniDrillIndex >= miniDrillQueue.length - 1;

  const setQuizWordAndReset = (word: VocabularyWord): void => {
    setQuizWord(word);
    setQuizOptions(pickQuizOptions(word, words));
    setTypingValue("");
    setQuizFeedback("");
  };

  const startMiniDrill = (): void => {
    const queue = miniDrillRecommendations.map((item) => item.word.id);
    if (queue.length === 0) return;

    setMiniDrillQueue(queue);
    setMiniDrillIndex(0);
    const firstWord = words.find((word) => word.id === queue[0]) ?? words[0];
    setQuizWordAndReset(firstWord);
  };

  const stopMiniDrill = (): void => {
    setMiniDrillQueue([]);
    setMiniDrillIndex(0);
  };

  const nextQuiz = (): void => {
    if (miniDrillQueue.length > 0) {
      const nextIndex = miniDrillIndex + 1;
      if (nextIndex < miniDrillQueue.length) {
        const nextWordId = miniDrillQueue[nextIndex];
        const nextWord = words.find((word) => word.id === nextWordId);

        if (nextWord) {
          setMiniDrillIndex(nextIndex);
          setQuizWordAndReset(nextWord);
          return;
        }
      }

      setMiniDrillQueue([]);
      setMiniDrillIndex(0);
    }

    setQuizWordAndReset(randomFrom(words));
  };

  const answerMcq = (option: string): void => {
    const isCorrect = option === quizWord.en;
    markWord(quizWord, isCorrect);

    if (isCorrect) {
      setQuizCorrect((current) => current + 1);
      setQuizFeedback("Correct.");
      return;
    }

    setQuizWrong((current) => current + 1);
    setQuizFeedback(`Incorrect. Correct answer: ${quizWord.en}`);
  };

  const answerTyping = (): void => {
    if (!typingValue.trim()) return;

    const isCorrect = normalizeFinnish(typingValue) === normalizeFinnish(quizWord.fi);
    markWord(quizWord, isCorrect);

    if (isCorrect) {
      setQuizCorrect((current) => current + 1);
      setQuizFeedback("Correct.");
      return;
    }

    setQuizWrong((current) => current + 1);
    setQuizFeedback(buildTypingMistakeFeedback(typingValue, quizWord));
  };

  return {
    quizMode,
    setQuizMode,
    quizWord,
    quizOptions,
    typingValue,
    setTypingValue,
    quizFeedback,
    quizCorrect,
    quizWrong,
    miniDrillRecommendations,
    miniDrillActive,
    miniDrillProgress,
    miniDrillLastQuestion,
    startMiniDrill,
    stopMiniDrill,
    nextQuiz,
    answerMcq,
    answerTyping
  };
};
