import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { setGithubPagesRedirectPath } from "./lib/github-pages";

// GitHub Pages SPA redirect: restore the original URL saved by 404.html
const ghRedirect = sessionStorage.getItem("gh-pages-redirect");
if (ghRedirect) {
  sessionStorage.removeItem("gh-pages-redirect");
  setGithubPagesRedirectPath(ghRedirect);
  history.replaceState(null, "", ghRedirect);
}

// PWA: prevent service worker from interfering in iframe / preview contexts
const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();
const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");
const isGitHubPages = window.location.hostname.endsWith(".github.io");

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
  }).catch((err) => {
    console.warn('Failed to unregister service workers:', err);
  });
} else if (!isGitHubPages) {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.location.reload();
    });
  }
}

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
