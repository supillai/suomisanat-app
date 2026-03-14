import { useRef } from "react";
import type { KeyboardEvent } from "react";
import { TAB_CONFIG, tabButtonId, tabPanelId } from "./app.constants";
import type { Tab } from "./app.types";

type AppHeaderProps = {
  tab: Tab;
  totalWords: number;
  knownCount: number;
  syncBadgeLabel: string;
  syncBadgeClass: string;
  onTabChange: (tab: Tab) => void;
  onOpenCloudSync: () => void;
};

export const AppHeader = ({
  tab,
  totalWords,
  knownCount,
  syncBadgeLabel,
  syncBadgeClass,
  onTabChange,
  onOpenCloudSync
}: AppHeaderProps) => {
  const tabButtonRefs = useRef<Record<Tab, HTMLButtonElement | null>>({
    study: null,
    quiz: null,
    list: null,
    progress: null
  });

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number): void => {
    let nextIndex = currentIndex;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % TAB_CONFIG.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + TAB_CONFIG.length) % TAB_CONFIG.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = TAB_CONFIG.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const nextTab = TAB_CONFIG[nextIndex].id;
    onTabChange(nextTab);
    tabButtonRefs.current[nextTab]?.focus();
  };

  return (
    <header className="glass card-shadow mb-4 rounded-3xl p-4 md:p-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-extrabold tracking-tight text-ink md:text-3xl">SuomiSanat</h1>
            <p className="max-w-2xl text-xs text-slate-700 md:text-sm">
              {totalWords} Finnish must-have words for YKI intermediate (grade 3), with English meaning and an easy Finnish clue.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              className={`inline-flex items-center rounded-2xl border px-3 py-2 text-xs font-semibold ${syncBadgeClass}`}
              onClick={onOpenCloudSync}
            >
              Sync: {syncBadgeLabel}
            </button>
            <div className="sun-gradient inline-flex rounded-2xl px-3 py-2 text-xs font-semibold text-ink">
              Known: {knownCount}/{totalWords}
            </div>
          </div>
        </div>
      </div>

      <nav className="mt-4 grid gap-2 sm:grid-cols-2 md:grid-cols-4" role="tablist" aria-label="Main sections">
        {TAB_CONFIG.map((item, index) => (
          <button
            key={item.id}
            id={tabButtonId(item.id)}
            ref={(node) => {
              tabButtonRefs.current[item.id] = node;
            }}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            aria-controls={tabPanelId(item.id)}
            tabIndex={tab === item.id ? 0 : -1}
            className={`rounded-xl border px-3 py-1.5 text-sm font-semibold ${
              tab === item.id ? "accent-gradient border-transparent text-white" : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
            }`}
            onClick={() => onTabChange(item.id)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </header>
  );
};
