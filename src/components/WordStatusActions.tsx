import type { VocabularyWord } from "../types";
import type { WordStatus } from "../features/progress/useProgressStore";

type WordStatusActionsProps = {
  word: VocabularyWord;
  known: boolean;
  needsPractice: boolean;
  compact?: boolean;
  onSetStatus: (word: VocabularyWord, status: WordStatus) => void;
};

export const WordStatusActions = ({
  word,
  known,
  needsPractice,
  compact = false,
  onSetStatus
}: WordStatusActionsProps) => {
  const baseClass = compact ? "rounded-lg px-3 py-2 text-xs font-semibold" : "rounded-md px-2.5 py-1.5 text-xs font-semibold";

  return (
    <div className={`flex flex-wrap gap-2 ${compact ? "mt-3" : ""}`}>
      <button
        type="button"
        className={`${baseClass} ${
          known ? "bg-emerald-600 text-white" : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
        }`}
        onClick={() => onSetStatus(word, "known")}
        aria-pressed={known}
      >
        Known
      </button>
      <button
        type="button"
        className={`${baseClass} ${
          needsPractice ? "bg-amber-500 text-white" : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
        }`}
        onClick={() => onSetStatus(word, "practice")}
        aria-pressed={needsPractice}
      >
        Needs Practice
      </button>
      {(known || needsPractice) && (
        <button
          type="button"
          className={`${baseClass} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}
          onClick={() => onSetStatus(word, "clear")}
        >
          Clear
        </button>
      )}
    </div>
  );
};
