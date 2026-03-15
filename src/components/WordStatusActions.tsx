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
