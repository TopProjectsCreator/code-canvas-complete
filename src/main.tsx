import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// PWA: prevent service worker from interfering in iframe / preview contexts
const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();
const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

const previewCacheResetKey = "lovable-preview-cache-reset";

if (isPreviewHost || isInIframe) {
  void navigator.serviceWorker?.getRegistrations().then(async (regs) => {
    const hadRegistrations = regs.length > 0;

    await Promise.all(regs.map((registration) => registration.unregister()));

    if ("caches" in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((key) => caches.delete(key)));
    }

    if (hadRegistrations && !window.sessionStorage.getItem(previewCacheResetKey)) {
      window.sessionStorage.setItem(previewCacheResetKey, "1");
      window.location.reload();
      return;
    }

    window.sessionStorage.removeItem(previewCacheResetKey);
  });
} else {
  if ("serviceWorker" in navigator) {
    void navigator.serviceWorker.register("/sw.js");
  }
}

createRoot(document.getElementById("root")!).render(<App />);
