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
  return (
    <section
      id={tabPanelId("list")}
      role="tabpanel"
      aria-labelledby={tabButtonId("list")}
      className="surface-card rounded-[28px] px-5 py-6 md:px-8 md:py-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Word list</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">Browse, sort, and queue your next review set</h2>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Word list view">
          <button
            type="button"
            className={`chip-button ${viewMode === "all" ? "chip-button-active" : "chip-button-idle"}`}
            onClick={() => onViewModeChange("all")}
          >
            All Words
          </button>
          <button
            type="button"
            className={`chip-button ${viewMode === "due-next" ? "chip-button-active" : "chip-button-idle"}`}
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

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-700">
        <p>
          Showing {filteredWords.length} of {totalWords} words
        </p>
        <p>{viewMode === "due-next" ? "Due next ranks weak or stale items first." : "Use search, topic, and sorting to narrow the set."}</p>
      </div>

      {filteredWords.length === 0 && (
        <div className="feedback-panel feedback-panel-warning mt-5 rounded-3xl p-4">
          <p className="text-sm font-semibold text-ink">No words match this view.</p>
          <p className="mt-1 text-sm text-slate-700">Try broadening the search or switch back to the full list.</p>
        </div>
      )}

      <div className="mt-5 space-y-3 md:hidden">
        {filteredWords.map((word) => {
          const known = progressMap[word.id]?.known ?? false;
          const needsPractice = progressMap[word.id]?.needsPractice ?? false;

          return (
            <article key={`mobile-word-${word.id}`} className="surface-subtle rounded-[24px] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-ink" lang="fi">
                    {word.fi}
                  </h3>
                  <p className="text-sm font-semibold text-accent">{word.en}</p>
                </div>
                <span className="state-pill state-pill-neutral">{TOPIC_LABELS[word.topic]}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="state-pill state-pill-neutral">{POS_LABELS[word.pos]}</span>
                {known && <span className="state-pill state-pill-success">Known</span>}
                {needsPractice && <span className="state-pill state-pill-warn">Practice</span>}
              </div>
              <p className="mt-3 text-sm text-slate-700" lang="fi">
                {word.fiSimple}
              </p>
              <WordStatusActions
                word={word}
                known={known}
                needsPractice={needsPractice}
                compact
                onSetStatus={onSetWordStatus}
              />
            </article>
          );
        })}
      </div>

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
    </section>
  );
};
