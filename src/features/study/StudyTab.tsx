import { useEffect, useEffectEvent, useRef, useState } from "react";
import { POS_LABELS, STUDY_FILTER_LABELS, TOPIC_LABELS, tabButtonId, tabPanelId } from "../app/app.constants";
import type { StudyDecision, StudyFilter } from "../app/app.types";
import { studyExample } from "./study.utils";
import type { VocabularyWord } from "../../types";
import { useFinePointer } from "../../utils/useFinePointer";

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

const MOBILE_STUDY_FILTER_LABELS: Record<StudyFilter, string> = {
  all: "All",
  unknown: "New",
  known: "Known",
  practice: "Practice"
};

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
  const [showMobileExample, setShowMobileExample] = useState(false);
  const supportsKeyboardUI = useFinePointer();
  const cardsInModeLabel = `${studyPool.length} ${studyPool.length === 1 ? "card" : "cards"}`;
  const showHintCounter = !reveal && studyHintLevel > 0;
  const examplePanelId = `study-example-${studyWord.id}`;
  const studyExampleText = studyExample(studyWord);

  useEffect(() => {
    setShowMobileExample(false);
  }, [reveal, studyWord.id]);

  useEffect(() => {
    if (!supportsKeyboardUI) return;

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
  }, [reveal, studyDecision, studyWord.id, supportsKeyboardUI]);

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
    if (!supportsKeyboardUI) return;

    const listener = (event: KeyboardEvent) => {
      handleShortcut(event);
    };

    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [supportsKeyboardUI]);

  return (
    <section
      id={tabPanelId("study")}
      role="tabpanel"
      aria-labelledby={tabButtonId("study")}
      className="surface-card study-shell rounded-[28px] px-4 py-4 md:px-7 md:py-6"
    >
      <div className="study-toolbar mb-4 space-y-3" role="group" aria-label="Study mode">
        <div className="flex items-center justify-between gap-2">
          <span className="eyebrow">Study mode</span>
          <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
            {cardsInModeLabel}
          </span>
        </div>
        <div className="touch-scroll-row flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0">
          {(["all", "unknown", "known", "practice"] as StudyFilter[]).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-label={STUDY_FILTER_LABELS[mode]}
              className={`chip-button shrink-0 ${studyFilter === mode ? "chip-button-active" : "chip-button-idle"}`}
              onClick={() => onStudyFilterChange(mode)}
            >
              <span className="md:hidden">{MOBILE_STUDY_FILTER_LABELS[mode]}</span>
              <span className="hidden md:inline">{STUDY_FILTER_LABELS[mode]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="surface-subtle study-card rounded-[28px] px-4 py-4 text-center md:px-6 md:py-5">
        <div className="study-card-top flex flex-wrap items-start justify-between gap-2 text-left">
          <div className="flex flex-wrap gap-2">
            <span className="state-pill state-pill-neutral">{TOPIC_LABELS[studyWord.topic]}</span>
            <span className="state-pill state-pill-neutral">{POS_LABELS[studyWord.pos]}</span>
          </div>
          {(showHintCounter || supportsKeyboardUI) && (
            <div className="flex max-w-[18rem] flex-wrap items-center justify-end gap-2">
              {showHintCounter && (
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Hints {studyHintLevel}/{studyHints.length}
                </span>
              )}
              {supportsKeyboardUI && <p className="study-shortcuts text-xs text-slate-500 md:text-right">Space/Enter reveal, H hint, K known, P practice, N next</p>}
            </div>
          )}
        </div>

        <h2 className="study-word mt-3.5 text-[2.35rem] font-semibold leading-[1.05] tracking-tight text-ink md:text-[3.25rem]" lang="fi">
          {studyWord.fi}
        </h2>
        {!reveal && (
          <>
            <p className="study-prompt mt-2 text-sm text-slate-700 md:hidden">Think of the meaning first.</p>
            <p className="study-prompt mt-2 hidden text-sm text-slate-700 md:block">Try to recall the meaning before revealing the answer.</p>
          </>
        )}
        {!reveal && studyHintLevel > 0 && (
          <div className="mx-auto mt-3 max-w-2xl space-y-2 text-left">
            {studyHints.slice(0, studyHintLevel).map((hint, index) => (
              <p key={`${studyWord.id}-hint-${index}`} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800">
                Hint {index + 1}: {hint}
              </p>
            ))}
          </div>
        )}
        {reveal && (
          <div className="mx-auto mt-3 max-w-2xl space-y-3 text-left">
            <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Meaning</p>
              <p className="mt-1 text-xl font-semibold text-accent">{studyWord.en}</p>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Easy Finnish</p>
              <p className="mt-1 text-sm text-slate-800" lang="fi">
                {studyWord.fiSimple}
              </p>
            </div>
            <div className="hidden rounded-[22px] border border-slate-200 bg-white px-4 py-3 md:block">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Example</p>
              <p className="mt-1 text-sm text-slate-700" lang="fi">
                {studyExampleText}
              </p>
            </div>
            <div className="md:hidden">
              <button
                type="button"
                className="action-secondary w-full rounded-full px-4 py-2 text-sm font-semibold"
                aria-expanded={showMobileExample}
                aria-controls={examplePanelId}
                onClick={() => setShowMobileExample((current) => !current)}
              >
                {showMobileExample ? "Hide example" : "Show example"}
              </button>
              {showMobileExample && (
                <div id={examplePanelId} className="mt-2 rounded-[22px] border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Example</p>
                  <p className="mt-1 text-sm text-slate-700" lang="fi">
                    {studyExampleText}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {!reveal && (
        <div className="study-actions mt-4 flex flex-col gap-3">
          <div className="grid w-full gap-3 min-[380px]:grid-cols-2 sm:max-w-xl">
            <button ref={studyRevealButtonRef} className="action-primary w-full rounded-full px-5 py-3 text-sm font-semibold" onClick={onRevealStudyWord}>
              Reveal Meaning
            </button>
            <button
              className="action-secondary w-full rounded-full px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              onClick={onRevealStudyHint}
              disabled={studyHintLevel >= studyHints.length}
            >
              {studyHintLevel === 0 ? "Show Hint" : studyHintLevel >= studyHints.length ? "All Hints Shown" : "Show Another Hint"}
            </button>
          </div>
          <button className="action-ghost w-full self-stretch rounded-full px-4 py-2 text-sm font-semibold sm:w-auto sm:self-start" onClick={onNextStudyWord}>
            Skip for Now
          </button>
        </div>
      )}

      {reveal && studyDecision === "none" && (
        <div className="study-actions mt-4 flex flex-col gap-3">
          <div className="grid w-full gap-3 min-[380px]:grid-cols-2 sm:max-w-xl">
            <button ref={studyKnownButtonRef} className="action-success w-full rounded-full px-5 py-3 text-sm font-semibold" onClick={onMarkStudyKnown}>
              Mark Known
            </button>
            <button className="action-warning w-full rounded-full px-5 py-3 text-sm font-semibold" onClick={onMarkStudyPractice}>
              Needs Practice
            </button>
          </div>
          <button className="action-ghost w-full self-stretch rounded-full px-4 py-2 text-sm font-semibold sm:w-auto sm:self-start" onClick={onNextStudyWord}>
            Skip Without Saving
          </button>
        </div>
      )}

      {reveal && studyDecision !== "none" && (
        <div className="mt-4">
          <div className={`feedback-panel rounded-3xl p-4 ${studyDecision === "known" ? "feedback-panel-correct" : "feedback-panel-warning"}`}>
            <p className="text-sm font-semibold text-ink" role="status" aria-live="polite">
              {studyDecision === "known" ? "Saved as known." : "Saved as needs practice."}
            </p>
          </div>
          <button ref={studyNextButtonRef} className="action-primary mt-3 w-full rounded-full px-5 py-3 text-sm font-semibold sm:w-auto" onClick={onNextStudyWord}>
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
            <div className="mt-4 flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:gap-3">
              <label htmlFor="daily-goal-study" className="text-sm text-slate-700">
                Daily target
              </label>
              <input
                id="daily-goal-study"
                type="number"
                min={5}
                max={200}
                className="text-input text-input-idle w-full min-[420px]:w-24"
                value={dailyGoal}
                onChange={(event) => onDailyGoalChange(Number(event.target.value))}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="surface-subtle mt-6 rounded-[24px] px-4 py-4 md:px-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <p className="section-title">Session overview</p>
              <p className="text-sm text-slate-600">Review a card to start today's study stats.</p>
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
              <div className="mt-4 flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:gap-3">
                <label htmlFor="daily-goal-study-empty" className="text-sm text-slate-700">
                  Daily target
                </label>
                <input
                  id="daily-goal-study-empty"
                  type="number"
                  min={5}
                  max={200}
                  className="text-input text-input-idle w-full min-[420px]:w-24"
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
