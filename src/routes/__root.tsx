import * as React from "react";
import { Suspense, useEffect } from "react";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import {
  ClientOnly,
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouter,
} from "@tanstack/react-router";
import { HelmetProvider } from "react-helmet-async";
import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { OnboardingProvider } from "@/contexts/OnboardingContext";
import { DiscordProvider } from "@/contexts/DiscordContext";
import NotFound from "@/pages/NotFound";
import { reportLovableError } from "@/lib/lovable-error-reporting";

// Browser-heavy side-effect mounts: lazy + ClientOnly so their module graphs
// never evaluate during SSR.
const OnboardingManager = React.lazy(() =>
  import("@/components/onboarding/OnboardingManager").then((m) => ({ default: m.OnboardingManager })),
);
const PresenceTrackerMount = React.lazy(() =>
  import("@/components/PresenceTrackerMount").then((m) => ({ default: m.PresenceTrackerMount })),
);
const OfflineDialog = React.lazy(() =>
  import("@/components/ide/OfflineDialog").then((m) => ({ default: m.OfflineDialog })),
);
const InboxNotifier = React.lazy(() =>
  import("@/components/ide/InboxNotifier").then((m) => ({ default: m.InboxNotifier })),
);

const SITE_TITLE = "Code Canvas — Collaborative AI IDE and Workspace";
const SITE_DESCRIPTION =
  "Code Canvas is an open-source, browser-based AI IDE with code editor, terminal, live preview, robotics flashing, Office editors, and an agentic assistant.";
const OG_IMAGE =
  "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/78128b37-f79e-4f65-9615-6f6e2367116a?Expires=1771219273&GoogleAccessId=go-api-on-aws%40gpt-engineer-390607.iam.gserviceaccount.com&Signature=li65DlbFs0hc4UHL6bKFd03fFRp7NEI7hBC7cvWMNAtu5CvDk6U3NSMMv%2BaAfQu%2BWH09r0VocFn%2Bs%2BCIaxlP1KnBa2%2Bs3iEk%2F0jXMTnW0ebpcEbh%2BwqT8kxeGeidIULwjhvbwkC7F3gCTd9l15XDaj2G9ApEeCwrFjdYOxoWZ5eF92WbptDS9AWWSQQZVfSFQ%2FT7daTBqS7VRgopu1vDy0QuvNnKDkWtVZZMQ%2BltMRTeEIfBCABdXIoAzqVo0ocj97ACJHin%2BpmKUAY1hPHT6%2FNu4MTSg1xTmSEQrEOm53X5%2B0IMhfque2M8mFEZWjpjV%2BxxBD4HS7guRrUTtwe83Q%3D%3D";

// ported from index.html — GitHub Pages SPA redirect restore (must run pre-router)
const GH_PAGES_REDIRECT_SCRIPT =
  'try{var r=sessionStorage.getItem("gh-pages-redirect");if(r){sessionStorage.removeItem("gh-pages-redirect");history.replaceState(null,"",r);}}catch(e){}';

const ORG_JSONLD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Code Canvas",
  url: "https://replitclone.lovable.app/",
  logo: "https://replitclone.lovable.app/favicon.svg",
  description:
    "Open-source, browser-based AI IDE with code editor, terminal, live preview, robotics flashing, Office editors, automations, and an agentic assistant.",
});

const WEBSITE_JSONLD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Code Canvas",
  url: "https://replitclone.lovable.app/",
  potentialAction: {
    "@type": "SearchAction",
    target: "https://replitclone.lovable.app/?q={search_term_string}",
    "query-input": "required name=search_term_string",
  },
});

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes, viewport-fit=cover",
      },
      { title: SITE_TITLE },
      { name: "description", content: SITE_DESCRIPTION },
      { name: "author", content: "IDE" },
      { name: "theme-color", content: "#0f1419" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: SITE_TITLE },
      { property: "og:description", content: SITE_DESCRIPTION },
      { property: "og:url", content: "https://replitclone.lovable.app/" },
      { property: "og:image", content: OG_IMAGE },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@IDE" },
      { name: "twitter:title", content: SITE_TITLE },
      { name: "twitter:description", content: SITE_DESCRIPTION },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "preconnect", href: "https://xlmvlplazxrouscupidi.supabase.co", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap",
      },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/pwa-192x192.png" },
    ],
    scripts: [
      { children: GH_PAGES_REDIRECT_SCRIPT },
      { type: "application/ld+json", children: ORG_JSONLD },
      { type: "application/ld+json", children: WEBSITE_JSONLD },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: () => <NotFound />,
  errorComponent: RootErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // ported from main.tsx — aggressive SW/cache purge on preview hosts & iframes
  // (intentional behaviour, see project memory: pwa-preview-environment-management).
  // Production SW registration is NOT ported: the kill-switch at /sw.js reaches
  // returning users via the browser's automatic SW update polling.
  useEffect(() => {
    const isInIframe = (() => {
      try {
        return window.self !== window.top;
      } catch {
        return true;
      }
    })();
    const isPreviewHost =
      window.location.hostname.includes("id-preview--") ||
      window.location.hostname.includes("lovableproject.com");
    const previewCacheResetKey = "lovable-preview-cache-reset";

    if (!isPreviewHost && !isInIframe) return;
    void navigator.serviceWorker
      ?.getRegistrations()
      .then(async (regs) => {
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
      })
      .catch((err) => {
        console.warn("Failed to unregister service workers:", err);
      });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <AuthProvider>
          <ThemeProvider>
            <OnboardingProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <ClientOnly fallback={null}>
                  <Suspense fallback={null}>
                    <OfflineDialog />
                    <InboxNotifier />
                    <OnboardingManager />
                    <PresenceTrackerMount />
                  </Suspense>
                </ClientOnly>
                <DiscordProvider>
                  <Outlet />
                </DiscordProvider>
              </TooltipProvider>
            </OnboardingProvider>
          </ThemeProvider>
        </AuthProvider>
      </HelmetProvider>
    </QueryClientProvider>
  );
}

function RootErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();

  console.error(error);
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-2xl font-semibold">This page didn't load</h1>
        <p className="text-sm text-muted-foreground">
          Something went wrong while rendering this page. You can retry, or head back home.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            onClick={() => {
              void router.invalidate();
              reset();
            }}
          >
            Try again
          </button>
          <a
            href="/"
            className="px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-accent transition-colors"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}
