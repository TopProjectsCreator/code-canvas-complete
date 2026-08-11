import { useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { OnboardingProvider } from "@/contexts/OnboardingContext";
import { OnboardingManager } from "@/components/onboarding/OnboardingManager";
import { DiscordProvider } from "@/contexts/DiscordContext";
import Landing from "./pages/Landing";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Docs from "./pages/Docs";
import ProfilePage from "./pages/Profile";
import PrivacyPolicyPage from "./pages/PrivacyPolicy";
import TermsOfUsePage from "./pages/TermsOfUse";
import Compare from "./pages/Compare";
import FTCPage from "./pages/FTC";
import ArduinoPage from "./pages/Arduino";
import OfficePage from "./pages/Office";
import AutomationsPage from "./pages/Automations";
import ScratchPage from "./pages/Scratch";
import CadPage from "./pages/CadPage";
import AuthBridge from "./pages/AuthBridge";
import AuthLink from "./pages/AuthLink";
import AuthLogout from "./pages/AuthLogout";
import AuthCallback from "./pages/AuthCallback";
import ExternalOAuth from "./pages/ExternalOAuth";
import OAuthConsent from "./pages/OAuthConsent";
import LinkDiscord from "./pages/LinkDiscord";
import ResetPassword from "./pages/ResetPassword";
import OAuthHostsAdmin from "./pages/admin/OAuthHosts";
import OnlineUsersAdmin from "./pages/admin/OnlineUsers";
import AdminDashboard from "./pages/admin/AdminDashboard";
import UsageAnalytics from "./pages/admin/UsageAnalytics";
import { PresenceTrackerMount } from "./components/PresenceTrackerMount";
import OAuthAppsPublic from "./pages/OAuthApps";
import MCP from "./pages/MCP";
import ThreadsLayout from "./pages/threads/ThreadsLayout";
import ThreadsList from "./pages/threads/ThreadsList";
import ThreadDetail from "./pages/threads/ThreadDetail";
import CreateThread from "./pages/threads/CreateThread";
import GlobalWhiteboard from "./pages/threads/GlobalWhiteboard";
import CardPreview from "./pages/threads/__CardPreview";
import RedactorLanding from "./pages/redactor/Landing";
import RedactorAuth from "./pages/redactor/Auth";
import RedactorDashboard from "./pages/redactor/Dashboard";
import RedactorPlayground from "./pages/redactor/Playground";
import RedactorProviderKeys from "./pages/redactor/ProviderKeys";
import RedactorProxyKeys from "./pages/redactor/ProxyKeys";
import RedactorRouters from "./pages/redactor/Routers";
import RedactorRules from "./pages/redactor/Rules";
import RedactorLogs from "./pages/redactor/Logs";
import RedactorAuthenticatedLayout from "./pages/redactor/AuthenticatedLayout";
import { LivingGrid } from "./pages/landings/LivingGrid";
import { TerminalBoot } from "./pages/landings/TerminalBoot";
import { TheVoid } from "./pages/landings/TheVoid";
import { MonochromePrecision } from "./pages/landings/MonochromePrecision";
import { WarmMomentum } from "./pages/landings/WarmMomentum";
import { TerminalVerdict } from "./pages/landings/TerminalVerdict";
import { isPublishedHost } from "./lib/publishing";
import { getGitHubPagesBasename } from "./lib/github-pages";
import { OfflineDialog } from "@/components/ide/OfflineDialog";
import { InboxNotifier } from "@/components/ide/InboxNotifier";
import { useDiscord } from "@/contexts/DiscordContext";

const queryClient = new QueryClient();

const landingVariants = [
  "/landing",
  "/landing/living-grid",
  "/landing/terminal-boot",
  "/landing/the-void",
  "/landing/monochrome",
  "/landing/warm-momentum",
  "/landing/terminal-verdict",
] as const;

const getLandingVariant = () => {
  const roll = Math.random();
  if (roll < 0.99) return "/landing";
  const otherVariants = landingVariants.slice(1);
  const idx = Math.floor(Math.random() * otherVariants.length);
  return otherVariants[idx] ?? "/landing";
};

function LandingDiscordUpdater({ children }: { children: React.ReactNode }) {
  const { updateRichPresence } = useDiscord();
  useEffect(() => {
    updateRichPresence(null, null, null, false, 'landing');
  }, [updateRichPresence]);
  return <>{children}</>;
}

const RootRoute = () => {
  if (isPublishedHost()) return <Index />;
  const choice = getLandingVariant();
  if (choice === "/landing") return <LandingDiscordUpdater><Landing /></LandingDiscordUpdater>;
  return <Navigate to={choice} replace />;
};

const isOAuthConsentPath = () =>
  typeof window !== "undefined" && window.location.pathname === "/.lovable/oauth/consent";

const OAuthConsentShell = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <OAuthConsent />
        </TooltipProvider>
      </ThemeProvider>
    </AuthProvider>
  </QueryClientProvider>
);

