import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from "react";
import { POS_LABELS, STUDY_FILTER_LABELS, TOPIC_LABELS, tabButtonId, tabPanelId } from "../app/app.constants";
import type { StudyDecision, StudyFilter } from "../app/app.types";
import { studyExample } from "./study.utils";
import type { VocabularyWord } from "../../types";
import { useFinePointer } from "../../utils/useFinePointer";
import { useKeyboardMode } from "../../utils/useKeyboardMode";

type StudyRevealPanel = "meaning" | "simple" | "example";
type StudyCardAdvanceMotion = "next" | "skip";
type StudySwipeIntent = "known" | "practice";

const STUDY_SWIPE_THRESHOLD_PX = 84;
const STUDY_SWIPE_MAX_OFFSET_PX = 160;
const STUDY_CARD_ADVANCE_MS = 220;

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
  knownCount: number;
  totalWords: number;
  streakDays: number;
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

const COMPACT_REVEAL_PANEL_BUTTON_LABELS: Record<StudyRevealPanel, string> = {
  meaning: "Meaning",
  simple: "Easy",
  example: "Example"
};

const getStreakLabel = (streakDays: number): string => {
  if (streakDays <= 0) {
    return "Start a streak";
  }

  return `${streakDays} day${streakDays === 1 ? "" : "s"} streak`;
};

const getMomentumCopy = (reviewedToday: number, dailyGoal: number, goalPct: number): string => {
  if (goalPct >= 100) {
    return "Daily target reached. Extra reps now count as bonus review.";
  }

  if (reviewedToday === 0) {
    return `Start with one review. Today's target is ${dailyGoal}.`;
  }

  return `${reviewedToday} of ${dailyGoal} reviews completed today.`;
};

const getRemainingCopy = (reviewedToday: number, dailyGoal: number, goalPct: number): string => {
  if (goalPct >= 100) {
    return "Goal complete";
  }

  const remaining = Math.max(dailyGoal - reviewedToday, 0);
  return `${remaining} to go`;
};

