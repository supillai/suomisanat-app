import { useEffect, useRef } from "react";
import { tabButtonId, tabPanelId } from "../app/app.constants";
import type { QuizMode } from "../app/app.types";
import type { VocabularyWord } from "../../types";

type QuizTabProps = {
  quizMode: QuizMode;
  isAnswered: boolean;
  quizWord: VocabularyWord;
  quizOptions: string[];
  typingValue: string;
  quizFeedback: string;
  quizCorrect: number;
  quizWrong: number;
  miniDrillActive: boolean;
  miniDrillProgress: string;
  miniDrillLastQuestion: boolean;
  onQuizModeChange: (mode: QuizMode) => void;
  onTypingValueChange: (value: string) => void;
  onAnswerMcq: (option: string) => void;
  onAnswerTyping: () => void;
  onNextQuiz: () => void;
  onStopMiniDrill: () => void;
};

export const QuizTab = ({
  quizMode,
  isAnswered,
  quizWord,
  quizOptions,
  typingValue,
  quizFeedback,
  quizCorrect,
  quizWrong,
  miniDrillActive,
  miniDrillProgress,
  miniDrillLastQuestion,
  onQuizModeChange,
  onTypingValueChange,
  onAnswerMcq,
  onAnswerTyping,
  onNextQuiz,
  onStopMiniDrill
}: QuizTabProps) => {
  const quizFirstOptionRef = useRef<HTMLButtonElement | null>(null);
  const quizTypingInputRef = useRef<HTMLInputElement | null>(null);
  const quizNextButtonRef = useRef<HTMLButtonElement | null>(null);
  const nextQuizLabel = miniDrillLastQuestion
    ? isAnswered
      ? "Finish Mini Drill"
      : "Skip and Finish Mini Drill"
    : isAnswered
      ? "Next Question"
      : "Skip Question";

  useEffect(() => {
    const target = isAnswered ? quizNextButtonRef.current : quizMode === "typing" ? quizTypingInputRef.current : quizFirstOptionRef.current;
    if (!target) return;

    const rafId = window.requestAnimationFrame(() => {
      target.focus();
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [isAnswered, quizMode, quizWord.id]);

  return (
    <section
      id={tabPanelId("quiz")}
      role="tabpanel"
      aria-labelledby={tabButtonId("quiz")}
      className="glass card-shadow rounded-3xl p-5 md:p-8"
    >
      <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Quiz mode">
        <span className="text-sm font-semibold text-slate-700">Quiz mode:</span>
        <button
          className={`rounded-lg border px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-60 ${
            quizMode === "mcq" ? "accent-gradient border-transparent text-white" : "border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200"
          }`}
          type="button"
          aria-pressed={quizMode === "mcq"}
          disabled={isAnswered}
          onClick={() => onQuizModeChange("mcq")}
        >
          Multiple Choice
        </button>
        <button
          className={`rounded-lg border px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-60 ${
            quizMode === "typing" ? "accent-gradient border-transparent text-white" : "border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200"
          }`}
          type="button"
          aria-pressed={quizMode === "typing"}
          disabled={isAnswered}
          onClick={() => onQuizModeChange("typing")}
        >
          Type Finnish
        </button>
        <span className="ml-auto text-xs text-slate-700">
          Score: {quizCorrect} correct / {quizWrong} wrong
        </span>
        {miniDrillActive && (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
            Mini drill: {miniDrillProgress}
          </span>
        )}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6">
        {quizMode === "mcq" && (
          <>
            <p className="text-sm text-slate-600">Pick the English meaning:</p>
            <h2 className="mt-2 text-3xl font-bold text-ink">{quizWord.fi}</h2>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {quizOptions.map((option) => (
                <button
                  key={`${quizWord.id}-${option}`}
                  ref={option === quizOptions[0] ? quizFirstOptionRef : null}
                  type="button"
                  className="rounded-xl border border-slate-300 px-3 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isAnswered}
                  onClick={() => onAnswerMcq(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </>
        )}

        {quizMode === "typing" && (
          <>
            <p className="text-sm text-slate-600">Type the Finnish word:</p>
            <h2 className="mt-2 text-2xl font-bold text-ink">{quizWord.en}</h2>
            <label htmlFor="quiz-typing-input" className="sr-only">
              Type the Finnish word for {quizWord.en}
            </label>
            <input
              id="quiz-typing-input"
              ref={quizTypingInputRef}
              className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-accent focus:outline-none"
              placeholder="Write Finnish word"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              value={typingValue}
              disabled={isAnswered}
              onChange={(event) => onTypingValueChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onAnswerTyping();
                }
              }}
            />
            <button
              type="button"
              className="mt-3 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isAnswered || !typingValue.trim()}
              onClick={onAnswerTyping}
            >
              Check
            </button>
          </>
        )}

        {quizFeedback && (
          <p className="mt-4 text-sm font-semibold text-slate-800" role="status" aria-live="polite">
            {quizFeedback}
          </p>
        )}
      </div>

      <button
        ref={quizNextButtonRef}
        type="button"
        className="mt-4 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        onClick={onNextQuiz}
      >
        {nextQuizLabel}
      </button>
      {miniDrillActive && (
        <button
          type="button"
          className="ml-2 mt-4 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          onClick={onStopMiniDrill}
        >
          Exit Mini Drill
        </button>
      )}
    </section>
  );
};
