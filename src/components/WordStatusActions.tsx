import type { VocabularyWord } from "../types";
import type { WordStatus } from "../features/progress/useProgressStore";

type WordStatusActionLayout = "default" | "mobile-list";

type WordStatusActionsProps = {
  word: VocabularyWord;
  known: boolean;
  needsPractice: boolean;
  compact?: boolean;
  layout?: WordStatusActionLayout;
  onSetStatus: (word: VocabularyWord, status: WordStatus) => void;
};

export const WordStatusActions = ({
  word,
  known,
  needsPractice,
  compact = false,
  layout = "default",
  onSetStatus
}: WordStatusActionsProps) => {
  if (layout === "mobile-list") {
    return (
      <div className="mt-3 space-y-2.5">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className={`w-full rounded-full px-4 py-2.5 text-sm font-semibold ${known ? "action-success text-white" : "action-secondary text-slate-800"}`}
            onClick={() => onSetStatus(word, "known")}
            aria-pressed={known}
          >
            Known
          </button>
          <button
            type="button"
            className={`w-full rounded-full px-4 py-2.5 text-sm font-semibold ${needsPractice ? "action-warning text-white" : "action-secondary text-slate-800"}`}
            onClick={() => onSetStatus(word, "practice")}
            aria-pressed={needsPractice}
          >
            Practice
          </button>
        </div>
        {(known || needsPractice) && (
          <div className="flex justify-end">
            <button
              type="button"
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
              onClick={() => onSetStatus(word, "clear")}
            >
              Clear status
            </button>
          </div>
        )}
      </div>
    );
  }

  const baseClass = compact ? "rounded-full px-4 py-2 text-xs font-semibold" : "rounded-full px-3 py-2 text-xs font-semibold";

  return (
    <div className={`flex flex-wrap gap-2 ${compact ? "mt-3" : ""}`}>
      <button
        type="button"
        className={`${baseClass} ${known ? "action-success text-white" : "action-secondary text-slate-800"}`}
        onClick={() => onSetStatus(word, "known")}
        aria-pressed={known}
      >
        Known
      </button>
      <button
        type="button"
        className={`${baseClass} ${needsPractice ? "action-warning text-white" : "action-secondary text-slate-800"}`}
        onClick={() => onSetStatus(word, "practice")}
        aria-pressed={needsPractice}
      >
        Needs Practice
      </button>
      {(known || needsPractice) && (
        <button type="button" className={`${baseClass} action-ghost text-slate-700`} onClick={() => onSetStatus(word, "clear")}>
          Clear
        </button>
      )}
    </div>
  );
};