const getSessionActivityCopy = (studyKnownSession: number, studyPracticeSession: number): string => {
  if (studyKnownSession === 0 && studyPracticeSession === 0) {
    return "One calm card at a time.";
  }

  return `This session: ${studyKnownSession} known, ${studyPracticeSession} practice.`;
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
  knownCount,
  totalWords,
  streakDays,
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
  const studyRevealPanelRef = useRef<HTMLDivElement | null>(null);
  const shortcutHelpRef = useRef<HTMLDivElement | null>(null);
  const previousRevealRef = useRef(reveal);
  const advanceTimerRef = useRef<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const [studyRevealPanel, setStudyRevealPanel] = useState<StudyRevealPanel>("meaning");
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swipeActive, setSwipeActive] = useState(false);
  const [swipeIntent, setSwipeIntent] = useState<StudySwipeIntent | null>(null);
  const [cardAdvanceMotion, setCardAdvanceMotion] = useState<StudyCardAdvanceMotion | null>(null);
  const supportsKeyboardUI = useFinePointer();
  const keyboardMode = useKeyboardMode();
  const cardsInModeLabel = `${studyPool.length} ${studyPool.length === 1 ? "card" : "cards"}`;
  const showHintCounter = !reveal && studyHintLevel > 0;
  const studyExampleText = studyExample(studyWord);
  const currentHint = studyHintLevel > 0 ? studyHints[studyHintLevel - 1] : null;
  const knownProgressPct = totalWords > 0 ? Math.round((knownCount / totalWords) * 100) : 0;
  const streakLabel = getStreakLabel(streakDays);
  const momentumCopy = getMomentumCopy(reviewedToday, dailyGoal, goalPct);
  const remainingCopy = getRemainingCopy(reviewedToday, dailyGoal, goalPct);
  const sessionActivityCopy = getSessionActivityCopy(studyKnownSession, studyPracticeSession);
  const studyDetailsSummary = hasStudyActivity
    ? `Momentum ${reviewedToday}/${dailyGoal}, ${streakLabel.toLowerCase()}`
    : `Momentum ready, ${streakLabel.toLowerCase()}`;
  const canSwipeCard = reveal && studyDecision === "none";
  const swipeKnownOpacity = swipeOffset > 0 ? Math.min(swipeOffset / STUDY_SWIPE_THRESHOLD_PX, 1) : 0;
  const swipePracticeOpacity = swipeOffset < 0 ? Math.min(Math.abs(swipeOffset) / STUDY_SWIPE_THRESHOLD_PX, 1) : 0;
  const swipeGuideCopy = swipeIntent === "known"
    ? "Release to mark known."
    : swipeIntent === "practice"
      ? "Release to mark practice."
      : canSwipeCard
        ? "Swipe left for practice or right for known."
        : !reveal
          ? "Tap the card or use Reveal Meaning."
          : "Choose a status to save this card.";
  const actionBusy = cardAdvanceMotion !== null;
  const cardShellStyle = cardAdvanceMotion === "next"
    ? { transform: "translate3d(8%, -2%, 0) rotate(2deg)", opacity: 0 }
    : cardAdvanceMotion === "skip"
      ? { transform: "translate3d(0, -6%, 0) scale(0.985)", opacity: 0 }
      : { transform: `translate3d(${swipeOffset}px, 0, 0) rotate(${swipeOffset / 24}deg)` };

  const resetSwipeState = (): void => {
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    setSwipeOffset(0);
    setSwipeActive(false);
    setSwipeIntent(null);
  };

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
    resetSwipeState();
  }, [reveal, studyDecision, studyWord.id]);

  useEffect(() => {
    if (!supportsKeyboardUI && showShortcutHelp) {
      setShowShortcutHelp(false);
    }
  }, [showShortcutHelp, supportsKeyboardUI]);

  useEffect(() => {
    if (!showShortcutHelp || typeof document === "undefined") return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!shortcutHelpRef.current?.contains(event.target as Node)) {
        setShowShortcutHelp(false);
      }
    };

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowShortcutHelp(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [showShortcutHelp]);

  useEffect(() => {
    const wasRevealed = previousRevealRef.current;
    previousRevealRef.current = reveal;

    if (!reveal || wasRevealed || supportsKeyboardUI || typeof window === "undefined") return;

    const panelTarget = studyRevealPanelRef.current;
    const fallbackTarget = studyRevealActionsRef.current;
    const target = panelTarget ?? fallbackTarget;
    if (!target) return;

    const rafId = window.requestAnimationFrame(() => {
      target.scrollIntoView({
        behavior: "auto",
        block: panelTarget ? "end" : "nearest",
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

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(advanceTimerRef.current);
      }
    };
  }, []);

  const queueNextStudyWord = (motion: StudyCardAdvanceMotion): void => {
    if (actionBusy) return;

    resetSwipeState();
    setCardAdvanceMotion(motion);

    if (typeof window === "undefined") {
      onNextStudyWord();
      setCardAdvanceMotion(null);
      return;
    }

    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current);
    }

    advanceTimerRef.current = window.setTimeout(() => {
      onNextStudyWord();
      setCardAdvanceMotion(null);
      advanceTimerRef.current = null;
    }, STUDY_CARD_ADVANCE_MS);
  };

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
        queueNextStudyWord("next");
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
      queueNextStudyWord("next");
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

  const handleStudyCardClick = (event: ReactMouseEvent<HTMLDivElement>): void => {
    if (reveal || actionBusy) return;

    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.closest(".study-card-shell-tools")) return;

    onRevealStudyWord();
  };

  const handleCardTouchStart = (event: ReactTouchEvent<HTMLDivElement>): void => {
    if (!canSwipeCard || actionBusy) return;

    const touch = event.touches[0];
    if (!touch) return;

    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
    setSwipeActive(false);
  };

  const handleCardTouchMove = (event: ReactTouchEvent<HTMLDivElement>): void => {
    if (!canSwipeCard || actionBusy) return;
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;

    const touch = event.touches[0];
    if (!touch) return;

    const deltaX = touch.clientX - touchStartXRef.current;
    const deltaY = touch.clientY - touchStartYRef.current;

    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 14) {
      return;
    }

    const clampedDeltaX = Math.max(-STUDY_SWIPE_MAX_OFFSET_PX, Math.min(STUDY_SWIPE_MAX_OFFSET_PX, deltaX));
    setSwipeActive(true);
    setSwipeOffset(clampedDeltaX);
    setSwipeIntent(clampedDeltaX >= 28 ? "known" : clampedDeltaX <= -28 ? "practice" : null);
  };

  const handleCardTouchEnd = (event: ReactTouchEvent<HTMLDivElement>): void => {
    if (!canSwipeCard || actionBusy) {
      resetSwipeState();
      return;
    }

    const touch = event.changedTouches[0];
    const startX = touchStartXRef.current;
    if (!touch || startX === null) {
      resetSwipeState();
      return;
    }

    const deltaX = touch.clientX - startX;
    resetSwipeState();

    if (deltaX >= STUDY_SWIPE_THRESHOLD_PX) {
      onMarkStudyKnown();
      return;
    }

    if (deltaX <= -STUDY_SWIPE_THRESHOLD_PX) {
      onMarkStudyPractice();
    }
  };

  return (
    <section
      id={tabPanelId("study")}
      role="tabpanel"
      aria-labelledby={tabButtonId("study")}
      className="surface-card study-shell study-shell-focus rounded-[28px] px-4 py-4 md:px-5 md:py-5"
    >
      <div className="study-main-stage">
        <div className="study-toolbar mb-4 space-y-3" role="group" aria-label="Study mode">
          <div className="study-progress-band rounded-[30px] px-4 py-4 md:px-5 md:py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div className="space-y-2">
                  <span className="eyebrow">Study mode</span>
                  <p className="max-w-2xl text-sm leading-6 text-slate-600">{sessionActivityCopy}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="state-pill state-pill-neutral">{STUDY_FILTER_LABELS[studyFilter]}</span>
                  <span className="state-pill state-pill-neutral">{cardsInModeLabel}</span>
                  <span className="state-pill state-pill-neutral">{remainingCopy}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:max-w-[18rem]">
                <article className="study-stage-metric">
                  <p className="metric-label">Known</p>
                  <p className="study-stage-metric-value">
                    {knownCount}
                    <span className="study-stage-metric-unit">/{totalWords}</span>
                  </p>
                </article>
                <article className="study-stage-metric">
                  <p className="metric-label">Today</p>
                  <p className="study-stage-metric-value">
                    {reviewedToday}
                    <span className="study-stage-metric-unit">/{dailyGoal}</span>
                  </p>
                </article>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                <span>Known progress</span>
                <span>{knownProgressPct}%</span>
              </div>
              <div className="study-stage-track">
                <div className="study-stage-track-bar" style={{ width: `${knownProgressPct}%` }} />
              </div>
            </div>
          </div>

          <label className="study-toolbar-compact-filter">
            <span className="study-toolbar-compact-filter-label text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Card set</span>
            <select
              aria-label="Study filter"
              className="study-filter-select mt-2"
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

        <div className="surface-subtle study-card study-card-focus rounded-[32px] px-3 py-3 md:px-4 md:py-4">
          <div
            className={`study-card-shell ${reveal ? "study-card-shell-revealed" : ""}`}
            data-swipe-active={swipeActive ? "true" : "false"}
            data-swipe-intent={swipeIntent ?? "idle"}
            onClick={handleStudyCardClick}
            onTouchStart={handleCardTouchStart}
            onTouchMove={handleCardTouchMove}
            onTouchEnd={handleCardTouchEnd}
            onTouchCancel={resetSwipeState}
            style={{
              ...cardShellStyle,
              touchAction: canSwipeCard ? "pan-y" : "manipulation"
            }}
          >
            {supportsKeyboardUI && (
              <div ref={shortcutHelpRef} className="study-card-shell-tools" onClick={(event) => event.stopPropagation()}>
                <button
                  type="button"
                  aria-label="Show keyboard shortcuts"
                  aria-expanded={showShortcutHelp}
                  aria-controls="study-shortcut-help"
                  title="Keyboard shortcuts"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-sm font-semibold text-slate-600 shadow-sm"
                  onClick={() => setShowShortcutHelp((current) => !current)}
                >
                  ?
                </button>
                {showShortcutHelp && (
                  <div
                    id="study-shortcut-help"
                    className="absolute right-0 z-20 mt-2 w-[17rem] rounded-[20px] border border-slate-200 bg-white p-4 text-left shadow-[0_18px_40px_rgba(19,39,58,0.14)]"
                  >
                    <p className="text-sm font-semibold text-ink">Keyboard shortcuts</p>
                    <ul className="mt-3 space-y-2 text-sm text-slate-700">
                      <li><strong>Space / Enter</strong>: reveal or move next</li>
                      <li><strong>H</strong>: show a hint</li>
                      <li><strong>K</strong>: mark known</li>
                      <li><strong>P</strong>: mark practice</li>
                      <li><strong>N</strong>: next card</li>
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="study-card-gesture-indicators" aria-hidden="true">
              <span className="study-gesture-badge study-gesture-badge-left" style={{ opacity: swipePracticeOpacity }}>
                Practice
              </span>
              <span className="study-gesture-badge study-gesture-badge-right" style={{ opacity: swipeKnownOpacity }}>
                Known
              </span>
            </div>

            <div className="study-card-flip">
              <article className="study-card-face study-card-face-front">
                <div className="study-card-face-header">
                  <div className="flex flex-wrap gap-2">
                    <span className="state-pill state-pill-neutral">{TOPIC_LABELS[studyWord.topic]}</span>
                    <span className="state-pill state-pill-neutral">{POS_LABELS[studyWord.pos]}</span>
                  </div>
                  {showHintCounter && <span className="study-card-counter">Hint {studyHintLevel}/{studyHints.length}</span>}
                </div>

                <div className="study-card-front-body">
                  <p className="study-card-kicker">Finnish</p>
                  <h2 className="study-word study-card-hero-word" lang="fi">
                    {studyWord.fi}
                  </h2>
                  <p className="study-front-prompt">Think of the meaning before you flip the card.</p>

                  {currentHint && (
                    <div className="study-latest-hint mx-auto w-full max-w-xl text-left">
                      <div className="rounded-[22px] border border-slate-200 bg-white/95 px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Latest hint</p>
                        <p className="mt-1 text-sm leading-6 text-slate-800">{currentHint}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="study-card-front-foot">
                  <span>Tap the card or use Reveal Meaning</span>
                </div>
              </article>

              <article className="study-card-face study-card-face-back">
                <div className="study-card-face-header">
                  <div className="flex flex-wrap gap-2">
                    <span className="state-pill state-pill-neutral">{TOPIC_LABELS[studyWord.topic]}</span>
                    <span className="state-pill state-pill-neutral">{POS_LABELS[studyWord.pos]}</span>
                  </div>
                  <span className="study-card-counter">{revealPanelContent.label}</span>
                </div>

                <div className="study-card-back-body">
                  <h2 className="study-word study-card-back-word" lang="fi">
                    {studyWord.fi}
                  </h2>

                  <div className="study-reveal-switch grid grid-cols-3 gap-2" role="group" aria-label="Reveal details">
                    {(["meaning", "simple", "example"] as StudyRevealPanel[]).map((panel) => (
                      <button
                        key={panel}
                        type="button"
                        aria-label={REVEAL_PANEL_LABELS[panel]}
                        aria-pressed={studyRevealPanel === panel}
                        className={`study-detail-tab ${studyRevealPanel === panel ? "study-detail-tab-active" : "study-detail-tab-idle"}`}
                        onClick={() => setStudyRevealPanel(panel)}
                      >
                        <span className="md:hidden">{COMPACT_REVEAL_PANEL_BUTTON_LABELS[panel]}</span>
                        <span className="hidden md:inline">{REVEAL_PANEL_LABELS[panel]}</span>
                      </button>
                    ))}
                  </div>

                  <div ref={studyRevealPanelRef} className="study-reveal-panel rounded-[24px] border border-slate-200 px-4 py-4 md:px-5 md:py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{revealPanelContent.label}</p>
                    <p className={`mt-2 ${revealPanelContent.bodyClassName}`} lang={revealPanelContent.lang}>
                      {revealPanelContent.body}
                    </p>
                  </div>
                </div>

                <div className="study-swipe-guide" aria-live="polite">
                  <span>Practice</span>
                  <span>{swipeGuideCopy}</span>
                  <span>Known</span>
                </div>
              </article>
            </div>
          </div>
        </div>

        {!reveal && (
          <div className="study-actions mt-4 flex flex-col gap-2 md:mx-auto md:max-w-3xl md:items-center">
            <div className="grid w-full gap-3 md:max-w-2xl md:grid-cols-[minmax(0,1.45fr)_minmax(13rem,0.75fr)]">
              <button
                ref={studyRevealButtonRef}
                aria-label="Reveal Meaning"
                className="action-primary w-full rounded-full px-5 py-3.5 text-sm font-semibold md:text-base"
                onClick={onRevealStudyWord}
                disabled={actionBusy}
              >
                <span className="md:hidden">Reveal</span>
                <span className="hidden md:inline">Reveal Meaning</span>
              </button>
              <button
                aria-label={studyHintLevel === 0 ? "Show Hint" : studyHintLevel >= studyHints.length ? "All Hints Shown" : "Show Another Hint"}
                className="action-secondary w-full rounded-full px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                onClick={onRevealStudyHint}
                disabled={actionBusy || studyHintLevel >= studyHints.length}
              >
                <span className="md:hidden">{studyHintLevel >= studyHints.length ? "Hints Used" : "Hint"}</span>
                <span className="hidden md:inline">{studyHintLevel === 0 ? "Show Hint" : studyHintLevel >= studyHints.length ? "All Hints Shown" : "Show Another Hint"}</span>
              </button>
            </div>
            <button
              type="button"
              aria-label="Skip for Now"
              className="study-skip-link text-sm font-semibold"
              onClick={() => queueNextStudyWord("skip")}
            >
              <span className="md:hidden">Skip for now</span>
              <span className="hidden md:inline">Skip for Now</span>
            </button>
          </div>
        )}

        {reveal && studyDecision === "none" && (
          <div ref={studyRevealActionsRef} className="study-actions study-reveal-tray mt-4 flex flex-col gap-2 md:mx-auto md:max-w-3xl md:items-center">
            <div className="grid w-full gap-3 md:max-w-2xl md:grid-cols-2">
              <button
                ref={studyKnownButtonRef}
                aria-label="Mark Known"
                className="action-success w-full rounded-full px-5 py-3 text-sm font-semibold"
                onClick={onMarkStudyKnown}
                disabled={actionBusy}
              >
                <span className="md:hidden">Known</span>
                <span className="hidden md:inline">Known</span>
              </button>
              <button
                aria-label="Needs Practice"
                className="action-warning w-full rounded-full px-5 py-3 text-sm font-semibold"
                onClick={onMarkStudyPractice}
                disabled={actionBusy}
              >
                <span className="md:hidden">Practice</span>
                <span className="hidden md:inline">Practice</span>
              </button>
            </div>
            <button
              type="button"
              aria-label="Skip Without Saving"
              className="study-skip-link text-sm font-semibold"
              onClick={() => queueNextStudyWord("skip")}
            >
              <span className="md:hidden">Skip</span>
              <span className="hidden md:inline">Skip Without Saving</span>
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
                aria-label="Next Card"
                className="action-primary w-full rounded-full px-5 py-3 text-sm font-semibold sm:min-w-[12rem] sm:w-auto"
                onClick={() => queueNextStudyWord("next")}
                disabled={actionBusy}
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
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1.5">
                    <p className="section-title">Today's momentum</p>
                    <p className="text-sm text-slate-600">{momentumCopy}</p>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">
                    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
                      <path
                        d="M10.7 2.3c.3 1.5-.2 2.8-1.4 4-.9.9-1.4 1.9-1.4 3 0 1.4.9 2.7 2.4 3.3-.2-.5-.3-1-.3-1.6 0-1.6 1.1-3 2.8-4.4 1 1.2 1.5 2.4 1.5 3.7 0 2.5-1.8 4.6-4.5 5.4-3.3-.7-5.6-3.2-5.6-6.1 0-2.7 1.7-4.6 3.8-6.4.8-.7 1.7-1.4 2.7-2.9Z"
                        fill="currentColor"
                      />
                    </svg>
                    <span>{streakLabel}</span>
                  </span>
                </div>
                <div className="progress-track">
                  <div className="progress-bar" style={{ width: `${goalPct}%` }} />
                </div>
                <div className="flex items-center justify-between gap-3 text-sm text-slate-700">
                  <span>{remainingCopy}</span>
                  <span>{reviewedToday}/{dailyGoal}</span>
                </div>
                <div className="flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:gap-3">
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
          </div>
        ) : (
          <div className="mt-4 rounded-[24px] border border-slate-200 bg-white px-4 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1.5">
                <p className="section-title">Session overview</p>
                <p className="text-sm text-slate-600">Review one card to start today's momentum.</p>
              </div>
              <div className="min-w-0 lg:w-[340px] space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1.5">
                    <p className="section-title">Today's momentum</p>
                    <p className="text-sm text-slate-600">{momentumCopy}</p>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">
                    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
                      <path
                        d="M10.7 2.3c.3 1.5-.2 2.8-1.4 4-.9.9-1.4 1.9-1.4 3 0 1.4.9 2.7 2.4 3.3-.2-.5-.3-1-.3-1.6 0-1.6 1.1-3 2.8-4.4 1 1.2 1.5 2.4 1.5 3.7 0 2.5-1.8 4.6-4.5 5.4-3.3-.7-5.6-3.2-5.6-6.1 0-2.7 1.7-4.6 3.8-6.4.8-.7 1.7-1.4 2.7-2.9Z"
                        fill="currentColor"
                      />
                    </svg>
                    <span>{streakLabel}</span>
                  </span>
                </div>
                <div className="progress-track">
                  <div className="progress-bar" style={{ width: `${goalPct}%` }} />
                </div>
                <div className="flex items-center justify-between gap-3 text-sm text-slate-700">
                  <span>{remainingCopy}</span>
                  <span>{reviewedToday}/{dailyGoal}</span>
                </div>
                <div className="flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:gap-3">
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
