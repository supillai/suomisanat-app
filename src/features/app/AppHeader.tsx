import { useEffect, useRef } from "react";
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
  isCloudSyncOpen: boolean;
  onTabChange: (tab: Tab) => void;
  onOpenCloudSync: () => void;
};

const getMobileSyncBadgeLabel = (label: string): string => {
  switch (label) {
    case "Local only":
      return "Local";
    case "Signed out":
      return "Offline";
    case "Action needed":
      return "Review";
    case "Up to date":
      return "Synced";
    case "Idle":
      return "Ready";
    default:
      return label;
  }
};

export const AppHeader = ({
  tab,
  totalWords,
  knownCount,
  reviewedToday,
  syncBadgeLabel,
  syncBadgeClass,
  isCloudSyncOpen,
  onTabChange,
  onOpenCloudSync
}: AppHeaderProps) => {
  const headerRef = useRef<HTMLElement | null>(null);
  const tabButtonRefs = useRef<Record<Tab, HTMLButtonElement | null>>({
    study: null,
    quiz: null,
    list: null,
    progress: null
  });
  const mobileTabBarRef = useRef<HTMLElement | null>(null);
  const mobileSyncBadgeLabel = getMobileSyncBadgeLabel(syncBadgeLabel);
  const isStudyFocus = tab === "study";

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    const header = headerRef.current;
    if (!header) {
      return;
    }

    const mobileTabBar = mobileTabBarRef.current;
    const rootStyle = document.documentElement.style;
    let frameId = 0;

    const updateLayoutMetrics = () => {
      const headerBounds = header.getBoundingClientRect();
      rootStyle.setProperty("--app-header-height", `${Math.max(0, Math.round(headerBounds.height))}px`);

      if (window.innerWidth >= 768 || !mobileTabBar) {
        rootStyle.removeProperty("--mobile-tab-bar-clearance");
        return;
      }

      const mobileTabBarBounds = mobileTabBar.getBoundingClientRect();
      const clearance = Math.max(0, Math.round(window.innerHeight - mobileTabBarBounds.top));
      rootStyle.setProperty("--mobile-tab-bar-clearance", `${clearance}px`);
    };

    const scheduleUpdate = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateLayoutMetrics);
    };

    scheduleUpdate();

    const resizeObserver = "ResizeObserver" in window ? new ResizeObserver(scheduleUpdate) : null;
    resizeObserver?.observe(header);
    if (mobileTabBar) {
      resizeObserver?.observe(mobileTabBar);
    }

    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("orientationchange", scheduleUpdate);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("orientationchange", scheduleUpdate);
      rootStyle.removeProperty("--app-header-height");
      rootStyle.removeProperty("--mobile-tab-bar-clearance");
    };
  }, [tab]);

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
    <header
      ref={headerRef}
      className={
        isStudyFocus
          ? "hero-panel app-hero app-hero-compact mb-3 rounded-[28px] px-4 py-3 md:mb-3 md:rounded-[30px] md:px-6 md:py-4"
          : "hero-panel app-hero mb-4 rounded-[30px] px-4 pt-4 pb-3.5 md:rounded-[32px] md:px-6 md:py-5"
      }
    >
      <div className={`flex flex-col ${isStudyFocus ? "gap-2.5 md:gap-3" : "gap-3.5 md:gap-4"}`}>
        <div className={`hero-top flex flex-col ${isStudyFocus ? "gap-2.5 md:gap-3" : "gap-3"} md:flex-row md:items-start md:justify-between`}>
          <div className="hero-copy space-y-2">
            {!isStudyFocus && <p className="eyebrow hidden text-white/80 md:block">Finnish YKI vocabulary trainer</p>}
            <div className="flex items-start justify-between gap-3 md:block">
              <div className="space-y-1.5">
                <h1 className={isStudyFocus ? "text-[1.85rem] font-semibold tracking-tight text-white md:text-[3rem]" : "text-[2rem] font-semibold tracking-tight text-white md:text-4xl"}>SuomiSanat</h1>
                {!isStudyFocus && <p className="max-w-xl text-sm leading-5 text-white/82 md:hidden">YKI level 3 vocabulary trainer</p>}
              </div>
              <button
                type="button"
                aria-label={`Sync: ${syncBadgeLabel}`}
                aria-controls="cloud-sync-panel"
                aria-expanded={isCloudSyncOpen}
                className={`inline-flex h-10 ${isStudyFocus ? "w-[7rem]" : "w-[7.75rem]"} shrink-0 items-center justify-center overflow-hidden rounded-full border px-3.5 py-2 text-xs font-semibold leading-none md:hidden ${syncBadgeClass}`}
                onClick={onOpenCloudSync}
              >
                <span className="truncate">Sync: {mobileSyncBadgeLabel}</span>
              </button>
            </div>
            {!isStudyFocus && (
              <div className="flex flex-wrap gap-2 md:hidden">
                <div className="inline-flex rounded-full bg-white/12 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/18">
                  Known {knownCount}/{totalWords}
                </div>
                <div className="inline-flex rounded-full bg-white/12 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/18">
                  Today {reviewedToday}
                </div>
              </div>
            )}
            {!isStudyFocus && (
              <p className="hero-summary hidden max-w-2xl text-sm leading-6 text-white/85 md:block md:text-base">
                Finnish study vocabulary for YKI level 3, with plain-English meanings, easy Finnish clues, offline study, and optional cloud sync.
              </p>
            )}
          </div>

          <div className={`hero-badges hidden shrink-0 flex-wrap items-center ${isStudyFocus ? "gap-1.5" : "gap-2"} md:flex`}>
            <button
              type="button"
              aria-label={`Sync: ${syncBadgeLabel}`}
              aria-controls="cloud-sync-panel"
              aria-expanded={isCloudSyncOpen}
              className={`inline-flex items-center rounded-full border ${isStudyFocus ? "px-3.5 py-1.5 text-xs" : "px-4 py-2 text-sm"} font-semibold ${syncBadgeClass}`}
              onClick={onOpenCloudSync}
            >
              Sync: {syncBadgeLabel}
            </button>
            <div className={`inline-flex rounded-full bg-white/15 ${isStudyFocus ? "px-3.5 py-1.5 text-xs" : "px-4 py-2 text-sm"} font-semibold text-white ring-1 ring-white/20`}>
              Known: {knownCount}/{totalWords}
            </div>
          </div>
        </div>

        <nav
          ref={mobileTabBarRef}
          className="hero-nav mobile-tab-bar grid grid-cols-4 gap-2 md:grid-cols-4"
          role="tablist"
          aria-label="Main sections"
        >
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