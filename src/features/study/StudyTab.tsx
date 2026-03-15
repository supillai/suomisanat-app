import { useEffect, useEffectEvent, useRef } from "react";
import { POS_LABELS, STUDY_FILTER_LABELS, TOPIC_LABELS, tabButtonId, tabPanelId } from "../app/app.constants";
import type { StudyDecision, StudyFilter } from "../app/app.types";
import { studyExample } from "./study.utils";
import type { VocabularyWord } from "../../types";

type StudyTabProps = {
  studyFilter: StudyFilter;
  studyPool: VocabularyWord[];
  studyWord: VocabularyWord;
  reveal: boolean;
  studyHintLevel: number;
  studyHints: string[];
  studyDecision: StudyDecision;
  studyKnownSession: number;
  studyPracticeSession: number;
  reviewedToday: number;
  accuracy: number;
  needsPracticeCount: number;
  dailyGoal: number;
  goalPct: number;
  hasStudyActivity: boolean;
  onStudyFilterChange: (filter: StudyFilter) => void;
  onRevealStudyWord: () => void;
  onRevealStudyHint: () => void;
  onNextStudyWord: () => void;
  onMarkStudyKnown: () => void;
  onMarkStudyPractice: () => void;
  onDailyGoalChange: (value: number) => void;
};

const isEditableTarget = (target: EventTarget | null): boolean => {
  const element = target instanceof HTMLElement ? target : null;
  if (!element) return false;

  return element.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName);
};

const isButtonTarget = (target: EventTarget | null): boolean => target instanceof HTMLElement && target.tagName === "BUTTON";

