import { useEffect, useMemo, useReducer, useState } from "react";
import type { ProgressMap, VocabularyWord } from "../../types";
import { randomFrom } from "../../utils/collections";
import type { LearningScope, QuizMode } from "../app/app.types";
import { filterWordsByScope } from "../app/learningScope";
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
  quizScope: LearningScope;
  setQuizScope: (scope: LearningScope) => void;
  quizPool: VocabularyWord[];
  isAnswered: boolean;
  quizWord: VocabularyWord;
  quizOptions: string[];
  selectedOption: string | null;
  typingValue: string;
  setTypingValue: (value: string) => void;
  quizFeedback: string;
  lastAnswerCorrect: boolean | null;
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

type QuizState = {
  quizMode: QuizMode;
  quizWordId: number;
  quizOptions: string[];
  selectedOption: string | null;
  typingValue: string;
  quizFeedback: string;
  lastAnswerCorrect: boolean | null;
  quizCorrect: number;
  quizWrong: number;
  miniDrillQueue: number[];
  miniDrillIndex: number;
  isAnswered: boolean;
};

type QuizAction =
  | { type: "set_quiz_mode"; mode: QuizMode }
  | { type: "set_typing_value"; value: string }
  | { type: "set_question"; wordId: number; options: string[] }
  | { type: "start_mini_drill"; queue: number[]; wordId: number; options: string[] }
  | { type: "advance_mini_drill"; index: number; wordId: number; options: string[] }
  | { type: "stop_mini_drill" }
  | { type: "answer"; isCorrect: boolean; feedback: string; selectedOption: string | null };

const resetQuestionState = (state: QuizState, wordId: number, options: string[]): QuizState => ({
  ...state,
  quizWordId: wordId,
  quizOptions: options,
  selectedOption: null,
  typingValue: "",
  quizFeedback: "",
  lastAnswerCorrect: null,
  isAnswered: false
});

const createInitialQuizState = (words: VocabularyWord[]): QuizState => {
  const initialWord = words[0]!;

  return {
    quizMode: "mcq",
    quizWordId: initialWord.id,
    quizOptions: pickQuizOptions(initialWord, words),
    selectedOption: null,
    typingValue: "",
    quizFeedback: "",
    lastAnswerCorrect: null,
    quizCorrect: 0,
    quizWrong: 0,
    miniDrillQueue: [],
    miniDrillIndex: 0,
    isAnswered: false
  };
};

const quizReducer = (state: QuizState, action: QuizAction): QuizState => {
  switch (action.type) {
    case "set_quiz_mode":
      return {
        ...state,
        quizMode: action.mode
      };
    case "set_typing_value":
      return {
        ...state,
        typingValue: action.value
      };
    case "set_question":
      return resetQuestionState(state, action.wordId, action.options);
    case "start_mini_drill":
      return {
        ...resetQuestionState(state, action.wordId, action.options),
        miniDrillQueue: action.queue,
        miniDrillIndex: 0
      };
    case "advance_mini_drill":
      return {
        ...resetQuestionState(state, action.wordId, action.options),
        miniDrillIndex: action.index
      };
    case "stop_mini_drill":
      return {
        ...state,
        miniDrillQueue: [],
        miniDrillIndex: 0
      };
    case "answer":
      if (state.isAnswered) {
        return state;
      }

      return {
        ...state,
        selectedOption: action.selectedOption,
        quizFeedback: action.feedback,
        lastAnswerCorrect: action.isCorrect,
        quizCorrect: state.quizCorrect + (action.isCorrect ? 1 : 0),
        quizWrong: state.quizWrong + (action.isCorrect ? 0 : 1),
        isAnswered: true
      };
    default:
      return state;
  }
};

