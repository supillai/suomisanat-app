export const registerServiceWorker = (): void => {
  if (!import.meta.env.PROD || import.meta.env.MODE === "e2e" || !("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js");
  });
};
