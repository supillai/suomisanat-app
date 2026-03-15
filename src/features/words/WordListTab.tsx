import { useEffect, useMemo, useState } from "react";
import { WordStatusActions } from "../../components/WordStatusActions";
import { POS_LABELS, POS_OPTIONS, TOPIC_LABELS, TOPICS, tabButtonId, tabPanelId } from "../app/app.constants";
import type { ProgressMap, VocabularyWord, WordPos, WordTopic } from "../../types";
import type { WordStatus } from "../progress/useProgressStore";
import type { WordListSort, WordListView } from "./useWordFilters";

type WordListTabProps = {
  filteredWords: VocabularyWord[];
  totalWords: number;
  searchValue: string;
  topicFilter: WordTopic | "all";
  posFilter: WordPos | "all";
  sortBy: WordListSort;
  viewMode: WordListView;
  dueNextCount: number;
  progressMap: ProgressMap;
  onSearchChange: (value: string) => void;
  onTopicFilterChange: (value: WordTopic | "all") => void;
  onPosFilterChange: (value: WordPos | "all") => void;
  onSortByChange: (value: WordListSort) => void;
  onViewModeChange: (value: WordListView) => void;
  onSetWordStatus: (word: VocabularyWord, status: WordStatus) => void;
};

const MOBILE_BATCH_SIZE = 24;

const SORT_LABELS: Record<WordListSort, string> = {
  fi: "Finnish A-Z",
  en: "English A-Z",
  topic: "Topic",
  recent: "Recent review"
};

const getWordStatusMeta = (known: boolean, needsPractice: boolean): { label: string; className: string } => {
  if (known) {
    return { label: "Known", className: "state-pill-success" };
  }

  if (needsPractice) {
    return { label: "Practice", className: "state-pill-warn" };
  }

  return { label: "New", className: "state-pill-neutral" };
};