const App = () => isOAuthConsentPath() ? <OAuthConsentShell /> : (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ThemeProvider>
        <OnboardingProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <OfflineDialog />
          <InboxNotifier />
          <OnboardingManager />
          <PresenceTrackerMount />
          <DiscordProvider>
          <BrowserRouter basename={getGitHubPagesBasename()}>
            <Routes>
              <Route path="/" element={<RootRoute />} />
              <Route path="/landing" element={<LandingDiscordUpdater><Landing /></LandingDiscordUpdater>} />
              <Route path="/landing/living-grid" element={<LandingDiscordUpdater><LivingGrid /></LandingDiscordUpdater>} />
              <Route path="/landing/terminal-boot" element={<LandingDiscordUpdater><TerminalBoot /></LandingDiscordUpdater>} />
              <Route path="/landing/the-void" element={<LandingDiscordUpdater><TheVoid /></LandingDiscordUpdater>} />
              <Route path="/landing/monochrome" element={<LandingDiscordUpdater><MonochromePrecision /></LandingDiscordUpdater>} />
              <Route path="/landing/warm-momentum" element={<LandingDiscordUpdater><WarmMomentum /></LandingDiscordUpdater>} />
              <Route path="/landing/terminal-verdict" element={<LandingDiscordUpdater><TerminalVerdict /></LandingDiscordUpdater>} />
              <Route path="/home" element={<Index />} />
              <Route path="/editor" element={<Index />} />
              <Route path="/project/:projectId" element={<Index />} />
              <Route path="/docs" element={<Docs />} />
              <Route path="/docs/:slug" element={<Docs />} />
              <Route path="/profile/:userId" element={<ProfilePage />} />
              <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
              <Route path="/terms-of-use" element={<TermsOfUsePage />} />
              <Route path="/compare" element={<Compare />} />
              <Route path="/FTC" element={<FTCPage />} />
              <Route path="/ftc" element={<FTCPage />} />
              <Route path="/ardurino" element={<ArduinoPage />} />
              <Route path="/arduino" element={<ArduinoPage />} />
              <Route path="/office" element={<OfficePage />} />
              <Route path="/automations" element={<AutomationsPage />} />
              <Route path="/scratch" element={<ScratchPage />} />
              <Route path="/cad" element={<CadPage />} />
              <Route path="/auth-bridge" element={<AuthBridge />} />
              <Route path="/auth-link" element={<AuthLink />} />
              <Route path="/auth-logout" element={<AuthLogout />} />
              <Route path="/auth-callback" element={<AuthCallback />} />
              <Route path="/auth/external-oauth" element={<ExternalOAuth />} />
              <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/link-discord" element={<LinkDiscord />} />
              <Route path="/admin/oauth-hosts" element={<OAuthHostsAdmin />} />
              <Route path="/admin/online-users" element={<OnlineUsersAdmin />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/usage" element={<UsageAnalytics />} />
              <Route path="/oauth-apps" element={<OAuthAppsPublic />} />
              <Route path="/mcp" element={<MCP />} />
              {/* Redactor routes — public */}
              <Route path="/redactor" element={<RedactorLanding />} />
              <Route path="/redactor/auth" element={<RedactorAuth />} />
              {/* Redactor routes — authenticated (layout provides sidebar + auth guard) */}
              <Route element={<RedactorAuthenticatedLayout />}>
                <Route path="/redactor/dashboard" element={<RedactorDashboard />} />
                <Route path="/redactor/playground" element={<RedactorPlayground />} />
                <Route path="/redactor/provider-keys" element={<RedactorProviderKeys />} />
                <Route path="/redactor/proxy-keys" element={<RedactorProxyKeys />} />
                <Route path="/redactor/routers" element={<RedactorRouters />} />
                <Route path="/redactor/rules" element={<RedactorRules />} />
                <Route path="/redactor/logs" element={<RedactorLogs />} />
              </Route>
              {/* Threads routes */}
              <Route path="/threads" element={<ThreadsLayout />}>
                <Route index element={<ThreadsList />} />
                <Route path="new" element={<CreateThread />} />
                <Route path="whiteboard" element={<GlobalWhiteboard />} />
                <Route path="__card-preview" element={<CardPreview />} />
                <Route path=":id" element={<ThreadDetail />} />
              </Route>
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
          </DiscordProvider>
        </TooltipProvider>
        </OnboardingProvider>
      </ThemeProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