export const useQuizSession = ({ words, progressMap, markWord }: UseQuizSessionOptions): QuizSession => {
  const [state, dispatch] = useReducer(quizReducer, words, createInitialQuizState);
  const [quizScope, setQuizScope] = useState<LearningScope>("all");
  const wordsById = useMemo(() => new Map(words.map((word) => [word.id, word] as const)), [words]);
  const quizPool = useMemo(() => {
    const filteredWords = filterWordsByScope(words, quizScope);
    return filteredWords.length > 0 ? filteredWords : words;
  }, [quizScope, words]);
  const quizWord = wordsById.get(state.quizWordId) ?? quizPool[0] ?? words[0]!;

  const miniDrillRecommendations = useMemo(() => buildMiniDrillRecommendations(words, progressMap), [progressMap, words]);
  const miniDrillActive = state.miniDrillQueue.length > 0;
  const miniDrillProgress = miniDrillActive
    ? `${Math.min(state.miniDrillIndex + 1, state.miniDrillQueue.length)}/${state.miniDrillQueue.length}`
    : "";
  const miniDrillLastQuestion = miniDrillActive && state.miniDrillIndex >= state.miniDrillQueue.length - 1;

  useEffect(() => {
    if (miniDrillActive) {
      return;
    }

    const nextWord = quizPool.find((word) => word.id === state.quizWordId) ?? quizPool[0] ?? words[0]!;
    dispatch({
      type: "set_question",
      wordId: nextWord.id,
      options: pickQuizOptions(nextWord, quizPool)
    });
  }, [miniDrillActive, quizPool, quizScope, state.quizWordId, words]);

  const setQuestion = (word: VocabularyWord): void => {
    dispatch({
      type: "set_question",
      wordId: word.id,
      options: pickQuizOptions(word, quizPool)
    });
  };

  const startMiniDrill = (): void => {
    const queue = miniDrillRecommendations.map((item) => item.word.id);
    if (queue.length === 0) return;

    const firstWord = wordsById.get(queue[0]) ?? words[0]!;
    dispatch({
      type: "start_mini_drill",
      queue,
      wordId: firstWord.id,
      options: pickQuizOptions(firstWord, words)
    });
  };

  const stopMiniDrill = (): void => {
    dispatch({ type: "stop_mini_drill" });
  };

  const nextQuiz = (): void => {
    if (state.miniDrillQueue.length > 0) {
      const nextIndex = state.miniDrillIndex + 1;
      if (nextIndex < state.miniDrillQueue.length) {
        const nextWordId = state.miniDrillQueue[nextIndex];
        const nextWord = wordsById.get(nextWordId);

        if (nextWord) {
          dispatch({
            type: "advance_mini_drill",
            index: nextIndex,
            wordId: nextWord.id,
            options: pickQuizOptions(nextWord, words)
          });
          return;
        }
      }

      dispatch({ type: "stop_mini_drill" });
    }

    setQuestion(randomFrom(quizPool));
  };

  const answerMcq = (option: string): void => {
    if (state.isAnswered) return;

    const isCorrect = option === quizWord.en;
    markWord(quizWord, isCorrect);

    dispatch({
      type: "answer",
      isCorrect,
      feedback: isCorrect ? "Correct." : `Incorrect. Correct answer: ${quizWord.en}`,
      selectedOption: option
    });
  };

  const answerTyping = (): void => {
    if (state.isAnswered || !state.typingValue.trim()) return;

    const isCorrect = normalizeFinnish(state.typingValue) === normalizeFinnish(quizWord.fi);
    markWord(quizWord, isCorrect);

    dispatch({
      type: "answer",
      isCorrect,
      feedback: isCorrect ? "Correct." : buildTypingMistakeFeedback(state.typingValue, quizWord),
      selectedOption: null
    });
  };

  return {
    quizMode: state.quizMode,
    setQuizMode: (mode) => dispatch({ type: "set_quiz_mode", mode }),
    quizScope,
    setQuizScope,
    quizPool,
    isAnswered: state.isAnswered,
    quizWord,
    quizOptions: state.quizOptions,
    selectedOption: state.selectedOption,
    typingValue: state.typingValue,
    setTypingValue: (value) => dispatch({ type: "set_typing_value", value }),
    quizFeedback: state.quizFeedback,
    lastAnswerCorrect: state.lastAnswerCorrect,
    quizCorrect: state.quizCorrect,
    quizWrong: state.quizWrong,
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