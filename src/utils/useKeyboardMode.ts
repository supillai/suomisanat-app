import { useEffect, useState } from "react";

const isKeyboardIntent = (event: KeyboardEvent): boolean => !event.metaKey && !event.ctrlKey && !event.altKey;

export const useKeyboardMode = (): boolean => {
  const [keyboardMode, setKeyboardMode] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const enableKeyboardMode = (event: KeyboardEvent) => {
      if (isKeyboardIntent(event)) {
        setKeyboardMode(true);
      }
    };
    const disableKeyboardMode = () => {
      setKeyboardMode(false);
    };

    window.addEventListener("keydown", enableKeyboardMode, true);
    window.addEventListener("pointerdown", disableKeyboardMode, true);
    window.addEventListener("mousedown", disableKeyboardMode, true);
    window.addEventListener("touchstart", disableKeyboardMode, true);

    return () => {
      window.removeEventListener("keydown", enableKeyboardMode, true);
      window.removeEventListener("pointerdown", disableKeyboardMode, true);
      window.removeEventListener("mousedown", disableKeyboardMode, true);
      window.removeEventListener("touchstart", disableKeyboardMode, true);
    };
  }, []);

  return keyboardMode;
};
