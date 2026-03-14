import { WordStatusActions } from "../../components/WordStatusActions";
import { POS_LABELS, POS_OPTIONS, TOPIC_LABELS, TOPICS, tabButtonId, tabPanelId } from "../app/app.constants";
import type { ProgressMap, VocabularyWord, WordPos, WordTopic } from "../../types";
import type { WordStatus } from "../progress/useProgressStore";

type WordListTabProps = {
  filteredWords: VocabularyWord[];
  totalWords: number;
  searchValue: string;
  topicFilter: WordTopic | "all";
  posFilter: WordPos | "all";
  progressMap: ProgressMap;
  onSearchChange: (value: string) => void;
  onTopicFilterChange: (value: WordTopic | "all") => void;
  onPosFilterChange: (value: WordPos | "all") => void;
  onSetWordStatus: (word: VocabularyWord, status: WordStatus) => void;
};

export const WordListTab = ({
  filteredWords,
  totalWords,
  searchValue,
  topicFilter,
  posFilter,
  progressMap,
  onSearchChange,
  onTopicFilterChange,
  onPosFilterChange,
  onSetWordStatus
}: WordListTabProps) => {
  return (
    <section
      id={tabPanelId("list")}
      role="tabpanel"
      aria-labelledby={tabButtonId("list")}
      className="glass card-shadow rounded-3xl p-5 md:p-8"
    >
      <div className="grid gap-3 md:grid-cols-4">
        <label htmlFor="word-search" className="sr-only">
          Search words
        </label>
        <input
          id="word-search"
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-accent focus:outline-none md:col-span-2"
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
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-accent focus:outline-none"
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
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-accent focus:outline-none"
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
      </div>

      <p className="mt-3 text-xs text-slate-700">
        Showing {filteredWords.length} of {totalWords} words
      </p>

      <div className="mt-4 space-y-3 md:hidden">
        {filteredWords.map((word) => (
          <article key={`mobile-word-${word.id}`} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-ink">{word.fi}</h3>
                <p className="text-sm font-semibold text-accent">{word.en}</p>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                {TOPIC_LABELS[word.topic]}
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-700">{word.fiSimple}</p>
            <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">{POS_LABELS[word.pos]}</p>
            <WordStatusActions
              word={word}
              known={progressMap[word.id]?.known ?? false}
              needsPractice={progressMap[word.id]?.needsPractice ?? false}
              compact
              onSetStatus={onSetWordStatus}
            />
          </article>
        ))}
      </div>

      <div className="mt-4 hidden max-h-[60vh] overflow-auto rounded-2xl border border-slate-300 bg-white md:block">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="sticky top-0 bg-slate-100 text-xs uppercase tracking-wide text-slate-700">
            <tr>
              <th className="px-3 py-2">Finnish</th>
              <th className="px-3 py-2">English</th>
              <th className="px-3 py-2">Easy Finnish clue</th>
              <th className="px-3 py-2">Topic</th>
              <th className="px-3 py-2">Known</th>
              <th className="px-3 py-2">Needs Practice</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredWords.map((word) => (
              <tr key={word.id} className="border-t border-slate-200 align-top">
                <td className="px-3 py-2 font-semibold text-ink">{word.fi}</td>
                <td className="px-3 py-2 text-slate-800">{word.en}</td>
                <td className="px-3 py-2 text-slate-700">{word.fiSimple}</td>
                <td className="px-3 py-2 text-xs uppercase tracking-wide text-slate-600">{TOPIC_LABELS[word.topic]}</td>
                <td className="px-3 py-2 text-slate-800">{progressMap[word.id]?.known ? "yes" : "no"}</td>
                <td className="px-3 py-2 text-slate-800">{progressMap[word.id]?.needsPractice ? "yes" : "no"}</td>
                <td className="px-3 py-2">
                  <WordStatusActions
                    word={word}
                    known={progressMap[word.id]?.known ?? false}
                    needsPractice={progressMap[word.id]?.needsPractice ?? false}
                    onSetStatus={onSetWordStatus}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
