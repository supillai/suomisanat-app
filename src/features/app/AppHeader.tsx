import { useRef } from "react";
import type { KeyboardEvent } from "react";
import { TAB_CONFIG, tabButtonId, tabPanelId } from "./app.constants";
import type { Tab } from "./app.types";

type AppHeaderProps = {
  tab: Tab;
  totalWords: number;
  knownCount: number;
  reviewedToday: number;
  syncBadgeLabel: string;
  syncBadgeClass: string;
  onTabChange: (tab: Tab) => void;
  onOpenCloudSync: () => void;
};

export const AppHeader = ({
  tab,
  totalWords,
  knownCount,
  reviewedToday,
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
    <header className="hero-panel app-hero mb-4 rounded-[30px] px-4 pt-4 pb-3.5 md:rounded-[32px] md:px-6 md:py-5">
      <div className="flex flex-col gap-3.5 md:gap-4">
        <div className="hero-top flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="hero-copy space-y-2">
            <p className="eyebrow hidden text-white/80 md:block">Finnish YKI vocabulary trainer</p>
            <div className="flex items-start justify-between gap-3 md:block">
              <div className="space-y-1.5">
                <h1 className="text-[2rem] font-semibold tracking-tight text-white md:text-4xl">SuomiSanat</h1>
                <p className="max-w-xl text-sm leading-5 text-white/82 md:hidden">YKI level 3 vocabulary trainer</p>
              </div>
              <button
                type="button"
                aria-label={`Sync: ${syncBadgeLabel}`}
                className={`inline-flex max-w-[11rem] items-center rounded-full border px-3.5 py-2 text-xs font-semibold leading-tight md:hidden ${syncBadgeClass}`}
                onClick={onOpenCloudSync}
              >
                Sync: {syncBadgeLabel}
              </button>
            </div>
            <div className="flex flex-wrap gap-2 md:hidden">
              <div className="inline-flex rounded-full bg-white/12 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/18">
                Known {knownCount}/{totalWords}
              </div>
              <div className="inline-flex rounded-full bg-white/12 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/18">
                Today {reviewedToday}
              </div>
            </div>
            <p className="hero-summary hidden max-w-2xl text-sm leading-6 text-white/85 md:block md:text-base">
              Finnish study vocabulary for YKI level 3, with plain-English meanings, easy Finnish clues, offline study, and optional cloud sync.
            </p>
          </div>

          <div className="hero-badges hidden shrink-0 flex-wrap items-center gap-2 md:flex">
            <button type="button" className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold ${syncBadgeClass}`} onClick={onOpenCloudSync}>
              Sync: {syncBadgeLabel}
            </button>
            <div className="inline-flex rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/20">
              Known: {knownCount}/{totalWords}
            </div>
          </div>
        </div>

        <nav className="hero-nav mobile-tab-bar grid grid-cols-4 gap-2 md:grid-cols-4" role="tablist" aria-label="Main sections">
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
              aria-label={item.label}
              className={`nav-tab ${tab === item.id ? "nav-tab-active" : "nav-tab-idle"}`}
              onClick={() => onTabChange(item.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
            >
              <span className="md:hidden">{item.id === "list" ? "Words" : item.label}</span>
              <span className="hidden md:inline">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
};
