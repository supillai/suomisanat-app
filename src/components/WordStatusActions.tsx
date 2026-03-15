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
          <div className="flex">
            <button
              type="button"
              className="action-ghost w-full rounded-full px-4 py-2 text-sm font-semibold min-[380px]:ml-auto min-[380px]:w-auto"
              onClick={() => onSetStatus(word, "clear")}
            >
              Clear status
            </button>
          </div>
        )}
      </div>
    );
  }

  const baseClass = compact
    ? "min-h-[2.75rem] rounded-full px-4 py-2.5 text-sm font-semibold"
    : "min-h-[2.75rem] rounded-full px-3.5 py-2.5 text-sm font-semibold";

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
