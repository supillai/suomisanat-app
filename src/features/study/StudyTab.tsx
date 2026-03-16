import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { POS_LABELS, STUDY_FILTER_LABELS, TOPIC_LABELS, tabButtonId, tabPanelId } from "../app/app.constants";
import type { StudyDecision, StudyFilter } from "../app/app.types";
import { studyExample } from "./study.utils";
import type { VocabularyWord } from "../../types";
import { useFinePointer } from "../../utils/useFinePointer";
import { useKeyboardMode } from "../../utils/useKeyboardMode";

type StudyRevealPanel = "meaning" | "simple" | "example";

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

const REVEAL_PANEL_LABELS: Record<StudyRevealPanel, string> = {
  meaning: "Meaning",
  simple: "Easy Finnish",
  example: "Example"
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
  const studyRevealActionsRef = useRef<HTMLDivElement | null>(null);
  const previousRevealRef = useRef(reveal);
  const [studyRevealPanel, setStudyRevealPanel] = useState<StudyRevealPanel>("meaning");
  const supportsKeyboardUI = useFinePointer();
  const keyboardMode = useKeyboardMode();
  const cardsInModeLabel = `${studyPool.length} ${studyPool.length === 1 ? "card" : "cards"}`;
  const showHintCounter = !reveal && studyHintLevel > 0;
  const studyExampleText = studyExample(studyWord);
  const currentHint = studyHintLevel > 0 ? studyHints[studyHintLevel - 1] : null;
  const studyDetailsSummary = hasStudyActivity
    ? `Today ${reviewedToday}/${dailyGoal}, accuracy ${accuracy}%, practice ${needsPracticeCount}`
    : `Daily goal ${reviewedToday}/${dailyGoal}`;

  const revealPanelContent = useMemo(() => {
    switch (studyRevealPanel) {
      case "simple":
        return {
          label: REVEAL_PANEL_LABELS.simple,
          body: studyWord.fiSimple,
          lang: "fi",
          bodyClassName: "text-sm leading-6 text-slate-800 md:text-base"
        };
      case "example":
        return {
          label: REVEAL_PANEL_LABELS.example,
          body: studyExampleText,
          lang: "fi",
          bodyClassName: "text-sm leading-6 text-slate-700 md:text-base"
        };
      case "meaning":
      default:
        return {
          label: REVEAL_PANEL_LABELS.meaning,
          body: studyWord.en,
          lang: undefined,
          bodyClassName: "text-2xl font-semibold text-accent md:text-[2rem]"
        };
    }
  }, [studyExampleText, studyRevealPanel, studyWord.en, studyWord.fiSimple]);

  useEffect(() => {
    setStudyRevealPanel("meaning");
  }, [reveal, studyWord.id]);

  useEffect(() => {
    const wasRevealed = previousRevealRef.current;
    previousRevealRef.current = reveal;

    if (!reveal || wasRevealed || supportsKeyboardUI || typeof window === "undefined") return;

    const target = studyRevealActionsRef.current;
    if (!target) return;

    const rafId = window.requestAnimationFrame(() => {
      target.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest"
      });
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [reveal, supportsKeyboardUI]);

  useEffect(() => {
    if (!supportsKeyboardUI || !keyboardMode) return;

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
  }, [keyboardMode, reveal, studyDecision, studyWord.id, supportsKeyboardUI]);

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
      className="surface-card study-shell study-shell-focus rounded-[28px] px-4 py-4 md:px-7 md:py-6"
    >
      <div className="study-main-stage">
        <div className="study-toolbar mb-4 space-y-3" role="group" aria-label="Study mode">
          <div className="flex items-center justify-between gap-2">
            <span className="eyebrow">Study mode</span>
            <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
              {cardsInModeLabel}
            </span>
          </div>
          <label className="study-toolbar-compact-filter">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Card set</span>
            <select
              aria-label="Study filter"
              className="study-filter-select mt-2 w-full"
              value={studyFilter}
              onChange={(event) => onStudyFilterChange(event.target.value as StudyFilter)}
            >
              {(["all", "unknown", "known", "practice"] as StudyFilter[]).map((mode) => (
                <option key={`compact-filter-${mode}`} value={mode}>
                  {STUDY_FILTER_LABELS[mode]}
                </option>
              ))}
            </select>
          </label>
          <div className="study-toolbar-default-filters touch-scroll-row flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0">
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

        <div className="surface-subtle study-card study-card-focus rounded-[28px] px-4 py-4 text-center md:px-6 md:py-5">
          <div className="study-card-top flex flex-wrap items-start justify-between gap-2 text-left">
            <div className="flex flex-wrap gap-2">
              <span className="state-pill state-pill-neutral">{TOPIC_LABELS[studyWord.topic]}</span>
              <span className="state-pill state-pill-neutral">{POS_LABELS[studyWord.pos]}</span>
            </div>
            {(showHintCounter || supportsKeyboardUI) && (
              <div className="flex max-w-[18rem] flex-wrap items-center justify-end gap-2">
                {showHintCounter && (
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Hint {studyHintLevel}/{studyHints.length}
                  </span>
                )}
                {supportsKeyboardUI && <p className="study-shortcuts text-xs text-slate-500 md:text-right">Space/Enter reveal, H hint, K known, P practice, N next</p>}
              </div>
            )}
          </div>

          <div className="study-card-body">
            <h2 className="study-word mt-3.5 text-[2.35rem] font-semibold leading-[1.05] tracking-tight text-ink md:text-[3.25rem]" lang="fi">
              {studyWord.fi}
            </h2>

            {!reveal && (
              <>
                <p className="study-prompt mt-2 text-sm text-slate-700 md:hidden">Think of the meaning first.</p>
                <p className="study-prompt mt-2 hidden text-sm text-slate-700 md:block">Try to recall the meaning before revealing the answer.</p>
              </>
            )}

            {!reveal && currentHint && (
              <div className="mx-auto mt-4 max-w-2xl text-left">
                <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Latest hint</p>
                  <p className="mt-1 text-sm leading-6 text-slate-800">{currentHint}</p>
                </div>
              </div>
            )}

            {reveal && (
              <div className="mx-auto mt-4 flex w-full max-w-2xl flex-1 flex-col justify-center gap-3 text-left">
                <div className="study-reveal-switch grid grid-cols-3 gap-2" role="group" aria-label="Reveal details">
                  {(["meaning", "simple", "example"] as StudyRevealPanel[]).map((panel) => (
                    <button
                      key={panel}
                      type="button"
                      aria-pressed={studyRevealPanel === panel}
                      className={`study-detail-tab ${studyRevealPanel === panel ? "study-detail-tab-active" : "study-detail-tab-idle"}`}
                      onClick={() => setStudyRevealPanel(panel)}
                    >
                      {REVEAL_PANEL_LABELS[panel]}
                    </button>
                  ))}
                </div>

                <div className="study-reveal-panel rounded-[24px] border border-slate-200 bg-white px-4 py-4 md:px-5 md:py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{revealPanelContent.label}</p>
                  <p className={`mt-2 ${revealPanelContent.bodyClassName}`} lang={revealPanelContent.lang}>
                    {revealPanelContent.body}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {!reveal && (
          <div className="study-actions mt-4 flex flex-col gap-3 md:mx-auto md:max-w-3xl md:flex-row md:items-center md:justify-center">
            <div className="grid w-full gap-3 min-[380px]:grid-cols-2 md:max-w-2xl md:flex-1">
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
            <button
              className="action-ghost w-full self-stretch rounded-full px-4 py-2 text-sm font-semibold sm:w-auto sm:self-start md:shrink-0 md:self-auto md:whitespace-nowrap"
              onClick={onNextStudyWord}
            >
              Skip for Now
            </button>
          </div>
        )}

        {reveal && studyDecision === "none" && (
          <div ref={studyRevealActionsRef} className="study-actions study-reveal-tray mt-4 flex flex-col gap-3 md:mx-auto md:max-w-3xl md:flex-row md:items-center md:justify-center">
            <div className="grid w-full gap-3 min-[380px]:grid-cols-2 md:max-w-2xl md:flex-1">
              <button ref={studyKnownButtonRef} className="action-success w-full rounded-full px-5 py-3 text-sm font-semibold" onClick={onMarkStudyKnown}>
                Mark Known
              </button>
              <button className="action-warning w-full rounded-full px-5 py-3 text-sm font-semibold" onClick={onMarkStudyPractice}>
                Needs Practice
              </button>
            </div>
            <button
              className="action-ghost w-full self-stretch rounded-full px-4 py-2 text-sm font-semibold sm:w-auto sm:self-start md:shrink-0 md:self-auto md:whitespace-nowrap"
              onClick={onNextStudyWord}
            >
              Skip Without Saving
            </button>
          </div>
        )}

        {reveal && studyDecision !== "none" && (
          <div className="study-reveal-tray mt-4 mx-auto max-w-2xl">
            <div className={`feedback-panel rounded-3xl p-4 ${studyDecision === "known" ? "feedback-panel-correct" : "feedback-panel-warning"}`}>
              <p className="text-sm font-semibold text-ink" role="status" aria-live="polite">
                {studyDecision === "known" ? "Saved as known." : "Saved as needs practice."}
              </p>
            </div>
            <div className="mt-3 flex justify-center">
              <button
                ref={studyNextButtonRef}
                className="action-primary w-full rounded-full px-5 py-3 text-sm font-semibold sm:min-w-[12rem] sm:w-auto"
                onClick={onNextStudyWord}
              >
                Next Card
              </button>
            </div>
          </div>
        )}
      </div>

      <details className="surface-subtle study-insights mt-5 rounded-[24px] px-4 py-3 md:px-5" open={false}>
        <summary className="study-insights-toggle flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold text-slate-800">
          <span>Study details and goal</span>
          <span className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">{studyDetailsSummary}</span>
        </summary>

        {hasStudyActivity ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.9fr)]">
            <div className="rounded-[24px] border border-slate-200 bg-white p-4">
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

            <div className="rounded-[24px] border border-slate-200 bg-white p-4">
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
          <div className="mt-4 rounded-[24px] border border-slate-200 bg-white px-4 py-4">
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
      </details>
    </section>
  );
};