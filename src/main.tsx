import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import { isPreviewLikeHostname } from "@/lib/platform";
import "./index.css";

// PWA: prevent service worker from interfering in iframe / preview contexts
const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();
const isPreviewHost = isPreviewLikeHostname(window.location.hostname);

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
    void (async () => {
      try {
        const swHead = await fetch("/sw.js", { method: "HEAD" });
        const contentType = swHead.headers.get("content-type") ?? "";

        if (!swHead.ok || !contentType.toLowerCase().includes("javascript")) {
          return;
        }

        await navigator.serviceWorker.register("/sw.js");
      } catch {
        // Ignore service worker registration failures so app boot is unaffected.
      }
    })();
  }
}

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
