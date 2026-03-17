import { useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";
import { TAB_CONFIG, tabButtonId, tabPanelId } from "./app.constants";
import type { Tab } from "./app.types";

type AppHeaderProps = {
  tab: Tab;
  syncBadgeLabel: string;
  onTabChange: (tab: Tab) => void;
};

type SyncIndicator = {
  toneClassName: string;
  label: string;
};

const getProgressSyncIndicator = (label: string): SyncIndicator | null => {
  switch (label) {
    case "Action needed":
      return { toneClassName: "nav-tab-indicator-alert", label: "Sync needs attention" };
    case "Error":
      return { toneClassName: "nav-tab-indicator-error", label: "Sync error" };
    case "Saving":
    case "Loading":
      return { toneClassName: "nav-tab-indicator-active", label: "Sync in progress" };
    case "Local only":
      return { toneClassName: "nav-tab-indicator-muted", label: "Sync unavailable" };
    case "Signed out":
      return { toneClassName: "nav-tab-indicator-muted", label: "Sync signed out" };
    default:
      return null;
  }
};

export const AppHeader = ({ tab, syncBadgeLabel, onTabChange }: AppHeaderProps) => {
  const headerRef = useRef<HTMLElement | null>(null);
  const tabButtonRefs = useRef<Record<Tab, HTMLButtonElement | null>>({
    study: null,
    quiz: null,
    list: null,
    progress: null
  });
  const mobileTabBarRef = useRef<HTMLElement | null>(null);
  const isStudyFocus = tab === "study";
  const progressSyncIndicator = getProgressSyncIndicator(syncBadgeLabel);

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
          ? "hero-panel app-hero app-hero-compact mb-3 rounded-[28px] px-4 py-3 md:mb-2 md:rounded-[28px] md:px-5 md:py-3.5"
          : "hero-panel app-hero mb-3 rounded-[28px] px-4 py-3.5 md:mb-3 md:rounded-[30px] md:px-6 md:py-4"
      }
    >
      <div className={`flex flex-col ${isStudyFocus ? "gap-2.5 md:gap-3" : "gap-3 md:gap-3.5"}`}>
        <div className={`hero-top flex flex-col ${isStudyFocus ? "gap-1.5 md:gap-2" : "gap-2 md:gap-2.5"}`}>
          <div className="hero-copy space-y-1">
            {!isStudyFocus && <p className="eyebrow hidden text-white/80 md:block">Finnish YKI vocabulary trainer</p>}
            <h1 className={isStudyFocus ? "text-[1.85rem] font-semibold tracking-tight text-white md:text-[2.45rem]" : "text-[2rem] font-semibold tracking-tight text-white md:text-[3.15rem]"}>
              SuomiSanat
            </h1>
            {!isStudyFocus && (
              <>
                <p className="max-w-xl text-sm leading-5 text-white/82 md:hidden">Study Finnish vocabulary without leaving the main workspace.</p>
                <p className="hero-summary hidden max-w-2xl text-sm leading-6 text-white/84 md:block">
                  Study, quiz, browse, and manage cloud sync from a single compact workspace.
                </p>
              </>
            )}
          </div>
        </div>

        <nav
          ref={mobileTabBarRef}
          className="hero-nav mobile-tab-bar grid grid-cols-4 gap-2 md:grid-cols-4"
          role="tablist"
          aria-label="Main sections"
        >
          {TAB_CONFIG.map((item, index) => {
            const syncDescription = item.id === "progress" ? progressSyncIndicator?.label : undefined;

            return (
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
                aria-description={syncDescription}
                tabIndex={tab === item.id ? 0 : -1}
                aria-label={item.label}
                title={syncDescription}
                className={`nav-tab ${tab === item.id ? "nav-tab-active" : "nav-tab-idle"}`}
                onClick={() => onTabChange(item.id)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
              >
                <span className="md:hidden">{item.id === "list" ? "Words" : item.label}</span>
                <span className="hidden md:inline">{item.label}</span>
                {item.id === "progress" && progressSyncIndicator && (
                  <span className={`nav-tab-indicator ${progressSyncIndicator.toneClassName}`} data-sync-indicator="true" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
