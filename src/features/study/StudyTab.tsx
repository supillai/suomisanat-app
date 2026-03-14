import { useEffect, useRef } from "react";
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

  return (
    <section
      id={tabPanelId("study")}
      role="tabpanel"
      aria-labelledby={tabButtonId("study")}
      className="glass card-shadow rounded-3xl p-4 md:p-6"
    >
      <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Study mode">
        <span className="text-xs font-semibold text-slate-700">Study mode:</span>
        {(["all", "unknown", "known", "practice"] as StudyFilter[]).map((mode) => (
          <button
            key={mode}
            className={`rounded-lg border px-2 py-1 text-xs ${
              studyFilter === mode ? "accent-gradient border-transparent text-white" : "border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200"
            }`}
            onClick={() => onStudyFilterChange(mode)}
          >
            {STUDY_FILTER_LABELS[mode]}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-700">Cards in mode: {studyPool.length}</span>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white px-5 py-4 text-center md:px-6 md:py-5">
        <div className="mb-1.5 flex flex-wrap justify-center gap-2">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
            {TOPIC_LABELS[studyWord.topic]}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
            {POS_LABELS[studyWord.pos]}
          </span>
        </div>
        <h2 className="mt-1 text-4xl font-extrabold text-ink md:text-[3.25rem]">{studyWord.fi}</h2>
        {!reveal && <p className="mt-2.5 text-sm text-slate-700">Try to recall the meaning, then reveal.</p>}
        {!reveal && studyHintLevel > 0 && (
          <div className="mx-auto mt-2.5 max-w-2xl space-y-2 text-left">
            {studyHints.slice(0, studyHintLevel).map((hint, index) => (
              <p key={`${studyWord.id}-hint-${index}`} className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-800">
                Hint {index + 1}: {hint}
              </p>
            ))}
          </div>
        )}
        {reveal && (
          <div className="mt-2.5 space-y-2">
            <p className="text-xl font-semibold text-accent">{studyWord.en}</p>
            <p className="text-sm text-slate-800">{studyWord.fiSimple}</p>
            <p className="text-sm text-slate-700">{studyExample(studyWord)}</p>
          </div>
        )}
      </div>

      {!reveal && (
        <div className="mt-4 flex flex-col items-center gap-2.5">
          <div className="grid w-full gap-2 sm:max-w-xl sm:grid-cols-2">
            <button
              ref={studyRevealButtonRef}
              className="w-full rounded-xl bg-slate-800 px-4 py-3 text-sm font-semibold text-white"
              onClick={onRevealStudyWord}
            >
              Reveal Meaning
            </button>
            <button
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={onRevealStudyHint}
              disabled={studyHintLevel >= studyHints.length}
            >
              {studyHintLevel === 0 ? "Show Hint" : studyHintLevel >= studyHints.length ? "All Hints Shown" : "Show Another Hint"}
            </button>
          </div>
          <button className="px-3 py-1 text-sm font-semibold text-slate-600 hover:text-slate-900" onClick={onNextStudyWord}>
            Skip for Now
          </button>
        </div>
      )}

      {reveal && studyDecision === "none" && (
        <div className="mt-4 flex flex-col items-center gap-2.5">
          <div className="grid w-full gap-2 sm:max-w-xl sm:grid-cols-2">
            <button
              ref={studyKnownButtonRef}
              className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white"
              onClick={onMarkStudyKnown}
            >
              Mark Known
            </button>
            <button className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white" onClick={onMarkStudyPractice}>
              Needs Practice
            </button>
          </div>
          <button className="px-3 py-1 text-sm font-semibold text-slate-600 hover:text-slate-900" onClick={onNextStudyWord}>
            Skip Without Saving
          </button>
        </div>
      )}

      {reveal && studyDecision !== "none" && (
        <div className="mt-5">
          <p className="mb-3 text-sm font-semibold text-slate-800" role="status" aria-live="polite">
            {studyDecision === "known" ? "Saved as known." : "Saved as needs practice."}
          </p>
          <button
            ref={studyNextButtonRef}
            className="w-full rounded-xl bg-slate-800 px-4 py-3 text-sm font-semibold text-white sm:w-auto"
            onClick={onNextStudyWord}
          >
            Next Card
          </button>
        </div>
      )}

      {hasStudyActivity ? (
        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(260px,0.9fr)]">
          <div className="rounded-xl bg-slate-50/80 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink">Session overview</p>
              <p className="text-xs text-slate-600">
                This session: {studyKnownSession} known, {studyPracticeSession} needs practice
              </p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
              <article className="rounded-lg bg-white px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide text-slate-600">Reviewed Today</p>
                <p className="mt-1 text-lg font-bold leading-none text-ink">{reviewedToday}</p>
              </article>
              <article className="rounded-lg bg-white px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide text-slate-600">Accuracy</p>
                <p className="mt-1 text-lg font-bold leading-none text-ink">{accuracy}%</p>
              </article>
              <article className="rounded-lg bg-white px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide text-slate-600">Practice Queue</p>
                <p className="mt-1 text-lg font-bold leading-none text-ink">{needsPracticeCount}</p>
              </article>
              <article className="rounded-lg bg-white px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide text-slate-600">Cards in Mode</p>
                <p className="mt-1 text-lg font-bold leading-none text-ink">{studyPool.length}</p>
              </article>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50/80 p-3">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink">Daily goal</p>
              <span className="text-xs text-slate-700">
                {reviewedToday}/{dailyGoal}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-200">
              <div className="h-2.5 rounded-full bg-accent" style={{ width: `${goalPct}%` }} />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <label htmlFor="daily-goal-study" className="text-xs text-slate-700">
                Daily target
              </label>
              <input
                id="daily-goal-study"
                type="number"
                min={5}
                max={200}
                className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-900"
                value={dailyGoal}
                onChange={(event) => onDailyGoalChange(Number(event.target.value))}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-xl bg-slate-50/80 px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-ink">Session overview</p>
              <p className="text-sm text-slate-600">Start reviewing cards to unlock your session stats.</p>
            </div>
            <div className="min-w-0 lg:w-[320px]">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink">Daily goal</p>
                <span className="text-xs text-slate-700">
                  {reviewedToday}/{dailyGoal}
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-200">
                <div className="h-2.5 rounded-full bg-accent" style={{ width: `${goalPct}%` }} />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <label htmlFor="daily-goal-study" className="text-xs text-slate-700">
                  Daily target
                </label>
                <input
                  id="daily-goal-study"
                  type="number"
                  min={5}
                  max={200}
                  className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-900"
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
