import { useEffect, useEffectEvent, useRef } from "react";
import { tabButtonId, tabPanelId } from "../app/app.constants";
import type { QuizMode } from "../app/app.types";
import type { VocabularyWord } from "../../types";
import { useFinePointer } from "../../utils/useFinePointer";

type QuizTabProps = {
  quizMode: QuizMode;
  isAnswered: boolean;
  quizWord: VocabularyWord;
  quizOptions: string[];
  selectedOption: string | null;
  typingValue: string;
  quizFeedback: string;
  lastAnswerCorrect: boolean | null;
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

const isEditableTarget = (target: EventTarget | null): boolean => {
  const element = target instanceof HTMLElement ? target : null;
  if (!element) return false;

  return element.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName);
};

const isButtonTarget = (target: EventTarget | null): boolean => target instanceof HTMLElement && target.tagName === "BUTTON";

export const QuizTab = ({
  quizMode,
  isAnswered,
  quizWord,
  quizOptions,
  selectedOption,
  typingValue,
  quizFeedback,
  lastAnswerCorrect,
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
  const supportsKeyboardUI = useFinePointer();
  const scoreLabel = `${quizCorrect} correct / ${quizWrong} wrong`;
  const compactScoreLabel = `${quizCorrect}/${quizWrong}`;
  const nextQuizLabel = miniDrillLastQuestion
    ? isAnswered
      ? "Finish Mini Drill"
      : "Skip and Finish Mini Drill"
    : isAnswered
      ? "Next Question"
      : "Skip Question";
  const compactNextQuizLabel = miniDrillLastQuestion
    ? isAnswered
      ? "Finish drill"
      : "Skip + finish"
    : isAnswered
      ? "Next"
      : "Skip";

  useEffect(() => {
    if (!supportsKeyboardUI) return;

    const target = isAnswered ? quizNextButtonRef.current : quizMode === "typing" ? quizTypingInputRef.current : quizFirstOptionRef.current;
    if (!target) return;

    const rafId = window.requestAnimationFrame(() => {
      target.focus();
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [isAnswered, quizMode, quizWord.id, supportsKeyboardUI]);

  const handleShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (miniDrillActive && event.key === "Escape") {
      event.preventDefault();
      onStopMiniDrill();
      return;
    }

    const key = event.key.toLowerCase();
    const editableTarget = isEditableTarget(event.target);
    const buttonTarget = isButtonTarget(event.target);

    if (isAnswered) {
      if (key === "enter" || key === "n" || event.key === " ") {
        if (buttonTarget && (key === "enter" || event.key === " ")) return;
        event.preventDefault();
        onNextQuiz();
      }
      return;
    }

    if (!editableTarget && key === "m") {
      event.preventDefault();
      onQuizModeChange("mcq");
      return;
    }

    if (!editableTarget && key === "t") {
      event.preventDefault();
      onQuizModeChange("typing");
      return;
    }

    if (!editableTarget && key === "n") {
      event.preventDefault();
      onNextQuiz();
      return;
    }

    if (quizMode === "mcq") {
      if (editableTarget) return;

      const optionIndex = Number(event.key) - 1;
      if (Number.isInteger(optionIndex) && optionIndex >= 0 && optionIndex < quizOptions.length) {
        event.preventDefault();
        onAnswerMcq(quizOptions[optionIndex]!);
      }
      return;
    }

    if (!editableTarget && key === "enter" && typingValue.trim()) {
      event.preventDefault();
      onAnswerTyping();
    }
  });

  useEffect(() => {
    if (!supportsKeyboardUI) return;

    const listener = (event: KeyboardEvent) => {
      handleShortcut(event);
    };

    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [supportsKeyboardUI]);

  return (
    <section
      id={tabPanelId("quiz")}
      role="tabpanel"
      aria-labelledby={tabButtonId("quiz")}
      className="surface-card quiz-shell rounded-[28px] px-4 py-4 md:px-7 md:py-6"
    >
      <div className="quiz-toolbar mb-4 space-y-3" role="group" aria-label="Quiz mode">
        <div className="flex items-center justify-between gap-2">
          <span className="eyebrow">Quiz mode</span>
          {miniDrillActive && <span className="state-pill state-pill-warn">Mini drill {miniDrillProgress}</span>}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="touch-scroll-row flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0">
            <button
              className={`chip-button shrink-0 ${quizMode === "mcq" ? "chip-button-active" : "chip-button-idle"}`}
              type="button"
              aria-pressed={quizMode === "mcq"}
              aria-label="Multiple Choice"
              disabled={isAnswered}
              onClick={() => onQuizModeChange("mcq")}
            >
              <span className="md:hidden">Choices</span>
              <span className="hidden md:inline">Multiple Choice</span>
            </button>
            <button
              className={`chip-button shrink-0 ${quizMode === "typing" ? "chip-button-active" : "chip-button-idle"}`}
              type="button"
              aria-pressed={quizMode === "typing"}
              aria-label="Type Finnish"
              disabled={isAnswered}
              onClick={() => onQuizModeChange("typing")}
            >
              <span className="md:hidden">Type</span>
              <span className="hidden md:inline">Type Finnish</span>
            </button>
          </div>
          <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 sm:shrink-0" aria-label={`Score: ${scoreLabel}`}>
            <span className="md:hidden">Score {compactScoreLabel}</span>
            <span className="hidden md:inline">Score: {scoreLabel}</span>
          </span>
        </div>
      </div>

      <div className="surface-subtle quiz-card rounded-[26px] px-4 py-4 md:p-5">
        {supportsKeyboardUI && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="eyebrow">Shortcuts</p>
            <p className="text-xs text-slate-500">1-4 answer, M/T switch mode, N next, Esc exits mini drill</p>
          </div>
        )}

        {quizMode === "mcq" && (
          <>
            <p className="mt-2.5 text-sm text-slate-600 md:hidden">Pick the meaning.</p>
            <p className="mt-2.5 hidden text-sm text-slate-600 md:block">Pick the English meaning:</p>
            <h2 className="quiz-word mt-1.5 text-[2.15rem] font-semibold leading-[1.05] text-ink md:text-[2.75rem]" lang="fi">
              {quizWord.fi}
            </h2>
            <div className="quiz-options mt-3 grid gap-2 sm:grid-cols-2">
              {quizOptions.map((option, index) => {
                const isCorrectOption = option === quizWord.en;
                const isSelectedOption = selectedOption === option;
                const optionStateClass = !isAnswered
                  ? "quiz-option-idle"
                  : isCorrectOption
                    ? "quiz-option-correct"
                    : isSelectedOption
                      ? "quiz-option-wrong"
                      : "quiz-option-muted";

                return (
                  <button
                    key={`${quizWord.id}-${option}`}
                    ref={option === quizOptions[0] ? quizFirstOptionRef : null}
                    type="button"
                    className={`quiz-option w-full ${optionStateClass}`}
                    disabled={isAnswered}
                    onClick={() => onAnswerMcq(option)}
                  >
                    <span className="quiz-option-index" aria-hidden="true">
                      {index + 1}
                    </span>
                    <span>{option}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {quizMode === "typing" && (
          <>
            <p className="mt-2.5 text-sm text-slate-600 md:hidden">Type the Finnish word.</p>
            <p className="mt-2.5 hidden text-sm text-slate-600 md:block">Type the Finnish word:</p>
            <h2 className="quiz-word mt-1.5 text-[2rem] font-semibold leading-[1.08] text-ink md:text-[2.4rem]">{quizWord.en}</h2>
            <label htmlFor="quiz-typing-input" className="sr-only">
              Type the Finnish word for {quizWord.en}
            </label>
            <input
              id="quiz-typing-input"
              ref={quizTypingInputRef}
              className={`text-input mt-3 ${
                !isAnswered
                  ? "text-input-idle"
                  : lastAnswerCorrect
                    ? "text-input-correct"
                    : "text-input-error"
              }`}
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
              className="action-primary mt-3 w-full rounded-full px-5 py-2.5 text-sm font-semibold sm:w-auto"
              disabled={isAnswered || !typingValue.trim()}
              onClick={onAnswerTyping}
            >
              Check
            </button>
            {isAnswered && !lastAnswerCorrect && (
              <p className="mt-3 text-sm text-slate-700">
                Correct answer: <strong lang="fi">{quizWord.fi}</strong>
              </p>
            )}
          </>
        )}

        {quizFeedback && (
          <div
            className={`feedback-panel mt-4 rounded-3xl p-4 ${lastAnswerCorrect ? "feedback-panel-correct" : "feedback-panel-warning"}`}
            role="status"
            aria-live="polite"
          >
            <p className="text-sm font-semibold text-ink">{lastAnswerCorrect ? "Answer saved" : "Review the answer"}</p>
            <p className="mt-1 text-sm text-slate-700">{quizFeedback}</p>
          </div>
        )}
      </div>

      <div className="quiz-actions mt-4 flex flex-col gap-2.5 sm:flex-row">
        <button
          ref={quizNextButtonRef}
          type="button"
          aria-label={nextQuizLabel}
          className="action-secondary w-full rounded-full px-5 py-2.5 text-sm font-semibold sm:w-auto"
          onClick={onNextQuiz}
        >
          <span className="md:hidden">{compactNextQuizLabel}</span>
          <span className="hidden md:inline">{nextQuizLabel}</span>
        </button>
        {miniDrillActive && (
          <button type="button" aria-label="Exit Mini Drill" className="action-ghost w-full rounded-full px-5 py-2.5 text-sm font-semibold sm:w-auto" onClick={onStopMiniDrill}>
            <span className="md:hidden">Exit</span>
            <span className="hidden md:inline">Exit Mini Drill</span>
          </button>
        )}
      </div>
    </section>
  );
};