export const WordListTab = ({
  filteredWords,
  totalWords,
  searchValue,
  topicFilter,
  posFilter,
  sortBy,
  viewMode,
  dueNextCount,
  progressMap,
  onSearchChange,
  onTopicFilterChange,
  onPosFilterChange,
  onSortByChange,
  onViewModeChange,
  onSetWordStatus
}: WordListTabProps) => {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobileVisibleCount, setMobileVisibleCount] = useState(MOBILE_BATCH_SIZE);
  const [expandedWordIds, setExpandedWordIds] = useState<Record<number, boolean>>({});
  const normalizedSearchValue = searchValue.trim();
  const compactSearchValue = normalizedSearchValue.length > 18 ? `${normalizedSearchValue.slice(0, 18)}...` : normalizedSearchValue;
  const activeFilterCount = Number(normalizedSearchValue.length > 0) + Number(topicFilter !== "all") + Number(posFilter !== "all") + Number(sortBy !== "fi");
  const visibleMobileWords = useMemo(() => filteredWords.slice(0, mobileVisibleCount), [filteredWords, mobileVisibleCount]);
  const activeFilterTokens = [
    normalizedSearchValue ? `Search: ${compactSearchValue}` : null,
    topicFilter !== "all" ? `Topic: ${TOPIC_LABELS[topicFilter]}` : null,
    posFilter !== "all" ? `Type: ${POS_LABELS[posFilter]}` : null,
    sortBy !== "fi" ? `Sort: ${SORT_LABELS[sortBy]}` : null
  ].filter((value): value is string => Boolean(value));

  useEffect(() => {
    setMobileVisibleCount(MOBILE_BATCH_SIZE);
    setExpandedWordIds({});
  }, [filteredWords.length, posFilter, searchValue, sortBy, topicFilter, viewMode]);

  useEffect(() => {
    if (activeFilterCount > 0) {
      setMobileFiltersOpen(true);
    }
  }, [activeFilterCount]);

  const toggleWordDetails = (wordId: number): void => {
    setExpandedWordIds((current) => ({
      ...current,
      [wordId]: !current[wordId]
    }));
  };

  const clearFilters = (): void => {
    onSearchChange("");
    onTopicFilterChange("all");
    onPosFilterChange("all");
    onSortByChange("fi");
    setMobileFiltersOpen(false);
  };

  const resetEmptyState = (): void => {
    clearFilters();
    if (viewMode === "due-next") {
      onViewModeChange("all");
    }
  };

  const showEmptyStateAction = activeFilterCount > 0 || viewMode === "due-next";
  const emptyStateActionLabel = viewMode === "due-next" ? "Show all words" : "Clear filters";

  return (
    <section
      id={tabPanelId("list")}
      role="tabpanel"
      aria-labelledby={tabButtonId("list")}
      className="surface-card rounded-[28px] px-4 py-5 md:px-8 md:py-8"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="eyebrow">Word list</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">Browse, sort, and queue your next review set</h2>
        </div>
        <div className="touch-scroll-row flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:justify-end sm:overflow-visible sm:pb-0" role="group" aria-label="Word list view">
          <button
            type="button"
            className={`chip-button shrink-0 ${viewMode === "all" ? "chip-button-active" : "chip-button-idle"}`}
            onClick={() => onViewModeChange("all")}
          >
            All Words
          </button>
          <button
            type="button"
            className={`chip-button shrink-0 ${viewMode === "due-next" ? "chip-button-active" : "chip-button-idle"}`}
            onClick={() => onViewModeChange("due-next")}
          >
            Due Next ({dueNextCount})
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1.8fr)_repeat(3,minmax(0,1fr))]">
        <label htmlFor="word-search" className="sr-only">
          Search words
        </label>
        <input
          id="word-search"
          className="text-input text-input-idle lg:col-span-1"
          placeholder="Search Finnish, English, or clue"
          autoComplete="off"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
        />
        <div className="flex items-center justify-between gap-2 md:hidden">
          <button
            type="button"
            className="action-secondary rounded-full px-4 py-2 text-sm font-semibold"
            aria-expanded={mobileFiltersOpen}
            aria-controls="word-list-secondary-filters"
            onClick={() => setMobileFiltersOpen((current) => !current)}
          >
            {mobileFiltersOpen ? "Hide Filters" : "Filters & Sort"}
          </button>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            {activeFilterCount > 0 ? `${activeFilterCount} active` : "Optional"}
          </span>
        </div>

        {activeFilterTokens.length > 0 && (
          <div className="touch-scroll-row flex items-center gap-2 overflow-x-auto pb-1 md:hidden lg:col-span-4">
            {activeFilterTokens.map((token) => (
              <span key={token} className="inline-flex shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                {token}
              </span>
            ))}
            <button
              type="button"
              className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
              onClick={clearFilters}
            >
              Clear all
            </button>
          </div>
        )}

        <div id="word-list-secondary-filters" className={`${mobileFiltersOpen ? "block" : "hidden"} md:contents lg:col-span-4`}>
          <div className="surface-subtle grid gap-3 rounded-[22px] p-3 md:contents md:rounded-none md:border-0 md:bg-transparent md:p-0">
            <label htmlFor="topic-filter" className="sr-only">
              Filter by topic
            </label>
            <select
              id="topic-filter"
              className="text-input text-input-idle"
              value={topicFilter}
              onChange={(event) => onTopicFilterChange(event.target.value as WordTopic | "all")}
            >
              <option value="all">All Topics</option>
              {TOPICS.map((topic) => (
                <option key={topic} value={topic}>
                  {TOPIC_LABELS[topic]}
                </option>
              ))}
            </select>
            <label htmlFor="pos-filter" className="sr-only">
              Filter by part of speech
            </label>
            <select
              id="pos-filter"
              className="text-input text-input-idle"
              value={posFilter}
              onChange={(event) => onPosFilterChange(event.target.value as WordPos | "all")}
            >
              <option value="all">All Word Types</option>
              {POS_OPTIONS.map((pos) => (
                <option key={pos} value={pos}>
                  {POS_LABELS[pos]}
                </option>
              ))}
            </select>
            <label htmlFor="sort-filter" className="sr-only">
              Sort word list
            </label>
            <select
              id="sort-filter"
              className="text-input text-input-idle"
              value={sortBy}
              onChange={(event) => onSortByChange(event.target.value as WordListSort)}
            >
              <option value="fi">Sort: Finnish A-Z</option>
              <option value="en">Sort: English A-Z</option>
              <option value="topic">Sort: Topic</option>
              <option value="recent">Sort: Recently reviewed</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-1 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <p>
          Showing {filteredWords.length} of {totalWords} words
        </p>
        <p>{viewMode === "due-next" ? "Due next ranks weak or stale items first." : "Use search, topic, and sorting to narrow the set."}</p>
      </div>

      {filteredWords.length === 0 && (
        <div className="feedback-panel feedback-panel-warning mt-5 rounded-3xl p-4">
          <p className="text-sm font-semibold text-ink">{viewMode === "due-next" ? "Nothing is due right now." : "No words match this view."}</p>
          <p className="mt-1 text-sm text-slate-700">
            {viewMode === "due-next"
              ? "Switch back to the full list or clear the current filters to browse every word."
              : "Try a broader search or clear the current filters."}
          </p>
          {showEmptyStateAction && (
            <button type="button" className="action-secondary mt-3 w-full rounded-full px-4 py-2 text-sm font-semibold sm:w-auto" onClick={resetEmptyState}>
              {emptyStateActionLabel}
            </button>
          )}
        </div>
      )}

      {filteredWords.length > 0 && (
        <div className="mt-5 space-y-3 md:hidden">
          <div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            <p>
              Showing {visibleMobileWords.length} of {filteredWords.length}
            </p>
            {filteredWords.length > visibleMobileWords.length && <p>More below</p>}
          </div>

          {visibleMobileWords.map((word) => {
            const known = progressMap[word.id]?.known ?? false;
            const needsPractice = progressMap[word.id]?.needsPractice ?? false;
            const statusMeta = getWordStatusMeta(known, needsPractice);
            const detailsOpen = Boolean(expandedWordIds[word.id]);
            const detailId = `word-mobile-clue-${word.id}`;

            return (
              <article key={`mobile-word-${word.id}`} className="surface-subtle rounded-[22px] px-3.5 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-semibold text-ink" lang="fi">
                          {word.fi}
                        </h3>
                        <p className="mt-0.5 truncate text-sm font-semibold text-accent">{word.en}</p>
                      </div>
                      <span className={`state-pill shrink-0 ${statusMeta.className}`}>{statusMeta.label}</span>
                    </div>
                    <p className="mt-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {TOPIC_LABELS[word.topic]} / {POS_LABELS[word.pos]}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
                    aria-expanded={detailsOpen}
                    aria-controls={detailId}
                    onClick={() => toggleWordDetails(word.id)}
                  >
                    {detailsOpen ? "Hide clue" : "Show clue"}
                  </button>
                  <span className="text-xs text-slate-500">Tap to inspect before marking</span>
                </div>

                {detailsOpen && (
                  <div id={detailId} className="mt-2 rounded-[18px] border border-slate-200 bg-white px-3.5 py-3">
                    <p className="text-sm text-slate-700" lang="fi">
                      {word.fiSimple}
                    </p>
                  </div>
                )}

                <WordStatusActions
                  word={word}
                  known={known}
                  needsPractice={needsPractice}
                  layout="mobile-list"
                  onSetStatus={onSetWordStatus}
                />
              </article>
            );
          })}

          {filteredWords.length > visibleMobileWords.length && (
            <button
              type="button"
              className="action-secondary w-full rounded-full px-5 py-3 text-sm font-semibold"
              onClick={() => setMobileVisibleCount((current) => Math.min(current + MOBILE_BATCH_SIZE, filteredWords.length))}
            >
              Show {Math.min(MOBILE_BATCH_SIZE, filteredWords.length - visibleMobileWords.length)} More Words
            </button>
          )}
        </div>
      )}

      {filteredWords.length > 0 && (
        <div className="mt-5 hidden max-h-[64vh] overflow-auto rounded-[28px] border border-slate-200 bg-white md:block">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="sticky top-0 bg-slate-100/95 text-xs uppercase tracking-[0.18em] text-slate-600 backdrop-blur">
              <tr>
                <th className="px-4 py-3">Finnish</th>
                <th className="px-4 py-3">English</th>
                <th className="px-4 py-3">Easy Finnish clue</th>
                <th className="px-4 py-3">Topic</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredWords.map((word) => {
                const known = progressMap[word.id]?.known ?? false;
                const needsPractice = progressMap[word.id]?.needsPractice ?? false;

                return (
                  <tr key={word.id} className="border-t border-slate-200 align-top transition-colors hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-semibold text-ink" lang="fi">
                      {word.fi}
                    </td>
                    <td className="px-4 py-3 text-slate-800">{word.en}</td>
                    <td className="px-4 py-3 text-slate-700" lang="fi">
                      {word.fiSimple}
                    </td>
                    <td className="px-4 py-3 text-xs uppercase tracking-wide text-slate-600">{TOPIC_LABELS[word.topic]}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <span className="state-pill state-pill-neutral">{POS_LABELS[word.pos]}</span>
                        {known && <span className="state-pill state-pill-success">Known</span>}
                        {needsPractice && <span className="state-pill state-pill-warn">Practice</span>}
                        {!known && !needsPractice && <span className="state-pill state-pill-neutral">New</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <WordStatusActions
                        word={word}
                        known={known}
                        needsPractice={needsPractice}
                        onSetStatus={onSetWordStatus}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
