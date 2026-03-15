import { useEffect, useEffectEvent, useRef } from "react";
import { tabButtonId, tabPanelId } from "../app/app.constants";
import type { QuizMode } from "../app/app.types";
import type { VocabularyWord } from "../../types";

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
    const listener = (event: KeyboardEvent) => {
      handleShortcut(event);
    };

    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  return (
    <section
      id={tabPanelId("quiz")}
      role="tabpanel"
      aria-labelledby={tabButtonId("quiz")}
      className="surface-card rounded-[28px] px-5 py-6 md:px-8 md:py-8"
    >
      <div className="mb-5 flex flex-wrap items-center gap-2" role="group" aria-label="Quiz mode">
        <span className="eyebrow">Quiz mode</span>
        <button
          className={`chip-button ${quizMode === "mcq" ? "chip-button-active" : "chip-button-idle"}`}
          type="button"
          aria-pressed={quizMode === "mcq"}
          disabled={isAnswered}
          onClick={() => onQuizModeChange("mcq")}
        >
          Multiple Choice
        </button>
        <button
          className={`chip-button ${quizMode === "typing" ? "chip-button-active" : "chip-button-idle"}`}
          type="button"
          aria-pressed={quizMode === "typing"}
          disabled={isAnswered}
          onClick={() => onQuizModeChange("typing")}
        >
          Type Finnish
        </button>
        <span className="ml-auto text-sm font-medium text-slate-700">
          Score: {quizCorrect} correct / {quizWrong} wrong
        </span>
        {miniDrillActive && <span className="state-pill state-pill-warn">Mini drill {miniDrillProgress}</span>}
      </div>

      <div className="surface-subtle rounded-[26px] p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="eyebrow">Shortcuts</p>
          <p className="text-xs text-slate-500">1-4 answer, M/T switch mode, N next, Esc exits mini drill</p>
        </div>

        {quizMode === "mcq" && (
          <>
            <p className="mt-4 text-sm text-slate-600">Pick the English meaning:</p>
            <h2 className="mt-2 text-3xl font-semibold text-ink md:text-4xl" lang="fi">
              {quizWord.fi}
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
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
                    className={`quiz-option ${optionStateClass}`}
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
            <p className="mt-4 text-sm text-slate-600">Type the Finnish word:</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink md:text-3xl">{quizWord.en}</h2>
            <label htmlFor="quiz-typing-input" className="sr-only">
              Type the Finnish word for {quizWord.en}
            </label>
            <input
              id="quiz-typing-input"
              ref={quizTypingInputRef}
              className={`text-input mt-4 ${
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
              className="action-primary mt-3 rounded-full px-5 py-2.5 text-sm font-semibold"
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
            className={`feedback-panel mt-5 rounded-3xl p-4 ${lastAnswerCorrect ? "feedback-panel-correct" : "feedback-panel-warning"}`}
            role="status"
            aria-live="polite"
          >
            <p className="text-sm font-semibold text-ink">{lastAnswerCorrect ? "Answer saved" : "Review the answer"}</p>
            <p className="mt-1 text-sm text-slate-700">{quizFeedback}</p>
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          ref={quizNextButtonRef}
          type="button"
          className="action-secondary rounded-full px-5 py-2.5 text-sm font-semibold"
          onClick={onNextQuiz}
        >
          {nextQuizLabel}
        </button>
        {miniDrillActive && (
          <button type="button" className="action-ghost rounded-full px-5 py-2.5 text-sm font-semibold" onClick={onStopMiniDrill}>
            Exit Mini Drill
          </button>
        )}
      </div>
    </section>
  );
};
