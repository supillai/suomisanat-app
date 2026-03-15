import { useEffect, useState } from "react";

const COARSE_POINTER_QUERY = "(pointer: coarse)";
const FINE_POINTER_QUERIES = ["(pointer: fine)", "(any-pointer: fine)"] as const;

const supportsFinePointer = (): boolean => {
  if (typeof window === "undefined" || !("matchMedia" in window)) {
    return true;
  }

  const hasFinePointer = FINE_POINTER_QUERIES.some((query) => window.matchMedia(query).matches);
  const hasCoarseOnlyPointer = window.matchMedia(COARSE_POINTER_QUERY).matches && !hasFinePointer;

  return !hasCoarseOnlyPointer;
};

export const useFinePointer = (): boolean => {
  const [hasFinePointer, setHasFinePointer] = useState<boolean>(() => supportsFinePointer());

  useEffect(() => {
    if (typeof window === "undefined" || !("matchMedia" in window)) {
      return;
    }

    const mediaQueries = [window.matchMedia(COARSE_POINTER_QUERY), ...FINE_POINTER_QUERIES.map((query) => window.matchMedia(query))];
    const update = () => {
      setHasFinePointer(supportsFinePointer());
    };

    update();

    if (mediaQueries.every((mediaQuery) => "addEventListener" in mediaQuery)) {
      mediaQueries.forEach((mediaQuery) => mediaQuery.addEventListener("change", update));
      return () => mediaQueries.forEach((mediaQuery) => mediaQuery.removeEventListener("change", update));
    }

    const legacyMediaQueries = mediaQueries as Array<
      MediaQueryList & {
        addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
        removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
      }
    >;

    legacyMediaQueries.forEach((mediaQuery) => mediaQuery.addListener?.(update));
    return () => legacyMediaQueries.forEach((mediaQuery) => mediaQuery.removeListener?.(update));
  }, []);

  return hasFinePointer;
};