export const StudyTab = ({
  studyFilter,
  studyPool,
  studyWord,
  reveal,
  studyHintLevel,
  studyHints,
  studyDecision,
  studyKnownSession,
  studyPracticeSession,
  reviewedToday,
  accuracy,
  needsPracticeCount,
  dailyGoal,
  goalPct,
  hasStudyActivity,
  onStudyFilterChange,
  onRevealStudyWord,
  onRevealStudyHint,
  onNextStudyWord,
  onMarkStudyKnown,
  onMarkStudyPractice,
  onDailyGoalChange
}: StudyTabProps) => {
  const studyRevealButtonRef = useRef<HTMLButtonElement | null>(null);
  const studyKnownButtonRef = useRef<HTMLButtonElement | null>(null);
  const studyNextButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const target = !reveal
      ? studyRevealButtonRef.current
      : studyDecision === "none"
        ? studyKnownButtonRef.current
        : studyNextButtonRef.current;
    if (!target) return;

    const rafId = window.requestAnimationFrame(() => {
      target.focus();
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [reveal, studyDecision, studyWord.id]);

  const handleShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (isEditableTarget(event.target)) return;

    const key = event.key.toLowerCase();
    const buttonTarget = isButtonTarget(event.target);

    if (!reveal) {
      if (key === "h") {
        event.preventDefault();
        onRevealStudyHint();
        return;
      }

      if (key === "n") {
        event.preventDefault();
        onNextStudyWord();
        return;
      }

      if (key === "enter" || event.key === " ") {
        if (buttonTarget) return;
        event.preventDefault();
        onRevealStudyWord();
      }
      return;
    }

    if (studyDecision === "none") {
      if (key === "k") {
        event.preventDefault();
        onMarkStudyKnown();
        return;
      }

      if (key === "p") {
        event.preventDefault();
        onMarkStudyPractice();
        return;
      }
    }

    if (key === "n" || key === "enter" || event.key === " ") {
      if (buttonTarget && (key === "enter" || event.key === " ")) return;
      event.preventDefault();
      onNextStudyWord();
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
      id={tabPanelId("study")}
      role="tabpanel"
      aria-labelledby={tabButtonId("study")}
      className="surface-card rounded-[28px] px-5 py-6 md:px-8 md:py-8"
    >
      <div className="mb-5 flex flex-wrap items-center gap-2" role="group" aria-label="Study mode">
        <span className="eyebrow">Study mode</span>
        {(["all", "unknown", "known", "practice"] as StudyFilter[]).map((mode) => (
          <button
            key={mode}
            className={`chip-button ${studyFilter === mode ? "chip-button-active" : "chip-button-idle"}`}
            onClick={() => onStudyFilterChange(mode)}
          >
            {STUDY_FILTER_LABELS[mode]}
          </button>
        ))}
        <span className="ml-auto text-sm text-slate-700">Cards in mode: {studyPool.length}</span>
      </div>

      <div className="surface-subtle rounded-[28px] px-5 py-5 text-center md:px-6 md:py-6">
        <div className="flex flex-wrap items-center justify-between gap-2 text-left">
          <div className="flex flex-wrap gap-2">
            <span className="state-pill state-pill-neutral">{TOPIC_LABELS[studyWord.topic]}</span>
            <span className="state-pill state-pill-neutral">{POS_LABELS[studyWord.pos]}</span>
          </div>
          <p className="text-xs text-slate-500">Space/Enter reveal, H hint, K known, P practice, N next</p>
        </div>

        <h2 className="mt-5 text-4xl font-semibold tracking-tight text-ink md:text-[3.5rem]" lang="fi">
          {studyWord.fi}
        </h2>
        {!reveal && <p className="mt-3 text-sm text-slate-700">Try to recall the meaning before revealing the answer.</p>}
        {!reveal && studyHintLevel > 0 && (
          <div className="mx-auto mt-4 max-w-2xl space-y-2 text-left">
            {studyHints.slice(0, studyHintLevel).map((hint, index) => (
              <p key={`${studyWord.id}-hint-${index}`} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800">
                Hint {index + 1}: {hint}
              </p>
            ))}
          </div>
        )}
        {reveal && (
          <div className="mx-auto mt-4 max-w-2xl space-y-2">
            <p className="text-xl font-semibold text-accent">{studyWord.en}</p>
            <p className="text-sm text-slate-800" lang="fi">
              {studyWord.fiSimple}
            </p>
            <p className="text-sm text-slate-700" lang="fi">
              {studyExample(studyWord)}
            </p>
          </div>
        )}
      </div>

      {!reveal && (
        <div className="mt-5 flex flex-col items-center gap-3">
          <div className="grid w-full gap-3 sm:max-w-xl sm:grid-cols-2">
            <button ref={studyRevealButtonRef} className="action-primary rounded-full px-5 py-3 text-sm font-semibold" onClick={onRevealStudyWord}>
              Reveal Meaning
            </button>
            <button
              className="action-secondary rounded-full px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              onClick={onRevealStudyHint}
              disabled={studyHintLevel >= studyHints.length}
            >
              {studyHintLevel === 0 ? "Show Hint" : studyHintLevel >= studyHints.length ? "All Hints Shown" : "Show Another Hint"}
            </button>
          </div>
          <button className="action-ghost rounded-full px-4 py-2 text-sm font-semibold" onClick={onNextStudyWord}>
            Skip for Now
          </button>
        </div>
      )}

      {reveal && studyDecision === "none" && (
        <div className="mt-5 flex flex-col items-center gap-3">
          <div className="grid w-full gap-3 sm:max-w-xl sm:grid-cols-2">
            <button ref={studyKnownButtonRef} className="action-success rounded-full px-5 py-3 text-sm font-semibold" onClick={onMarkStudyKnown}>
              Mark Known
            </button>
            <button className="action-warning rounded-full px-5 py-3 text-sm font-semibold" onClick={onMarkStudyPractice}>
              Needs Practice
            </button>
          </div>
          <button className="action-ghost rounded-full px-4 py-2 text-sm font-semibold" onClick={onNextStudyWord}>
            Skip Without Saving
          </button>
        </div>
      )}

      {reveal && studyDecision !== "none" && (
        <div className="mt-5">
          <div className={`feedback-panel rounded-3xl p-4 ${studyDecision === "known" ? "feedback-panel-correct" : "feedback-panel-warning"}`}>
            <p className="text-sm font-semibold text-ink" role="status" aria-live="polite">
              {studyDecision === "known" ? "Saved as known." : "Saved as needs practice."}
            </p>
          </div>
          <button ref={studyNextButtonRef} className="action-primary mt-4 rounded-full px-5 py-3 text-sm font-semibold" onClick={onNextStudyWord}>
            Next Card
          </button>
        </div>
      )}

      {hasStudyActivity ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.9fr)]">
          <div className="surface-subtle rounded-[24px] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="section-title">Session overview</p>
              <p className="text-sm text-slate-600">
                This session: {studyKnownSession} known, {studyPracticeSession} needs practice
              </p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <article className="metric-card">
                <p className="metric-label">Reviewed Today</p>
                <p className="metric-value">{reviewedToday}</p>
              </article>
              <article className="metric-card">
                <p className="metric-label">Accuracy</p>
                <p className="metric-value">{accuracy}%</p>
              </article>
              <article className="metric-card">
                <p className="metric-label">Practice Queue</p>
                <p className="metric-value">{needsPracticeCount}</p>
              </article>
              <article className="metric-card">
                <p className="metric-label">Cards in Mode</p>
                <p className="metric-value">{studyPool.length}</p>
              </article>
            </div>
          </div>

          <div className="surface-subtle rounded-[24px] p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="section-title">Daily goal</p>
              <span className="text-sm text-slate-700">
                {reviewedToday}/{dailyGoal}
              </span>
            </div>
            <div className="progress-track">
              <div className="progress-bar" style={{ width: `${goalPct}%` }} />
            </div>
            <div className="mt-4 flex items-center gap-3">
              <label htmlFor="daily-goal-study" className="text-sm text-slate-700">
                Daily target
              </label>
              <input
                id="daily-goal-study"
                type="number"
                min={5}
                max={200}
                className="text-input text-input-idle w-24"
                value={dailyGoal}
                onChange={(event) => onDailyGoalChange(Number(event.target.value))}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="surface-subtle mt-6 rounded-[24px] px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <p className="section-title">Session overview</p>
              <p className="text-sm text-slate-600">Start reviewing cards to unlock your daily study stats.</p>
            </div>
            <div className="min-w-0 lg:w-[340px]">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="section-title">Daily goal</p>
                <span className="text-sm text-slate-700">
                  {reviewedToday}/{dailyGoal}
                </span>
              </div>
              <div className="progress-track">
                <div className="progress-bar" style={{ width: `${goalPct}%` }} />
              </div>
              <div className="mt-4 flex items-center gap-3">
                <label htmlFor="daily-goal-study-empty" className="text-sm text-slate-700">
                  Daily target
                </label>
                <input
                  id="daily-goal-study-empty"
                  type="number"
                  min={5}
                  max={200}
                  className="text-input text-input-idle w-24"
                  value={dailyGoal}
                  onChange={(event) => onDailyGoalChange(Number(event.target.value))}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
