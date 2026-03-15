const MOBILE_WIDTH_MAX = 767;
const COMPACT_MOBILE_HEIGHT_MAX = 760;
const RESIZE_WIDTH_THRESHOLD = 40;

type ViewportSnapshot = {
  width: number;
  height: number;
  landscape: boolean;
};

const MOBILE_VIEWPORT_MODE_ATTRIBUTE = "data-mobile-viewport-mode";

const getViewportSnapshot = (): ViewportSnapshot => ({
  width: window.innerWidth,
  height: window.innerHeight,
  landscape: window.innerWidth > window.innerHeight
});

const applyViewportMode = ({ width, height }: ViewportSnapshot): void => {
  const mode = width <= MOBILE_WIDTH_MAX && height <= COMPACT_MOBILE_HEIGHT_MAX ? "compact" : "regular";
  document.documentElement.setAttribute(MOBILE_VIEWPORT_MODE_ATTRIBUTE, mode);
};

export const configureViewportMode = (): void => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  let snapshot = getViewportSnapshot();
  applyViewportMode(snapshot);

  const updateViewportMode = (): void => {
    const nextSnapshot = getViewportSnapshot();
    const widthChanged = Math.abs(nextSnapshot.width - snapshot.width) >= RESIZE_WIDTH_THRESHOLD;
    const orientationChanged = nextSnapshot.landscape !== snapshot.landscape;

    // Ignore height-only viewport changes caused by mobile browser chrome collapsing or expanding.
    if (!widthChanged && !orientationChanged) {
      return;
    }

    snapshot = nextSnapshot;
    applyViewportMode(snapshot);
  };

  let frameId = 0;

  window.addEventListener("resize", () => {
    window.cancelAnimationFrame(frameId);
    frameId = window.requestAnimationFrame(updateViewportMode);
  });
};
