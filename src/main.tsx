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

if (isPreviewHost || isInIframe) {
  navigator.serviceWorker?.getRegistrations().then((regs) =>
    regs.forEach((r) => r.unregister()),
  );
}

createRoot(document.getElementById("root")!).render(<App />);
